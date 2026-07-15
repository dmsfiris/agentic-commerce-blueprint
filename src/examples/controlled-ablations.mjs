import {
  bindDerivedGeneratedClaimProvenance,
  buildAgentCommerceDecisionEnvelope,
  canUseGeneratedClaimCapability,
  createGeneratedClaimDependencyProjection,
  evaluateAgentCommerceDecisionEnvelopeIntegrity,
  evaluateAgentCommerceDecisionExecution,
  projectAgentCommerceDecisionEnvelope,
  projectTrustedAgentCommerceDecisionEnvelope,
  sha256Hex,
} from '../index.mjs';
import {
  allowedGeneratedClaims,
  blockedGeneratedClaims,
} from './fixtures.mjs';

const EVALUATED_AT = '2026-07-14T12:00:00.000Z';
const NOW = '2026-07-14T12:05:00.000Z';
const VALID_UNTIL = '2026-07-14T13:00:00.000Z';

const ACTOR = Object.freeze({
  actorType: 'agent',
  agentId: 'agent:ablation-study',
  merchantId: 'merchant:reference',
});
const SUBJECT = Object.freeze({ productId: 'product:ablation-study' });

function baseEnvelopeInput(overrides = {}) {
  return {
    decisionId: 'decision:ablation-study',
    evaluatedAt: EVALUATED_AT,
    surface: 'feed',
    requestedAction: 'discover',
    subject: SUBJECT,
    actor: ACTOR,
    eligibility: { result: 'allowed', source: 'product', blockerCodes: [] },
    authority: { result: 'not_required', blockerCodes: [] },
    freshness: {
      validUntil: VALID_UNTIL,
      staleAfter: VALID_UNTIL,
      dependencies: [],
    },
    ...overrides,
  };
}

function expectedRequest(envelope) {
  return {
    requestedAction: envelope.requestedAction,
    subject: envelope.subject,
    actor: envelope.actor,
  };
}

function protectedProjection(envelope, surface, request = expectedRequest(envelope)) {
  return projectTrustedAgentCommerceDecisionEnvelope(envelope, surface, {
    allowUnsignedLocalDevelopment: true,
    expectedRequest: request,
    now: NOW,
  });
}

/*
 * The following helpers are intentionally unsafe negative controls. They are
 * local to this experiment, are not exported by the package, and must never be
 * used as production alternatives to the protected paths.
 */
function unsafeExecutionWithoutDependencyRevalidation(envelope) {
  return {
    permitted: envelope.basis?.allowed === true,
    requiresFreshDecision: false,
    reasonCodes: [],
  };
}

function unsafeVerifyThenProjectOriginal(envelope, surface) {
  const integrity = evaluateAgentCommerceDecisionEnvelopeIntegrity({
    envelope,
    allowUnsignedLocalDevelopment: true,
  });
  if (!integrity.valid) {
    throw new Error(`unsafe control integrity failed: ${integrity.reasonCodes.join(', ')}`);
  }
  return projectAgentCommerceDecisionEnvelope(envelope, surface);
}

function unsafeIntegrityOnlyProjection(envelope, surface) {
  const integrity = evaluateAgentCommerceDecisionEnvelopeIntegrity({
    envelope,
    allowUnsignedLocalDevelopment: true,
  });
  if (!integrity.valid) {
    throw new Error(`unsafe control integrity failed: ${integrity.reasonCodes.join(', ')}`);
  }
  return projectAgentCommerceDecisionEnvelope(envelope, surface);
}

function unsafeBindDerivedWithoutRefusalPropagation({
  childRecordKey,
  childPayloadHash,
  dependencyProjections,
}) {
  return {
    childRecordKey,
    childPayloadHash,
    dependencyProjectionHashes: dependencyProjections
      .map((entry) => entry.projectionHash)
      .sort(),
    inheritedRefusalCount: 0,
    inheritedRefusals: [],
    canonicalHash: sha256Hex({
      childRecordKey,
      childPayloadHash,
      dependencyProjectionHashes: dependencyProjections
        .map((entry) => entry.projectionHash)
        .sort(),
      inheritedRefusals: [],
    }),
  };
}

function captureError(fn) {
  try {
    return { rejected: false, message: null, value: fn() };
  } catch (error) {
    return {
      rejected: true,
      message: error instanceof Error ? error.message : String(error),
      value: null,
    };
  }
}

function dependencyRevalidationAblation() {
  const initialPrice = { amountMinor: 8_000, currency: 'EUR', version: 1 };
  const changedPrice = { amountMinor: 9_500, currency: 'EUR', version: 2 };
  const envelope = buildAgentCommerceDecisionEnvelope(baseEnvelopeInput({
    decisionId: 'decision:ablation:dependency-revalidation',
    surface: 'checkout',
    requestedAction: 'complete_checkout',
    subject: {
      productId: SUBJECT.productId,
      checkoutId: 'checkout:ablation',
      mandateId: 'mandate:ablation',
    },
    authority: { result: 'allowed', blockerCodes: [] },
    checkout: {
      state: 'requires_payment',
      validForRequestedAction: true,
      blockerCodes: [],
    },
    payment: {
      authorityResult: 'allowed',
      blockerCodes: [],
      paymentDispatchAttempted: false,
    },
    freshness: {
      validUntil: VALID_UNTIL,
      staleAfter: VALID_UNTIL,
      dependencies: [
        {
          kind: 'price',
          ref: 'price_snapshot:price:ablation',
          hash: sha256Hex(initialPrice),
          validUntil: VALID_UNTIL,
          staleAfter: VALID_UNTIL,
        },
      ],
    },
  }));
  const currentDependencies = [{
    kind: 'price',
    ref: 'price_snapshot:price:ablation',
    hash: sha256Hex(changedPrice),
    validUntil: VALID_UNTIL,
    staleAfter: VALID_UNTIL,
  }];

  const protectedResult = evaluateAgentCommerceDecisionExecution({
    envelope,
    currentDependencies,
    now: NOW,
  });
  const ablatedResult = unsafeExecutionWithoutDependencyRevalidation(envelope);
  return Object.freeze({
    id: 'dependency_revalidation_removed',
    control: 'execution-time protected-dependency comparison',
    predictedFailure: 'an earlier allowed checkout decision proceeds after the price dependency changes',
    protectedOutcome: Object.freeze({
      permitted: protectedResult.permitted,
      requiresFreshDecision: protectedResult.requiresFreshDecision,
      reasonCodes: Object.freeze([...protectedResult.reasonCodes]),
    }),
    ablatedOutcome: Object.freeze({
      permitted: ablatedResult.permitted,
      requiresFreshDecision: ablatedResult.requiresFreshDecision,
      reasonCodes: Object.freeze([...ablatedResult.reasonCodes]),
    }),
    safetyRegressionObserved:
      protectedResult.permitted === false &&
      protectedResult.requiresFreshDecision === true &&
      ablatedResult.permitted === true,
  });
}

function makeHostileEnvelope() {
  const blocked = buildAgentCommerceDecisionEnvelope(baseEnvelopeInput({
    decisionId: 'decision:ablation:verified-state:blocked',
    eligibility: {
      result: 'blocked',
      source: 'product',
      blockerCodes: ['product_not_discoverable'],
    },
  }));
  const allowed = buildAgentCommerceDecisionEnvelope(baseEnvelopeInput({
    decisionId: 'decision:ablation:verified-state:allowed-control',
  }));
  const live = structuredClone(blocked);
  const originalAuthenticator = live.authenticator;
  let authenticatorReads = 0;
  let drift = false;
  Object.defineProperty(live, 'authenticator', {
    enumerable: true,
    configurable: true,
    get() {
      authenticatorReads += 1;
      if (authenticatorReads >= 2) drift = true;
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
  return {
    live,
    state() {
      return { authenticatorReads, drift };
    },
  };
}

function detachedCaptureAblation() {
  const protectedHostile = makeHostileEnvelope();
  const protectedResult = protectedProjection(protectedHostile.live, 'feed');
  const protectedState = protectedHostile.state();

  const ablatedHostile = makeHostileEnvelope();
  const ablatedResult = unsafeVerifyThenProjectOriginal(
    ablatedHostile.live,
    'feed',
  );
  const ablatedState = ablatedHostile.state();

  return Object.freeze({
    id: 'detached_capture_removed',
    control: 'single detached deeply frozen verified snapshot',
    predictedFailure: 'caller-controlled state changes between verification and projection',
    protectedOutcome: Object.freeze({
      allowed: protectedResult.allowed,
      status: protectedResult.status,
      accessorReads: protectedState.authenticatorReads,
      driftObserved: protectedState.drift,
    }),
    ablatedOutcome: Object.freeze({
      allowed: ablatedResult.allowed,
      status: ablatedResult.status,
      accessorReads: ablatedState.authenticatorReads,
      driftObserved: ablatedState.drift,
    }),
    safetyRegressionObserved:
      protectedResult.allowed === false &&
      protectedState.authenticatorReads === 1 &&
      ablatedResult.allowed === true &&
      ablatedState.drift === true,
  });
}

function surfaceBindingAblation() {
  const envelope = buildAgentCommerceDecisionEnvelope(baseEnvelopeInput({
    decisionId: 'decision:ablation:surface-binding',
    surface: 'feed',
  }));
  const protectedAttempt = captureError(() =>
    protectedProjection(envelope, 'tool'),
  );
  const ablatedProjection = unsafeIntegrityOnlyProjection(envelope, 'tool');
  return Object.freeze({
    id: 'surface_binding_removed',
    control: 'protected target-surface binding',
    predictedFailure: 'an envelope scoped to one recipient surface is redirected to another',
    protectedOutcome: Object.freeze({
      rejected: protectedAttempt.rejected,
      message: protectedAttempt.message,
    }),
    ablatedOutcome: Object.freeze({
      accepted: ablatedProjection.allowed === true,
      status: ablatedProjection.status,
      projectedSurface: 'tool',
      envelopeSurface: envelope.surface,
    }),
    safetyRegressionObserved:
      protectedAttempt.rejected === true && ablatedProjection.allowed === true,
  });
}

function requestBindingAblation() {
  const envelope = buildAgentCommerceDecisionEnvelope(baseEnvelopeInput({
    decisionId: 'decision:ablation:request-binding',
    surface: 'tool',
  }));
  const mismatchRequests = Object.freeze({
    action: {
      ...expectedRequest(envelope),
      requestedAction: 'prepare_checkout',
    },
    actor: {
      ...expectedRequest(envelope),
      actor: { ...ACTOR, agentId: 'agent:redirected' },
    },
    subject: {
      ...expectedRequest(envelope),
      subject: { productId: 'product:redirected' },
    },
  });
  const protectedRejections = Object.fromEntries(
    Object.entries(mismatchRequests).map(([kind, request]) => {
      const attempt = captureError(() => protectedProjection(envelope, 'tool', request));
      return [kind, { rejected: attempt.rejected, message: attempt.message }];
    }),
  );
  const ablatedProjection = unsafeIntegrityOnlyProjection(envelope, 'tool');
  const rejectedCount = Object.values(protectedRejections).filter(
    (entry) => entry.rejected,
  ).length;
  return Object.freeze({
    id: 'live_request_binding_removed',
    control: 'live action, actor, and subject rebinding',
    predictedFailure: 'a valid artifact is replayed or redirected to a different live request',
    protectedOutcome: Object.freeze({
      mismatchProbeCount: 3,
      rejectedCount,
      probes: Object.freeze(protectedRejections),
    }),
    ablatedOutcome: Object.freeze({
      acceptedWithoutLiveRequest: ablatedProjection.allowed === true,
      status: ablatedProjection.status,
    }),
    safetyRegressionObserved:
      rejectedCount === 3 && ablatedProjection.allowed === true,
  });
}

function refusalPropagationAblation() {
  const refusedParent = createGeneratedClaimDependencyProjection({
    generatedClaims: blockedGeneratedClaims(),
    sourceEnvelopeHash: sha256Hex('ablation:refused-parent-envelope'),
    sourceEvidencePinHash: sha256Hex('ablation:refused-parent-evidence'),
    sourceRecordKey: 'generated-claim:ablation-refused-parent',
    requestedSurface: 'product_detail',
    requestedUse: 'quote',
  });
  const childPayloadHash = sha256Hex('Derived claim that paraphrases a refused parent.');
  const protectedBinding = bindDerivedGeneratedClaimProvenance({
    childRecordKey: 'generated-claim:ablation-child',
    childPayloadHash,
    dependencyProjections: [refusedParent],
  });
  const protectedChild = {
    ...allowedGeneratedClaims(),
    allowed: false,
    status: 'inherited_refusal',
    claimIds: ['claim:ablation-child'],
    allowedUses: ['quote'],
    inheritedRefusalCount: protectedBinding.inheritedRefusalCount,
    blockerCodes: ['inherited_refusal'],
    axes: {
      ...allowedGeneratedClaims().axes,
      taint: { status: 'failed', blockerCodes: ['inherited_refusal'] },
    },
  };
  const protectedCapability = canUseGeneratedClaimCapability(protectedChild, {
    claimId: 'claim:ablation-child',
    use: 'quote',
    surface: 'product_detail',
    requiredValueHash: childPayloadHash,
    claimValueHash: childPayloadHash,
  });

  const ablatedBinding = unsafeBindDerivedWithoutRefusalPropagation({
    childRecordKey: 'generated-claim:ablation-child',
    childPayloadHash,
    dependencyProjections: [refusedParent],
  });
  const ablatedChild = {
    ...allowedGeneratedClaims(),
    claimIds: ['claim:ablation-child'],
    allowedUses: ['quote'],
    derivedFactRefs: [
      `approved_value_hash:${childPayloadHash}`,
      `generated_claim_provenance_hash:${ablatedBinding.canonicalHash}`,
    ],
  };
  const ablatedCapability = canUseGeneratedClaimCapability(ablatedChild, {
    claimId: 'claim:ablation-child',
    use: 'quote',
    surface: 'product_detail',
    requiredValueHash: childPayloadHash,
    claimValueHash: childPayloadHash,
  });

  return Object.freeze({
    id: 'refusal_propagation_removed',
    control: 'generated-claim inherited-refusal propagation',
    predictedFailure: 'a derived claim becomes usable even though a direct parent was refused',
    protectedOutcome: Object.freeze({
      parentStatus: refusedParent.status,
      inheritedRefusalCount: protectedBinding.inheritedRefusalCount,
      childAllowed: protectedCapability.allowed,
      blockerCodes: Object.freeze([...protectedCapability.blockerCodes]),
    }),
    ablatedOutcome: Object.freeze({
      inheritedRefusalCount: ablatedBinding.inheritedRefusalCount,
      childAllowed: ablatedCapability.allowed,
      blockerCodes: Object.freeze([...ablatedCapability.blockerCodes]),
    }),
    safetyRegressionObserved:
      refusedParent.status !== 'usable' &&
      protectedBinding.inheritedRefusalCount > 0 &&
      protectedCapability.allowed === false &&
      ablatedCapability.allowed === true,
  });
}

export function runControlledAblations() {
  const results = Object.freeze([
    dependencyRevalidationAblation(),
    detachedCaptureAblation(),
    surfaceBindingAblation(),
    requestBindingAblation(),
    refusalPropagationAblation(),
  ]);
  return Object.freeze({
    studyType: 'controlled_negative_control_ablation',
    evaluatedAt: EVALUATED_AT,
    ablationCount: results.length,
    protectedControlSuccessCount: results.filter(
      (entry) => entry.safetyRegressionObserved,
    ).length,
    expectedRegressionObservedCount: results.filter(
      (entry) => entry.safetyRegressionObserved,
    ).length,
    allExpectedRegressionsObserved: results.every(
      (entry) => entry.safetyRegressionObserved,
    ),
    interpretationBoundary:
      'The unsafe variants are purpose-built negative controls local to the experiment. Results show the demonstrated failure mechanism when one declared safeguard is bypassed; they do not estimate exploit prevalence or prove that the protected architecture is complete.',
    results,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(runControlledAblations(), null, 2)}\n`);
}
