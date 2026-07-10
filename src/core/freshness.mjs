import { normalizeSha256, stableCommercialJsonHash } from './hash.mjs';
import { optionalIso, text } from './text.mjs';
import { uniqueAgentCommerceReasonCodes } from './actions.mjs';

export const FRESHNESS_DEPENDENCY_KINDS = Object.freeze([
  'product', 'price', 'inventory', 'policy', 'checkout', 'mandate', 'generated_claim', 'authority', 'payment', 'evidence',
]);

export function sha256DependencyHash({ providedHash, ref, kind }) {
  return normalizeSha256(providedHash)
    ?? normalizeSha256(ref)
    ?? stableCommercialJsonHash({ kind, ref });
}

export function inferFreshnessKindFromInputRef(key) {
  if (key === 'productRef') return 'product';
  if (key === 'policyRef') return 'policy';
  if (key === 'checkoutRef') return 'checkout';
  if (key === 'paymentRef') return 'payment';
  return 'authority';
}

export function inferFreshnessKindFromEvidenceType(type) {
  if (type.includes('inventory')) return 'inventory';
  if (type.includes('price')) return 'price';
  if (type.includes('policy')) return 'policy';
  if (type.includes('checkout') || type.includes('cart')) return 'checkout';
  if (type.includes('mandate')) return 'mandate';
  if (type.includes('claim') || type.includes('generated')) return 'generated_claim';
  if (type.includes('payment')) return 'payment';
  if (type.includes('authority')) return 'authority';
  return 'evidence';
}

export function normalizeFreshnessDependency(input) {
  const ref = text(input?.ref ?? input?.id);
  if (!ref) return null;
  const kind = FRESHNESS_DEPENDENCY_KINDS.includes(input.kind) ? input.kind : 'evidence';
  return {
    ref,
    kind,
    ...(input.validUntil != null ? { validUntil: optionalIso(input.validUntil) } : {}),
    ...(input.staleAfter != null ? { staleAfter: optionalIso(input.staleAfter) } : {}),
    hash: sha256DependencyHash({ providedHash: input.hash, ref, kind }),
  };
}

export function normalizeFreshnessDependencies(values) {
  const refs = (values ?? []).map(normalizeFreshnessDependency).filter(Boolean);
  return Array.from(new Map(refs.map((entry) => [`${entry.kind}:${entry.ref}:${entry.hash ?? ''}`, entry])).values())
    .sort((left, right) => `${left.kind}:${left.ref}`.localeCompare(`${right.kind}:${right.ref}`));
}

function earliestIso(values) {
  const times = values
    .map((value) => value ? new Date(value).getTime() : Number.NaN)
    .filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

export function freshnessBlockerCodes(basis) {
  return (basis?.reasonCodes ?? []).filter((code) => code.includes('stale') || code.includes('fresh') || code.includes('expired') || code.includes('missing'));
}

export function normalizeFreshness({ freshness, evaluatedAt, inputRefs, evidenceRefs, generatedClaims, basis }) {
  const dependencies = [];
  if (inputRefs) {
    for (const key of ['productRef', 'policyRef', 'checkoutRef', 'paymentRef', 'authorityRef']) {
      const ref = inputRefs[key];
      if (ref) {
        const kind = inferFreshnessKindFromInputRef(key);
        dependencies.push({ ref, kind, hash: sha256DependencyHash({ ref, kind }) });
      }
    }
  }
  for (const evidence of evidenceRefs ?? []) {
    dependencies.push({ ref: `${evidence.type}:${evidence.id}`, kind: inferFreshnessKindFromEvidenceType(evidence.type), hash: evidence.hash });
  }
  for (const ref of generatedClaims?.sourceFactRefs ?? []) {
    const kind = inferFreshnessKindFromEvidenceType(ref);
    dependencies.push({ ref, kind, hash: sha256DependencyHash({ ref, kind }) });
  }
  for (const ref of generatedClaims?.derivedFactRefs ?? []) {
    dependencies.push({ ref, kind: 'generated_claim', hash: sha256DependencyHash({ ref, kind: 'generated_claim' }) });
  }
  dependencies.push(...normalizeFreshnessDependencies(freshness?.dependencies));

  const uniqueDependencies = normalizeFreshnessDependencies(dependencies);
  const reasonCodes = uniqueAgentCommerceReasonCodes([
    ...freshnessBlockerCodes(basis),
    ...(freshness?.reasonCodes ?? []),
  ]);
  const validUntil = optionalIso(freshness?.validUntil)
    ?? earliestIso(uniqueDependencies.map((entry) => entry.validUntil ?? null))
    ?? (reasonCodes.length || basis.status !== 'allowed' ? evaluatedAt : null);
  const staleAfter = optionalIso(freshness?.staleAfter)
    ?? earliestIso(uniqueDependencies.map((entry) => entry.staleAfter ?? null))
    ?? validUntil;
  return { evaluatedAt, validUntil, staleAfter, reasonCodes, dependencies: uniqueDependencies };
}

export function isFresh(freshness, now = new Date().toISOString()) {
  if (!freshness) return false;
  const checkedAt = new Date(now).getTime();
  const validUntil = freshness.validUntil ? new Date(freshness.validUntil).getTime() : Number.POSITIVE_INFINITY;
  const staleAfter = freshness.staleAfter ? new Date(freshness.staleAfter).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(checkedAt) && checkedAt <= Math.min(validUntil, staleAfter) && (freshness.reasonCodes ?? []).length === 0;
}
