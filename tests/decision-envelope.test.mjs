import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  AGENT_COMMERCE_DECISION_ACTION_RULES,
  AGENT_COMMERCE_DECISION_ACTIONS,
  agentCommerceReasonCodeHasAny,
  bindDerivedGeneratedClaimProvenance,
  buildAgentCommerceDecisionNextSafeActions,
  buildAgentCommerceDecisionEnvelope,
  buildGeneratedClaimsFromPolicyProjection,
  calculateAgentCommerceDecisionEnvelopeHashes,
  calculateGeneratedClaimDependencyProjectionHashes,
  evaluateAgentCommerceDecisionEnvelopeIntegrity,
  evaluateAgentCommerceDecisionEnvelopeSemantics,
  canUseGeneratedClaimCapability,
  createGeneratedClaimDependencyProjection,
  GENERATED_CLAIM_INHERITED_REFUSAL_LIMIT,
  mcpDecisionProjection,
  normalizeEvidenceRefs,
  normalizeFreshness,
  normalizeGeneratedClaims,
  operatorDecisionProjection,
  publicDecisionProjection,
  projectTrustedAgentCommerceDecisionEnvelope,
  sha256Hex,
  verifyDecisionEnvelopeAuthenticator,
} from '../src/index.mjs';
import {
  baseInput,
  allowedGeneratedClaims,
  blockedGeneratedClaims,
  travelBackpackGeneratedClaims,
  DEMO_SIGNING_SECRET,
} from '../src/examples/fixtures.mjs';

const sha = /^[a-f0-9]{64}$/u;

function liveRequestBinding(envelope) {
  return {
    requestedAction: envelope.requestedAction,
    subject: envelope.subject,
    actor: envelope.actor,
  };
}

test('v4 envelope exposes the canonical contract and content-addressed rule set', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  assert.equal(envelope.contractVersion, 'agent-commerce-decision-envelope-v4');
  assert.equal(
    envelope.envelopeSchemaVersion,
    'agent-commerce-decision-envelope-schema-v4',
  );
  assert.equal(envelope.ruleSetVersion, 'agent-commerce-decision-rules-v4');
  assert.match(envelope.ruleSetHash, sha);
  assert.ok(envelope.ruleSetRef.includes(envelope.ruleSetHash));
  assert.match(envelope.decisionHash, sha);
  assert.match(envelope.inputDependencyHash, sha);
  assert.match(envelope.resultHash, sha);
});

test('action vocabulary and rules include generated-claim display and explanation', () => {
  assert.deepEqual(Object.keys(AGENT_COMMERCE_DECISION_ACTION_RULES), [
    ...AGENT_COMMERCE_DECISION_ACTIONS,
  ]);
  assert.equal(
    AGENT_COMMERCE_DECISION_ACTION_RULES.show_generated_claim.generatedClaimUse,
    true,
  );
  assert.equal(AGENT_COMMERCE_DECISION_ACTION_RULES.explain.mutatesState, false);
  assert.equal(
    AGENT_COMMERCE_DECISION_ACTION_RULES.delegate_payment.paymentBoundary,
    true,
  );
});

test('builder rejects vocabulary that would violate the canonical schema', () => {
  assert.throws(
    () => buildAgentCommerceDecisionEnvelope(baseInput({ surface: 'mobile' })),
    /surface must be one of/u,
  );
  assert.throws(
    () =>
      buildAgentCommerceDecisionEnvelope(
        baseInput({ actor: { actorType: 'assistant' } }),
      ),
    /actor\.actorType must be one of/u,
  );
  assert.throws(
    () =>
      buildAgentCommerceDecisionEnvelope(
        baseInput({
          eligibility: {
            result: 'blocked',
            blockerCodes: ['missing_return_policy'],
            source: 'catalog',
          },
        }),
      ),
    /eligibility\.source must be one of/u,
  );
  assert.throws(
    () =>
      buildAgentCommerceDecisionEnvelope(
        baseInput({
          nextSafeActions: [
            {
              action: 'review',
              owner: 'reviewer',
              reasonCode: 'missing_return_policy',
            },
          ],
        }),
      ),
    /nextSafeActions\.owner must be one of/u,
  );
});

test('requires_confirmation remains distinct from blocked and review states', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(
    baseInput({
      requestedAction: 'prepare_checkout',
      eligibility: {
        requiresConfirmation: true,
        blockerCodes: [],
        source: 'checkout',
      },
      checkout: undefined,
      payment: undefined,
      generatedClaims: undefined,
    }),
  );
  assert.equal(envelope.eligibility.result, 'requires_confirmation');
  assert.equal(envelope.basis.status, 'requires_confirmation');
  assert.equal(envelope.basis.allowed, false);
});

test('hard authority and checkout blocks dominate softer eligibility outcomes', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(
    baseInput({
      eligibility: {
        result: 'requires_revalidation',
        blockerCodes: [],
        source: 'combined',
      },
      authority: {
        result: 'blocked',
        blockerCodes: ['mandate_expired'],
      },
      checkout: {
        state: 'requires_revalidation',
        validForRequestedAction: false,
        blockerCodes: ['stale_inventory'],
      },
    }),
  );
  assert.equal(envelope.basis.status, 'blocked');
  assert.ok(envelope.basis.reasonCodes.includes('authority_blocked'));
  assert.ok(envelope.basis.reasonCodes.includes('mandate_expired'));
});

test('generated-claim review remains a review outcome when the action uses the claim', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(
    baseInput({
      requestedAction: 'show_generated_claim',
      eligibility: {
        result: 'requires_review',
        blockerCodes: [],
        source: 'policy',
      },
      authority: { result: 'not_required', blockerCodes: [] },
      checkout: undefined,
      payment: undefined,
      generatedClaims: {
        ...blockedGeneratedClaims(),
        status: 'requires_review',
        blockerCodes: ['generated_claim_requires_review'],
        axes: {
          ...allowedGeneratedClaims().axes,
          payload: {
            status: 'not_evaluated',
            blockerCodes: ['generated_claim_requires_review'],
          },
        },
      },
      freshness: {
        validUntil: '2026-07-06T10:15:00.000Z',
        staleAfter: '2026-07-06T10:15:00.000Z',
        reasonCodes: [],
      },
    }),
  );
  assert.equal(envelope.basis.status, 'requires_review');
  assert.equal(envelope.basis.allowed, false);
  assert.equal(envelope.generatedClaims.status, 'requires_review');
});

test('contradictory allowed sections are rejected at construction', () => {
  assert.throws(
    () =>
      buildAgentCommerceDecisionEnvelope(
        baseInput({
          eligibility: {
            result: 'allowed',
            blockerCodes: ['missing_return_policy'],
            source: 'policy',
          },
        }),
      ),
    /eligibility\.result cannot be allowed/u,
  );
  assert.throws(
    () =>
      buildAgentCommerceDecisionEnvelope(
        baseInput({
          authority: {
            result: 'allowed',
            blockerCodes: ['mandate_expired'],
          },
        }),
      ),
    /authority\.result cannot be allowed/u,
  );
  assert.throws(
    () =>
      buildAgentCommerceDecisionEnvelope(
        baseInput({
          checkout: {
            state: 'requires_payment',
            validForRequestedAction: true,
            blockerCodes: [],
          },
          payment: {
            authorityResult: 'allowed',
            blockerCodes: ['invalid_checkout_state'],
            paymentDispatchAttempted: false,
          },
        }),
      ),
    /payment\.authorityResult cannot be allowed/u,
  );
});

test('payment authority is not evaluated when actor authority or checkout validity prevents evaluation', () => {
  const invalidCheckout = buildAgentCommerceDecisionEnvelope(
    baseInput({
      payment: {
        paymentDispatchAttempted: false,
        authorityResult: 'blocked',
        blockerCodes: ['invalid_checkout_state'],
      },
    }),
  );
  assert.deepEqual(invalidCheckout.payment, {
    paymentDispatchAttempted: false,
    authorityResult: 'not_evaluated',
    blockerCodes: [],
  });
  assert.equal(
    invalidCheckout.basis.reasonCodes.includes('payment_authority_blocked'),
    false,
  );

  const blockedActor = buildAgentCommerceDecisionEnvelope(
    baseInput({
      authority: { result: 'blocked', blockerCodes: ['mandate_expired'] },
      checkout: {
        state: 'requires_payment',
        validForRequestedAction: true,
        blockerCodes: [],
      },
      payment: {
        paymentDispatchAttempted: false,
        authorityResult: 'allowed',
        blockerCodes: [],
      },
    }),
  );
  assert.equal(blockedActor.payment.authorityResult, 'not_evaluated');
});

test('semantic evaluation rejects contradictory deserialized sections', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  const contradictory = structuredClone(envelope);
  contradictory.authority = {
    result: 'allowed',
    blockerCodes: ['mandate_expired'],
  };
  const semantics = evaluateAgentCommerceDecisionEnvelopeSemantics(contradictory);
  assert.equal(semantics.valid, false);
  assert.ok(semantics.reasonCodes.includes('authority_blocker_conflict'));
  assert.ok(semantics.reasonCodes.includes('basis_semantic_mismatch'));
});

test('semantic evaluation rejects payment-prerequisite and generated-claim drift', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());

  const paymentDrift = structuredClone(envelope);
  paymentDrift.payment = {
    paymentDispatchAttempted: false,
    authorityResult: 'blocked',
    blockerCodes: ['invalid_checkout_state'],
  };
  const paymentSemantics =
    evaluateAgentCommerceDecisionEnvelopeSemantics(paymentDrift);
  assert.ok(
    paymentSemantics.reasonCodes.includes(
      'payment_evaluation_prerequisite_conflict',
    ),
  );

  const claimDrift = structuredClone(envelope);
  claimDrift.generatedClaims.status = 'requires_review';
  const claimSemantics =
    evaluateAgentCommerceDecisionEnvelopeSemantics(claimDrift);
  assert.ok(
    claimSemantics.reasonCodes.includes('generated_claim_semantic_mismatch'),
  );
});

test('reason semantics match complete tokens rather than substrings', () => {
  assert.equal(agentCommerceReasonCodeHasAny('missing_return_policy', ['policy']), true);
  assert.equal(agentCommerceReasonCodeHasAny('metapolicyx_signal', ['policy']), false);
  assert.deepEqual(buildAgentCommerceDecisionNextSafeActions(['metapolicyx_signal']), [
    {
      action: 'resolve_commerce_blocker',
      owner: 'merchant',
      reasonCode: 'metapolicyx_signal',
    },
  ]);
});

test('HMAC authenticator verifies with the shared secret and rejects the wrong secret', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  assert.equal(envelope.authenticator.kind, 'message_authentication_code');
  assert.equal(envelope.authenticator.algorithm, 'hmac-sha256');
  assert.equal(envelope.authenticator.format, 'detached');
  assert.equal(envelope.authenticator.protectedHash, envelope.decisionHash);
  assert.equal(
    verifyDecisionEnvelopeAuthenticator({
      decisionHash: envelope.decisionHash,
      envelopeSchemaVersion: envelope.envelopeSchemaVersion,
      ruleSetHash: envelope.ruleSetHash,
      authenticator: envelope.authenticator,
      signingSecret: DEMO_SIGNING_SECRET,
    }),
    true,
  );
  assert.equal(
    verifyDecisionEnvelopeAuthenticator({
      decisionHash: envelope.decisionHash,
      envelopeSchemaVersion: envelope.envelopeSchemaVersion,
      ruleSetHash: envelope.ruleSetHash,
      authenticator: envelope.authenticator,
      signingSecret: 'wrong-secret',
    }),
    false,
  );
});

test('Ed25519 authenticator verifies with the public key', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const envelope = buildAgentCommerceDecisionEnvelope(
    baseInput({
      signingSecret: null,
      signingPrivateKeyPem: privateKeyPem,
      authenticatorKeyId: 'reference-demo-ed25519-key',
      verificationKeyRef: 'public-key:reference-demo-ed25519-key',
    }),
  );
  assert.equal(envelope.authenticator.kind, 'digital_signature');
  assert.equal(envelope.authenticator.algorithm, 'ed25519');
  assert.equal(
    verifyDecisionEnvelopeAuthenticator({
      decisionHash: envelope.decisionHash,
      envelopeSchemaVersion: envelope.envelopeSchemaVersion,
      ruleSetHash: envelope.ruleSetHash,
      authenticator: envelope.authenticator,
      verificationPublicKeyPem: publicKeyPem,
    }),
    true,
  );
});

test('unsigned envelopes are rejected unless local development acceptance is explicit', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(
    baseInput({ signingSecret: null, signingPrivateKeyPem: null }),
  );
  assert.equal(envelope.authenticator.kind, 'unsigned');
  const verificationInput = {
    decisionHash: envelope.decisionHash,
    envelopeSchemaVersion: envelope.envelopeSchemaVersion,
    ruleSetHash: envelope.ruleSetHash,
    authenticator: envelope.authenticator,
  };
  assert.equal(verifyDecisionEnvelopeAuthenticator(verificationInput), false);
  assert.equal(
    verifyDecisionEnvelopeAuthenticator({
      ...verificationInput,
      allowUnsignedLocalDevelopment: true,
    }),
    true,
  );
});

test('authenticator is bound to decisionHash and ruleSetHash', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  assert.equal(
    verifyDecisionEnvelopeAuthenticator({
      decisionHash: sha256Hex('tampered'),
      envelopeSchemaVersion: envelope.envelopeSchemaVersion,
      ruleSetHash: envelope.ruleSetHash,
      authenticator: envelope.authenticator,
      signingSecret: DEMO_SIGNING_SECRET,
    }),
    false,
  );
  assert.equal(
    verifyDecisionEnvelopeAuthenticator({
      decisionHash: envelope.decisionHash,
      envelopeSchemaVersion: envelope.envelopeSchemaVersion,
      ruleSetHash: sha256Hex('different-rules'),
      authenticator: envelope.authenticator,
      signingSecret: DEMO_SIGNING_SECRET,
    }),
    false,
  );
});

test('decisionId is protected by the dependency hash and authenticator', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  const mutated = structuredClone(envelope);
  mutated.decisionId = 'decision:tampered';
  const integrity = evaluateAgentCommerceDecisionEnvelopeIntegrity({
    envelope: mutated,
    signingSecret: DEMO_SIGNING_SECRET,
  });
  assert.equal(integrity.valid, false);
  assert.ok(integrity.reasonCodes.includes('input_dependency_hash_mismatch'));
  assert.ok(integrity.reasonCodes.includes('decision_hash_mismatch'));
});

test('evidence refs require explicit SHA-256 pins and reject identity conflicts', () => {
  const hash = sha256Hex({ days: 7 });
  const refs = normalizeEvidenceRefs([
    { type: 'policy_fact', id: 'policy:returns:seven-day', hash },
    { type: 'policy_fact', id: 'policy:returns:seven-day', hash },
  ]);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].hashAlgorithm, 'sha256');
  assert.equal(refs[0].hash, hash);
  assert.throws(
    () => normalizeEvidenceRefs([
      { type: 'policy_fact', id: 'policy:returns:seven-day' },
    ]),
    /requires an explicit SHA-256/u,
  );
  assert.throws(
    () => normalizeEvidenceRefs([
      { type: 'policy_fact', id: 'policy:returns:seven-day', hash },
      { type: 'policy_fact', id: 'policy:returns:seven-day', hash: sha256Hex({ days: 14 }) },
    ]),
    /conflicting SHA-256 hashes/u,
  );
});

test('input hash changes with dependency or rule-set changes while result may remain blocked', () => {
  const first = buildAgentCommerceDecisionEnvelope(baseInput());
  const dependencyChange = buildAgentCommerceDecisionEnvelope(
    baseInput({
      inputRefs: {
        ...baseInput().inputRefs,
        productRef: 'product:travel-backpack:v2',
      },
    }),
  );
  const changedRuleSetHash = sha256Hex('agent-commerce-decision-rules-v4.1');
  const ruleChange = buildAgentCommerceDecisionEnvelope(
    baseInput({
      ruleSetVersion: 'agent-commerce-decision-rules-v4.1',
      ruleSetRef: `ruleset:sha256:${changedRuleSetHash}`,
    }),
  );
  assert.equal(first.basis.status, dependencyChange.basis.status);
  assert.notEqual(first.inputDependencyHash, dependencyChange.inputDependencyHash);
  assert.notEqual(first.ruleSetHash, ruleChange.ruleSetHash);
  assert.notEqual(first.inputDependencyHash, ruleChange.inputDependencyHash);
});

test('decisionHash wraps contract, schema, dependency and result hashes', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  assert.equal(
    envelope.decisionHash,
    sha256Hex({
      contractVersion: envelope.contractVersion,
      envelopeSchemaVersion: envelope.envelopeSchemaVersion,
      inputDependencyHash: envelope.inputDependencyHash,
      resultHash: envelope.resultHash,
    }),
  );
});

test('generated-claim state is visible but does not falsely cause delegate-payment failure', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  assert.equal(envelope.generatedClaims.status, 'inherited_refusal');
  assert.equal(envelope.generatedClaims.inheritedRefusalCount, 1);
  assert.equal(envelope.generatedClaims.axes.taint.status, 'failed');
  assert.equal(
    envelope.basis.reasonCodes.includes('generated_claim_requires_review'),
    false,
  );
  assert.equal(envelope.payment.paymentDispatchAttempted, false);
  assert.deepEqual(envelope.freshness.reasonCodes, ['stale_inventory']);
});

test('show-generated-claim action can require review while preserving inherited-refusal status', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(
    baseInput({
      requestedAction: 'show_generated_claim',
      eligibility: {
        result: 'requires_review',
        blockerCodes: [],
        source: 'policy',
      },
      authority: { result: 'not_required', blockerCodes: [] },
      checkout: undefined,
      payment: undefined,
      generatedClaims: travelBackpackGeneratedClaims(),
      freshness: {
        validUntil: '2026-07-06T10:15:00.000Z',
        staleAfter: '2026-07-06T10:15:00.000Z',
        reasonCodes: ['stale_inventory'],
      },
    }),
  );
  assert.equal(envelope.basis.status, 'requires_review');
  assert.equal(envelope.generatedClaims.status, 'inherited_refusal');
});

test('generated-claim status and axes follow one canonical precedence', () => {
  const claim = normalizeGeneratedClaims({
    allowed: false,
    status: 'requires_review',
    claimIds: ['claim:collision'],
    blockerCodes: ['generated_claim_requires_review', 'inherited_refusal'],
    inheritedRefusalCount: 1,
    axes: {
      source: { status: 'passed', blockerCodes: [] },
      freshness: { status: 'passed', blockerCodes: ['stale_inventory'] },
      scope: { status: 'passed', blockerCodes: [] },
      surface: { status: 'passed', blockerCodes: [] },
      use: { status: 'failed', blockerCodes: ['generated_claim_requires_review'] },
      payload: { status: 'not_evaluated', blockerCodes: [] },
      taint: { status: 'failed', blockerCodes: ['inherited_refusal'] },
    },
  });
  assert.equal(claim.status, 'inherited_refusal');
  assert.deepEqual(claim.axes.freshness, {
    status: 'failed',
    blockerCodes: ['stale_inventory'],
  });
  assert.deepEqual(claim.axes.payload, {
    status: 'not_evaluated',
    blockerCodes: [],
  });

  const absent = normalizeGeneratedClaims({
    allowed: false,
    status: 'inherited_refusal',
    claimIds: [],
    blockerCodes: ['inherited_refusal'],
    inheritedRefusalCount: 1,
  });
  assert.equal(absent.status, 'absent');
  assert.deepEqual(absent.blockerCodes, []);
  assert.equal(absent.inheritedRefusalCount, 0);
});

test('policy projection mapping uses the same generated-claim precedence', () => {
  const inherited = buildGeneratedClaimsFromPolicyProjection({
    projectionState: {
      allowed: false,
      claimIds: ['claim:policy-summary'],
      outcomeCodes: [
        'generated_claim_requires_review',
        'stale_inventory',
        'inherited_refusal',
      ],
      inheritedRefusalCount: 1,
      axes: {
        source: { status: 'passed', blockerCodes: [] },
        freshness: { status: 'failed', blockerCodes: ['stale_inventory'] },
        scope: { status: 'passed', blockerCodes: [] },
        surface: { status: 'passed', blockerCodes: [] },
        use: {
          status: 'failed',
          blockerCodes: ['generated_claim_requires_review'],
        },
        payload: { status: 'not_evaluated', blockerCodes: [] },
        taint: { status: 'failed', blockerCodes: ['inherited_refusal'] },
      },
    },
  });
  assert.equal(inherited.status, 'inherited_refusal');

  const localRefusal = buildGeneratedClaimsFromPolicyProjection({
    status: 'refused_here',
    projectionState: {
      allowed: false,
      claimIds: ['claim:local-refusal'],
      outcomeCodes: ['stale_inventory'],
      axes: {
        source: { status: 'passed', blockerCodes: [] },
        freshness: { status: 'failed', blockerCodes: ['stale_inventory'] },
        scope: { status: 'passed', blockerCodes: [] },
        surface: { status: 'passed', blockerCodes: [] },
        use: { status: 'passed', blockerCodes: [] },
        payload: { status: 'passed', blockerCodes: [] },
        taint: { status: 'passed', blockerCodes: [] },
      },
    },
  });
  assert.equal(localRefusal.status, 'refused_here');
});

test('generated-claim blockers contribute when the requested action uses generated claims', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(
    baseInput({
      requestedAction: 'show_generated_claim',
      eligibility: {
        result: 'blocked',
        blockerCodes: ['generated_claim_use_axis_blocked'],
        source: 'policy',
      },
      checkout: undefined,
      payment: undefined,
      generatedClaims: blockedGeneratedClaims(),
    }),
  );
  assert.ok(envelope.basis.components.some((entry) => entry.source === 'generated_claim'));
  assert.ok(envelope.basis.reasonCodes.includes('generated_claim_out_of_scope'));
});

test('generated claim capability gate rejects value-hash drift', () => {
  const claimValue = 'Cabin-size compatible travel backpack.';
  const expectedHash = sha256Hex({ claimValue });
  const allowed = canUseGeneratedClaimCapability(allowedGeneratedClaims(), {
    claimId: 'claim:cabin-size-compatible',
    use: 'quote',
    surface: 'product_detail',
    requiredValueHash: expectedHash,
    observedValue: claimValue,
  });
  const drifted = canUseGeneratedClaimCapability(allowedGeneratedClaims(), {
    claimId: 'claim:cabin-size-compatible',
    use: 'quote',
    surface: 'product_detail',
    requiredValueHash: expectedHash,
    observedValue: 'Waterproof expedition backpack.',
  });
  assert.equal(allowed.allowed, true);
  assert.equal(drifted.allowed, false);
  assert.ok(drifted.blockerCodes.includes('generated_claim_value_hash_mismatch'));
});

test('projections preserve canonical hashes and apply only surface-specific behavior', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  const publicProjection = publicDecisionProjection(envelope, {
    now: envelope.evaluatedAt,
  });
  const mcpProjection = mcpDecisionProjection(envelope);
  const operatorProjection = operatorDecisionProjection(envelope);
  for (const projection of [publicProjection, mcpProjection, operatorProjection]) {
    assert.equal(projection.envelopeSchemaVersion, envelope.envelopeSchemaVersion);
    assert.equal(projection.ruleSetRef, envelope.ruleSetRef);
    assert.equal(projection.ruleSetHash, envelope.ruleSetHash);
    assert.deepEqual(projection.authenticator, envelope.authenticator);
    assert.equal(projection.decisionHash, envelope.decisionHash);
    assert.equal(projection.paymentDispatchAttempted, false);
  }
  assert.equal(publicProjection.exportable, false);
  assert.equal(publicProjection.status, 'blocked');
  assert.ok(publicProjection.reasonCodes.includes('freshness.stale'));
  assert.ok(publicProjection.reasonCodes.includes('missing_return_policy'));
  assert.ok(publicProjection.reasonCodes.includes('stale_inventory'));
  assert.equal(mcpProjection.tool_result_type, 'agent_commerce_decision');
  assert.deepEqual(mcpProjection.reasonCodes, envelope.basis.reasonCodes);
  assert.deepEqual(operatorProjection.reasonCodes, envelope.basis.reasonCodes);
  assert.ok(operatorProjection.ownerCodes.includes('operator:stale_inventory'));
});


test('fixed normalized input is deterministic and set-like order does not drift hashes', () => {
  const first = buildAgentCommerceDecisionEnvelope(baseInput());
  const reordered = buildAgentCommerceDecisionEnvelope(baseInput({
    evidenceRefs: [...baseInput().evidenceRefs].reverse(),
    nextSafeActions: [...baseInput().nextSafeActions].reverse(),
    freshness: {
      ...baseInput().freshness,
      reasonCodes: [...baseInput().freshness.reasonCodes].reverse(),
      dependencies: [...baseInput().freshness.dependencies].reverse(),
    },
  }));
  assert.equal(first.inputDependencyHash, reordered.inputDependencyHash);
  assert.equal(first.resultHash, reordered.resultHash);
  assert.equal(first.decisionHash, reordered.decisionHash);
  assert.deepEqual(calculateAgentCommerceDecisionEnvelopeHashes(first), {
    inputDependencyHash: first.inputDependencyHash,
    resultHash: first.resultHash,
    decisionHash: first.decisionHash,
  });
});

test('surface and freshness outcome are protected by the canonical hashes', () => {
  const first = buildAgentCommerceDecisionEnvelope(baseInput());
  const surfaceChange = buildAgentCommerceDecisionEnvelope(baseInput({ surface: 'tool' }));
  const freshnessChange = buildAgentCommerceDecisionEnvelope(baseInput({
    freshness: { ...baseInput().freshness, staleAfter: '2026-07-06T10:14:00.000Z' },
  }));
  assert.notEqual(first.inputDependencyHash, surfaceChange.inputDependencyHash);
  assert.notEqual(first.resultHash, freshnessChange.resultHash);
});

test('integrity evaluation detects hash, basis, and authenticator drift', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
  assert.deepEqual(
    evaluateAgentCommerceDecisionEnvelopeIntegrity({
      envelope,
      signingSecret: DEMO_SIGNING_SECRET,
    }),
    { valid: true, reasonCodes: [] },
  );
  const tampered = {
    ...envelope,
    basis: { ...envelope.basis, reasonCodes: [...envelope.basis.reasonCodes, 'unexplained_reason'] },
  };
  const integrity = evaluateAgentCommerceDecisionEnvelopeIntegrity({
    envelope: tampered,
    signingSecret: DEMO_SIGNING_SECRET,
  });
  assert.equal(integrity.valid, false);
  assert.ok(integrity.reasonCodes.includes('result_hash_mismatch'));
  assert.ok(integrity.reasonCodes.includes('basis_reason_component_mismatch'));
});

test('allowed decisions cannot carry freshness blocker reasons', () => {
  assert.throws(
    () =>
      buildAgentCommerceDecisionEnvelope(
        baseInput({
          requestedAction: 'discover',
          eligibility: { result: 'allowed', blockerCodes: [], source: 'product' },
          authority: { result: 'not_required', blockerCodes: [] },
          checkout: undefined,
          payment: undefined,
          generatedClaims: undefined,
          freshness: {
            validUntil: '2026-07-06T10:15:00.000Z',
            staleAfter: '2026-07-06T10:15:00.000Z',
            reasonCodes: ['stale_inventory'],
          },
        }),
      ),
    /allowed decision cannot carry freshness blocker/u,
  );
});

test('strict date normalization rejects ambiguous input and canonicalizes offsets', () => {
  assert.throws(
    () => buildAgentCommerceDecisionEnvelope(baseInput({ evaluatedAt: '2026-07-06' })),
    /valid ISO-8601 date-time/u,
  );
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput({
    evaluatedAt: '2026-07-06T12:12:00+02:00',
  }));
  assert.equal(envelope.evaluatedAt, '2026-07-06T10:12:00.000Z');
});

test('freshness dependencies merge by kind and ref with conservative horizons', () => {
  const freshness = normalizeFreshness({
    freshness: {
      dependencies: [
        { kind: 'inventory', ref: 'inventory:item:1', staleAfter: '2026-07-06T10:20:00.000Z' },
        { kind: 'inventory', ref: 'inventory:item:1', staleAfter: '2026-07-06T10:15:00.000Z' },
      ],
    },
    evaluatedAt: '2026-07-06T10:00:00.000Z',
    inputRefs: undefined,
    evidenceRefs: [],
    generatedClaims: undefined,
    basis: { status: 'allowed', allowed: true, reasonCodes: [], components: [] },
  });
  assert.equal(freshness.dependencies.length, 1);
  assert.equal(freshness.dependencies[0].staleAfter, '2026-07-06T10:15:00.000Z');
  assert.throws(
    () => normalizeFreshness({
      freshness: { dependencies: [{ kind: 'inventory', ref: 'inventory:item:1', hash: 'bad' }] },
      evaluatedAt: '2026-07-06T10:00:00.000Z', inputRefs: undefined, evidenceRefs: [], generatedClaims: undefined,
      basis: { status: 'allowed', allowed: true, reasonCodes: [], components: [] },
    }),
    /valid SHA-256/u,
  );
});

test('evidence hash remains authoritative when an explicit dependency adds only a horizon', () => {
  const evidenceHash = sha256Hex({ inventory: 3 });
  const freshness = normalizeFreshness({
    freshness: { dependencies: [{ kind: 'inventory', ref: 'inventory_fact:inventory:item:1', staleAfter: '2026-07-06T10:15:00.000Z' }] },
    evaluatedAt: '2026-07-06T10:00:00.000Z',
    inputRefs: undefined,
    evidenceRefs: [{ type: 'inventory_fact', id: 'inventory:item:1', hash: evidenceHash, hashAlgorithm: 'sha256' }],
    generatedClaims: undefined,
    basis: { status: 'allowed', allowed: true, reasonCodes: [], components: [] },
  });
  assert.equal(freshness.dependencies[0].hash, evidenceHash);
});

test('generated claims cannot remain allowed with failed or unevaluated axes', () => {
  const claim = normalizeGeneratedClaims({
    allowed: true,
    status: 'allowed',
    claimIds: ['claim:test'],
    axes: {
      source: { status: 'passed', blockerCodes: [] },
      freshness: { status: 'failed', blockerCodes: ['stale_claim'] },
      scope: { status: 'passed', blockerCodes: [] },
      surface: { status: 'passed', blockerCodes: [] },
      use: { status: 'passed', blockerCodes: [] },
      payload: { status: 'passed', blockerCodes: [] },
      taint: { status: 'passed', blockerCodes: [] },
    },
  });
  assert.equal(claim.allowed, false);
  assert.equal(claim.status, 'stale');
  assert.ok(claim.blockerCodes.includes('generated_claim_freshness_axis_failed'));
});

test('Ed25519 metadata and key type are enforced', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(
    () => buildAgentCommerceDecisionEnvelope(baseInput({
      signingSecret: null,
      signingPrivateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    })),
    /require an Ed25519 private key/u,
  );
  const { privateKey: edPrivate, publicKey: edPublic } = generateKeyPairSync('ed25519');
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput({
    signingSecret: null,
    signingPrivateKeyPem: edPrivate.export({ type: 'pkcs8', format: 'pem' }),
  }));
  assert.equal(verifyDecisionEnvelopeAuthenticator({
    decisionHash: envelope.decisionHash,
    envelopeSchemaVersion: envelope.envelopeSchemaVersion,
    ruleSetHash: envelope.ruleSetHash,
    authenticator: { ...envelope.authenticator, algorithm: 'hmac-sha256' },
    verificationPublicKeyPem: edPublic.export({ type: 'spki', format: 'pem' }),
  }), false);
});

test('trusted projections enforce surface, trust, integrity, live binding, and freshness', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const envelope = buildAgentCommerceDecisionEnvelope(baseInput({
    signingSecret: null,
    signingPrivateKeyPem: privateKeyPem,
    surface: 'tool',
    authenticatorKeyId: 'trusted-key',
    verificationKeyRef: 'keyset:trusted-key',
  }));
  assert.doesNotThrow(() => projectTrustedAgentCommerceDecisionEnvelope(envelope, 'tool', {
    verificationPublicKeyPem: publicKeyPem,
    trustedKeyId: 'trusted-key',
    trustedVerificationKeyRef: 'keyset:trusted-key',
    expectedRequest: liveRequestBinding(envelope),
    now: envelope.evaluatedAt,
  }));
  assert.throws(
    () => projectTrustedAgentCommerceDecisionEnvelope(envelope, 'feed', { verificationPublicKeyPem: publicKeyPem }),
    /surface mismatch/u,
  );
  const hmacEnvelope = buildAgentCommerceDecisionEnvelope(baseInput({ surface: 'tool' }));
  assert.throws(
    () => projectTrustedAgentCommerceDecisionEnvelope(hmacEnvelope, 'tool', { signingSecret: DEMO_SIGNING_SECRET }),
    /requires an independently verifiable Ed25519 signature/u,
  );
  assert.doesNotThrow(() => projectTrustedAgentCommerceDecisionEnvelope(hmacEnvelope, 'tool', {
    signingSecret: DEMO_SIGNING_SECRET,
    allowHmac: true,
    expectedRequest: liveRequestBinding(hmacEnvelope),
    now: hmacEnvelope.evaluatedAt,
  }));

  assert.throws(
    () => projectTrustedAgentCommerceDecisionEnvelope(envelope, 'tool', {
      verificationPublicKeyPem: publicKeyPem,
      now: envelope.evaluatedAt,
    }),
    /requires live requested-action, subject, and actor binding/u,
  );
  assert.throws(
    () => projectTrustedAgentCommerceDecisionEnvelope(envelope, 'tool', {
      verificationPublicKeyPem: publicKeyPem,
      expectedRequest: {
        ...liveRequestBinding(envelope),
        requestedAction: 'discover',
      },
      now: envelope.evaluatedAt,
    }),
    /requested-action mismatch/u,
  );
  assert.throws(
    () => projectTrustedAgentCommerceDecisionEnvelope(envelope, 'tool', {
      verificationPublicKeyPem: publicKeyPem,
      expectedRequest: {
        ...liveRequestBinding(envelope),
        subject: { ...envelope.subject, checkoutId: 'checkout:other' },
      },
      now: envelope.evaluatedAt,
    }),
    /subject mismatch/u,
  );
  assert.throws(
    () => projectTrustedAgentCommerceDecisionEnvelope(envelope, 'tool', {
      verificationPublicKeyPem: publicKeyPem,
      expectedRequest: {
        ...liveRequestBinding(envelope),
        actor: { ...envelope.actor, agentId: 'agent:other' },
      },
      now: envelope.evaluatedAt,
    }),
    /actor mismatch/u,
  );

  const staleAllowed = buildAgentCommerceDecisionEnvelope(baseInput({
    signingSecret: null,
    signingPrivateKeyPem: privateKeyPem,
    surface: 'tool',
    requestedAction: 'discover',
    eligibility: { result: 'allowed', blockerCodes: [], source: 'product' },
    authority: { result: 'not_required', blockerCodes: [] },
    checkout: undefined,
    payment: undefined,
    generatedClaims: allowedGeneratedClaims(),
    freshness: {
      validUntil: '2026-07-06T10:12:01.000Z',
      staleAfter: '2026-07-06T10:12:01.000Z',
      reasonCodes: [],
      dependencies: [],
    },
  }));
  assert.throws(
    () => projectTrustedAgentCommerceDecisionEnvelope(staleAllowed, 'tool', {
      verificationPublicKeyPem: publicKeyPem,
      expectedRequest: liveRequestBinding(staleAllowed),
      now: '2026-07-06T10:12:02.000Z',
    }),
    /stale for projection/u,
  );
});

test('derived generated-claim provenance binds usable parent projections and request context deterministically', () => {
  const first = createGeneratedClaimDependencyProjection({
    generatedClaims: allowedGeneratedClaims(),
    sourceEnvelopeHash: sha256Hex('parent-envelope:first'),
    sourceEvidencePinHash: sha256Hex('parent-evidence:first'),
    sourceRecordKey: 'generated-claim:parent:first',
    requestedSurface: 'product_detail',
    requestedUse: 'quote',
    marketCode: 'EU',
  });
  const second = createGeneratedClaimDependencyProjection({
    generatedClaims: allowedGeneratedClaims(),
    sourceEnvelopeHash: sha256Hex('parent-envelope:second'),
    sourceEvidencePinHash: sha256Hex('parent-evidence:second'),
    sourceRecordKey: 'generated-claim:parent:second',
    requestedSurface: 'product_detail',
    requestedUse: 'quote',
    marketCode: 'EU',
  });
  const input = {
    childRecordKey: 'generated-claim:child',
    childPayloadHash: sha256Hex('derived child claim'),
  };
  const ordered = bindDerivedGeneratedClaimProvenance({
    ...input,
    dependencyProjections: [first, second],
  });
  const reversed = bindDerivedGeneratedClaimProvenance({
    ...input,
    dependencyProjections: [second, first],
  });

  assert.equal(ordered.canonicalHash, reversed.canonicalHash);
  assert.deepEqual(ordered.dependencyRefs, reversed.dependencyRefs);
  assert.equal(ordered.dependencyRefs.length, 2);
  assert.equal(ordered.inheritedRefusalCount, 0);
  assert.ok(
    ordered.dependencyRefs.every((entry) => entry.status === 'usable'),
  );

  const changedContextProjection = createGeneratedClaimDependencyProjection({
    generatedClaims: allowedGeneratedClaims(),
    sourceEnvelopeHash: first.sourceEnvelopeHash,
    sourceEvidencePinHash: first.sourceEvidencePinHash,
    sourceRecordKey: first.sourceRecordKey,
    requestedSurface: 'support',
    requestedUse: 'quote',
    marketCode: 'EU',
  });
  const changedContext = bindDerivedGeneratedClaimProvenance({
    ...input,
    dependencyProjections: [changedContextProjection, second],
  });
  assert.notEqual(changedContextProjection.projectionHash, first.projectionHash);
  assert.notEqual(changedContext.canonicalHash, ordered.canonicalHash);

  const changedParentProjection = createGeneratedClaimDependencyProjection({
    generatedClaims: allowedGeneratedClaims(),
    sourceEnvelopeHash: sha256Hex('parent-envelope:first:changed'),
    sourceEvidencePinHash: first.sourceEvidencePinHash,
    sourceRecordKey: first.sourceRecordKey,
    requestedSurface: 'product_detail',
    requestedUse: 'quote',
    marketCode: 'EU',
  });
  const changedParent = bindDerivedGeneratedClaimProvenance({
    ...input,
    dependencyProjections: [changedParentProjection, second],
  });
  assert.notEqual(changedParent.canonicalHash, ordered.canonicalHash);

  const changedEvidenceProjection = createGeneratedClaimDependencyProjection({
    generatedClaims: allowedGeneratedClaims(),
    sourceEnvelopeHash: first.sourceEnvelopeHash,
    sourceEvidencePinHash: sha256Hex('parent-evidence:first:changed'),
    sourceRecordKey: first.sourceRecordKey,
    requestedSurface: 'product_detail',
    requestedUse: 'quote',
    marketCode: 'EU',
  });
  const changedEvidence = bindDerivedGeneratedClaimProvenance({
    ...input,
    dependencyProjections: [changedEvidenceProjection, second],
  });
  assert.notEqual(changedEvidence.canonicalHash, ordered.canonicalHash);

  assert.throws(
    () => createGeneratedClaimDependencyProjection({
      generatedClaims: blockedGeneratedClaims(),
      sourceEnvelopeHash: sha256Hex('blocked-parent'),
      requestedSurface: 'product_detail',
      requestedUse: 'quote',
      status: 'usable',
    }),
    /conflicts with generated-claim state/u,
  );

  const hashes = calculateGeneratedClaimDependencyProjectionHashes(first);
  assert.deepEqual(hashes, {
    requestContextHash: first.requestContextHash,
    projectionHash: first.projectionHash,
  });
  assert.throws(
    () => bindDerivedGeneratedClaimProvenance({
      ...input,
      dependencyProjections: [
        { ...first, sourceRecordKey: 'generated-claim:tampered' },
      ],
    }),
    /projectionHash does not match/u,
  );
});

test('derived generated-claim provenance keeps refusal causal, multi-hop, and complete within its explicit limit', () => {
  const usable = createGeneratedClaimDependencyProjection({
    generatedClaims: allowedGeneratedClaims(),
    sourceEnvelopeHash: sha256Hex('usable-envelope'),
    sourceEvidencePinHash: sha256Hex('usable-evidence'),
    sourceRecordKey: 'generated-claim:usable',
    requestedSurface: 'product_detail',
    requestedUse: 'quote',
  });
  const refused = createGeneratedClaimDependencyProjection({
    generatedClaims: blockedGeneratedClaims(),
    sourceEnvelopeHash: sha256Hex('refused-envelope'),
    sourceEvidencePinHash: sha256Hex('refused-evidence'),
    sourceRecordKey: 'generated-claim:refused',
    requestedSurface: 'product_detail',
    requestedUse: 'quote',
  });

  const cleanChild = bindDerivedGeneratedClaimProvenance({
    childRecordKey: 'generated-claim:clean-child',
    childPayloadHash: sha256Hex('clean child'),
    dependencyProjections: [usable],
  });
  assert.equal(cleanChild.inheritedRefusalCount, 0);

  const taintedChild = bindDerivedGeneratedClaimProvenance({
    childRecordKey: 'generated-claim:tainted-child',
    childPayloadHash: sha256Hex('tainted child'),
    dependencyProjections: [usable, refused],
  });
  assert.equal(taintedChild.inheritedRefusalCount, 1);
  assert.equal(
    taintedChild.inheritedRefusals[0].sourceProjectionHash,
    refused.projectionHash,
  );

  const childProjection = createGeneratedClaimDependencyProjection({
    generatedClaims: {
      ...allowedGeneratedClaims(),
      allowed: false,
      status: 'inherited_refusal',
      blockerCodes: ['inherited_refusal'],
      inheritedRefusalCount: taintedChild.inheritedRefusalCount,
      axes: {
        ...allowedGeneratedClaims().axes,
        taint: { status: 'failed', blockerCodes: ['inherited_refusal'] },
      },
    },
    sourceEnvelopeHash: taintedChild.canonicalHash,
    sourceEvidencePinHash: sha256Hex('tainted-child-evidence'),
    sourceRecordKey: taintedChild.childRecordKey,
    requestedSurface: 'support',
    requestedUse: 'paraphrase',
    inheritedRefusals: taintedChild.inheritedRefusals,
  });
  const grandchild = bindDerivedGeneratedClaimProvenance({
    childRecordKey: 'generated-claim:grandchild',
    childPayloadHash: sha256Hex('grandchild'),
    dependencyProjections: [childProjection],
  });
  assert.equal(grandchild.inheritedRefusalCount, 2);
  assert.ok(
    grandchild.inheritedRefusals.some(
      (entry) => entry.sourceProjectionHash === refused.projectionHash,
    ),
  );
  assert.ok(
    grandchild.inheritedRefusals.some(
      (entry) => entry.sourceProjectionHash === childProjection.projectionHash,
    ),
  );

  const inheritedRefusals = Array.from(
    { length: GENERATED_CLAIM_INHERITED_REFUSAL_LIMIT },
    (_, index) => ({
      sourceProjectionHash: sha256Hex(`ancestor-projection:${index}`),
      sourceEnvelopeHash: sha256Hex(`ancestor-envelope:${index}`),
      sourceRecordKey: `generated-claim:ancestor:${index}`,
      status: 'refused_here',
      refusalKind: 'not_allowed_for_requested_use',
      axis: 'use',
      blockerCodes: [`ancestor_refusal_${index}`],
    }),
  );
  const atLimit = createGeneratedClaimDependencyProjection({
    generatedClaims: blockedGeneratedClaims(),
    sourceEnvelopeHash: sha256Hex('at-limit-envelope'),
    sourceEvidencePinHash: sha256Hex('at-limit-evidence'),
    sourceRecordKey: 'generated-claim:at-limit',
    requestedSurface: 'product_detail',
    requestedUse: 'quote',
    inheritedRefusals,
  });
  assert.throws(
    () => bindDerivedGeneratedClaimProvenance({
      childRecordKey: 'generated-claim:overflow',
      childPayloadHash: sha256Hex('overflow'),
      dependencyProjections: [atLimit],
    }),
    new RegExp(
      `inherited refusal lineage exceeds the ${GENERATED_CLAIM_INHERITED_REFUSAL_LIMIT}-entry limit`,
      'u',
    ),
  );
});

