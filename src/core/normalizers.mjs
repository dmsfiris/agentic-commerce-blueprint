import {
  AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS,
  uniqueAgentCommerceReasonCodes,
} from './actions.mjs';
import { optionalText, text } from './text.mjs';
import { normalizeGeneratedClaims } from './generated-claims.mjs';

export function normalizeSubject(subject = {}) {
  const output = {};
  for (const key of [
    'productId',
    'variantId',
    'sku',
    'checkoutId',
    'mandateId',
    'orderId',
  ]) {
    const value = optionalText(subject?.[key]);
    if (value) output[key] = value;
  }
  return output;
}

export function normalizeActor(actor = {}) {
  const actorType = [
    'agent',
    'buyer',
    'merchant',
    'operator',
    'system',
  ].includes(actor?.actorType)
    ? actor.actorType
    : 'system';
  return {
    actorType,
    ...(optionalText(actor?.agentId) ? { agentId: optionalText(actor.agentId) } : {}),
    ...(optionalText(actor?.merchantId)
      ? { merchantId: optionalText(actor.merchantId) }
      : {}),
  };
}

export function normalizeInputRefs(inputRefs) {
  if (!inputRefs) return undefined;
  const output = {};
  for (const key of [
    'productRef',
    'policyRef',
    'checkoutRef',
    'paymentRef',
    'authorityRef',
  ]) {
    const value = optionalText(inputRefs[key]);
    if (value) output[key] = value;
  }
  return Object.keys(output).length ? output : undefined;
}

export function normalizeEligibility(input = {}) {
  const blockerCodes = uniqueAgentCommerceReasonCodes(input?.blockerCodes);
  let result = input?.result;
  if (!AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS.includes(result)) {
    result = blockerCodes.length > 0
      ? 'blocked'
      : input?.requiresRevalidation
        ? 'requires_revalidation'
        : input?.requiresConfirmation
          ? 'requires_confirmation'
          : input?.requiresReview
            ? 'requires_review'
            : 'allowed';
  }
  return { result, blockerCodes, source: input?.source ?? 'combined' };
}

export function normalizeAuthority(input = {}) {
  const blockerCodes = uniqueAgentCommerceReasonCodes(input?.blockerCodes);
  return {
    result:
      input?.result ??
      (blockerCodes.length
        ? 'blocked'
        : input?.required === false
          ? 'not_required'
          : 'allowed'),
    blockerCodes,
  };
}

export function normalizeCheckout(input) {
  if (!input) return undefined;
  const blockerCodes = uniqueAgentCommerceReasonCodes(input.blockerCodes);
  return {
    state: text(input.state) ?? 'unknown',
    validForRequestedAction:
      Boolean(input.validForRequestedAction) && blockerCodes.length === 0,
    blockerCodes,
  };
}

export function normalizePayment(input, eligibility, authority, checkout) {
  if (!input) return undefined;
  const blockerCodes = uniqueAgentCommerceReasonCodes(input.blockerCodes);
  const authorityResult =
    input.authorityResult ??
    (blockerCodes.length ? 'blocked' : 'not_evaluated');
  const decisionAllowsDispatch =
    eligibility.result === 'allowed' &&
    authority.result !== 'blocked' &&
    (checkout?.validForRequestedAction ?? true) &&
    authorityResult === 'allowed' &&
    blockerCodes.length === 0;
  return {
    paymentDispatchAttempted:
      Boolean(input.paymentDispatchAttempted) && decisionAllowsDispatch,
    authorityResult,
    blockerCodes,
  };
}

export { normalizeGeneratedClaims };
