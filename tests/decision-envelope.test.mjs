import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  AGENT_COMMERCE_DECISION_ACTION_RULES,
  AGENT_COMMERCE_DECISION_ACTIONS,
  buildAgentCommerceDecisionEnvelope,
  canUseGeneratedClaimCapability,
  mcpDecisionProjection,
  normalizeEvidenceRefs,
  operatorDecisionProjection,
  publicDecisionProjection,
  sha256Hex,
  verifyDecisionEnvelopeAuthenticator,
} from '../src/index.mjs';
import {
  baseInput,
  allowedGeneratedClaims,
  blockedGeneratedClaims,
  DEMO_SIGNING_SECRET,
} from '../src/examples/fixtures.mjs';

const sha = /^[a-f0-9]{64}$/u;

test('v4 envelope exposes the app-aligned contract and content-addressed rule set', () => {
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

test('requires_confirmation remains distinct from blocked and review states', () => {
  const envelope = buildAgentCommerceDecisionEnvelope(
    baseInput({
      requestedAction: 'prepare_checkout',
      eligibility: {
        requiresConfirmation: true,
        blockerCodes: [],
        source: 'checkout',
      },
      payment: undefined,
      generatedClaims: undefined,
    }),
  );
  assert.equal(envelope.eligibility.result, 'requires_confirmation');
  assert.equal(envelope.basis.status, 'requires_confirmation');
  assert.equal(envelope.basis.allowed, false);
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

test('evidence refs carry required SHA-256 pins', () => {
  const refs = normalizeEvidenceRefs([
    {
      type: 'policy_fact',
      id: 'policy:returns:seven-day',
      source: { days: 7 },
    },
  ]);
  assert.equal(refs[0].hashAlgorithm, 'sha256');
  assert.match(refs[0].hash, sha);
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
  assert.equal(envelope.generatedClaims.status, 'requires_review');
  assert.equal(envelope.generatedClaims.inheritedRefusalCount, 1);
  assert.equal(envelope.generatedClaims.axes.taint.status, 'failed');
  assert.equal(
    envelope.basis.reasonCodes.includes('generated_claim_requires_review'),
    false,
  );
  assert.equal(envelope.payment.paymentDispatchAttempted, false);
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
  assert.equal(publicProjection.status, 'requires_revalidation');
  assert.deepEqual(publicProjection.reasonCodes, ['freshness.stale']);
  assert.equal(mcpProjection.tool_result_type, 'agent_commerce_decision');
  assert.deepEqual(mcpProjection.reasonCodes, envelope.basis.reasonCodes);
  assert.deepEqual(operatorProjection.reasonCodes, envelope.basis.reasonCodes);
  assert.ok(operatorProjection.ownerCodes.includes('operator:stale_inventory'));
});
