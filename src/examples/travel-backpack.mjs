import { buildAgentCommerceDecisionEnvelope } from '../index.mjs';
import { baseInput } from './fixtures.mjs';

const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
console.log(JSON.stringify({
  scenario: 'travel-backpack delegate_payment',
  decisionId: envelope.decisionId,
  requestedAction: envelope.requestedAction,
  allowed: envelope.basis.allowed,
  status: envelope.basis.status,
  reasonCodes: envelope.basis.reasonCodes,
  basisSources: envelope.basis.components.map((entry) => entry.source),
  generatedClaimStatus: envelope.generatedClaims.status,
  paymentDispatchAttempted: envelope.payment.paymentDispatchAttempted,
  decisionHash: envelope.decisionHash,
}, null, 2));
