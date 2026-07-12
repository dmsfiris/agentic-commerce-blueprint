export const AGENT_COMMERCE_DECISION_ENVELOPE_CONTRACT_VERSION =
  'agent-commerce-decision-envelope-v4';
export const AGENT_COMMERCE_DECISION_ENVELOPE_SCHEMA_VERSION =
  'agent-commerce-decision-envelope-schema-v4';
export const AGENT_COMMERCE_DECISION_DEFAULT_RULE_SET_VERSION =
  'agent-commerce-decision-rules-v4';
export const AGENT_COMMERCE_DECISION_DEFAULT_AUTHENTICATOR_KEY_ID =
  'agent-commerce-decision-envelope-v4';
export const AGENT_COMMERCE_DECISION_DEFAULT_VERIFICATION_KEY_REF =
  'platform-key:agent-commerce-decision-envelope-v4';

export const AGENT_COMMERCE_DECISION_SURFACES = Object.freeze([
  'feed',
  'tool',
  'checkout',
  'admin',
  'support',
  'protocol',
]);

export const AGENT_COMMERCE_DECISION_ACTOR_TYPES = Object.freeze([
  'agent',
  'buyer',
  'merchant',
  'operator',
  'system',
]);

export const AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES = Object.freeze([
  'product',
  'policy',
  'checkout',
  'payment',
  'operator',
  'combined',
]);

export const AGENT_COMMERCE_DECISION_NEXT_SAFE_ACTION_OWNERS = Object.freeze([
  'system',
  'operator',
  'buyer',
  'merchant',
]);

export const AGENT_COMMERCE_DECISION_ACTIONS = Object.freeze([
  'discover',
  'compare',
  'quote_policy',
  'add_to_cart',
  'prepare_checkout',
  'delegate_payment',
  'complete_checkout',
  'show_generated_claim',
  'explain',
]);

export const AGENT_COMMERCE_DECISION_ACTION_RULES = Object.freeze({
  discover: {
    mutatesState: false,
    checkoutBoundary: false,
    paymentBoundary: false,
    generatedClaimUse: false,
  },
  compare: {
    mutatesState: false,
    checkoutBoundary: false,
    paymentBoundary: false,
    generatedClaimUse: true,
  },
  quote_policy: {
    mutatesState: false,
    checkoutBoundary: false,
    paymentBoundary: false,
    generatedClaimUse: true,
  },
  add_to_cart: {
    mutatesState: true,
    checkoutBoundary: true,
    paymentBoundary: false,
    generatedClaimUse: false,
  },
  prepare_checkout: {
    mutatesState: true,
    checkoutBoundary: true,
    paymentBoundary: false,
    generatedClaimUse: false,
  },
  delegate_payment: {
    mutatesState: true,
    checkoutBoundary: true,
    paymentBoundary: true,
    generatedClaimUse: false,
  },
  complete_checkout: {
    mutatesState: true,
    checkoutBoundary: true,
    paymentBoundary: true,
    generatedClaimUse: false,
  },
  show_generated_claim: {
    mutatesState: false,
    checkoutBoundary: false,
    paymentBoundary: false,
    generatedClaimUse: true,
  },
  explain: {
    mutatesState: false,
    checkoutBoundary: false,
    paymentBoundary: false,
    generatedClaimUse: false,
  },
});

export const AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS = Object.freeze([
  'allowed',
  'blocked',
  'requires_revalidation',
  'requires_review',
  'requires_confirmation',
]);

export const AGENT_COMMERCE_DECISION_AUTHORITY_RESULTS = Object.freeze([
  'allowed',
  'blocked',
  'not_required',
]);

export const AGENT_COMMERCE_DECISION_PAYMENT_AUTHORITY_RESULTS = Object.freeze([
  'allowed',
  'blocked',
  'not_evaluated',
]);

export function agentCommerceDecisionActionRule(action) {
  const rule = AGENT_COMMERCE_DECISION_ACTION_RULES[action];
  if (!rule) throw new Error(`Unsupported requestedAction: ${action}`);
  return rule;
}

export function canonicalAgentCommerceReasonCode(code) {
  const normalized = String(code ?? '').trim().toLowerCase();
  if (normalized === 'inventory_freshness_stale') return 'stale_inventory';
  if (normalized === 'inventory_freshness_unknown') {
    return 'unknown_inventory_freshness';
  }
  if (
    normalized === 'return_policy_missing' ||
    normalized === 'policy_return_missing'
  ) {
    return 'missing_return_policy';
  }
  if (normalized === 'generated_description_pending_review') {
    return 'generated_claim_requires_review';
  }
  return normalized;
}

export function uniqueAgentCommerceReasonCodes(values) {
  return Array.from(
    new Set(
      (values ?? [])
        .filter((value) => typeof value === 'string' && value.trim())
        .map(canonicalAgentCommerceReasonCode),
    ),
  ).sort();
}

export function agentCommerceReasonCodeTokens(code) {
  return canonicalAgentCommerceReasonCode(code)
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

export function agentCommerceReasonCodeHasAny(code, expectedTokens) {
  const tokens = new Set(agentCommerceReasonCodeTokens(code));
  return (expectedTokens ?? []).some((token) =>
    tokens.has(String(token).trim().toLowerCase()),
  );
}

export function agentCommerceReasonCodesHaveAny(codes, expectedTokens) {
  return (codes ?? []).some((code) =>
    agentCommerceReasonCodeHasAny(code, expectedTokens),
  );
}
