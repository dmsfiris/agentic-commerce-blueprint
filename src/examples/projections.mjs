import { buildAgentCommerceDecisionEnvelope, publicDecisionProjection, mcpDecisionProjection, operatorDecisionProjection } from '../index.mjs';
import { baseInput } from './fixtures.mjs';

const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
console.log(JSON.stringify({
  scenario: 'projection surfaces',
  public: publicDecisionProjection(envelope, { now: envelope.evaluatedAt }),
  mcp: mcpDecisionProjection(envelope),
  operator: operatorDecisionProjection(envelope),
}, null, 2));
