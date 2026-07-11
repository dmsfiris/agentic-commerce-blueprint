import {
  AGENT_COMMERCE_DECISION_DEFAULT_AUTHENTICATOR_KEY_ID,
  AGENT_COMMERCE_DECISION_DEFAULT_RULE_SET_VERSION,
  AGENT_COMMERCE_DECISION_DEFAULT_VERIFICATION_KEY_REF,
  AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION,
  AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION,
  agentCommerceDecisionActionRule,
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

  const reasonSet = new Set(envelope.basis.reasonCodes);
  const componentSet = new Set(
    envelope.basis.components.map((component) => component.code),
  );
  if (
    reasonSet.size !== componentSet.size ||
    [...reasonSet].some((reasonCode) => !componentSet.has(reasonCode))
  ) {
    reasonCodes.push('basis_reason_component_mismatch');
  }

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

  return { valid: reasonCodes.length === 0, reasonCodes };
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

  const hashInput = {
    contractVersion: AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION,
    envelopeSchemaVersion: AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION,
    ...(input.surface ? { surface: input.surface } : {}),
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

  const decisionId =
    text(input.decisionId) ?? `decision_${hashes.decisionHash.slice(0, 24)}`;
  return deepFreeze({
    ...hashInput,
    decisionId,
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
      const owner = ['system', 'operator', 'buyer', 'merchant'].includes(
        entry.owner,
      )
        ? entry.owner
        : 'operator';
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
