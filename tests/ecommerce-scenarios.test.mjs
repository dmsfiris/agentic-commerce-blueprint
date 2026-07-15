import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ECOMMERCE_SCENARIO_IDS,
  runEcommerceScenarios,
} from '../src/examples/ecommerce-scenarios.mjs';

test('realistic ecommerce scenarios stop changed commercial state consistently', () => {
  const summary = runEcommerceScenarios();
  assert.equal(summary.scenarioCount, ECOMMERCE_SCENARIO_IDS.length);
  assert.deepEqual(summary.scenarioIds, ECOMMERCE_SCENARIO_IDS);
  assert.equal(summary.baselinePermittedCount, summary.scenarioCount - 1);
  assert.equal(summary.changedStatePreventedCount, summary.scenarioCount);
  assert.equal(summary.refreshedSafeOutcomeCount, summary.scenarioCount);
  assert.equal(summary.surfaceConsistentCount, summary.scenarioCount);
  assert.equal(summary.traceabilityCompleteCount, summary.scenarioCount);

  for (const result of summary.results) {
    assert.equal(result.changedStatePermitted, false, result.id);
    assert.notEqual(result.refreshedStatus, 'allowed', result.id);
    assert.equal(result.surfaceConsistent, true, result.id);
    assert.equal(result.traceabilityComplete, true, result.id);
  }

  const stateIdentity = summary.results.find(
    (entry) => entry.id === 'verified_state_identity',
  );
  assert.deepEqual(
    stateIdentity && {
      accessorReads: stateIdentity.accessorReads,
      initialStatus: stateIdentity.initialStatus,
      refreshedStatus: stateIdentity.refreshedStatus,
      changedStatePermitted: stateIdentity.changedStatePermitted,
    },
    {
      accessorReads: 1,
      initialStatus: 'blocked',
      refreshedStatus: 'blocked',
      changedStatePermitted: false,
    },
  );
});

import {
  buildAgentCommerceDecisionEnvelope,
  evaluateAgentCommerceDecisionExecution,
  sha256Hex,
} from '../src/index.mjs';

function executionEnvelope() {
  return buildAgentCommerceDecisionEnvelope({
    decisionId: 'decision:execution-test',
    evaluatedAt: '2026-07-14T12:00:00.000Z',
    surface: 'checkout',
    requestedAction: 'complete_checkout',
    subject: { productId: 'product:test', checkoutId: 'checkout:test' },
    actor: { actorType: 'agent', agentId: 'agent:test' },
    eligibility: { result: 'allowed', source: 'combined', blockerCodes: [] },
    authority: { result: 'allowed', blockerCodes: [] },
    checkout: { state: 'requires_payment', validForRequestedAction: true, blockerCodes: [] },
    payment: { authorityResult: 'allowed', paymentDispatchAttempted: false, blockerCodes: [] },
    evidenceRefs: [
      { type: 'price_snapshot', id: 'price:test', hash: sha256Hex({ amountMinor: 100 }) },
    ],
    freshness: {
      validUntil: '2026-07-14T13:00:00.000Z',
      staleAfter: '2026-07-14T13:00:00.000Z',
    },
  });
}

test('execution comparison fails closed for missing, expired, and duplicate dependencies', () => {
  const envelope = executionEnvelope();
  const current = envelope.freshness.dependencies.map((entry) => ({ ...entry }));
  const missing = evaluateAgentCommerceDecisionExecution({
    envelope,
    currentDependencies: current.slice(1),
    now: new Date('2026-07-14T12:05:00.000Z'),
  });
  assert.equal(missing.permitted, false);
  assert.equal(missing.requiresFreshDecision, true);
  assert.ok(missing.reasonCodes.some((code) => code.endsWith('_dependency_missing')));

  const expired = evaluateAgentCommerceDecisionExecution({
    envelope,
    currentDependencies: current.map((entry) => ({
      ...entry,
      validUntil: '2026-07-14T12:01:00.000Z',
    })),
    now: new Date('2026-07-14T12:05:00.000Z'),
  });
  assert.equal(expired.permitted, false);
  assert.ok(expired.reasonCodes.some((code) => code.endsWith('_dependency_expired')));

  assert.throws(
    () =>
      evaluateAgentCommerceDecisionExecution({
        envelope,
        currentDependencies: [current[0], current[0]],
        now: new Date('2026-07-14T12:05:00.000Z'),
      }),
    /duplicate current dependency/u,
  );
});
