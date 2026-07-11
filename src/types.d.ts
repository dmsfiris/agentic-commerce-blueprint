export const AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION:
  'agent-commerce-decision-envelope-v4';
export const AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION:
  'agent-commerce-decision-envelope-schema-v4';
export const AGENT_COMMERCE_DECISION_DEFAULT_RULE_SET_VERSION:
  'agent-commerce-decision-rules-v4';
export const AGENT_COMMERCE_DECISION_DEFAULT_AUTHENTICATOR_KEY_ID: string;
export const AGENT_COMMERCE_DECISION_DEFAULT_VERIFICATION_KEY_REF: string;

export type AgentCommerceDecisionSurface =
  | 'feed'
  | 'tool'
  | 'checkout'
  | 'admin'
  | 'support'
  | 'protocol';

export type AgentCommerceDecisionActorType =
  | 'agent'
  | 'buyer'
  | 'merchant'
  | 'operator'
  | 'system';

export type AgentCommerceDecisionAction =
  | 'discover'
  | 'compare'
  | 'quote_policy'
  | 'add_to_cart'
  | 'prepare_checkout'
  | 'delegate_payment'
  | 'complete_checkout'
  | 'show_generated_claim'
  | 'explain';

export type AgentCommerceDecisionEligibilityResult =
  | 'allowed'
  | 'blocked'
  | 'requires_revalidation'
  | 'requires_review'
  | 'requires_confirmation';

export type AgentCommerceDecisionProjectionStatus =
  AgentCommerceDecisionEligibilityResult;

export type AgentCommerceDecisionAuthorityResult =
  | 'allowed'
  | 'blocked'
  | 'not_required';

export type AgentCommerceDecisionPaymentAuthorityResult =
  | 'allowed'
  | 'blocked'
  | 'not_evaluated';

export type AgentCommerceDecisionGeneratedClaimStatus =
  | 'allowed'
  | 'requires_review'
  | 'refused_here'
  | 'inherited_refusal'
  | 'stale'
  | 'out_of_scope'
  | 'absent';

export type AgentCommerceDecisionGeneratedClaimAxisStatus =
  | 'passed'
  | 'failed'
  | 'not_evaluated';

export type AgentCommerceDecisionGeneratedClaimAxis = {
  readonly status: AgentCommerceDecisionGeneratedClaimAxisStatus;
  readonly blockerCodes: readonly string[];
};

export type AgentCommerceDecisionGeneratedClaimAxes = {
  readonly source: AgentCommerceDecisionGeneratedClaimAxis;
  readonly freshness: AgentCommerceDecisionGeneratedClaimAxis;
  readonly scope: AgentCommerceDecisionGeneratedClaimAxis;
  readonly surface: AgentCommerceDecisionGeneratedClaimAxis;
  readonly use: AgentCommerceDecisionGeneratedClaimAxis;
  readonly payload: AgentCommerceDecisionGeneratedClaimAxis;
  readonly taint: AgentCommerceDecisionGeneratedClaimAxis;
};

export type GeneratedClaimDependencyProjectionStatus =
  | 'usable'
  | 'refused_here'
  | 'never_grounded';

export type GeneratedClaimDependencyRequestContext = {
  readonly requestedSurface: string;
  readonly requestedUse: string | null;
  readonly marketCode: string | null;
  readonly localeCode: string | null;
  readonly jurisdictionCode: string | null;
  readonly channelCode: string | null;
};

export type GeneratedClaimInheritedRefusal = {
  readonly sourceProjectionHash: string | null;
  readonly sourceEnvelopeHash: string | null;
  readonly sourceRecordKey: string | null;
  readonly status: Exclude<GeneratedClaimDependencyProjectionStatus, 'usable'>;
  readonly refusalKind: string;
  readonly axis: keyof AgentCommerceDecisionGeneratedClaimAxes;
  readonly blockerCodes: readonly string[];
};

export type GeneratedClaimDependencyProjection = {
  readonly projectionHash: string;
  readonly requestContextHash: string;
  readonly sourceEnvelopeHash: string | null;
  readonly sourceEvidencePinHash: string | null;
  readonly sourceRecordKey: string | null;
  readonly requestContext: GeneratedClaimDependencyRequestContext;
  readonly status: GeneratedClaimDependencyProjectionStatus;
  readonly refusalKind: string | null;
  readonly refusalAxis: keyof AgentCommerceDecisionGeneratedClaimAxes | null;
  readonly axes: AgentCommerceDecisionGeneratedClaimAxes;
  readonly blockerCodes: readonly string[];
  readonly inheritedRefusals: readonly GeneratedClaimInheritedRefusal[];
};

export type DerivedGeneratedClaimProvenance = {
  readonly childRecordKey: string;
  readonly childPayloadHash: string;
  readonly dependencyRefs: readonly {
    readonly projectionHash: string;
    readonly sourceEnvelopeHash: string | null;
    readonly sourceEvidencePinHash: string | null;
    readonly sourceRecordKey: string | null;
    readonly requestContextHash: string;
    readonly status: GeneratedClaimDependencyProjectionStatus;
    readonly requestedSurface: string;
    readonly requestedUse: string | null;
    readonly refusalKind: string | null;
  }[];
  readonly inheritedRefusals: readonly GeneratedClaimInheritedRefusal[];
  readonly inheritedRefusalCount: number;
  readonly canonicalHash: string;
  readonly derivedFactRefs: readonly string[];
};

export type AgentCommerceGeneratedClaimsSection = {
  readonly allowed: boolean;
  readonly status: AgentCommerceDecisionGeneratedClaimStatus;
  readonly claimIds: readonly string[];
  readonly sourceFactRefs: readonly string[];
  readonly derivedFactRefs: readonly string[];
  readonly allowedUses: readonly string[];
  readonly axes: AgentCommerceDecisionGeneratedClaimAxes;
  readonly blockerCodes: readonly string[];
  readonly inheritedRefusalCount: number;
};

export type AgentCommerceDecisionEnvelopeAuthenticator =
  | {
      readonly kind: 'digital_signature';
      readonly algorithm: 'ed25519';
      readonly format: 'detached';
      readonly keyId: string;
      readonly verificationKeyRef: string;
      readonly protectedHash: string;
      readonly value: string;
      readonly verifiable: true;
    }
  | {
      readonly kind: 'message_authentication_code';
      readonly algorithm: 'hmac-sha256';
      readonly format: 'detached';
      readonly keyId: string;
      readonly verificationKeyRef: string;
      readonly protectedHash: string;
      readonly value: string;
      readonly verifiable: true;
    }
  | {
      readonly kind: 'unsigned';
      readonly algorithm: 'none';
      readonly format: 'none';
      readonly protectedHash: string;
      readonly verifiable: false;
      readonly warning: 'missing_platform_signing_key';
    };

export type AgentCommerceDecisionSubject = {
  readonly productId?: string;
  readonly variantId?: string;
  readonly sku?: string;
  readonly checkoutId?: string;
  readonly mandateId?: string;
  readonly orderId?: string;
};

export type AgentCommerceDecisionActor = {
  readonly actorType: AgentCommerceDecisionActorType;
  readonly agentId?: string;
  readonly merchantId?: string;
};

export type AgentCommerceDecisionInputRefs = {
  readonly productRef?: string;
  readonly policyRef?: string;
  readonly checkoutRef?: string;
  readonly paymentRef?: string;
  readonly authorityRef?: string;
};

export type AgentCommerceDecisionEvidenceRef = {
  readonly type: string;
  readonly id: string;
  readonly hash: string;
  readonly hashAlgorithm: 'sha256';
};

export type AgentCommerceDecisionFreshnessDependencyKind =
  | 'product'
  | 'price'
  | 'inventory'
  | 'policy'
  | 'checkout'
  | 'mandate'
  | 'generated_claim'
  | 'authority'
  | 'payment'
  | 'evidence';

export type AgentCommerceDecisionFreshnessDependency = {
  readonly ref: string;
  readonly kind: AgentCommerceDecisionFreshnessDependencyKind;
  readonly validUntil?: string | null;
  readonly staleAfter?: string | null;
  readonly hash?: string | null;
};

export type AgentCommerceDecisionFreshness = {
  readonly evaluatedAt: string;
  readonly validUntil: string | null;
  readonly staleAfter: string | null;
  readonly reasonCodes: readonly string[];
  readonly dependencies: readonly AgentCommerceDecisionFreshnessDependency[];
};

export type AgentCommerceDecisionBasisComponent = {
  readonly code: string;
  readonly source:
    | 'eligibility'
    | 'authority'
    | 'checkout'
    | 'payment'
    | 'generated_claim';
  readonly field: string;
  readonly value: string | number | boolean | null;
  readonly contributesTo:
    | 'status'
    | 'payment_dispatch'
    | 'generated_claim_use';
};

export type AgentCommerceDecisionBasis = {
  readonly status: AgentCommerceDecisionProjectionStatus;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly components: readonly AgentCommerceDecisionBasisComponent[];
};

export type AgentCommerceDecisionNextSafeAction = {
  readonly action: string;
  readonly owner: 'system' | 'operator' | 'buyer' | 'merchant';
  readonly reasonCode: string;
};

export type AgentCommerceDecisionEnvelope = {
  readonly contractVersion: 'agent-commerce-decision-envelope-v4';
  readonly envelopeSchemaVersion: 'agent-commerce-decision-envelope-schema-v4';
  readonly decisionId: string;
  readonly decisionHash: string;
  readonly inputDependencyHash: string;
  readonly resultHash: string;
  readonly evaluatedAt: string;
  readonly ruleSetVersion: string;
  readonly ruleSetRef: string;
  readonly ruleSetHash: string;
  readonly authenticator: AgentCommerceDecisionEnvelopeAuthenticator;
  readonly freshness: AgentCommerceDecisionFreshness;
  readonly basis: AgentCommerceDecisionBasis;
  readonly surface?: AgentCommerceDecisionSurface;
  readonly subject: AgentCommerceDecisionSubject;
  readonly actor: AgentCommerceDecisionActor;
  readonly requestedAction: AgentCommerceDecisionAction;
  readonly inputRefs?: AgentCommerceDecisionInputRefs;
  readonly eligibility: {
    readonly result: AgentCommerceDecisionEligibilityResult;
    readonly blockerCodes: readonly string[];
    readonly source:
      | 'product'
      | 'policy'
      | 'checkout'
      | 'payment'
      | 'operator'
      | 'combined';
  };
  readonly authority: {
    readonly result: AgentCommerceDecisionAuthorityResult;
    readonly blockerCodes: readonly string[];
  };
  readonly checkout?: {
    readonly state: string;
    readonly validForRequestedAction: boolean;
    readonly blockerCodes: readonly string[];
  };
  readonly payment?: {
    readonly paymentDispatchAttempted: boolean;
    readonly authorityResult: AgentCommerceDecisionPaymentAuthorityResult;
    readonly blockerCodes: readonly string[];
  };
  readonly generatedClaims?: AgentCommerceGeneratedClaimsSection;
  readonly evidenceRefs: readonly AgentCommerceDecisionEvidenceRef[];
  readonly nextSafeActions: readonly AgentCommerceDecisionNextSafeAction[];
};

export type AgentCommerceDecisionEnvelopeInput = {
  readonly decisionId?: string | null;
  readonly evaluatedAt?: string | Date | null;
  readonly ruleSetVersion?: string | null;
  readonly ruleSetRef?: string | null;
  readonly authenticatorKeyId?: string | null;
  readonly signingSecret?: string | null;
  readonly signingPrivateKeyPem?: string | null;
  readonly verificationKeyRef?: string | null;
  readonly surface?: AgentCommerceDecisionSurface;
  readonly subject?: AgentCommerceDecisionSubject | null;
  readonly actor?: Partial<AgentCommerceDecisionActor> | null;
  readonly requestedAction: AgentCommerceDecisionAction;
  readonly inputRefs?: AgentCommerceDecisionInputRefs | null;
  readonly eligibility?: {
    readonly result?: AgentCommerceDecisionEligibilityResult;
    readonly blockerCodes?: readonly string[] | null;
    readonly source?:
      | 'product'
      | 'policy'
      | 'checkout'
      | 'payment'
      | 'operator'
      | 'combined';
    readonly requiresRevalidation?: boolean;
    readonly requiresReview?: boolean;
    readonly requiresConfirmation?: boolean;
  } | null;
  readonly authority?: {
    readonly result?: AgentCommerceDecisionAuthorityResult;
    readonly blockerCodes?: readonly string[] | null;
    readonly required?: boolean;
  } | null;
  readonly checkout?: AgentCommerceDecisionEnvelope['checkout'] | null;
  readonly payment?: Partial<NonNullable<AgentCommerceDecisionEnvelope['payment']>> | null;
  readonly generatedClaims?: Partial<AgentCommerceGeneratedClaimsSection> | null;
  readonly evidenceRefs?: readonly (
    | AgentCommerceDecisionEvidenceRef
    | {
        readonly type: string;
        readonly id: string;
        readonly hash: string;
      }
  )[] | null;
  readonly freshness?: {
    readonly validUntil?: string | Date | null;
    readonly staleAfter?: string | Date | null;
    readonly reasonCodes?: readonly string[] | null;
    readonly dependencies?: readonly (
      AgentCommerceDecisionFreshnessDependency & {
        readonly validUntil?: string | Date | null;
        readonly staleAfter?: string | Date | null;
      }
    )[] | null;
  } | null;
  readonly nextSafeActions?: readonly AgentCommerceDecisionNextSafeAction[] | null;
};

export type AgentCommerceDecisionProjection = {
  readonly envelopeSchemaVersion: 'agent-commerce-decision-envelope-schema-v4';
  readonly ruleSetRef: string;
  readonly ruleSetHash: string;
  readonly authenticator: AgentCommerceDecisionEnvelopeAuthenticator;
  readonly decisionHash: string;
  readonly inputDependencyHash: string;
  readonly resultHash: string;
  readonly requestedAction: AgentCommerceDecisionAction;
  readonly allowed: boolean;
  readonly status: AgentCommerceDecisionProjectionStatus;
  readonly reasonCodes: readonly string[];
  readonly basisComponents?: readonly AgentCommerceDecisionBasisComponent[];
  readonly freshness?: {
    readonly evaluatedAt: string;
    readonly validUntil: string | null;
    readonly staleAfter: string | null;
    readonly reasonCodes: readonly string[];
    readonly dependencyCount: number;
    readonly dependencyKinds: readonly AgentCommerceDecisionFreshnessDependencyKind[];
  };
  readonly checkout?: AgentCommerceDecisionEnvelope['checkout'];
  readonly payment?: AgentCommerceDecisionEnvelope['payment'];
  readonly generatedClaims?: AgentCommerceGeneratedClaimsSection & {
    readonly approvedValueHash?: string | null;
    readonly claimTextHash?: string | null;
    readonly quoteTextHash?: string | null;
  };
  readonly paymentDispatchAttempted?: boolean;
  readonly nextSafeActions: readonly AgentCommerceDecisionNextSafeAction[];
};

export function buildAgentCommerceDecisionEnvelope(
  input: AgentCommerceDecisionEnvelopeInput,
): AgentCommerceDecisionEnvelope;
export const buildDecisionEnvelope: typeof buildAgentCommerceDecisionEnvelope;

export function calculateAgentCommerceDecisionEnvelopeHashes(
  envelope: Omit<AgentCommerceDecisionEnvelope,
    'decisionId' | 'decisionHash' | 'inputDependencyHash' | 'resultHash' | 'authenticator'>,
): {
  readonly inputDependencyHash: string;
  readonly resultHash: string;
  readonly decisionHash: string;
};
export type AgentCommerceDecisionEnvelopeIntegrityReasonCode =
  | 'contract_version_mismatch'
  | 'envelope_schema_version_mismatch'
  | 'input_dependency_hash_mismatch'
  | 'result_hash_mismatch'
  | 'decision_hash_mismatch'
  | 'basis_reason_component_mismatch'
  | 'authenticator_invalid';
export function evaluateAgentCommerceDecisionEnvelopeIntegrity(input: {
  readonly envelope: AgentCommerceDecisionEnvelope;
  readonly signingSecret?: string | null;
  readonly allowUnsignedLocalDevelopment?: boolean;
}): {
  readonly valid: boolean;
  readonly reasonCodes: readonly AgentCommerceDecisionEnvelopeIntegrityReasonCode[];
};

export function verifyDecisionEnvelopeAuthenticator(input: {
  readonly decisionHash: string;
  readonly envelopeSchemaVersion: string;
  readonly ruleSetHash: string;
  readonly authenticator: AgentCommerceDecisionEnvelopeAuthenticator;
  readonly signingSecret?: string | null;
  readonly allowUnsignedLocalDevelopment?: boolean;
}): boolean;
export function publicDecisionProjection(
  envelope: AgentCommerceDecisionEnvelope,
  options?: { readonly now?: string | Date },
): AgentCommerceDecisionProjection & { readonly exportable: boolean };
export function mcpDecisionProjection(
  envelope: AgentCommerceDecisionEnvelope,
): AgentCommerceDecisionProjection & {
  readonly tool_result_type: 'agent_commerce_decision';
  readonly paymentDispatchAttempted: boolean;
};
export function operatorDecisionProjection(
  envelope: AgentCommerceDecisionEnvelope,
): AgentCommerceDecisionProjection & { readonly ownerCodes: readonly string[] };
export function checkoutDecisionProjection(
  envelope: AgentCommerceDecisionEnvelope,
): AgentCommerceDecisionProjection & {
  readonly mutationAllowed: boolean;
  readonly paymentDispatchAttempted: boolean;
};
export function supportDecisionProjection(
  envelope: AgentCommerceDecisionEnvelope,
): AgentCommerceDecisionProjection & { readonly blockerSummary: string };
export function sha256Hex(value: unknown): string;
export function stableCommercialJsonHash(value: unknown): string;
export function stableJson(value: unknown): string;

export const AGENT_COMMERCE_DECISION_ACTIONS: readonly AgentCommerceDecisionAction[];
export const AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS:
  readonly AgentCommerceDecisionEligibilityResult[];
export const AGENT_COMMERCE_DECISION_ACTION_RULES: Readonly<
  Record<
    AgentCommerceDecisionAction,
    {
      readonly mutatesState: boolean;
      readonly checkoutBoundary: boolean;
      readonly paymentBoundary: boolean;
      readonly generatedClaimUse: boolean;
    }
  >
>;
export function agentCommerceDecisionActionRule(
  action: AgentCommerceDecisionAction,
): (typeof AGENT_COMMERCE_DECISION_ACTION_RULES)[AgentCommerceDecisionAction];
export function canonicalAgentCommerceReasonCode(code: string): string;
export function uniqueAgentCommerceReasonCodes(
  values: readonly (string | null | undefined)[] | null | undefined,
): string[];

export function canonicalRuleSetRef(input: {
  readonly ruleSetVersion: string;
  readonly ruleSetRef?: string | null;
}): { readonly ruleSetRef: string; readonly ruleSetHash: string };

export function authenticatorPayload(input: {
  readonly decisionHash: string;
  readonly envelopeSchemaVersion: string;
  readonly ruleSetHash: string;
  readonly keyId: string;
  readonly verificationKeyRef: string;
}): string;
export function createDecisionEnvelopeAuthenticator(input: {
  readonly decisionHash: string;
  readonly envelopeSchemaVersion: string;
  readonly keyId: string;
  readonly verificationKeyRef: string;
  readonly ruleSetHash: string;
  readonly signingSecret?: string | null;
  readonly signingPrivateKeyPem?: string | null;
}): AgentCommerceDecisionEnvelopeAuthenticator;

export function evaluateAgentCommerceDecisionBasis(input: {
  readonly requestedAction: AgentCommerceDecisionAction;
  readonly eligibility: AgentCommerceDecisionEnvelope['eligibility'];
  readonly authority: AgentCommerceDecisionEnvelope['authority'];
  readonly checkout?: AgentCommerceDecisionEnvelope['checkout'];
  readonly payment?: AgentCommerceDecisionEnvelope['payment'];
  readonly generatedClaims?: AgentCommerceGeneratedClaimsSection;
}): AgentCommerceDecisionBasis;
export function buildAgentCommerceDecisionNextSafeActions(
  reasonCodes: readonly string[],
  options?: {
    readonly defaultAction?: string;
    readonly defaultOwner?: AgentCommerceDecisionNextSafeAction['owner'];
  },
): AgentCommerceDecisionNextSafeAction[];

export function sha256EvidenceHash(input: {
  readonly providedHash?: unknown;
  readonly id?: unknown;
  readonly type?: unknown;
}): string;
export function normalizeEvidenceRefs(
  values: readonly Record<string, unknown>[] | null | undefined,
): AgentCommerceDecisionEvidenceRef[];

export function normalizeFreshness(input: {
  readonly freshness?: AgentCommerceDecisionEnvelopeInput['freshness'];
  readonly evaluatedAt: string;
  readonly inputRefs?: AgentCommerceDecisionInputRefs;
  readonly evidenceRefs: readonly AgentCommerceDecisionEvidenceRef[];
  readonly generatedClaims?: AgentCommerceGeneratedClaimsSection;
  readonly basis: AgentCommerceDecisionBasis;
}): AgentCommerceDecisionFreshness;
export function isFresh(
  freshness: AgentCommerceDecisionFreshness | null | undefined,
  now?: string,
): boolean;

export const GENERATED_CLAIM_STATUS:
  readonly AgentCommerceDecisionGeneratedClaimStatus[];
export const GENERATED_CLAIM_AXIS_KEYS: readonly (
  keyof AgentCommerceDecisionGeneratedClaimAxes
)[];
export const GENERATED_CLAIM_DEPENDENCY_PROJECTION_STATUS:
  readonly GeneratedClaimDependencyProjectionStatus[];
export const GENERATED_CLAIM_INHERITED_REFUSAL_LIMIT: 256;
export function normalizeGeneratedClaims(
  input: Partial<AgentCommerceGeneratedClaimsSection> | null | undefined,
): AgentCommerceGeneratedClaimsSection | undefined;
export function buildGeneratedClaimsFromPolicyProjection(
  input?: Record<string, unknown>,
): AgentCommerceGeneratedClaimsSection;
export function canUseGeneratedClaimCapability(
  generatedClaims: Partial<AgentCommerceGeneratedClaimsSection> | null,
  input?: {
    readonly claimId?: string;
    readonly use?: string;
    readonly surface?: string;
    readonly requiredValueHash?: string | null;
    readonly observedValue?: unknown;
    readonly claimValueHash?: string | null;
  },
): {
  readonly allowed: boolean;
  readonly status: 'allowed' | 'refused_here';
  readonly blockerCodes: readonly string[];
  readonly axes: AgentCommerceDecisionGeneratedClaimAxes;
  readonly providedValueHash: string | null;
  readonly requiredValueHash: string | null;
};

export function createGeneratedClaimDependencyProjection(input: {
  readonly generatedClaims?: Partial<AgentCommerceGeneratedClaimsSection> | null;
  readonly sourceEnvelopeHash?: string | null;
  readonly sourceEvidencePinHash?: string | null;
  readonly sourceRecordKey?: string | null;
  readonly requestedSurface: string;
  readonly requestedUse?: string | null;
  readonly marketCode?: string | null;
  readonly localeCode?: string | null;
  readonly jurisdictionCode?: string | null;
  readonly channelCode?: string | null;
  readonly requestContext?: Partial<GeneratedClaimDependencyRequestContext> & {
    readonly requestedSurface: string;
  };
  readonly status?: GeneratedClaimDependencyProjectionStatus;
  readonly refusalKind?: string | null;
  readonly refusalAxis?: keyof AgentCommerceDecisionGeneratedClaimAxes | null;
  readonly blockerCodes?: readonly string[] | null;
  readonly inheritedRefusals?: readonly GeneratedClaimInheritedRefusal[] | null;
}): GeneratedClaimDependencyProjection;

export function calculateGeneratedClaimDependencyProjectionHashes(
  projection: Omit<GeneratedClaimDependencyProjection, 'projectionHash' | 'requestContextHash'> &
    Partial<Pick<GeneratedClaimDependencyProjection, 'projectionHash' | 'requestContextHash'>>,
): {
  readonly requestContextHash: string;
  readonly projectionHash: string;
};

export function bindDerivedGeneratedClaimProvenance(input: {
  readonly childRecordKey: string;
  readonly childPayloadHash: string;
  readonly dependencyProjections: readonly GeneratedClaimDependencyProjection[];
}): DerivedGeneratedClaimProvenance;

export function projectAgentCommerceDecisionEnvelope(
  envelope: AgentCommerceDecisionEnvelope,
  surface: AgentCommerceDecisionSurface,
): AgentCommerceDecisionProjection & Record<string, unknown>;

export function projectTrustedAgentCommerceDecisionEnvelope(
  envelope: AgentCommerceDecisionEnvelope,
  surface: AgentCommerceDecisionSurface,
  options?: {
      readonly signingSecret?: string | null;
    readonly allowHmac?: boolean;
    readonly allowUnsignedLocalDevelopment?: boolean;
    readonly trustedKeyId?: string | null;
    readonly trustedVerificationKeyRef?: string | null;
    readonly now?: string | Date;
  },
): AgentCommerceDecisionProjection & Record<string, unknown>;
