import { sha256Hex } from '../core/hash.mjs';

export const EVALUATED_AT = '2026-07-06T10:12:00.000Z';
export const DEMO_SIGNING_SECRET = 'reference-demo-secret-not-for-production';
export const RULE_SET_VERSION = 'agent-commerce-decision-rules-v4';
export const RULE_SET_HASH = sha256Hex({
  ruleSetVersion: RULE_SET_VERSION,
  scope: 'travel-bags',
});
export const RULE_SET_REF = `ruleset:sha256:${RULE_SET_HASH}`;

export function travelBackpackEvidence() {
  return [
    {
      type: 'inventory_fact',
      id: 'inventory:product:travel-backpack:15',
      hash: sha256Hex('inventory:product:travel-backpack:15'),
    },
    {
      type: 'policy_fact',
      id: 'policy:returns:travel-bags:missing',
      hash: sha256Hex('policy:returns:travel-bags:missing'),
    },
    {
      type: 'generated_claim',
      id: 'generated_claim:returns-summary:refused',
      hash: sha256Hex('generated_claim:returns-summary:refused'),
    },
  ];
}

export function travelBackpackGeneratedClaims() {
  const claimTextHash = sha256Hex('Cabin-size compatible travel backpack.');
  return {
    allowed: false,
    status: 'requires_review',
    claimIds: [
      'generated_claim:cabin-size-compatible',
      'generated_claim:returns-comparison-paragraph',
    ],
    sourceFactRefs: [
      'inventory:travel-backpack:15',
      'policy:returns:travel-bags:missing',
    ],
    derivedFactRefs: [
      'generated_claim:returns-summary:refused',
      `claim_text_hash:${claimTextHash}`,
    ],
    allowedUses: [],
    blockerCodes: [
      'generated_claim_requires_review',
      'inherited_refusal',
    ],
    inheritedRefusalCount: 1,
    axes: {
      source: { status: 'passed', blockerCodes: [] },
      freshness: { status: 'failed', blockerCodes: ['stale_inventory'] },
      scope: { status: 'passed', blockerCodes: [] },
      surface: { status: 'passed', blockerCodes: [] },
      use: {
        status: 'failed',
        blockerCodes: ['generated_claim_requires_review'],
      },
      payload: { status: 'not_evaluated', blockerCodes: [] },
      taint: { status: 'failed', blockerCodes: ['inherited_refusal'] },
    },
  };
}

export function baseInput(overrides = {}) {
  return {
    decisionId:
      overrides.decisionId ??
      'decision:travel-backpack:delegate-payment:2026-07-06T10:12:00Z',
    evaluatedAt: overrides.evaluatedAt ?? EVALUATED_AT,
    ruleSetVersion: overrides.ruleSetVersion ?? RULE_SET_VERSION,
    ruleSetRef: overrides.ruleSetRef ?? RULE_SET_REF,
    authenticatorKeyId:
      overrides.authenticatorKeyId ?? 'reference-demo-hmac-key',
    verificationKeyRef:
      overrides.verificationKeyRef ?? 'shared-secret:reference-demo-hmac-key',
    signingSecret:
      Object.hasOwn(overrides, 'signingSecret')
        ? overrides.signingSecret
        : DEMO_SIGNING_SECRET,
    signingPrivateKeyPem: overrides.signingPrivateKeyPem,
    surface: overrides.surface ?? 'protocol',
    requestedAction: overrides.requestedAction ?? 'delegate_payment',
    subject:
      overrides.subject ?? {
        productId: 'product:travel-backpack',
        sku: 'travel-backpack',
        checkoutId: 'checkout:travel-backpack:demo',
        mandateId: 'mandate:buyer-agent-under-150',
      },
    actor:
      overrides.actor ?? {
        actorType: 'agent',
        agentId: 'agent:buyer-shopping-assistant',
        merchantId: 'merchant:travel-demo',
      },
    inputRefs:
      overrides.inputRefs ?? {
        productRef: 'product:travel-backpack',
        policyRef: 'policy:returns:travel-bags:missing',
        checkoutRef: 'checkout:travel-backpack:demo',
        paymentRef: 'payment-artifact:present-under-150',
        authorityRef: 'mandate:buyer-agent-under-150',
      },
    eligibility:
      overrides.eligibility ?? {
        result: 'blocked',
        blockerCodes: ['stale_inventory', 'missing_return_policy'],
        source: 'combined',
      },
    authority:
      overrides.authority ?? {
        result: 'allowed',
        blockerCodes: [],
      },
    checkout:
      Object.hasOwn(overrides, 'checkout')
        ? overrides.checkout
        : {
            state: 'requires_revalidation',
            validForRequestedAction: false,
            blockerCodes: [
              'invalid_checkout_state',
              'stale_inventory',
              'missing_return_policy',
            ],
          },
    payment:
      Object.hasOwn(overrides, 'payment')
        ? overrides.payment
        : {
            paymentDispatchAttempted: false,
            authorityResult: 'blocked',
            blockerCodes: ['invalid_checkout_state'],
          },
    generatedClaims:
      Object.hasOwn(overrides, 'generatedClaims')
        ? overrides.generatedClaims
        : travelBackpackGeneratedClaims(),
    evidenceRefs: overrides.evidenceRefs ?? travelBackpackEvidence(),
    freshness:
      overrides.freshness ?? {
        validUntil: '2026-07-06T10:15:00.000Z',
        staleAfter: '2026-07-06T10:15:00.000Z',
        reasonCodes: ['stale_inventory', 'missing_return_policy'],
        dependencies: [
          {
            kind: 'inventory',
            ref: 'inventory:travel-backpack:15',
            hash: sha256Hex('inventory:travel-backpack:15'),
            staleAfter: '2026-07-06T10:15:00.000Z',
          },
          {
            kind: 'policy',
            ref: 'policy:returns:travel-bags:missing',
            hash: sha256Hex('policy:returns:travel-bags:missing'),
          },
          {
            kind: 'generated_claim',
            ref: 'generated_claim:cabin-size-compatible',
            hash: sha256Hex('generated_claim:cabin-size-compatible'),
          },
          {
            kind: 'authority',
            ref: 'mandate:buyer-agent-under-150',
            hash: sha256Hex('mandate:buyer-agent-under-150'),
          },
        ],
      },
    nextSafeActions:
      overrides.nextSafeActions ?? [
        {
          action: 'refresh_inventory_facts',
          owner: 'operator',
          reasonCode: 'stale_inventory',
        },
        {
          action: 'attach_return_policy_fact',
          owner: 'operator',
          reasonCode: 'missing_return_policy',
        },
        {
          action: 'review_generated_claim',
          owner: 'operator',
          reasonCode: 'generated_claim_requires_review',
        },
      ],
  };
}

export function allowedGeneratedClaims() {
  const approvedValueHash = sha256Hex('Cabin-size compatible travel backpack.');
  return {
    allowed: true,
    status: 'allowed',
    claimIds: ['claim:cabin-size-compatible'],
    sourceFactRefs: ['product_fact:travel-backpack'],
    derivedFactRefs: [`approved_value_hash:${approvedValueHash}`],
    allowedUses: ['discovery', 'quote', 'paraphrase'],
    inheritedRefusalCount: 0,
    blockerCodes: [],
    axes: {
      source: { status: 'passed', blockerCodes: [] },
      freshness: { status: 'passed', blockerCodes: [] },
      scope: { status: 'passed', blockerCodes: [] },
      surface: { status: 'passed', blockerCodes: [] },
      use: { status: 'passed', blockerCodes: [] },
      payload: { status: 'passed', blockerCodes: [] },
      taint: { status: 'passed', blockerCodes: [] },
    },
  };
}

export function blockedGeneratedClaims() {
  return {
    ...allowedGeneratedClaims(),
    allowed: false,
    status: 'out_of_scope',
    allowedUses: ['internal_review'],
    blockerCodes: [
      'generated_claim_use_axis_blocked',
      'generated_claim_scope_axis_blocked',
    ],
    axes: {
      ...allowedGeneratedClaims().axes,
      scope: { status: 'failed', blockerCodes: ['region_not_covered'] },
      use: { status: 'failed', blockerCodes: ['public_quote_not_allowed'] },
    },
  };
}
