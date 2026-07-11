import { agentCommerceDecisionActionRule } from './actions.mjs';
import { isFresh } from './freshness.mjs';
import { evaluateAgentCommerceDecisionEnvelopeIntegrity } from './decision-envelope.mjs';

function prefixedRefValue(values, prefix) {
  const match = (values ?? []).find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) || null : null;
}

function cloneAxes(axes) {
  return Object.fromEntries(
    Object.entries(axes).map(([key, value]) => [
      key,
      { ...value, blockerCodes: [...value.blockerCodes] },
    ]),
  );
}

function baseProjection(envelope) {
  const dependencyKinds = Array.from(
    new Set(envelope.freshness.dependencies.map((entry) => entry.kind)),
  ).sort();
  return {
    envelopeSchemaVersion: envelope.envelopeSchemaVersion,
    ruleSetRef: envelope.ruleSetRef,
    ruleSetHash: envelope.ruleSetHash,
    authenticator: { ...envelope.authenticator },
    decisionHash: envelope.decisionHash,
    inputDependencyHash: envelope.inputDependencyHash,
    resultHash: envelope.resultHash,
    requestedAction: envelope.requestedAction,
    allowed: envelope.basis.allowed,
    status: envelope.basis.status,
    reasonCodes: [...envelope.basis.reasonCodes],
    basisComponents: envelope.basis.components.map((entry) => ({ ...entry })),
    freshness: {
      evaluatedAt: envelope.freshness.evaluatedAt,
      validUntil: envelope.freshness.validUntil,
      staleAfter: envelope.freshness.staleAfter,
      reasonCodes: [...envelope.freshness.reasonCodes],
      dependencyCount: envelope.freshness.dependencies.length,
      dependencyKinds,
    },
    ...(envelope.checkout
      ? {
          checkout: {
            state: envelope.checkout.state,
            validForRequestedAction: envelope.checkout.validForRequestedAction,
            blockerCodes: [...envelope.checkout.blockerCodes],
          },
        }
      : {}),
    ...(envelope.payment
      ? {
          payment: {
            authorityResult: envelope.payment.authorityResult,
            blockerCodes: [...envelope.payment.blockerCodes],
            paymentDispatchAttempted:
              envelope.payment.paymentDispatchAttempted,
          },
          paymentDispatchAttempted:
            envelope.payment.paymentDispatchAttempted,
        }
      : {}),
    ...(envelope.generatedClaims
      ? {
          generatedClaims: {
            allowed: envelope.generatedClaims.allowed,
            status: envelope.generatedClaims.status,
            claimIds: [...envelope.generatedClaims.claimIds],
            sourceFactRefs: [...envelope.generatedClaims.sourceFactRefs],
            derivedFactRefs: [...envelope.generatedClaims.derivedFactRefs],
            allowedUses: [...envelope.generatedClaims.allowedUses],
            blockerCodes: [...envelope.generatedClaims.blockerCodes],
            inheritedRefusalCount:
              envelope.generatedClaims.inheritedRefusalCount,
            axes: cloneAxes(envelope.generatedClaims.axes),
            approvedValueHash: prefixedRefValue(
              envelope.generatedClaims.derivedFactRefs,
              'approved_value_hash:',
            ),
            claimTextHash: prefixedRefValue(
              envelope.generatedClaims.derivedFactRefs,
              'claim_text_hash:',
            ),
            quoteTextHash: prefixedRefValue(
              envelope.generatedClaims.derivedFactRefs,
              'quote_text_hash:',
            ),
          },
        }
      : {}),
    nextSafeActions: envelope.nextSafeActions.map((entry) => ({ ...entry })),
  };
}

export function projectAgentCommerceDecisionEnvelope(envelope, surface) {
  const base = baseProjection(envelope);
  if (surface === 'feed') {
    return { ...base, exportable: base.allowed };
  }
  if (surface === 'tool') {
    return {
      ...base,
      paymentDispatchAttempted:
        envelope.payment?.paymentDispatchAttempted === true,
    };
  }
  if (surface === 'checkout') {
    const actionRule = agentCommerceDecisionActionRule(envelope.requestedAction);
    return {
      ...base,
      mutationAllowed:
        actionRule.mutatesState &&
        base.allowed &&
        (envelope.checkout?.validForRequestedAction ?? true),
      paymentDispatchAttempted:
        envelope.payment?.paymentDispatchAttempted === true,
    };
  }
  if (surface === 'admin') {
    return {
      ...base,
      ownerCodes: Array.from(
        new Set(
          envelope.nextSafeActions.map((action) =>
            `${action.owner}:${action.reasonCode}`.toLowerCase(),
          ),
        ),
      ).sort(),
    };
  }
  if (surface === 'support') {
    return {
      ...base,
      blockerSummary: base.reasonCodes.length
        ? base.reasonCodes.slice(0, 5).join(', ')
        : 'no_blockers',
    };
  }
  return base;
}

export function publicDecisionProjection(
  envelope,
  { now = envelope.evaluatedAt } = {},
) {
  const projection = projectAgentCommerceDecisionEnvelope(envelope, 'feed');
  if (isFresh(envelope.freshness, now)) return projection;
  return {
    ...projection,
    exportable: false,
    allowed: false,
    status: 'requires_revalidation',
    reasonCodes: ['freshness.stale'],
    nextSafeActions: [
      {
        action: 'refresh_product_commercial_facts',
        owner: 'system',
        reasonCode: 'freshness.stale',
      },
      {
        action: 'refresh_decision',
        owner: 'system',
        reasonCode: 'freshness.stale',
      },
    ],
  };
}

export function mcpDecisionProjection(envelope) {
  return {
    tool_result_type: 'agent_commerce_decision',
    ...projectAgentCommerceDecisionEnvelope(envelope, 'tool'),
  };
}

export function checkoutDecisionProjection(envelope) {
  return projectAgentCommerceDecisionEnvelope(envelope, 'checkout');
}

export function operatorDecisionProjection(envelope) {
  return projectAgentCommerceDecisionEnvelope(envelope, 'admin');
}

export function supportDecisionProjection(envelope) {
  return projectAgentCommerceDecisionEnvelope(envelope, 'support');
}


function boundaryIsFresh(envelope, now) {
  const checkedAt = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(checkedAt)) {
    throw new TypeError('projection time must be a valid date-time.');
  }
  const horizons = [
    envelope.freshness.validUntil,
    envelope.freshness.staleAfter,
  ]
    .filter(Boolean)
    .map((value) => new Date(value).getTime());
  return horizons.every(
    (horizon) => Number.isFinite(horizon) && horizon >= checkedAt,
  );
}

/**
 * Verifies integrity and trust before projecting an envelope across a boundary.
 * HMAC and unsigned output are opt-in because they are not independently
 * verifiable public artifacts.
 */
export function projectTrustedAgentCommerceDecisionEnvelope(
  envelope,
  surface,
  {
    verificationPublicKeyPem = null,
    signingSecret = null,
    allowHmac = false,
    allowUnsignedLocalDevelopment = false,
    trustedKeyId = null,
    trustedVerificationKeyRef = null,
    now = new Date(),
  } = {},
) {
  if (envelope.surface !== surface) {
    throw new Error(
      `Agent-commerce decision surface mismatch: envelope=${envelope.surface ?? 'unscoped'}, projection=${surface}.`,
    );
  }

  const { authenticator } = envelope;
  if (
    authenticator.kind === 'message_authentication_code' &&
    !allowHmac
  ) {
    throw new Error(
      'This decision boundary requires an independently verifiable Ed25519 signature.',
    );
  }
  if (
    authenticator.kind === 'unsigned' &&
    !allowUnsignedLocalDevelopment
  ) {
    throw new Error('Unsigned decision envelopes are local-development only.');
  }
  if (
    authenticator.kind !== 'unsigned' &&
    ((trustedKeyId && authenticator.keyId !== trustedKeyId) ||
      (trustedVerificationKeyRef &&
        authenticator.verificationKeyRef !== trustedVerificationKeyRef))
  ) {
    throw new Error(
      'Agent-commerce decision envelope uses an untrusted verification key reference.',
    );
  }

  const integrity = evaluateAgentCommerceDecisionEnvelopeIntegrity({
    envelope,
    signingSecret,
    verificationPublicKeyPem,
    allowUnsignedLocalDevelopment,
  });
  if (!integrity.valid) {
    throw new Error(
      `Agent-commerce decision envelope integrity failed: ${integrity.reasonCodes.join(', ')}.`,
    );
  }

  if (
    surface !== 'admin' &&
    surface !== 'support' &&
    envelope.basis.allowed &&
    !boundaryIsFresh(envelope, now)
  ) {
    throw new Error('Agent-commerce decision envelope is stale for projection.');
  }

  return projectAgentCommerceDecisionEnvelope(envelope, surface);
}
