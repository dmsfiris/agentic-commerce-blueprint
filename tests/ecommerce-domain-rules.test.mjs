import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateDelegatedSpending,
  evaluateDeliveryPromise,
  evaluateGeneratedClaimEvidence,
  evaluateInventoryAvailability,
  evaluatePriceQuote,
  evaluatePromotionEligibility,
  evaluateReturnPolicy,
} from '../src/examples/ecommerce-domain-rules.mjs';

const NOW = new Date('2026-07-14T12:05:00.000Z');

test('price outcome is derived from amount and currency, not revision alone', () => {
  const quoted = { amountMinor: 8_000, currency: 'EUR', version: 1 };
  assert.equal(evaluatePriceQuote({ quotedFact: quoted, currentFact: { ...quoted, version: 2 } }).allowed, true);
  const changed = evaluatePriceQuote({ quotedFact: quoted, currentFact: { amountMinor: 9_500, currency: 'EUR', version: 2 } });
  assert.equal(changed.allowed, false);
  assert.equal(changed.blockerCode, 'price_changed');
});

test('promotion outcome is derived from current eligibility', () => {
  assert.equal(evaluatePromotionEligibility({ currentFact: { eligible: true, region: 'EU' } }).allowed, true);
  assert.equal(evaluatePromotionEligibility({ currentFact: { eligible: false, region: 'EU' } }).blockerCode, 'promotion_ineligible');
});

test('inventory outcome is derived from available and requested quantities', () => {
  assert.equal(evaluateInventoryAvailability({ currentFact: { available: 1 }, requestedQuantity: 1 }).allowed, true);
  assert.equal(evaluateInventoryAvailability({ currentFact: { available: 0 }, requestedQuantity: 1 }).blockerCode, 'inventory_unavailable');
});

test('delegated-spending outcome is derived from amount and currency scope', () => {
  assert.equal(evaluateDelegatedSpending({ currentFact: { maximumMinor: 10_000, totalMinor: 8_800, currency: 'EUR' } }).allowed, true);
  const over = evaluateDelegatedSpending({ currentFact: { maximumMinor: 10_000, totalMinor: 11_200, currency: 'EUR' } });
  assert.equal(over.authorityBlocked, true);
  assert.equal(over.blockerCode, 'delegated_spending_limit_exceeded');
  assert.equal(evaluateDelegatedSpending({ currentFact: { maximumMinor: 10_000, totalMinor: 8_800, mandateCurrency: 'EUR', checkoutCurrency: 'USD' } }).allowed, false);
});

test('generated-claim outcome is derived from evidence availability', () => {
  assert.equal(evaluateGeneratedClaimEvidence({ currentFact: { evidenceAvailable: true, text: 'IPX4 evidence' } }).allowed, true);
  const absent = evaluateGeneratedClaimEvidence({ currentFact: { evidenceAvailable: false, text: 'No current evidence' } });
  assert.deepEqual(
    { allowed: absent.allowed, blockerCode: absent.blockerCode, claimStatus: absent.claimStatus, failedAxis: absent.failedAxis },
    { allowed: false, blockerCode: 'generated_claim_evidence_missing', claimStatus: 'refused_here', failedAxis: 'source' },
  );
});

test('delivery outcome is derived from the promise validity horizon', () => {
  assert.equal(evaluateDeliveryPromise({ currentFact: { text: 'Delivery by 18 July', validUntil: '2026-07-14T13:00:00.000Z' }, now: NOW }).allowed, true);
  const stale = evaluateDeliveryPromise({ currentFact: { text: 'Recalculate delivery', validUntil: '2026-07-14T12:01:00.000Z' }, now: NOW });
  assert.equal(stale.blockerCode, 'delivery_promise_stale');
  assert.equal(stale.claimStatus, 'stale');
});

test('return-policy outcome is derived from request and applicability facts', () => {
  assert.equal(evaluateReturnPolicy({ currentFact: { returnRequested: true, returnable: true, text: '30 days' } }).allowed, true);
  const conflict = evaluateReturnPolicy({ currentFact: { returnRequested: true, returnable: false, text: 'Non-returnable' } });
  assert.equal(conflict.blockerCode, 'return_policy_conflict');
  assert.equal(conflict.failedAxis, 'scope');
});

test('domain rules reject incomplete or malformed raw facts', () => {
  assert.throws(() => evaluateInventoryAvailability({ currentFact: { available: -1 } }), /safe integer/u);
  assert.throws(() => evaluatePromotionEligibility({ currentFact: { eligible: 'yes', region: 'EU' } }), /boolean/u);
  assert.throws(() => evaluateDeliveryPromise({ currentFact: { text: 'x', validUntil: 'not-a-date' }, now: NOW }), /ISO date-time/u);
});
