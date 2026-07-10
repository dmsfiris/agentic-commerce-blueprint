import { normalizeSha256, sha256Hex } from './hash.mjs';
import { uniqueTexts } from './text.mjs';

export const GENERATED_CLAIM_STATUS = Object.freeze([
  'allowed',
  'requires_review',
  'refused_here',
  'inherited_refusal',
  'stale',
  'out_of_scope',
  'absent',
]);

export const GENERATED_CLAIM_AXIS_KEYS = Object.freeze(['source', 'freshness', 'scope', 'surface', 'use', 'payload', 'taint']);

export function normalizeAxisStatus(value) {
  if (value === 'passed' || value === 'failed' || value === 'not_evaluated') return value;
  if (value === 'unknown') return 'not_evaluated';
  return null;
}

function blockerMatchesAxis(code, axis) {
  if (axis === 'source') return code.includes('source') || code.includes('ground') || code.includes('fact');
  if (axis === 'freshness') return code.includes('fresh') || code.includes('stale') || code.includes('expired');
  if (axis === 'scope') return code.includes('scope') || code.includes('market') || code.includes('region') || code.includes('jurisdiction') || code.includes('channel');
  if (axis === 'surface') return code.includes('surface');
  if (axis === 'use') return code.includes('use') || code.includes('quote') || code.includes('allowed_use');
  if (axis === 'payload') return code.includes('payload') || code.includes('claim') || code.includes('review') || code.includes('pending');
  return code.includes('taint') || code.includes('inherited');
}

export function generatedClaimStatusFromBlockers(input = {}, blockerCodes = [], allowed = false) {
  if (GENERATED_CLAIM_STATUS.includes(input.status)) return input.status;
  if (allowed && blockerCodes.length === 0) return 'allowed';
  if (blockerCodes.some((code) => code.includes('inherited') || code.includes('taint'))) return 'inherited_refusal';
  if (blockerCodes.some((code) => code.includes('stale') || code.includes('freshness') || code.includes('expired'))) return 'stale';
  if (blockerCodes.some((code) => code.includes('scope') || code.includes('surface') || code.includes('use') || code.includes('out_of_scope'))) return 'out_of_scope';
  if (blockerCodes.some((code) => code.includes('review') || code.includes('pending'))) return 'requires_review';
  if ((input.claimIds?.length ?? 0) === 0 && !allowed) return 'absent';
  return 'refused_here';
}

export function normalizeGeneratedClaimAxes(input = {}, blockerCodes = [], allowed = false) {
  const axesInput = input.axes ?? {};
  return Object.fromEntries(GENERATED_CLAIM_AXIS_KEYS.map((axis) => {
    const configured = axesInput[axis] ?? {};
    const configuredStatus = typeof configured === 'string' ? configured : configured.status;
    const axisBlockers = uniqueTexts([
      ...((typeof configured === 'object' && configured) ? configured.blockerCodes ?? [] : []),
      ...blockerCodes.filter((code) => blockerMatchesAxis(code, axis)),
    ]);
    const status = normalizeAxisStatus(configuredStatus) ?? (axisBlockers.length ? 'failed' : allowed ? 'passed' : 'not_evaluated');
    return [axis, { status, blockerCodes: axisBlockers }];
  }));
}

export function normalizeGeneratedClaims(input) {
  if (!input) return undefined;
  const blockerCodes = uniqueTexts(input.blockerCodes);
  const allowedCandidate = Boolean(input.allowed ?? blockerCodes.length === 0);
  const status = generatedClaimStatusFromBlockers(input, blockerCodes, allowedCandidate);
  return {
    allowed: allowedCandidate && status === 'allowed',
    status,
    claimIds: uniqueTexts(input.claimIds),
    sourceFactRefs: uniqueTexts(input.sourceFactRefs ?? input.sourceRefs),
    derivedFactRefs: uniqueTexts(input.derivedFactRefs ?? input.derivedRefs),
    allowedUses: uniqueTexts(input.allowedUses),
    axes: normalizeGeneratedClaimAxes(input, blockerCodes, allowedCandidate),
    blockerCodes,
    inheritedRefusalCount: Math.max(0, Number(input.inheritedRefusalCount ?? (status === 'inherited_refusal' ? 1 : 0)) || 0),
  };
}

/**
 * Generated claim text is a scoped capability, not a free field.
 * This helper demonstrates the article's value-hash recheck without exposing
 * the raw generated claim inside the decision envelope.
 */
export function canUseGeneratedClaimCapability(generatedClaims, {
  claimId,
  use,
  surface,
  requiredValueHash = null,
  observedValue = null,
  claimValueHash = null,
} = {}) {
  const claim = normalizeGeneratedClaims(generatedClaims) ?? normalizeGeneratedClaims({ allowed: false, status: 'absent' });
  const blockers = [...claim.blockerCodes];
  const providedValueHash = normalizeSha256(claimValueHash) ?? (observedValue == null ? null : sha256Hex({ claimValue: observedValue }));
  const expectedHash = normalizeSha256(requiredValueHash);

  if (!claim.allowed) blockers.push(`generated_claim_status_${claim.status}`);
  if (claimId && !claim.claimIds.includes(claimId.toLowerCase())) blockers.push('generated_claim_id_not_available');
  if (use && !claim.allowedUses.includes(use.toLowerCase())) blockers.push('generated_claim_use_not_allowed');
  if (claim.inheritedRefusalCount > 0) blockers.push('generated_claim_inherited_refusal');
  if (surface && claim.axes.surface.status === 'failed') blockers.push('generated_claim_surface_failed');
  if (expectedHash && providedValueHash !== expectedHash) blockers.push('generated_claim_value_hash_mismatch');

  for (const [axis, value] of Object.entries(claim.axes)) {
    if (value.status === 'failed') blockers.push(`generated_claim_axis_${axis}_failed`);
    if (axis !== 'taint' && value.status === 'not_evaluated') blockers.push(`generated_claim_axis_${axis}_not_evaluated`);
  }

  return {
    allowed: blockers.length === 0,
    status: blockers.length === 0 ? 'allowed' : 'refused_here',
    blockerCodes: uniqueTexts(blockers),
    axes: claim.axes,
    providedValueHash,
    requiredValueHash: expectedHash,
  };
}

export function buildGeneratedClaimsFromPolicyProjection(input = {}) {
  const state = input.projectionState ?? {};
  const blockingAxes = uniqueTexts(state.blockingAxes ?? state.metadata?.blockingAxes ?? []);
  const inheritedRefusalCount = Math.max(0, Number(state.inheritedRefusalCount ?? state.metadata?.taint?.inheritedRefusals?.length ?? 0) || 0);
  const blockerCodes = uniqueTexts([
    ...(state.outcomeCodes ?? []),
    ...blockingAxes.map((axis) => `generated_claim_${axis}_axis_blocked`),
    ...(input.blockerCodes ?? []),
  ]);
  const allowed = Boolean(input.allowed ?? state.allowed ?? (blockerCodes.length === 0 && inheritedRefusalCount === 0));
  return normalizeGeneratedClaims({
    allowed,
    status: input.status,
    claimIds: input.claimIds ?? state.claimIds,
    sourceFactRefs: input.sourceFactRefs ?? state.sourceFactRefs,
    derivedFactRefs: input.derivedFactRefs ?? state.derivedFactRefs,
    allowedUses: input.allowedUses ?? state.allowedUses,
    blockerCodes,
    inheritedRefusalCount,
    axes: input.axes ?? state.axes,
  });
}
