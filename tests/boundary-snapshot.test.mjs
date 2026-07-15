import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentCommerceDecisionEnvelope,
  captureAgentCommerceDecisionEnvelope,
  projectTrustedAgentCommerceDecisionEnvelope,
} from '../src/index.mjs';

const COMMON = {
  decisionId: 'decision:verified-state-identity',
  evaluatedAt: '2026-07-14T12:00:00.000Z',
  surface: 'feed',
  requestedAction: 'discover',
  subject: { productId: 'product:verified-state-identity' },
  actor: { actorType: 'agent', agentId: 'agent:boundary-test' },
  freshness: { validUntil: '2026-07-14T13:00:00.000Z' },
};

function blockedEnvelope() {
  return buildAgentCommerceDecisionEnvelope({
    ...COMMON,
    eligibility: {
      result: 'blocked',
      source: 'product',
      blockerCodes: ['product_not_discoverable'],
    },
    authority: { result: 'not_required', blockerCodes: [] },
  });
}

function allowedEnvelope() {
  return buildAgentCommerceDecisionEnvelope({
    ...COMMON,
    eligibility: { result: 'allowed', source: 'product', blockerCodes: [] },
    authority: { result: 'not_required', blockerCodes: [] },
  });
}

function projectionOptions() {
  return {
    allowUnsignedLocalDevelopment: true,
    expectedRequest: {
      requestedAction: COMMON.requestedAction,
      subject: COMMON.subject,
      actor: COMMON.actor,
    },
    now: new Date('2026-07-14T12:01:00.000Z'),
  };
}

test('boundary capture creates a detached deeply frozen snapshot', () => {
  const external = structuredClone(blockedEnvelope());
  const captured = captureAgentCommerceDecisionEnvelope(external);

  assert.notEqual(captured, external);
  assert.deepEqual(captured, external);
  assert.equal(Object.isFrozen(captured), true);
  assert.equal(Object.isFrozen(captured.basis), true);
  assert.equal(Object.isFrozen(captured.basis.reasonCodes), true);

  external.basis.allowed = true;
  external.basis.status = 'allowed';
  assert.equal(captured.basis.allowed, false);
  assert.equal(captured.basis.status, 'blocked');
});

test('trusted projection preserves the state that was captured and verified', () => {
  const blocked = blockedEnvelope();
  const allowed = allowedEnvelope();
  const live = structuredClone(blocked);
  let authenticatorReads = 0;
  let drift = false;
  const originalAuthenticator = live.authenticator;

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

  const projection = projectTrustedAgentCommerceDecisionEnvelope(
    live,
    'feed',
    projectionOptions(),
  );

  assert.equal(authenticatorReads, 1);
  assert.equal(drift, false);
  assert.equal(projection.allowed, false);
  assert.equal(projection.status, 'blocked');
  assert.ok(projection.reasonCodes.includes('product_not_discoverable'));
});

test('nested changing accessors are captured once before verification', () => {
  const blocked = blockedEnvelope();
  const live = structuredClone(blocked);
  let reads = 0;
  const protectedAllowed = blocked.basis.allowed;
  Object.defineProperty(live.basis, 'allowed', {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      return reads === 1 ? protectedAllowed : true;
    },
  });

  const projection = projectTrustedAgentCommerceDecisionEnvelope(
    live,
    'feed',
    projectionOptions(),
  );

  assert.equal(reads, 1);
  assert.equal(projection.allowed, false);
});

test('boundary capture rejects sparse arrays', () => {
  const external = structuredClone(blockedEnvelope());
  external.basis.reasonCodes = new Array(1);
  assert.throws(
    () => captureAgentCommerceDecisionEnvelope(external),
    /sparse_array/u,
  );
});

test('boundary capture does not invoke custom array iterators', () => {
  const external = structuredClone(blockedEnvelope());
  Object.defineProperty(external.basis.reasonCodes, Symbol.iterator, {
    value() {
      throw new Error('custom iterator must not run');
    },
  });
  const captured = captureAgentCommerceDecisionEnvelope(external);
  assert.ok(captured.basis.reasonCodes.includes('product_not_discoverable'));
});

test('boundary capture converts access failures into a bounded parse error', () => {
  const hostile = Object.create(null);
  Object.defineProperty(hostile, 'contractVersion', {
    enumerable: true,
    get() {
      throw new Error('hostile getter');
    },
  });
  assert.throws(
    () => captureAgentCommerceDecisionEnvelope(hostile),
    /input_access_failed/u,
  );
});

test('boundary capture rejects non-JSON runtime values and cycles', () => {
  const withFunction = structuredClone(blockedEnvelope());
  withFunction.extra = () => true;
  assert.throws(
    () => captureAgentCommerceDecisionEnvelope(withFunction),
    /non_json_value/u,
  );

  const cyclic = structuredClone(blockedEnvelope());
  cyclic.self = cyclic;
  assert.throws(
    () => captureAgentCommerceDecisionEnvelope(cyclic),
    /cyclic_value/u,
  );
});

test('boundary capture normalizes revoked proxy failures', () => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.throws(
    () => captureAgentCommerceDecisionEnvelope(proxy),
    /input_access_failed/u,
  );
});

test('boundary capture rejects array allocation beyond the node budget', () => {
  const external = structuredClone(blockedEnvelope());
  external.basis.reasonCodes = Array.from({ length: 4 }, () => 'product_not_discoverable');
  assert.throws(
    () => captureAgentCommerceDecisionEnvelope(external, { maxNodes: 3 }),
    /array_length_limit_exceeded|node_limit_exceeded/u,
  );
});
