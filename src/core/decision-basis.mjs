import {
  agentCommerceDecisionActionRule,
  agentCommerceReasonCodeHasAny,
  uniqueAgentCommerceReasonCodes,
} from './actions.mjs';

function component(input) {
  return input;
}

function reasonComponentForBlocker(
  source,
  field,
  code,
  contributesTo = 'status',
) {
  return component({ code, source, field, value: code, contributesTo });
}

export function evaluateAgentCommerceDecisionBasis({
  requestedAction,
  eligibility,
  authority,
  checkout,
  payment,
  generatedClaims,
}) {
  const components = [];
  for (const code of eligibility.blockerCodes) {
    components.push(
      reasonComponentForBlocker(
        'eligibility',
        'eligibility.blockerCodes',
        code,
      ),
    );
  }
  for (const code of authority.blockerCodes) {
    components.push(
      reasonComponentForBlocker('authority', 'authority.blockerCodes', code),
    );
  }
  for (const code of checkout?.blockerCodes ?? []) {
    components.push(
      reasonComponentForBlocker('checkout', 'checkout.blockerCodes', code),
    );
  }
  for (const code of payment?.blockerCodes ?? []) {
    components.push(
      reasonComponentForBlocker(
        'payment',
        'payment.blockerCodes',
        code,
        'payment_dispatch',
      ),
    );
  }

  const actionUsesGeneratedClaims =
    agentCommerceDecisionActionRule(requestedAction).generatedClaimUse;
  const generatedClaimBlockersAlreadyDriveEligibility = Boolean(
    generatedClaims?.blockerCodes.some((code) =>
      eligibility.blockerCodes.includes(code),
    ),
  );
  const generatedClaimsContributeToRequestedAction =
    Boolean(generatedClaims) &&
    (actionUsesGeneratedClaims || generatedClaimBlockersAlreadyDriveEligibility);

  if (generatedClaimsContributeToRequestedAction) {
    for (const code of generatedClaims?.blockerCodes ?? []) {
      components.push(
        reasonComponentForBlocker(
          'generated_claim',
          'generatedClaims.blockerCodes',
          code,
          'generated_claim_use',
        ),
      );
    }
  }

  if (eligibility.result !== 'allowed') {
    components.push(
      component({
        code: `eligibility_${eligibility.result}`,
        source: 'eligibility',
        field: 'eligibility.result',
        value: eligibility.result,
        contributesTo: 'status',
      }),
    );
  }
  if (authority.result === 'blocked') {
    components.push(
      component({
        code: 'authority_blocked',
        source: 'authority',
        field: 'authority.result',
        value: authority.result,
        contributesTo: 'status',
      }),
    );
  }
  if (checkout && !checkout.validForRequestedAction) {
    components.push(
      component({
        code: 'invalid_checkout_state',
        source: 'checkout',
        field: 'checkout.validForRequestedAction',
        value: false,
        contributesTo: 'status',
      }),
    );
  }
  if (payment?.authorityResult === 'blocked') {
    components.push(
      component({
        code: 'payment_authority_blocked',
        source: 'payment',
        field: 'payment.authorityResult',
        value: payment.authorityResult,
        contributesTo: 'payment_dispatch',
      }),
    );
  }
  if (
    generatedClaimsContributeToRequestedAction &&
    generatedClaims &&
    !generatedClaims.allowed
  ) {
    components.push(
      component({
        code: `generated_claim_${generatedClaims.status}`,
        source: 'generated_claim',
        field: 'generatedClaims.status',
        value: generatedClaims.status,
        contributesTo: 'generated_claim_use',
      }),
    );
  }

  const reasonCodes = uniqueAgentCommerceReasonCodes(
    components.map((entry) => entry.code),
  );
  const generatedClaimStatus =
    !generatedClaimsContributeToRequestedAction || generatedClaims?.allowed
      ? 'allowed'
      : eligibility.result === 'requires_review' ||
          generatedClaims?.status === 'requires_review'
        ? 'requires_review'
        : generatedClaims?.status === 'stale'
          ? 'requires_revalidation'
          : 'blocked';
  const hardBlocked =
    eligibility.result === 'blocked' ||
    authority.result === 'blocked' ||
    (checkout ? !checkout.validForRequestedAction : false) ||
    payment?.authorityResult === 'blocked' ||
    generatedClaimStatus === 'blocked';
  const status = hardBlocked
    ? 'blocked'
    : eligibility.result === 'requires_confirmation'
      ? 'requires_confirmation'
      : eligibility.result === 'requires_revalidation' ||
          generatedClaimStatus === 'requires_revalidation'
        ? 'requires_revalidation'
        : eligibility.result === 'requires_review' ||
            generatedClaimStatus === 'requires_review'
          ? 'requires_review'
          : 'allowed';

  return {
    status,
    allowed: status === 'allowed' && reasonCodes.length === 0,
    reasonCodes,
    components: Array.from(
      new Map(
        components.map((entry) => [
          `${entry.source}:${entry.field}:${entry.code}:${entry.contributesTo}`,
          entry,
        ]),
      ).values(),
    ).sort((left, right) =>
      `${left.source}:${left.field}:${left.code}`.localeCompare(
        `${right.source}:${right.field}:${right.code}`,
      ),
    ),
  };
}

function reasonHasAny(reasonCode, tokens) {
  return agentCommerceReasonCodeHasAny(reasonCode, tokens);
}

function defaultNextSafeActionForReasonCode(reasonCode) {
  if (reasonHasAny(reasonCode, ['url'])) return 'fix_agent_grade_url';
  if (
    reasonHasAny(reasonCode, [
      'inventory',
      'availability',
      'price',
      'currency',
      'freshness',
    ])
  ) {
    return 'refresh_product_commercial_facts';
  }
  if (
    reasonHasAny(reasonCode, [
      'policy',
      'return',
      'shipping',
      'claim',
      'generated',
    ])
  ) {
    return 'resolve_policy_or_claim_blocker';
  }
  if (reasonHasAny(reasonCode, ['checkout', 'cart'])) {
    return 'refresh_checkout_state';
  }
  if (reasonHasAny(reasonCode, ['mandate', 'payment', 'provider'])) {
    return 'resolve_payment_authority_blocker';
  }
  return 'resolve_commerce_blocker';
}

function defaultNextSafeActionOwnerForReasonCode(reasonCode) {
  if (reasonHasAny(reasonCode, ['buyer'])) return 'buyer';
  if (reasonHasAny(reasonCode, ['system'])) return 'system';
  if (
    reasonHasAny(reasonCode, [
      'policy',
      'return',
      'shipping',
      'claim',
      'generated',
      'operator',
    ])
  ) {
    return 'operator';
  }
  return 'merchant';
}

export function buildAgentCommerceDecisionNextSafeActions(
  reasonCodes,
  options = {},
) {
  return uniqueAgentCommerceReasonCodes(reasonCodes).map((reasonCode) => ({
    action:
      options.defaultAction ?? defaultNextSafeActionForReasonCode(reasonCode),
    owner:
      options.defaultOwner ??
      defaultNextSafeActionOwnerForReasonCode(reasonCode),
    reasonCode,
  }));
}
