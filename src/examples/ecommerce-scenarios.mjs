import {
  buildAgentCommerceDecisionEnvelope,
  evaluateAgentCommerceDecisionExecution,
  projectTrustedAgentCommerceDecisionEnvelope,
  sha256Hex,
} from '../index.mjs';
import { evaluateEcommerceScenarioFacts } from './ecommerce-domain-rules.mjs';

const EVALUATED_AT = '2026-07-14T12:00:00.000Z';
const VALID_UNTIL = '2026-07-14T13:00:00.000Z';
const NOW = new Date('2026-07-14T12:05:00.000Z');
const SIGNING_SECRET = 'scenario-demo-secret-not-for-production';

export const ECOMMERCE_SCENARIO_IDS = Object.freeze([
  'price_change_before_checkout',
  'promotion_eligibility_conflict',
  'inventory_exhaustion',
  'delegated_spending_limit_exceeded',
  'unsupported_generated_claim',
  'delivery_promise_stale',
  'return_policy_conflict',
  'verified_state_identity',
]);

const ACTOR = Object.freeze({
  actorType: 'agent',
  agentId: 'agent:ecommerce-evaluation',
  merchantId: 'merchant:reference',
});

const PASSED_AXES = Object.freeze({
  source: { status: 'passed', blockerCodes: [] },
  freshness: { status: 'passed', blockerCodes: [] },
  scope: { status: 'passed', blockerCodes: [] },
  surface: { status: 'passed', blockerCodes: [] },
  use: { status: 'passed', blockerCodes: [] },
  payload: { status: 'passed', blockerCodes: [] },
  taint: { status: 'passed', blockerCodes: [] },
});

function clone(value) {
  return structuredClone(value);
}

function dependencyRef(type, id) {
  return `${type}:${id}`;
}

function evidence(type, id, value) {
  return { type, id, hash: sha256Hex(value) };
}

function actorAndSubject(id, checkout = true) {
  return {
    actor: ACTOR,
    subject: {
      productId: 'product:travel-backpack',
      ...(checkout
        ? {
            checkoutId: `checkout:${id}`,
            mandateId: `mandate:${id}`,
          }
        : {}),
    },
  };
}

function allowedClaim(id, claimText, allowedUse) {
  return {
    allowed: true,
    status: 'allowed',
    claimIds: [`claim:${id}`],
    sourceFactRefs: [`fact:${id}`],
    derivedFactRefs: [`approved_value_hash:${sha256Hex(claimText)}`],
    allowedUses: [allowedUse],
    inheritedRefusalCount: 0,
    blockerCodes: [],
    axes: clone(PASSED_AXES),
  };
}

function blockedClaim(id, status, blockerCode, failedAxis) {
  const axes = clone(PASSED_AXES);
  axes[failedAxis] = { status: 'failed', blockerCodes: [blockerCode] };
  return {
    allowed: false,
    status,
    claimIds: [`claim:${id}`],
    sourceFactRefs: [`fact:${id}`],
    derivedFactRefs: [],
    allowedUses: [],
    inheritedRefusalCount: 0,
    blockerCodes: [blockerCode],
    axes,
  };
}

function checkoutInput({
  id,
  surface,
  factType,
  factId,
  fact,
  phase,
  outcome,
}) {
  const { actor, subject } = actorAndSubject(id, true);
  const blocked = outcome.blocked;
  const authorityBlocked = outcome.authorityBlocked;
  const blockerCode = outcome.blockerCode;
  return {
    decisionId: `decision:${id}:${phase}:${surface}`,
    evaluatedAt: EVALUATED_AT,
    surface,
    requestedAction: 'complete_checkout',
    subject,
    actor,
    signingSecret: SIGNING_SECRET,
    authenticatorKeyId: 'scenario-hmac-key',
    verificationKeyRef: 'shared-secret:scenario-hmac-key',
    inputRefs: {
      productRef: 'product:travel-backpack:v1',
      policyRef: 'policy:checkout:v1',
      checkoutRef: `${subject.checkoutId}:revision:1`,
      paymentRef: 'payment:reference:v1',
      authorityRef: `${subject.mandateId}:revision:1`,
    },
    eligibility: authorityBlocked
      ? { result: 'allowed', source: 'combined', blockerCodes: [] }
      : blocked
        ? { result: 'blocked', source: 'combined', blockerCodes: [blockerCode] }
        : { result: 'allowed', source: 'combined', blockerCodes: [] },
    authority: authorityBlocked
      ? { result: 'blocked', blockerCodes: [blockerCode] }
      : { result: 'allowed', blockerCodes: [] },
    checkout: blocked && !authorityBlocked
      ? {
          state: 'requires_revalidation',
          validForRequestedAction: false,
          blockerCodes: [blockerCode],
        }
      : {
          state: 'requires_payment',
          validForRequestedAction: true,
          blockerCodes: [],
        },
    payment: blocked
      ? {
          paymentDispatchAttempted: false,
          authorityResult: 'not_evaluated',
          blockerCodes: [],
        }
      : {
          paymentDispatchAttempted: false,
          authorityResult: 'allowed',
          blockerCodes: [],
        },
    evidenceRefs: [evidence(factType, factId, fact)],
    freshness: {
      validUntil: VALID_UNTIL,
      staleAfter: VALID_UNTIL,
      dependencies: [
        {
          kind: factType.includes('price')
            ? 'price'
            : factType.includes('inventory')
              ? 'inventory'
              : factType.includes('mandate')
                ? 'mandate'
                : 'policy',
          ref: dependencyRef(factType, factId),
          hash: sha256Hex(fact),
          validUntil: VALID_UNTIL,
          staleAfter: VALID_UNTIL,
        },
      ],
    },
    nextSafeActions: blocked
      ? [
          {
            action: 'produce_fresh_decision',
            owner: authorityBlocked ? 'buyer' : 'system',
            reasonCode: blockerCode,
          },
        ]
      : [],
  };
}

function claimInput({
  id,
  surface,
  factType,
  factId,
  fact,
  requestedAction,
  allowedUse,
  phase,
  outcome,
}) {
  const { actor, subject } = actorAndSubject(id, false);
  const dependencyKind = factType.includes('delivery')
    ? 'checkout'
    : factType.includes('return')
      ? 'policy'
      : 'evidence';
  const claimText = fact.text;
  return {
    decisionId: `decision:${id}:${phase}:${surface}`,
    evaluatedAt: EVALUATED_AT,
    surface,
    requestedAction,
    subject,
    actor,
    signingSecret: SIGNING_SECRET,
    authenticatorKeyId: 'scenario-hmac-key',
    verificationKeyRef: 'shared-secret:scenario-hmac-key',
    inputRefs: {
      productRef: 'product:travel-backpack:v1',
      ...(dependencyKind === 'policy' ? { policyRef: 'policy:returns:v1' } : {}),
    },
    eligibility: { result: 'allowed', source: dependencyKind === 'policy' ? 'policy' : 'product', blockerCodes: [] },
    authority: { result: 'not_required', blockerCodes: [] },
    generatedClaims: outcome.blocked
      ? blockedClaim(
          id,
          outcome.claimStatus,
          outcome.blockerCode,
          outcome.failedAxis,
        )
      : allowedClaim(id, claimText, allowedUse),
    evidenceRefs: [evidence(factType, factId, fact)],
    freshness: {
      validUntil: VALID_UNTIL,
      staleAfter: VALID_UNTIL,
      dependencies: [
        {
          kind: dependencyKind,
          ref: dependencyRef(factType, factId),
          hash: sha256Hex(fact),
          validUntil: VALID_UNTIL,
          staleAfter: VALID_UNTIL,
        },
      ],
    },
    nextSafeActions: outcome.blocked
      ? [
          {
            action: 'produce_fresh_decision',
            owner: 'system',
            reasonCode: outcome.blockerCode,
          },
        ]
      : [],
  };
}

const SCENARIOS = Object.freeze([
  {
    id: 'price_change_before_checkout',
    title: 'Price changes before checkout completion',
    surfaces: ['checkout', 'tool', 'protocol'],
    target: { kind: 'price', ref: dependencyRef('price_snapshot', 'price:travel-backpack') },
    initialFact: { amountMinor: 8_000, currency: 'EUR', version: 1 },
    changedFact: { amountMinor: 9_500, currency: 'EUR', version: 2 },
    input({ surface, fact, phase, outcome }) {
      return checkoutInput({ id: this.id, surface, factType: 'price_snapshot', factId: 'price:travel-backpack', fact, phase, outcome });
    },
  },
  {
    id: 'promotion_eligibility_conflict',
    title: 'Promotion becomes ineligible',
    surfaces: ['checkout', 'tool', 'protocol'],
    target: { kind: 'policy', ref: dependencyRef('promotion_policy', 'promotion:summer') },
    initialFact: { eligible: true, region: 'EU', version: 1 },
    changedFact: { eligible: false, region: 'EU', version: 2 },
    input({ surface, fact, phase, outcome }) {
      return checkoutInput({ id: this.id, surface, factType: 'promotion_policy', factId: 'promotion:summer', fact, phase, outcome });
    },
  },
  {
    id: 'inventory_exhaustion',
    title: 'Inventory is exhausted after the decision',
    surfaces: ['checkout', 'tool', 'protocol'],
    target: { kind: 'inventory', ref: dependencyRef('inventory_snapshot', 'inventory:travel-backpack') },
    initialFact: { available: 4, version: 1 },
    changedFact: { available: 0, version: 2 },
    input({ surface, fact, phase, outcome }) {
      return checkoutInput({ id: this.id, surface, factType: 'inventory_snapshot', factId: 'inventory:travel-backpack', fact, phase, outcome });
    },
  },
  {
    id: 'delegated_spending_limit_exceeded',
    title: 'Checkout total exceeds delegated authority',
    surfaces: ['checkout', 'tool', 'protocol'],
    target: { kind: 'mandate', ref: dependencyRef('mandate_snapshot', 'mandate:checkout-limit') },
    initialFact: { maximumMinor: 10_000, totalMinor: 8_800, currency: 'EUR', version: 1 },
    changedFact: { maximumMinor: 10_000, totalMinor: 11_200, currency: 'EUR', version: 2 },
    input({ surface, fact, phase, outcome }) {
      return checkoutInput({ id: this.id, surface, factType: 'mandate_snapshot', factId: 'mandate:checkout-limit', fact, phase, outcome });
    },
  },
  {
    id: 'unsupported_generated_claim',
    title: 'Generated product claim loses supporting evidence',
    surfaces: ['feed', 'tool', 'support'],
    target: { kind: 'evidence', ref: dependencyRef('claim_evidence', 'claim:water-resistance') },
    initialFact: { text: 'Water resistant to the documented IPX4 test', evidenceAvailable: true, sourceVersion: 1 },
    changedFact: { text: 'No current test evidence is available', evidenceAvailable: false, sourceVersion: 2 },
    input({ surface, fact, phase, outcome }) {
      return claimInput({ id: this.id, surface, factType: 'claim_evidence', factId: 'claim:water-resistance', fact, requestedAction: 'show_generated_claim', allowedUse: 'discovery', phase, outcome });
    },
  },
  {
    id: 'delivery_promise_stale',
    title: 'Delivery promise becomes stale',
    surfaces: ['feed', 'tool', 'support'],
    target: { kind: 'checkout', ref: dependencyRef('delivery_snapshot', 'delivery:travel-backpack') },
    initialFact: { text: 'Delivery by 18 July 2026', validUntil: '2026-07-14T13:00:00.000Z', promiseVersion: 1 },
    changedFact: { text: 'Delivery date requires recalculation', validUntil: '2026-07-14T12:01:00.000Z', promiseVersion: 2 },
    input({ surface, fact, phase, outcome }) {
      return claimInput({ id: this.id, surface, factType: 'delivery_snapshot', factId: 'delivery:travel-backpack', fact, requestedAction: 'show_generated_claim', allowedUse: 'discovery', phase, outcome });
    },
  },
  {
    id: 'return_policy_conflict',
    title: 'Return request conflicts with the current policy',
    surfaces: ['feed', 'tool', 'support'],
    target: { kind: 'policy', ref: dependencyRef('return_policy', 'returns:travel-backpack') },
    initialFact: { text: 'Returns accepted within 30 days', returnRequested: true, returnable: true, policyVersion: 1 },
    changedFact: { text: 'This promotional item is non-returnable', returnRequested: true, returnable: false, policyVersion: 2 },
    input({ surface, fact, phase, outcome }) {
      return claimInput({ id: this.id, surface, factType: 'return_policy', factId: 'returns:travel-backpack', fact, requestedAction: 'quote_policy', allowedUse: 'support', phase, outcome });
    },
  },
]);

function expectedRequest(envelope) {
  return {
    requestedAction: envelope.requestedAction,
    subject: envelope.subject,
    actor: envelope.actor,
  };
}

function project(envelope, surface) {
  return projectTrustedAgentCommerceDecisionEnvelope(envelope, surface, {
    signingSecret: SIGNING_SECRET,
    allowHmac: true,
    trustedKeyId: 'scenario-hmac-key',
    trustedVerificationKeyRef: 'shared-secret:scenario-hmac-key',
    expectedRequest: expectedRequest(envelope),
    now: NOW,
  });
}

function currentDependencies(envelope) {
  return envelope.freshness.dependencies.map((entry) => ({ ...entry }));
}

function runScenario(definition) {
  const initialOutcome = evaluateEcommerceScenarioFacts({
    scenarioId: definition.id,
    baselineFact: definition.initialFact,
    currentFact: definition.initialFact,
    now: NOW,
  });
  const changedOutcome = evaluateEcommerceScenarioFacts({
    scenarioId: definition.id,
    baselineFact: definition.initialFact,
    currentFact: definition.changedFact,
    now: NOW,
  });
  if (!initialOutcome.allowed || changedOutcome.allowed) {
    throw new Error(`scenario domain derivation is incoherent: ${definition.id}.`);
  }

  const initialEnvelopes = definition.surfaces.map((surface) =>
    buildAgentCommerceDecisionEnvelope(
      definition.input({
        surface,
        fact: definition.initialFact,
        phase: 'initial',
        outcome: initialOutcome,
      }),
    ),
  );
  const initialProjections = initialEnvelopes.map((envelope, index) =>
    project(envelope, definition.surfaces[index]),
  );
  const primary = initialEnvelopes[0];
  const baseline = evaluateAgentCommerceDecisionExecution({
    envelope: primary,
    currentDependencies: currentDependencies(primary),
    now: NOW,
  });
  const changedDependencies = currentDependencies(primary).map((entry) =>
    entry.kind === definition.target.kind && entry.ref === definition.target.ref
      ? { ...entry, hash: sha256Hex(definition.changedFact) }
      : entry,
  );
  const changed = evaluateAgentCommerceDecisionExecution({
    envelope: primary,
    currentDependencies: changedDependencies,
    now: NOW,
  });
  const refreshedProjections = definition.surfaces.map((surface) => {
    const envelope = buildAgentCommerceDecisionEnvelope(
      definition.input({
        surface,
        fact: definition.changedFact,
        phase: 'refreshed',
        outcome: changedOutcome,
      }),
    );
    return project(envelope, surface);
  });

  const initialStatuses = initialProjections.map((entry) => entry.status);
  const refreshedStatuses = refreshedProjections.map((entry) => entry.status);
  return Object.freeze({
    id: definition.id,
    title: definition.title,
    domainOutcomeDerived: true,
    domainRuleId: changedOutcome.ruleId,
    evaluatedFactFields: changedOutcome.evaluatedFields,
    initialDomainAllowed: initialOutcome.allowed,
    changedDomainAllowed: changedOutcome.allowed,
    derivedBlockerCode: changedOutcome.blockerCode,
    initialStatus: initialStatuses[0],
    baselinePermitted: baseline.permitted,
    changedStatePermitted: changed.permitted,
    requiresFreshDecision: changed.requiresFreshDecision,
    changedDependencyKinds: Object.freeze(
      [...new Set(changed.mismatches.map((entry) => entry.kind))].sort(),
    ),
    refreshedStatus: refreshedStatuses[0],
    refreshedReasonCodes: Object.freeze([...refreshedProjections[0].reasonCodes]),
    surfaceStatuses: Object.freeze(
      Object.fromEntries(
        definition.surfaces.map((surface, index) => [surface, refreshedStatuses[index]]),
      ),
    ),
    surfaceConsistent:
      new Set(initialStatuses).size === 1 && new Set(refreshedStatuses).size === 1,
    traceabilityComplete:
      Boolean(primary.decisionHash && primary.inputDependencyHash && primary.resultHash) &&
      primary.freshness.dependencies.some(
        (entry) => entry.kind === definition.target.kind && entry.ref === definition.target.ref,
      ),
    accessorReads: null,
  });
}

function runVerifiedStateIdentityScenario() {
  const common = {
    decisionId: 'decision:verified-state-identity:evaluation',
    evaluatedAt: EVALUATED_AT,
    surface: 'feed',
    requestedAction: 'discover',
    subject: { productId: 'product:verified-state-identity' },
    actor: ACTOR,
    signingSecret: SIGNING_SECRET,
    authenticatorKeyId: 'scenario-hmac-key',
    verificationKeyRef: 'shared-secret:scenario-hmac-key',
    freshness: { validUntil: VALID_UNTIL, staleAfter: VALID_UNTIL },
  };
  const blocked = buildAgentCommerceDecisionEnvelope({
    ...common,
    eligibility: { result: 'blocked', source: 'product', blockerCodes: ['product_not_discoverable'] },
    authority: { result: 'not_required', blockerCodes: [] },
  });
  const allowed = buildAgentCommerceDecisionEnvelope({
    ...common,
    decisionId: 'decision:verified-state-identity:allowed-control',
    eligibility: { result: 'allowed', source: 'product', blockerCodes: [] },
    authority: { result: 'not_required', blockerCodes: [] },
  });
  const live = structuredClone(blocked);
  const originalAuthenticator = live.authenticator;
  let accessorReads = 0;
  let drift = false;
  Object.defineProperty(live, 'authenticator', {
    enumerable: true,
    configurable: true,
    get() {
      accessorReads += 1;
      if (accessorReads >= 2) drift = true;
      return originalAuthenticator;
    },
  });
  Object.defineProperty(live, 'basis', {
    enumerable: true,
    configurable: true,
    get() {
      return drift ? allowed.basis : blocked.basis;
    },
  });
  const projection = project(live, 'feed');
  return Object.freeze({
    id: 'verified_state_identity',
    title: 'Runtime state changes after its first read',
    initialStatus: projection.status,
    baselinePermitted: false,
    changedStatePermitted: projection.allowed,
    requiresFreshDecision: false,
    changedDependencyKinds: Object.freeze([]),
    refreshedStatus: projection.status,
    refreshedReasonCodes: Object.freeze([...projection.reasonCodes]),
    surfaceStatuses: Object.freeze({ feed: projection.status }),
    surfaceConsistent: projection.status === 'blocked',
    traceabilityComplete: Boolean(projection.decisionHash && projection.inputDependencyHash && projection.resultHash),
    accessorReads,
  });
}

export function runEcommerceScenarios() {
  const results = Object.freeze([
    ...SCENARIOS.map(runScenario),
    runVerifiedStateIdentityScenario(),
  ]);
  return Object.freeze({
    scenarioCount: results.length,
    scenarioIds: Object.freeze(results.map((entry) => entry.id)),
    baselinePermittedCount: results.filter((entry) => entry.baselinePermitted).length,
    changedStatePreventedCount: results.filter((entry) => !entry.changedStatePermitted).length,
    refreshedSafeOutcomeCount: results.filter((entry) => entry.refreshedStatus !== 'allowed').length,
    derivedSafeOutcomeCount: results.filter(
      (entry) => entry.id === 'verified_state_identity' || entry.changedDomainAllowed === false,
    ).length,
    domainDerivedScenarioCount: results.filter((entry) => entry.domainOutcomeDerived === true).length,
    surfaceConsistentCount: results.filter((entry) => entry.surfaceConsistent).length,
    traceabilityCompleteCount: results.filter((entry) => entry.traceabilityComplete).length,
    results,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(runEcommerceScenarios(), null, 2)}\n`);
}
