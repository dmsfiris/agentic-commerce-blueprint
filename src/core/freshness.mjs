import { normalizeSha256, stableCommercialJsonHash } from './hash.mjs';
import { normalizedIso, optionalIso, text } from './text.mjs';
import {
  agentCommerceReasonCodeHasAny,
  uniqueAgentCommerceReasonCodes,
} from './actions.mjs';

export const FRESHNESS_DEPENDENCY_KINDS = Object.freeze([
  'product',
  'price',
  'inventory',
  'policy',
  'checkout',
  'mandate',
  'generated_claim',
  'authority',
  'payment',
  'evidence',
]);

function freshnessDependencyKind(value) {
  if (FRESHNESS_DEPENDENCY_KINDS.includes(value)) return value;
  throw new TypeError(`Unsupported freshness dependency kind: ${String(value)}.`);
}

export function sha256DependencyHash({ providedHash, ref, kind }) {
  const supplied = text(providedHash);
  const normalized = normalizeSha256(supplied);
  if (normalized) return normalized;
  if (supplied) {
    throw new TypeError(
      `Freshness dependency ${kind}:${ref} must use a valid SHA-256 hash when a hash is supplied.`,
    );
  }
  return normalizeSha256(ref) ?? stableCommercialJsonHash({ kind, ref });
}

export function inferFreshnessKindFromInputRef(key) {
  if (key === 'productRef') return 'product';
  if (key === 'policyRef') return 'policy';
  if (key === 'checkoutRef') return 'checkout';
  if (key === 'paymentRef') return 'payment';
  return 'authority';
}

export function inferFreshnessKindFromEvidenceType(type) {
  const normalized = text(type)?.toLowerCase() ?? '';
  if (agentCommerceReasonCodeHasAny(normalized, ['inventory'])) {
    return 'inventory';
  }
  if (agentCommerceReasonCodeHasAny(normalized, ['price'])) return 'price';
  if (agentCommerceReasonCodeHasAny(normalized, ['policy'])) return 'policy';
  if (agentCommerceReasonCodeHasAny(normalized, ['checkout', 'cart'])) {
    return 'checkout';
  }
  if (agentCommerceReasonCodeHasAny(normalized, ['mandate'])) return 'mandate';
  if (agentCommerceReasonCodeHasAny(normalized, ['claim', 'generated'])) {
    return 'generated_claim';
  }
  if (agentCommerceReasonCodeHasAny(normalized, ['payment'])) return 'payment';
  if (agentCommerceReasonCodeHasAny(normalized, ['authority'])) {
    return 'authority';
  }
  return 'evidence';
}

function dependencyIdentity({ kind, ref }) {
  return `${kind}:${ref}`;
}

function earliestIso(values) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

function normalizeExplicitFreshnessDependencies(values) {
  const groups = new Map();
  for (const input of values ?? []) {
    const ref = text(input?.ref ?? input?.id);
    if (!ref) continue;
    const kind = freshnessDependencyKind(input.kind);
    const identity = dependencyIdentity({ kind, ref });
    const group = groups.get(identity) ?? {
      ref,
      kind,
      hashes: new Set(),
      validUntil: [],
      staleAfter: [],
    };
    if (text(input.hash)) {
      group.hashes.add(
        sha256DependencyHash({ providedHash: input.hash, ref, kind }),
      );
    }
    const validUntil = optionalIso(
      input.validUntil,
      `freshness dependency ${identity} validUntil`,
    );
    const staleAfter = optionalIso(
      input.staleAfter,
      `freshness dependency ${identity} staleAfter`,
    );
    if (validUntil) group.validUntil.push(validUntil);
    if (staleAfter) group.staleAfter.push(staleAfter);
    groups.set(identity, group);
  }

  return [...groups.entries()]
    .map(([identity, group]) => {
      if (group.hashes.size > 1) {
        throw new TypeError(
          `Freshness dependency ${identity} cannot carry conflicting SHA-256 hashes.`,
        );
      }
      const hash = [...group.hashes][0] ?? null;
      return {
        ref: group.ref,
        kind: group.kind,
        ...(group.validUntil.length
          ? { validUntil: earliestIso(group.validUntil) }
          : {}),
        ...(group.staleAfter.length
          ? { staleAfter: earliestIso(group.staleAfter) }
          : {}),
        ...(hash ? { hash } : {}),
      };
    })
    .sort((left, right) =>
      dependencyIdentity(left).localeCompare(dependencyIdentity(right)),
    );
}

function mergeFreshnessDependencies(values) {
  const dependencies = new Map();
  for (const dependency of values) {
    const identity = dependencyIdentity(dependency);
    const existing = dependencies.get(identity);
    if (existing?.hash && dependency.hash && existing.hash !== dependency.hash) {
      throw new TypeError(
        `Freshness dependency ${identity} cannot carry conflicting SHA-256 hashes.`,
      );
    }
    const validUntil = earliestIso([
      existing?.validUntil ?? null,
      dependency.validUntil ?? null,
    ]);
    const staleAfter = earliestIso([
      existing?.staleAfter ?? null,
      dependency.staleAfter ?? null,
    ]);
    const hash = dependency.hash ?? existing?.hash ?? null;
    dependencies.set(identity, {
      ref: dependency.ref,
      kind: dependency.kind,
      ...(validUntil ? { validUntil } : {}),
      ...(staleAfter ? { staleAfter } : {}),
      ...(hash ? { hash } : {}),
    });
  }

  return [...dependencies.values()]
    .map((dependency) => ({
      ...dependency,
      hash:
        dependency.hash ??
        sha256DependencyHash({
          ref: dependency.ref,
          kind: dependency.kind,
        }),
    }))
    .sort((left, right) =>
      dependencyIdentity(left).localeCompare(dependencyIdentity(right)),
    );
}

export function normalizeFreshnessDependency(input) {
  const normalized = normalizeExplicitFreshnessDependencies([input]);
  if (normalized.length === 0) return null;
  return mergeFreshnessDependencies(normalized)[0];
}

export function normalizeFreshnessDependencies(values) {
  return mergeFreshnessDependencies(
    normalizeExplicitFreshnessDependencies(values),
  );
}

export function freshnessBlockerCodes(basis) {
  return (basis?.reasonCodes ?? []).filter((code) =>
    agentCommerceReasonCodeHasAny(code, [
      'stale',
      'fresh',
      'freshness',
      'expired',
      'missing',
    ]),
  );
}

export function normalizeFreshness({
  freshness,
  evaluatedAt,
  inputRefs,
  evidenceRefs,
  generatedClaims,
  basis,
}) {
  const dependencies = [];
  const explicitDependencies = normalizeExplicitFreshnessDependencies(
    freshness?.dependencies,
  );
  const explicitIdentities = new Set(
    explicitDependencies.map(dependencyIdentity),
  );
  const addInferredDependency = (dependency) => {
    if (!explicitIdentities.has(dependencyIdentity(dependency))) {
      dependencies.push(dependency);
    }
  };

  if (inputRefs) {
    for (const key of [
      'productRef',
      'policyRef',
      'checkoutRef',
      'paymentRef',
      'authorityRef',
    ]) {
      const ref = inputRefs[key];
      if (ref) {
        const kind = inferFreshnessKindFromInputRef(key);
        addInferredDependency({
          ref,
          kind,
          hash: sha256DependencyHash({ ref, kind }),
        });
      }
    }
  }

  for (const evidence of evidenceRefs ?? []) {
    dependencies.push({
      ref: `${evidence.type}:${evidence.id}`,
      kind: inferFreshnessKindFromEvidenceType(evidence.type),
      hash: evidence.hash,
    });
  }

  for (const ref of generatedClaims?.sourceFactRefs ?? []) {
    const kind = inferFreshnessKindFromEvidenceType(ref);
    addInferredDependency({
      ref,
      kind,
      hash: sha256DependencyHash({ ref, kind }),
    });
  }

  for (const ref of generatedClaims?.derivedFactRefs ?? []) {
    addInferredDependency({
      ref,
      kind: 'generated_claim',
      hash: sha256DependencyHash({ ref, kind: 'generated_claim' }),
    });
  }

  const uniqueDependencies = mergeFreshnessDependencies([
    ...dependencies,
    ...explicitDependencies,
  ]);
  const reasonCodes = uniqueAgentCommerceReasonCodes([
    ...freshnessBlockerCodes(basis),
    ...(freshness?.reasonCodes ?? []),
  ]);
  const validUntil =
    optionalIso(freshness?.validUntil, 'freshness.validUntil') ??
    earliestIso(uniqueDependencies.map((entry) => entry.validUntil ?? null)) ??
    (reasonCodes.length || basis.status !== 'allowed' ? evaluatedAt : null);
  const staleAfter =
    optionalIso(freshness?.staleAfter, 'freshness.staleAfter') ??
    earliestIso(uniqueDependencies.map((entry) => entry.staleAfter ?? null)) ??
    validUntil;

  return {
    evaluatedAt,
    validUntil,
    staleAfter,
    reasonCodes,
    dependencies: uniqueDependencies,
  };
}

export function isFresh(freshness, now = new Date().toISOString()) {
  if (!freshness) return false;
  const checkedAt = new Date(normalizedIso(now, 'freshness check time')).getTime();
  const validUntil = freshness.validUntil
    ? new Date(freshness.validUntil).getTime()
    : Number.POSITIVE_INFINITY;
  const staleAfter = freshness.staleAfter
    ? new Date(freshness.staleAfter).getTime()
    : Number.POSITIVE_INFINITY;
  return (
    checkedAt <= Math.min(validUntil, staleAfter) &&
    (freshness.reasonCodes ?? []).length === 0
  );
}
