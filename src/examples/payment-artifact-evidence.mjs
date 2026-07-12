import { buildAgentCommerceDecisionEnvelope } from '../index.mjs';
import { baseInput } from './fixtures.mjs';

const envelope = buildAgentCommerceDecisionEnvelope(
  baseInput({
    requestedAction: 'delegate_payment',
    payment: {
      paymentDispatchAttempted: false,
      authorityResult: 'blocked',
      blockerCodes: [
        'payment_artifact_is_evidence_not_permission',
        'payment_mandate_missing',
      ],
    },
    nextSafeActions: [
      {
        action: 'obtain_buyer_mandate',
        owner: 'buyer',
        reasonCode: 'payment_mandate_missing',
      },
    ],
  }),
);

console.log(
  JSON.stringify(
    {
      scenario: 'payment artifact is evidence not permission',
      paymentDispatchAttempted: envelope.payment.paymentDispatchAttempted,
      reasonCodes: envelope.basis.reasonCodes,
      nextSafeActions: envelope.nextSafeActions,
    },
    null,
    2,
  ),
);
