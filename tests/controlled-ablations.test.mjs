import test from 'node:test';
import assert from 'node:assert/strict';
import { runControlledAblations } from '../src/examples/controlled-ablations.mjs';

const STUDY = runControlledAblations();
const RESULTS = new Map(STUDY.results.map((entry) => [entry.id, entry]));

function result(id) {
  const entry = RESULTS.get(id);
  assert.ok(entry, `missing ablation result: ${id}`);
  return entry;
}

test('removing execution-time dependency revalidation permits a stale changed-price decision', () => {
  const entry = result('dependency_revalidation_removed');
  assert.equal(entry.protectedOutcome.permitted, false);
  assert.equal(entry.protectedOutcome.requiresFreshDecision, true);
  assert.ok(entry.protectedOutcome.reasonCodes.includes('price_dependency_changed'));
  assert.equal(entry.ablatedOutcome.permitted, true);
  assert.equal(entry.safetyRegressionObserved, true);
});

test('removing detached verified-state capture permits post-verification state drift', () => {
  const entry = result('detached_capture_removed');
  assert.equal(entry.protectedOutcome.allowed, false);
  assert.equal(entry.protectedOutcome.status, 'blocked');
  assert.equal(entry.protectedOutcome.accessorReads, 1);
  assert.equal(entry.ablatedOutcome.allowed, true);
  assert.equal(entry.ablatedOutcome.status, 'allowed');
  assert.equal(entry.ablatedOutcome.driftObserved, true);
  assert.equal(entry.safetyRegressionObserved, true);
});

test('removing surface binding permits cross-surface redirection', () => {
  const entry = result('surface_binding_removed');
  assert.equal(entry.protectedOutcome.rejected, true);
  assert.match(entry.protectedOutcome.message, /surface mismatch/u);
  assert.equal(entry.ablatedOutcome.accepted, true);
  assert.equal(entry.ablatedOutcome.envelopeSurface, 'feed');
  assert.equal(entry.ablatedOutcome.projectedSurface, 'tool');
  assert.equal(entry.safetyRegressionObserved, true);
});

test('removing live request rebinding permits action, actor, and subject redirection', () => {
  const entry = result('live_request_binding_removed');
  assert.equal(entry.protectedOutcome.mismatchProbeCount, 3);
  assert.equal(entry.protectedOutcome.rejectedCount, 3);
  assert.equal(entry.ablatedOutcome.acceptedWithoutLiveRequest, true);
  assert.equal(entry.safetyRegressionObserved, true);
});

test('removing refusal propagation launders a refused parent into a usable child claim', () => {
  const entry = result('refusal_propagation_removed');
  assert.notEqual(entry.protectedOutcome.parentStatus, 'usable');
  assert.ok(entry.protectedOutcome.inheritedRefusalCount > 0);
  assert.equal(entry.protectedOutcome.childAllowed, false);
  assert.equal(entry.ablatedOutcome.inheritedRefusalCount, 0);
  assert.equal(entry.ablatedOutcome.childAllowed, true);
  assert.equal(entry.safetyRegressionObserved, true);
});

test('controlled ablation corpus is complete and deterministic at the summary level', () => {
  assert.equal(STUDY.studyType, 'controlled_negative_control_ablation');
  assert.equal(STUDY.ablationCount, 5);
  assert.equal(STUDY.protectedControlSuccessCount, 5);
  assert.equal(STUDY.expectedRegressionObservedCount, 5);
  assert.equal(STUDY.allExpectedRegressionsObserved, true);
  assert.deepEqual(
    STUDY.results.map((entry) => entry.id),
    [
      'dependency_revalidation_removed',
      'detached_capture_removed',
      'surface_binding_removed',
      'live_request_binding_removed',
      'refusal_propagation_removed',
    ],
  );
});
