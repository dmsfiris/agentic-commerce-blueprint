import { captureAgentCommerceDecisionEnvelope } from './boundary.mjs';
import { normalizeFreshnessDependency, isFresh } from './freshness.mjs';
import { stableCommercialJsonHash } from './hash.mjs';
import { normalizedIso, text } from './text.mjs';

function dependencyIdentity(dependency) {
  return `${dependency.kind}:${dependency.ref}`;
}

function currentDependency(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('current dependency must be an object.');
  }
  const ref = text(input.ref ?? input.id);
  if (!ref) throw new TypeError('current dependency ref is required.');
  const suppliedHash = text(input.hash);
  if (!suppliedHash && !Object.hasOwn(input, 'value')) {
    throw new TypeError('current dependency requires hash or value.');
  }
  const hash = suppliedHash ?? stableCommercialJsonHash(input.value);
  return normalizeFreshnessDependency({
    kind: input.kind,
    ref,
    hash,
    validUntil: input.validUntil,
    staleAfter: input.staleAfter,
  });
}

function dependencyExpired(dependency, now) {
  const checkedAt = new Date(normalizedIso(now, 'execution check time')).getTime();
  const horizons = [dependency.validUntil, dependency.staleAfter]
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return horizons.length > 0 && checkedAt > Math.min(...horizons);
}

/**
 * Compares the protected dependencies in a decision envelope with current
 * authoritative dependency snapshots immediately before use.
 *
 * Call this after trusted integrity and request-binding verification, or with
 * an envelope built inside the trusted process. This function does not verify
 * the authenticator and does not rebuild the decision. A mismatch means that
 * the existing decision must not be used and a fresh decision must be produced.
 */
export function evaluateAgentCommerceDecisionExecution({
  envelope,
  currentDependencies = [],
  now = new Date(),
}) {
  const capturedEnvelope = captureAgentCommerceDecisionEnvelope(envelope);

  const currentByIdentity = new Map();
  for (const input of currentDependencies) {
    const normalized = currentDependency(input);
    const identity = dependencyIdentity(normalized);
    if (currentByIdentity.has(identity)) {
      throw new TypeError(`duplicate current dependency: ${identity}.`);
    }
    currentByIdentity.set(identity, normalized);
  }

  const mismatches = [];
  for (const expected of capturedEnvelope.freshness?.dependencies ?? []) {
    const identity = dependencyIdentity(expected);
    const current = currentByIdentity.get(identity);
    if (!current) {
      mismatches.push({
        kind: expected.kind,
        ref: expected.ref,
        reasonCode: `${expected.kind}_dependency_missing`,
        expectedHash: expected.hash ?? null,
        currentHash: null,
      });
      continue;
    }
    if (expected.hash !== current.hash) {
      mismatches.push({
        kind: expected.kind,
        ref: expected.ref,
        reasonCode: `${expected.kind}_dependency_changed`,
        expectedHash: expected.hash ?? null,
        currentHash: current.hash ?? null,
      });
      continue;
    }
    if (dependencyExpired(current, now)) {
      mismatches.push({
        kind: expected.kind,
        ref: expected.ref,
        reasonCode: `${expected.kind}_dependency_expired`,
        expectedHash: expected.hash ?? null,
        currentHash: current.hash ?? null,
      });
    }
  }

  const reasonCodes = [];
  if (capturedEnvelope.basis?.allowed !== true) {
    reasonCodes.push(...(capturedEnvelope.basis?.reasonCodes ?? ['decision_not_allowed']));
  }
  if (!isFresh(capturedEnvelope.freshness, now)) reasonCodes.push('decision_stale');
  reasonCodes.push(...mismatches.map((entry) => entry.reasonCode));

  const uniqueReasonCodes = [...new Set(reasonCodes)].sort();
  return Object.freeze({
    permitted: uniqueReasonCodes.length === 0,
    requiresFreshDecision: mismatches.length > 0 || uniqueReasonCodes.includes('decision_stale'),
    reasonCodes: Object.freeze(uniqueReasonCodes),
    mismatches: Object.freeze(mismatches.map((entry) => Object.freeze(entry))),
  });
}
