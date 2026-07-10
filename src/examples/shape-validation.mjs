import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAgentCommerceDecisionEnvelope } from '../index.mjs';
import { baseInput } from './fixtures.mjs';

const envelope = buildAgentCommerceDecisionEnvelope(baseInput());
const schema = JSON.parse(
  readFileSync('schemas/agent-commerce-decision-envelope.v4.schema.json', 'utf8'),
);
const sha = /^[a-f0-9]{64}$/u;

assert.equal(envelope.contractVersion, 'agent-commerce-decision-envelope-v4');
assert.equal(
  envelope.envelopeSchemaVersion,
  'agent-commerce-decision-envelope-schema-v4',
);
assert.equal(
  schema.properties.contractVersion.const,
  envelope.contractVersion,
);
assert.equal(
  schema.properties.envelopeSchemaVersion.const,
  envelope.envelopeSchemaVersion,
);
assert.match(envelope.decisionHash, sha);
assert.match(envelope.inputDependencyHash, sha);
assert.match(envelope.resultHash, sha);
assert.match(envelope.ruleSetHash, sha);
assert.equal(envelope.authenticator.protectedHash, envelope.decisionHash);
for (const ref of envelope.evidenceRefs) {
  assert.equal(ref.hashAlgorithm, 'sha256');
  assert.match(ref.hash, sha);
}
for (const field of schema.required) {
  assert.ok(Object.hasOwn(envelope, field), `missing schema-required field: ${field}`);
}
console.log('shape validation passed');
