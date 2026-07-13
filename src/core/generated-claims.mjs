import { agentCommerceReasonCodeHasAny } from './actions.mjs';
import { normalizeSha256, sha256Hex } from './hash.mjs';
import { text, uniqueOpaqueTexts, uniqueTexts } from './text.mjs';

export const GENERATED_CLAIM_STATUS = Object.freeze([
  'allowed',
  'requires_review',
  'refused_here',
  'inherited_refusal',
  'stale',
  'out_of_scope',
  'absent',
]);

export const GENERATED_CLAIM_AXIS_KEYS = Object.freeze([
  'source',
  'freshness',
  'scope',
  'surface',
  'use',
  'payload',
  'taint',
]);

export const GENERATED_CLAIM_DEPENDENCY_PROJECTION_STATUS = Object.freeze([
  'usable',
  'refused_here',
  'never_grounded',
]);

export const GENERATED_CLAIM_INHERITED_REFUSAL_LIMIT = 256;

function requiredText(value, field) {
  const normalized = text(value);
  if (!normalized) throw new TypeError(`${field} must be a non-empty string.`);
  return normalized;
}

function optionalTextValue(value) {
  return text(value);
}

function requiredSha256(value, field) {
  const normalized = normalizeSha256(value);
  if (!normalized) throw new TypeError(`${field} must be a valid SHA-256 hex value.`);
  return normalized;
}

function optionalSha256(value, field) {
  if (value == null || value === '') return null;
  return requiredSha256(value, field);
}

function normalizeDependencyProjectionStatus(value) {
  if (GENERATED_CLAIM_DEPENDENCY_PROJECTION_STATUS.includes(value)) return value;
  throw new TypeError(
    `status must be one of ${GENERATED_CLAIM_DEPENDENCY_PROJECTION_STATUS.join(', ')}.`,
  );
}

function normalizeProjectionAxes(input = {}) {
  return Object.fromEntries(
    GENERATED_CLAIM_AXIS_KEYS.map((axis) => {
      const configured = input[axis] ?? {};
      const status = normalizeAxisStatus(
        typeof configured === 'string' ? configured : configured.status,
      );
      if (!status) {
        throw new TypeError(`axes.${axis}.status must be passed, failed, or not_evaluated.`);
      }
      return [
        axis,
        {
          status,
          blockerCodes: uniqueTexts(
            typeof configured === 'object' && configured
              ? configured.blockerCodes
              : [],
          ),
        },
      ];
    }),
  );
}

function normalizeRequestContext(input = {}) {
  return {
    requestedSurface: requiredText(
      input.requestedSurface,
      'requestContext.requestedSurface',
    ).toLowerCase(),
    requestedUse: optionalTextValue(input.requestedUse)?.toLowerCase() ?? null,
    marketCode: optionalTextValue(input.marketCode)?.toLowerCase() ?? null,
    localeCode: optionalTextValue(input.localeCode)?.toLowerCase() ?? null,
    jurisdictionCode:
      optionalTextValue(input.jurisdictionCode)?.toLowerCase() ?? null,
    channelCode: optionalTextValue(input.channelCode)?.toLowerCase() ?? null,
  };
}

function normalizeInheritedRefusal(input = {}) {
  const status = normalizeDependencyProjectionStatus(input.status);
  if (status === 'usable') {
    throw new TypeError('Inherited refusal status cannot be usable.');
  }
  const axis = requiredText(input.axis, 'inheritedRefusal.axis').toLowerCase();
  if (!GENERATED_CLAIM_AXIS_KEYS.includes(axis)) {
    throw new TypeError(
      `inheritedRefusal.axis must be one of ${GENERATED_CLAIM_AXIS_KEYS.join(', ')}.`,
    );
  }
  return {
    sourceProjectionHash: optionalSha256(
      input.sourceProjectionHash,
      'inheritedRefusal.sourceProjectionHash',
    ),
    sourceEnvelopeHash: optionalSha256(
      input.sourceEnvelopeHash,
      'inheritedRefusal.sourceEnvelopeHash',
    ),
    sourceRecordKey: optionalTextValue(input.sourceRecordKey),
    status,
    refusalKind: requiredText(
      input.refusalKind,
      'inheritedRefusal.refusalKind',
    ).toLowerCase(),
    axis,
    blockerCodes: uniqueTexts(input.blockerCodes),
  };
}

function normalizeInheritedRefusals(values = []) {
  const byHash = new Map();
  for (const value of values ?? []) {
    const normalized = normalizeInheritedRefusal(value);
    byHash.set(sha256Hex(normalized), normalized);
  }
  const normalized = [...byHash.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
  if (normalized.length > GENERATED_CLAIM_INHERITED_REFUSAL_LIMIT) {
    throw new RangeError(
      `inherited refusal lineage exceeds the ${GENERATED_CLAIM_INHERITED_REFUSAL_LIMIT}-entry limit.`,
    );
  }
  return normalized;
}

function inferredDependencyProjectionStatus(claim) {
  if (claim.allowed) return 'usable';
  if (claim.status === 'absent') return 'never_grounded';
  return 'refused_here';
}

function inferredRefusalKind(claim) {
  if (claim.status === 'absent') return 'never_grounded';
  if (claim.status === 'inherited_refusal') return 'inherited_refusal';
  if (claim.status === 'stale') return 'freshness_failed';
  if (claim.status === 'out_of_scope') return 'not_allowed_for_requested_use';
  if (claim.status === 'requires_review') return 'requires_review';
  return 'refused_here';
}

function inferredRefusalAxis(claim) {
  const failed = GENERATED_CLAIM_AXIS_KEYS.find(
    (axis) => claim.axes[axis].status === 'failed',
  );
  if (failed) return failed;
  if (claim.status === 'absent') return 'source';
  if (claim.status === 'requires_review') return 'payload';
  return 'use';
}

function normalizeGeneratedClaimDependencyProjection(input = {}) {
  const requestContext = normalizeRequestContext(input.requestContext ?? input);
  const status = normalizeDependencyProjectionStatus(input.status);
  const refusalKind =
    status === 'usable'
      ? null
      : requiredText(input.refusalKind, 'refusalKind').toLowerCase();
  const refusalAxis =
    status === 'usable'
      ? null
      : requiredText(input.refusalAxis, 'refusalAxis').toLowerCase();

  if (refusalAxis && !GENERATED_CLAIM_AXIS_KEYS.includes(refusalAxis)) {
    throw new TypeError(
      `refusalAxis must be one of ${GENERATED_CLAIM_AXIS_KEYS.join(', ')}.`,
    );
  }
  if (status === 'usable' && (input.refusalKind != null || input.refusalAxis != null)) {
    throw new TypeError('A usable projection cannot carry refusal metadata.');
  }

  const axes = normalizeProjectionAxes(input.axes);
  const blockerCodes = uniqueTexts(input.blockerCodes);
  const inheritedRefusals = normalizeInheritedRefusals(input.inheritedRefusals);
  if (
    status === 'usable' &&
    (blockerCodes.length > 0 ||
      inheritedRefusals.length > 0 ||
      GENERATED_CLAIM_AXIS_KEYS.some((axis) => axes[axis].status !== 'passed'))
  ) {
    throw new TypeError(
      'A usable projection requires passed axes, no blockers, and no inherited refusal.',
    );
  }

  return {
    sourceEnvelopeHash: optionalSha256(
      input.sourceEnvelopeHash,
      'sourceEnvelopeHash',
    ),
    sourceEvidencePinHash: optionalSha256(
      input.sourceEvidencePinHash,
      'sourceEvidencePinHash',
    ),
    sourceRecordKey: optionalTextValue(input.sourceRecordKey),
    requestContext,
    status,
    refusalKind,
    refusalAxis,
    axes,
    blockerCodes,
    inheritedRefusals,
  };
}

function projectionHashPayload(projection, requestContextHash) {
  return {
    sourceEnvelopeHash: projection.sourceEnvelopeHash,
    sourceEvidencePinHash: projection.sourceEvidencePinHash,
    sourceRecordKey: projection.sourceRecordKey,
    requestContext: projection.requestContext,
    requestContextHash,
    status: projection.status,
    refusalKind: projection.refusalKind,
    refusalAxis: projection.refusalAxis,
    axes: projection.axes,
    blockerCodes: projection.blockerCodes,
    inheritedRefusals: projection.inheritedRefusals,
  };
}

export function calculateGeneratedClaimDependencyProjectionHashes(projection) {
  const normalized = normalizeGeneratedClaimDependencyProjection(projection);
  const requestContextHash = sha256Hex(normalized.requestContext);
  return {
    requestContextHash,
    projectionHash: sha256Hex(
      projectionHashPayload(normalized, requestContextHash),
    ),
  };
}

/**
 * Produces a canonical projection identity for a generated claim at one
 * consuming surface and use. The projection hash commits to both successful
 * and refused outcomes, their axis state, inherited lineage, and request context.
 */
export function createGeneratedClaimDependencyProjection(input = {}) {
  const claim =
    normalizeGeneratedClaims(input.generatedClaims) ??
    normalizeGeneratedClaims({ allowed: false, status: 'absent' });
  const inferredStatus = inferredDependencyProjectionStatus(claim);
  if (input.status != null && input.status !== inferredStatus) {
    throw new TypeError(
      `status ${input.status} conflicts with generated-claim state ${claim.status}.`,
    );
  }
  const status = inferredStatus;
  const normalized = normalizeGeneratedClaimDependencyProjection({
    sourceEnvelopeHash: input.sourceEnvelopeHash,
    sourceEvidencePinHash: input.sourceEvidencePinHash,
    sourceRecordKey: input.sourceRecordKey,
    requestContext: input.requestContext ?? input,
    status,
    refusalKind:
      status === 'usable'
        ? null
        : input.refusalKind ?? inferredRefusalKind(claim),
    refusalAxis:
      status === 'usable'
        ? null
        : input.refusalAxis ?? inferredRefusalAxis(claim),
    axes: claim.axes,
    blockerCodes: [...claim.blockerCodes, ...(input.blockerCodes ?? [])],
    inheritedRefusals: input.inheritedRefusals,
  });
  const hashes = calculateGeneratedClaimDependencyProjectionHashes(normalized);
  return { ...normalized, ...hashes };
}

function verifiedDependencyProjection(input) {
  const normalized = normalizeGeneratedClaimDependencyProjection(input);
  const hashes = calculateGeneratedClaimDependencyProjectionHashes(normalized);
  if (normalizeSha256(input.requestContextHash) !== hashes.requestContextHash) {
    throw new TypeError('Generated-claim dependency requestContextHash does not match its context.');
  }
  if (normalizeSha256(input.projectionHash) !== hashes.projectionHash) {
    throw new TypeError('Generated-claim dependency projectionHash does not match its semantics.');
  }
  return { ...normalized, ...hashes };
}

/**
 * Binds every direct projection actually used to derive a child claim.
 * Caller order is normalized, successful parents remain committed, inherited
 * refusal is causal to supplied dependencies, and lineage overflow fails.
 */
export function bindDerivedGeneratedClaimProvenance(input = {}) {
  const childRecordKey = requiredText(input.childRecordKey, 'childRecordKey');
  const childPayloadHash = requiredSha256(
    input.childPayloadHash,
    'childPayloadHash',
  );
  if (!Array.isArray(input.dependencyProjections) || input.dependencyProjections.length === 0) {
    throw new TypeError('dependencyProjections must contain at least one projection.');
  }

  const projectionMap = new Map();
  for (const dependency of input.dependencyProjections) {
    const projection = verifiedDependencyProjection(dependency);
    projectionMap.set(projection.projectionHash, projection);
  }
  const projections = [...projectionMap.values()].sort((left, right) =>
    left.projectionHash.localeCompare(right.projectionHash),
  );

  const dependencyRefs = projections.map((projection) => ({
    projectionHash: projection.projectionHash,
    sourceEnvelopeHash: projection.sourceEnvelopeHash,
    sourceEvidencePinHash: projection.sourceEvidencePinHash,
    sourceRecordKey: projection.sourceRecordKey,
    requestContextHash: projection.requestContextHash,
    status: projection.status,
    requestedSurface: projection.requestContext.requestedSurface,
    requestedUse: projection.requestContext.requestedUse,
    refusalKind: projection.refusalKind,
  }));

  const inheritedRefusals = normalizeInheritedRefusals(
    projections.flatMap((projection) => [
      ...projection.inheritedRefusals,
      ...(projection.status === 'usable'
        ? []
        : [
            {
              sourceProjectionHash: projection.projectionHash,
              sourceEnvelopeHash: projection.sourceEnvelopeHash,
              sourceRecordKey: projection.sourceRecordKey,
              status: projection.status,
              refusalKind: projection.refusalKind,
              axis: projection.refusalAxis,
              blockerCodes: projection.blockerCodes,
            },
          ]),
    ]),
  );

  const canonicalHash = sha256Hex({
    childRecordKey,
    childPayloadHash,
    dependencyRefs,
    inheritedRefusals,
  });

  return {
    childRecordKey,
    childPayloadHash,
    dependencyRefs,
    inheritedRefusals,
    inheritedRefusalCount: inheritedRefusals.length,
    canonicalHash,
    derivedFactRefs: [
      `generated_claim_provenance_hash:${canonicalHash}`,
      ...dependencyRefs.map(
        ({ projectionHash }) => `generated_claim_projection_hash:${projectionHash}`,
      ),
    ].sort(),
  };
}


export function normalizeAxisStatus(value) {
  if (
    value === 'passed' ||
    value === 'failed' ||
    value === 'not_evaluated'
  ) {
    return value;
  }
  if (value === 'unknown') return 'not_evaluated';
  return null;
}

function blockerMatchesAxis(code, axis) {
  if (axis === 'source') {
    return agentCommerceReasonCodeHasAny(code, ['source', 'ground', 'fact']);
  }
  if (axis === 'freshness') {
    return agentCommerceReasonCodeHasAny(code, [
      'fresh',
      'freshness',
      'stale',
      'expired',
    ]);
  }
  if (axis === 'scope') {
    return agentCommerceReasonCodeHasAny(code, [
      'scope',
      'market',
      'region',
      'jurisdiction',
      'channel',
    ]);
  }
  if (axis === 'surface') {
    return agentCommerceReasonCodeHasAny(code, ['surface']);
  }
  if (axis === 'use') {
    return agentCommerceReasonCodeHasAny(code, ['use', 'quote', 'allowed']);
  }
  if (axis === 'payload') {
    return agentCommerceReasonCodeHasAny(code, [
      'payload',
      'value',
      'text',
    ]);
  }
  return agentCommerceReasonCodeHasAny(code, ['taint', 'inherited']);
}

export function generatedClaimStatusFromBlockers(
  input = {},
  blockerCodes = [],
  allowed = false,
) {
  const claimIds = uniqueOpaqueTexts(input.claimIds);
  if (claimIds.length === 0) return 'absent';
  if (
    blockerCodes.some((code) =>
      agentCommerceReasonCodeHasAny(code, ['inherited', 'taint']),
    )
  ) {
    return 'inherited_refusal';
  }
  if (
    input.status === 'refused_here' ||
    blockerCodes.some((code) => code === 'generated_claim_refused_here')
  ) {
    return 'refused_here';
  }
  if (
    blockerCodes.some((code) =>
      agentCommerceReasonCodeHasAny(code, [
        'stale',
        'fresh',
        'freshness',
        'expired',
      ]),
    )
  ) {
    return 'stale';
  }
  if (
    blockerCodes.some((code) =>
      agentCommerceReasonCodeHasAny(code, [
        'scope',
        'surface',
        'use',
        'out',
      ]),
    )
  ) {
    return 'out_of_scope';
  }
  if (
    blockerCodes.some((code) =>
      agentCommerceReasonCodeHasAny(code, ['review', 'pending']),
    )
  ) {
    return 'requires_review';
  }
  if (allowed && blockerCodes.length === 0) return 'allowed';
  return input.status === 'allowed' ? 'allowed' : 'requires_review';
}

export function normalizeGeneratedClaimAxes(
  input = {},
  blockerCodes = [],
  allowed = false,
) {
  const axesInput = input.axes ?? {};
  return Object.fromEntries(
    GENERATED_CLAIM_AXIS_KEYS.map((axis) => {
      const configured = axesInput[axis] ?? {};
      const configuredStatus =
        typeof configured === 'string' ? configured : configured.status;
      const axisBlockers = uniqueTexts([
        ...((typeof configured === 'object' && configured)
          ? configured.blockerCodes ?? []
          : []),
        ...blockerCodes.filter((code) => blockerMatchesAxis(code, axis)),
      ]);
      const status =
        axisBlockers.length > 0
          ? 'failed'
          : normalizeAxisStatus(configuredStatus) ??
            (allowed ? 'passed' : 'not_evaluated');
      return [axis, { status, blockerCodes: axisBlockers }];
    }),
  );
}

function deriveGeneratedClaimStatus({
  axes,
  claimIds,
  blockerCodes,
  inheritedRefusalCount,
  requestedStatus,
  requestedAllowed,
}) {
  if (claimIds.length === 0) return 'absent';
  if (inheritedRefusalCount > 0 || axes.taint.status === 'failed') {
    return 'inherited_refusal';
  }
  if (
    requestedStatus === 'refused_here' ||
    blockerCodes.includes('generated_claim_refused_here')
  ) {
    return 'refused_here';
  }
  if (axes.freshness.status === 'failed') return 'stale';
  if (
    axes.scope.status === 'failed' ||
    axes.surface.status === 'failed' ||
    axes.use.status === 'failed'
  ) {
    return 'out_of_scope';
  }
  const allAxesPassed = GENERATED_CLAIM_AXIS_KEYS.every(
    (axis) => axes[axis].status === 'passed',
  );
  if (
    requestedAllowed &&
    requestedStatus === 'allowed' &&
    blockerCodes.length === 0 &&
    allAxesPassed
  ) {
    return 'allowed';
  }
  return 'requires_review';
}

export function normalizeGeneratedClaims(input) {
  if (!input) return undefined;
  let blockerCodes = uniqueTexts(input.blockerCodes);
  const claimIds = uniqueOpaqueTexts(input.claimIds);
  const sourceFactRefs = uniqueOpaqueTexts(input.sourceFactRefs);
  const derivedFactRefs = uniqueOpaqueTexts(input.derivedFactRefs);
  const allowedUses = uniqueTexts(input.allowedUses);
  if (claimIds.length === 0) {
    return {
      allowed: false,
      status: 'absent',
      claimIds: [],
      sourceFactRefs,
      derivedFactRefs,
      allowedUses: [],
      axes: Object.fromEntries(
        GENERATED_CLAIM_AXIS_KEYS.map((axis) => [
          axis,
          { status: 'not_evaluated', blockerCodes: [] },
        ]),
      ),
      blockerCodes: [],
      inheritedRefusalCount: 0,
    };
  }

  const requestedAllowed = Boolean(input.allowed ?? blockerCodes.length === 0);
  if (
    (requestedAllowed || input.status === 'allowed') &&
    allowedUses.length === 0
  ) {
    blockerCodes = uniqueTexts([
      ...blockerCodes,
      'generated_claim_allowed_use_missing',
    ]);
  }
  const requestedStatus = generatedClaimStatusFromBlockers(
    input,
    blockerCodes,
    requestedAllowed,
  );
  const inheritedRefusalCount = Math.max(
    0,
    Number(
      input.inheritedRefusalCount ??
        (requestedStatus === 'inherited_refusal' ? 1 : 0),
    ) || 0,
  );
  const intendedAllowed = requestedAllowed || requestedStatus === 'allowed';
  let axes = normalizeGeneratedClaimAxes(input, blockerCodes, intendedAllowed);
  const nonPassingAxes = GENERATED_CLAIM_AXIS_KEYS.filter(
    (axis) => axes[axis].status !== 'passed',
  );

  if (intendedAllowed && nonPassingAxes.length > 0) {
    blockerCodes = uniqueTexts([
      ...blockerCodes,
      ...nonPassingAxes.map(
        (axis) => `generated_claim_${axis}_axis_${axes[axis].status}`,
      ),
    ]);
    axes = normalizeGeneratedClaimAxes(input, blockerCodes, intendedAllowed);
  }

  if (requestedStatus === 'allowed' && input.allowed === false) {
    blockerCodes = uniqueTexts([
      ...blockerCodes,
      'generated_claim_allowed_flag_conflict',
    ]);
    axes = normalizeGeneratedClaimAxes(input, blockerCodes, intendedAllowed);
  }

  const allAxesPassed = GENERATED_CLAIM_AXIS_KEYS.every(
    (axis) => axes[axis].status === 'passed',
  );
  const status = deriveGeneratedClaimStatus({
    axes,
    claimIds,
    blockerCodes,
    inheritedRefusalCount,
    requestedStatus,
    requestedAllowed,
  });
  const allowed =
    requestedAllowed &&
    status === 'allowed' &&
    blockerCodes.length === 0 &&
    allAxesPassed &&
    inheritedRefusalCount === 0;

  return {
    allowed,
    status,
    claimIds,
    sourceFactRefs,
    derivedFactRefs,
    allowedUses,
    axes,
    blockerCodes,
    inheritedRefusalCount,
  };
}

/**
 * Generated claim text is a scoped capability, not a free field.
 * This helper performs the final value-hash recheck without exposing
 * the raw generated claim inside the decision envelope.
 */
export function canUseGeneratedClaimCapability(
  generatedClaims,
  {
    claimId,
    use,
    surface,
    requiredValueHash = null,
    observedValue = null,
    claimValueHash = null,
  } = {},
) {
  const claim =
    normalizeGeneratedClaims(generatedClaims) ??
    normalizeGeneratedClaims({ allowed: false, status: 'absent' });
  const blockers = [...claim.blockerCodes];
  const requestedClaimId = text(claimId);
  const requestedUse = text(use)?.toLowerCase() ?? null;
  const requestedSurface = text(surface)?.toLowerCase() ?? null;
  const providedValueHash =
    normalizeSha256(claimValueHash) ??
    (observedValue == null ? null : sha256Hex({ claimValue: observedValue }));
  const expectedHash = normalizeSha256(requiredValueHash);

  if (!claim.allowed) blockers.push(`generated_claim_status_${claim.status}`);
  if (!requestedClaimId) {
    blockers.push('generated_claim_id_required');
  } else if (!claim.claimIds.includes(requestedClaimId)) {
    blockers.push('generated_claim_id_not_available');
  }
  if (!requestedUse) {
    blockers.push('generated_claim_use_required');
  } else if (!claim.allowedUses.includes(requestedUse)) {
    blockers.push('generated_claim_use_not_allowed');
  }
  if (!requestedSurface) blockers.push('generated_claim_surface_required');
  if (claim.inheritedRefusalCount > 0) {
    blockers.push('generated_claim_inherited_refusal');
  }
  if (requestedSurface && claim.axes.surface.status === 'failed') {
    blockers.push('generated_claim_surface_failed');
  }
  if (!expectedHash) blockers.push('generated_claim_value_hash_required');
  if (!providedValueHash) blockers.push('generated_claim_value_missing');
  if (expectedHash && providedValueHash && providedValueHash !== expectedHash) {
    blockers.push('generated_claim_value_hash_mismatch');
  }

  for (const [axis, value] of Object.entries(claim.axes)) {
    if (value.status === 'failed') {
      blockers.push(`generated_claim_axis_${axis}_failed`);
    }
    if (axis !== 'taint' && value.status === 'not_evaluated') {
      blockers.push(`generated_claim_axis_${axis}_not_evaluated`);
    }
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
  const blockingAxes = uniqueTexts(
    state.blockingAxes ?? state.metadata?.blockingAxes ?? [],
  );
  const inheritedRefusalCount = Math.max(
    0,
    Number(
      state.inheritedRefusalCount ??
        state.metadata?.taint?.inheritedRefusals?.length ??
        0,
    ) || 0,
  );
  const blockerCodes = uniqueTexts([
    ...(state.outcomeCodes ?? []),
    ...blockingAxes.map((axis) => `generated_claim_${axis}_axis_blocked`),
    ...(input.blockerCodes ?? []),
  ]);
  const allowed = Boolean(
    input.allowed ??
      state.allowed ??
      (blockerCodes.length === 0 && inheritedRefusalCount === 0),
  );
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
