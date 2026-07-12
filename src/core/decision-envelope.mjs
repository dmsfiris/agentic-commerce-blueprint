import {
  AGENT_COMMERCE_DECISION_ACTOR_TYPES,
  AGENT_COMMERCE_DECISION_AUTHORITY_RESULTS,
  AGENT_COMMERCE_DECISION_DEFAULT_AUTHENTICATOR_KEY_ID,
  AGENT_COMMERCE_DECISION_DEFAULT_RULE_SET_VERSION,
  AGENT_COMMERCE_DECISION_DEFAULT_VERIFICATION_KEY_REF,
  AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS,
  AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES,
  AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION,
  AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION,
  AGENT_COMMERCE_DECISION_NEXT_SAFE_ACTION_OWNERS,
  AGENT_COMMERCE_DECISION_PAYMENT_AUTHORITY_RESULTS,
  AGENT_COMMERCE_DECISION_SURFACES,
  agentCommerceDecisionActionRule,
  uniqueAgentCommerceReasonCodes,
} from './actions.mjs';
import {
  createDecisionEnvelopeAuthenticator,
  verifyDecisionEnvelopeAuthenticator,
} from './authenticator.mjs';
import { stableCommercialJsonHash } from './hash.mjs';
import { normalizeEvidenceRefs } from './evidence.mjs';
import { normalizeFreshness } from './freshness.mjs';
import { evaluateAgentCommerceDecisionBasis } from './decision-basis.mjs';
import { deepFreeze, iso, text } from './text.mjs';
import {
  normalizeActor,
  normalizeAuthority,
  normalizeCheckout,
  normalizeEligibility,
  normalizeGeneratedClaims,
  normalizeInputRefs,
  normalizePayment,
  normalizeSubject,
} from './normalizers.mjs';

function sha256HashFromRef(value) {
  const normalized = text(value)?.toLowerCase();
  if (!normalized) return null;
  if (/^[a-f0-9]{64}$/u.test(normalized)) return normalized;
  const match = /(?:^|[:/])sha256[:/]([a-f0-9]{64})(?:$|[/:#?])/u.exec(
    `${normalized}:`,
  );
  return match?.[1] ?? null;
}

export function canonicalRuleSetRef({ ruleSetVersion, ruleSetRef }) {
  const explicitRef = text(ruleSetRef);
  const ruleSetHash =
    sha256HashFromRef(explicitRef) ??
    stableCommercialJsonHash({
      ruleSetVersion,
      ruleSetRef: explicitRef ?? null,
    });
  const contentAddressedRef =
    explicitRef && explicitRef.toLowerCase().includes(ruleSetHash)
      ? explicitRef
      : `ruleset:sha256:${ruleSetHash}`;
  return { ruleSetRef: contentAddressedRef, ruleSetHash };
}

function inputDependencyHash(envelope) {
  return stableCommercialJsonHash({
    decisionId: envelope.decisionId,
    surface: envelope.surface ?? null,
    requestedAction: envelope.requestedAction,
    subject: envelope.subject,
    actor: envelope.actor,
    inputRefs: envelope.inputRefs ?? null,
    ruleSetVersion: envelope.ruleSetVersion,
    ruleSetRef: envelope.ruleSetRef,
    ruleSetHash: envelope.ruleSetHash,
    evaluatedAt: envelope.evaluatedAt,
    evidencePins: envelope.evidenceRefs.map((ref) => ({
      type: ref.type,
      id: ref.id,
      hash: ref.hash,
      hashAlgorithm: ref.hashAlgorithm,
    })),
    freshnessDependencies: envelope.freshness.dependencies,
  });
}

function resultHash(envelope) {
  return stableCommercialJsonHash({
    eligibility: envelope.eligibility,
    authority: envelope.authority,
    checkout: envelope.checkout ?? null,
    payment: envelope.payment ?? null,
    generatedClaims: envelope.generatedClaims ?? null,
    freshness: {
      evaluatedAt: envelope.freshness.evaluatedAt,
      validUntil: envelope.freshness.validUntil,
      staleAfter: envelope.freshness.staleAfter,
      reasonCodes: envelope.freshness.reasonCodes,
    },
    basis: envelope.basis,
    nextSafeActions: envelope.nextSafeActions,
  });
}

export function calculateAgentCommerceDecisionEnvelopeHashes(envelope) {
  const calculatedInputDependencyHash = inputDependencyHash(envelope);
  const calculatedResultHash = resultHash(envelope);
  return {
    inputDependencyHash: calculatedInputDependencyHash,
    resultHash: calculatedResultHash,
    decisionHash: stableCommercialJsonHash({
      contractVersion: envelope.contractVersion,
      envelopeSchemaVersion: envelope.envelopeSchemaVersion,
      inputDependencyHash: calculatedInputDependencyHash,
      resultHash: calculatedResultHash,
    }),
  };
}

function blockers(value) {
  return Array.isArray(value) ? value : [];
}

function validResult(value, allowedValues) {
  return allowedValues.includes(value);
}

export function evaluateAgentCommerceDecisionEnvelopeSemantics(envelope) {
  const reasonCodes = [];
  if (!text(envelope?.decisionId)) reasonCodes.push('decision_id_missing');
  if (
    envelope?.surface != null &&
    !AGENT_COMMERCE_DECISION_SURFACES.includes(envelope.surface)
  ) {
    reasonCodes.push('surface_invalid');
  }
  if (!AGENT_COMMERCE_DECISION_ACTOR_TYPES.includes(envelope?.actor?.actorType)) {
    reasonCodes.push('actor_type_invalid');
  }

  try {
    agentCommerceDecisionActionRule(envelope?.requestedAction);
  } catch {
    reasonCodes.push('requested_action_invalid');
  }

  const eligibilityResult = envelope?.eligibility?.result;
  const eligibilityBlockers = blockers(envelope?.eligibility?.blockerCodes);
  if (
    !validResult(
      eligibilityResult,
      AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS,
  AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES,
    )
  ) {
    reasonCodes.push('eligibility_result_invalid');
  } else if (
    eligibilityBlockers.length > 0 &&
    eligibilityResult !== 'blocked'
  ) {
    reasonCodes.push('eligibility_blocker_conflict');
  }
  if (
    !AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES.includes(
      envelope?.eligibility?.source,
    )
  ) {
    reasonCodes.push('eligibility_source_invalid');
  }

  const authorityResult = envelope?.authority?.result;
  const authorityBlockers = blockers(envelope?.authority?.blockerCodes);
  if (
    !validResult(authorityResult, AGENT_COMMERCE_DECISION_AUTHORITY_RESULTS)
  ) {
    reasonCodes.push('authority_result_invalid');
  } else if (authorityBlockers.length > 0 && authorityResult !== 'blocked') {
    reasonCodes.push('authority_blocker_conflict');
  }

  const checkoutBlockers = blockers(envelope?.checkout?.blockerCodes);
  if (
    envelope?.checkout?.validForRequestedAction === true &&
    checkoutBlockers.length > 0
  ) {
    reasonCodes.push('checkout_blocker_conflict');
  }

  const paymentResult = envelope?.payment?.authorityResult;
  const paymentBlockers = blockers(envelope?.payment?.blockerCodes);
  if (
    envelope?.payment &&
    !validResult(
      paymentResult,
      AGENT_COMMERCE_DECISION_PAYMENT_AUTHORITY_RESULTS,
  AGENT_COMMERCE_DECISION_SURFACES,
    )
  ) {
    reasonCodes.push('payment_authority_result_invalid');
  } else if (
    envelope?.payment &&
    paymentBlockers.length > 0 &&
    paymentResult !== 'blocked'
  ) {
    reasonCodes.push('payment_blocker_conflict');
  }

  const dispatchAllowed =
    eligibilityResult === 'allowed' &&
    authorityResult !== 'blocked' &&
    (envelope?.checkout?.validForRequestedAction ?? true) &&
    paymentResult === 'allowed' &&
    paymentBlockers.length === 0;
  if (
    envelope?.payment?.paymentDispatchAttempted === true &&
    !dispatchAllowed
  ) {
    reasonCodes.push('payment_dispatch_semantic_conflict');
  }

  if (envelope?.freshness?.evaluatedAt !== envelope?.evaluatedAt) {
    reasonCodes.push('freshness_evaluation_time_mismatch');
  }
  if (
    envelope?.basis?.allowed === true &&
    blockers(envelope?.freshness?.reasonCodes).length > 0
  ) {
    reasonCodes.push('allowed_with_freshness_blockers');
  }
  if (
    (envelope?.nextSafeActions ?? []).some(
      (entry) =>
        !AGENT_COMMERCE_DECISION_NEXT_SAFE_ACTION_OWNERS.includes(entry.owner),
    )
  ) {
    reasonCodes.push('next_safe_action_owner_invalid');
  }

  try {
    const expectedRuleSet = canonicalRuleSetRef({
      ruleSetVersion: envelope?.ruleSetVersion,
      ruleSetRef: envelope?.ruleSetRef,
    });
    if (
      expectedRuleSet.ruleSetRef !== envelope?.ruleSetRef ||
      expectedRuleSet.ruleSetHash !== envelope?.ruleSetHash
    ) {
      reasonCodes.push('rule_set_identity_mismatch');
    }
  } catch {
    reasonCodes.push('rule_set_identity_invalid');
  }

  try {
    const expectedBasis = evaluateAgentCommerceDecisionBasis({
      requestedAction: envelope.requestedAction,
      eligibility: envelope.eligibility,
      authority: envelope.authority,
      checkout: envelope.checkout,
      payment: envelope.payment,
      generatedClaims: envelope.generatedClaims,
    });
    if (
      stableCommercialJsonHash(expectedBasis) !==
      stableCommercialJsonHash(envelope.basis)
    ) {
      reasonCodes.push('basis_semantic_mismatch');
    }
  } catch {
    reasonCodes.push('basis_semantic_evaluation_failed');
  }

  return {
    valid: reasonCodes.length === 0,
    reasonCodes: uniqueAgentCommerceReasonCodes(reasonCodes),
  };
}

export function evaluateAgentCommerceDecisionEnvelopeIntegrity({
  envelope,
  signingSecret,
  verificationPublicKeyPem,
  allowUnsignedLocalDevelopment = false,
}) {
  const reasonCodes = [];
  if (
    envelope.contractVersion !==
    AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION
  ) {
    reasonCodes.push('contract_version_mismatch');
  }
  if (
    envelope.envelopeSchemaVersion !==
    AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION
  ) {
    reasonCodes.push('envelope_schema_version_mismatch');
  }

  try {
    const hashes = calculateAgentCommerceDecisionEnvelopeHashes(envelope);
    if (hashes.inputDependencyHash !== envelope.inputDependencyHash) {
      reasonCodes.push('input_dependency_hash_mismatch');
    }
    if (hashes.resultHash !== envelope.resultHash) {
      reasonCodes.push('result_hash_mismatch');
    }
    if (hashes.decisionHash !== envelope.decisionHash) {
      reasonCodes.push('decision_hash_mismatch');
    }
  } catch {
    reasonCodes.push('hash_recalculation_failed');
  }

  const reasonSet = new Set(envelope?.basis?.reasonCodes ?? []);
  const componentSet = new Set(
    (envelope?.basis?.components ?? []).map((component) => component.code),
  );
  if (
    reasonSet.size !== componentSet.size ||
    [...reasonSet].some((reasonCode) => !componentSet.has(reasonCode))
  ) {
    reasonCodes.push('basis_reason_component_mismatch');
  }

  const semantics = evaluateAgentCommerceDecisionEnvelopeSemantics(envelope);
  reasonCodes.push(...semantics.reasonCodes);

  if (
    !verifyDecisionEnvelopeAuthenticator({
      decisionHash: envelope.decisionHash,
      envelopeSchemaVersion: envelope.envelopeSchemaVersion,
      ruleSetHash: envelope.ruleSetHash,
      authenticator: envelope.authenticator,
      signingSecret,
      verificationPublicKeyPem,
      allowUnsignedLocalDevelopment,
    })
  ) {
    reasonCodes.push('authenticator_invalid');
  }

  const uniqueReasonCodes = uniqueAgentCommerceReasonCodes(reasonCodes);
  return {
    valid: uniqueReasonCodes.length === 0,
    reasonCodes: uniqueReasonCodes,
  };
}

export function buildAgentCommerceDecisionEnvelope(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }

  const requestedAction = input.requestedAction ?? input.action;
  agentCommerceDecisionActionRule(requestedAction);
  const evaluatedAt = iso(input.evaluatedAt, 'evaluatedAt');
  const ruleSetVersion =
    text(input.ruleSetVersion) ??
    AGENT_COMMERCE_DECISION_DEFAULT_RULE_SET_VERSION;
  const { ruleSetRef, ruleSetHash } = canonicalRuleSetRef({
    ruleSetVersion,
    ruleSetRef: input.ruleSetRef,
  });
  const authenticatorKeyId =
    text(input.authenticatorKeyId) ??
    AGENT_COMMERCE_DECISION_DEFAULT_AUTHENTICATOR_KEY_ID;
  const verificationKeyRef =
    text(input.verificationKeyRef) ??
    AGENT_COMMERCE_DECISION_DEFAULT_VERIFICATION_KEY_REF;
  const surface = text(input.surface);
  if (surface && !AGENT_COMMERCE_DECISION_SURFACES.includes(surface)) {
    throw new TypeError(
      `surface must be one of ${AGENT_COMMERCE_DECISION_SURFACES.join(', ')}.`,
    );
  }

  const eligibility = normalizeEligibility(input.eligibility);
  const authority = normalizeAuthority(input.authority);
  const checkout = normalizeCheckout(input.checkout);
  const payment = normalizePayment(
    input.payment,
    eligibility,
    authority,
    checkout,
  );
  const generatedClaims = normalizeGeneratedClaims(input.generatedClaims);
  const subject = normalizeSubject(input.subject);
  const actor = normalizeActor(input.actor);
  const inputRefs = normalizeInputRefs(input.inputRefs);
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs);
  const nextSafeActions = normalizeNextSafeActions(input.nextSafeActions);

  const basis = evaluateAgentCommerceDecisionBasis({
    requestedAction,
    eligibility,
    authority,
    checkout,
    payment,
    generatedClaims,
  });
  const freshness = normalizeFreshness({
    freshness: input.freshness,
    evaluatedAt,
    inputRefs,
    evidenceRefs,
    generatedClaims,
    basis,
  });
  if (basis.allowed && freshness.reasonCodes.length > 0) {
    throw new TypeError(
      'An allowed decision cannot carry freshness blocker reason codes.',
    );
  }

  const unprotectedInput = {
    contractVersion: AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION,
    envelopeSchemaVersion: AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION,
    ...(surface ? { surface } : {}),
    subject,
    actor,
    requestedAction,
    ...(inputRefs ? { inputRefs } : {}),
    evaluatedAt,
    ruleSetVersion,
    ruleSetRef,
    ruleSetHash,
    eligibility,
    authority,
    ...(checkout ? { checkout } : {}),
    ...(payment ? { payment } : {}),
    ...(generatedClaims ? { generatedClaims } : {}),
    freshness,
    basis,
    evidenceRefs,
    nextSafeActions,
  };
  const decisionId =
    text(input.decisionId) ??
    `decision_${stableCommercialJsonHash(unprotectedInput).slice(0, 24)}`;
  const {
    contractVersion,
    envelopeSchemaVersion,
    ...decisionFields
  } = unprotectedInput;
  const hashInput = {
    contractVersion,
    envelopeSchemaVersion,
    decisionId,
    ...decisionFields,
  };
  const hashes = calculateAgentCommerceDecisionEnvelopeHashes(hashInput);
  const authenticator = createDecisionEnvelopeAuthenticator({
    decisionHash: hashes.decisionHash,
    envelopeSchemaVersion: AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION,
    keyId: authenticatorKeyId,
    verificationKeyRef,
    ruleSetHash,
    signingSecret: input.signingSecret,
    signingPrivateKeyPem: input.signingPrivateKeyPem,
  });

  return deepFreeze({
    ...hashInput,
    decisionHash: hashes.decisionHash,
    inputDependencyHash: hashes.inputDependencyHash,
    resultHash: hashes.resultHash,
    authenticator,
  });
}

export const buildDecisionEnvelope = buildAgentCommerceDecisionEnvelope;
export { verifyDecisionEnvelopeAuthenticator };

function normalizeNextSafeActions(values) {
  const actions = (values ?? [])
    .map((entry) => {
      const action = text(entry.action);
      const reasonCode = text(entry.reasonCode)?.toLowerCase();
      if (!action || !reasonCode) return null;
      const owner = entry.owner ?? 'operator';
      if (!AGENT_COMMERCE_DECISION_NEXT_SAFE_ACTION_OWNERS.includes(owner)) {
        throw new TypeError(
          `nextSafeActions.owner must be one of ${AGENT_COMMERCE_DECISION_NEXT_SAFE_ACTION_OWNERS.join(', ')}.`,
        );
      }
      return { action, owner, reasonCode };
    })
    .filter(Boolean);
  return Array.from(
    new Map(
      actions.map((entry) => [
        `${entry.owner}:${entry.action}:${entry.reasonCode}`,
        entry,
      ]),
    ).values(),
  ).sort((left, right) =>
    `${left.owner}:${left.action}:${left.reasonCode}`.localeCompare(
      `${right.owner}:${right.action}:${right.reasonCode}`,
    ),
  );
}
