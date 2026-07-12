import {
  AGENT_COMMERCE_DECISION_ACTOR_TYPES,
  AGENT_COMMERCE_DECISION_AUTHORITY_RESULTS,
  AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS,
  AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES,
  AGENT_COMMERCE_DECISION_PAYMENT_AUTHORITY_RESULTS,
  uniqueAgentCommerceReasonCodes,
} from './actions.mjs';
import { optionalText, text } from './text.mjs';
import { normalizeGeneratedClaims } from './generated-claims.mjs';

function explicitResult(value, allowedValues, field) {
  if (value == null) return null;
  if (!allowedValues.includes(value)) {
    throw new TypeError(
      `${field} must be one of ${allowedValues.join(', ')}.`,
    );
  }
  return value;
}

function assertBlockerCoherence({ result, blockerCodes, field }) {
  if (blockerCodes.length > 0 && result !== 'blocked') {
    throw new TypeError(
      `${field} cannot be ${result} while blockerCodes are present.`,
    );
  }
}

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
  if (
    actor?.actorType != null &&
    !AGENT_COMMERCE_DECISION_ACTOR_TYPES.includes(actor.actorType)
  ) {
    throw new TypeError(
      `actor.actorType must be one of ${AGENT_COMMERCE_DECISION_ACTOR_TYPES.join(', ')}.`,
    );
  }
  const actorType = actor?.actorType ?? 'system';
  return {
    actorType,
    ...(optionalText(actor?.agentId)
      ? { agentId: optionalText(actor.agentId) }
      : {}),
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
  const configuredResult = explicitResult(
    input?.result,
    AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS,
  AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES,
    'eligibility.result',
  );
  const result =
    configuredResult ??
    (blockerCodes.length > 0
      ? 'blocked'
      : input?.requiresRevalidation
        ? 'requires_revalidation'
        : input?.requiresConfirmation
          ? 'requires_confirmation'
          : input?.requiresReview
            ? 'requires_review'
            : 'allowed');
  assertBlockerCoherence({
    result,
    blockerCodes,
    field: 'eligibility.result',
  });
  const source = input?.source ?? 'combined';
  if (!AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES.includes(source)) {
    throw new TypeError(
      `eligibility.source must be one of ${AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES.join(', ')}.`,
    );
  }
  return { result, blockerCodes, source };
}

export function normalizeAuthority(input = {}) {
  const blockerCodes = uniqueAgentCommerceReasonCodes(input?.blockerCodes);
  const configuredResult = explicitResult(
    input?.result,
    AGENT_COMMERCE_DECISION_AUTHORITY_RESULTS,
    'authority.result',
  );
  const result =
    configuredResult ??
    (blockerCodes.length > 0
      ? 'blocked'
      : input?.required === false
        ? 'not_required'
        : 'allowed');
  assertBlockerCoherence({
    result,
    blockerCodes,
    field: 'authority.result',
  });
  return { result, blockerCodes };
}

export function normalizeCheckout(input) {
  if (!input) return undefined;
  const blockerCodes = uniqueAgentCommerceReasonCodes(input.blockerCodes);
  if (input.validForRequestedAction === true && blockerCodes.length > 0) {
    throw new TypeError(
      'checkout.validForRequestedAction cannot be true while blockerCodes are present.',
    );
  }
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
  const configuredAuthorityResult = explicitResult(
    input.authorityResult,
    AGENT_COMMERCE_DECISION_PAYMENT_AUTHORITY_RESULTS,
    'payment.authorityResult',
  );
  const authorityResult =
    configuredAuthorityResult ??
    (blockerCodes.length > 0 ? 'blocked' : 'not_evaluated');
  assertBlockerCoherence({
    result: authorityResult,
    blockerCodes,
    field: 'payment.authorityResult',
  });
  const decisionAllowsDispatch =
    eligibility.result === 'allowed' &&
    authority.result !== 'blocked' &&
    (checkout?.validForRequestedAction ?? true) &&
    authorityResult === 'allowed' &&
    blockerCodes.length === 0;
  if (input.paymentDispatchAttempted === true && !decisionAllowsDispatch) {
    throw new TypeError(
      'payment.paymentDispatchAttempted cannot be true unless eligibility, authority, checkout, and payment authority all allow dispatch.',
    );
  }
  return {
    paymentDispatchAttempted:
      Boolean(input.paymentDispatchAttempted) && decisionAllowsDispatch,
    authorityResult,
    blockerCodes,
  };
}

export { normalizeGeneratedClaims };
