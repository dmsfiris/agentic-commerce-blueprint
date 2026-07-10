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
import {
  evaluateAgentCommerceDecisionBasis,
} from './decision-basis.mjs';
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

export function buildAgentCommerceDecisionEnvelope(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }

  const requestedAction = input.requestedAction ?? input.action;
  agentCommerceDecisionActionRule(requestedAction);
  const evaluatedAt = iso(input.evaluatedAt);
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
  const payment = normalizePayment(input.payment, eligibility, authority, checkout);
  const generatedClaims = normalizeGeneratedClaims(input.generatedClaims);
  const subject = normalizeSubject(input.subject);
  const actor = normalizeActor(input.actor);
  const inputRefs = normalizeInputRefs(input.inputRefs);
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs);

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
  const nextSafeActions = normalizeNextSafeActions(input.nextSafeActions);

  const inputDependencyHash = stableCommercialJsonHash({
    requestedAction,
    subject,
    actor,
    inputRefs: inputRefs ?? null,
    ruleSetRef,
    ruleSetHash,
    evaluatedAt,
    evidencePins: evidenceRefs.map((ref) => ({
      type: ref.type,
      id: ref.id,
      hash: ref.hash,
      hashAlgorithm: ref.hashAlgorithm,
    })),
    freshnessDependencies: freshness.dependencies,
  });

  const resultHash = stableCommercialJsonHash({
    eligibility,
    authority,
    checkout: checkout ?? null,
    payment: payment ?? null,
    generatedClaims: generatedClaims ?? null,
    basis,
    nextSafeActions,
  });

  const decisionHash = stableCommercialJsonHash({
    contractVersion: AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION,
    envelopeSchemaVersion: AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION,
    inputDependencyHash,
    resultHash,
  });

  const authenticator = createDecisionEnvelopeAuthenticator({
    decisionHash,
    envelopeSchemaVersion: AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION,
    keyId: authenticatorKeyId,
    verificationKeyRef,
    ruleSetHash,
    signingSecret: input.signingSecret,
    signingPrivateKeyPem: input.signingPrivateKeyPem,
  });

  const decisionId = text(input.decisionId) ?? `decision_${decisionHash.slice(0, 24)}`;
  return deepFreeze({
    contractVersion: AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION,
    envelopeSchemaVersion: AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION,
    decisionId,
    decisionHash,
    inputDependencyHash,
    resultHash,
    evaluatedAt,
    ruleSetVersion,
    ruleSetRef,
    ruleSetHash,
    authenticator,
    freshness,
    basis,
    ...(input.surface ? { surface: input.surface } : {}),
    subject,
    actor,
    requestedAction,
    ...(inputRefs ? { inputRefs } : {}),
    eligibility,
    authority,
    ...(checkout ? { checkout } : {}),
    ...(payment ? { payment } : {}),
    ...(generatedClaims ? { generatedClaims } : {}),
    evidenceRefs,
    nextSafeActions,
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
      const owner = ['system', 'operator', 'buyer', 'merchant'].includes(entry.owner)
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
