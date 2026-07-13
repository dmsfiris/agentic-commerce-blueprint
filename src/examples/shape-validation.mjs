import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import {
  AGENT_COMMERCE_DECISION_ACTIONS,
  AGENT_COMMERCE_DECISION_ACTOR_TYPES,
  AGENT_COMMERCE_DECISION_AUTHORITY_RESULTS,
  AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES,
  AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS,
  AGENT_COMMERCE_DECISION_NEXT_SAFE_ACTION_OWNERS,
  AGENT_COMMERCE_DECISION_PAYMENT_AUTHORITY_RESULTS,
  AGENT_COMMERCE_DECISION_SURFACES,
  GENERATED_CLAIM_AXIS_KEYS,
  GENERATED_CLAIM_STATUS,
  buildAgentCommerceDecisionEnvelope,
} from '../index.mjs';
import { baseInput } from './fixtures.mjs';

const schema = JSON.parse(
  readFileSync('schemas/agent-commerce-decision-envelope.v4.schema.json', 'utf8'),
);

function resolveRef(ref) {
  assert.ok(ref.startsWith('#/'), `unsupported schema ref: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((value, key) => value[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value, expected) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'integer') return Number.isInteger(value);
  return typeof value === expected;
}

function validate(value, definition, path = '$') {
  if (definition.$ref) return validate(value, resolveRef(definition.$ref), path);

  if (definition.oneOf) {
    const successes = [];
    const failures = [];
    for (const option of definition.oneOf) {
      try {
        validate(value, option, path);
        successes.push(option);
      } catch (error) {
        failures.push(error.message);
      }
    }
    assert.equal(
      successes.length,
      1,
      `${path} must match exactly one schema option; matched ${successes.length}. ${failures.join(' | ')}`,
    );
    return;
  }

  if (definition.const !== undefined) {
    assert.deepEqual(value, definition.const, `${path} must equal ${JSON.stringify(definition.const)}`);
  }
  if (definition.enum) {
    assert.ok(definition.enum.includes(value), `${path} has unsupported value ${JSON.stringify(value)}`);
  }
  if (definition.type) {
    const expected = Array.isArray(definition.type) ? definition.type : [definition.type];
    assert.ok(
      expected.some((type) => matchesType(value, type)),
      `${path} must be ${expected.join(' or ')}, received ${describe(value)}`,
    );
  }
  if (typeof value === 'string') {
    if (definition.minLength !== undefined) {
      assert.ok(value.length >= definition.minLength, `${path} is shorter than ${definition.minLength}`);
    }
    if (definition.pattern) {
      assert.match(value, new RegExp(definition.pattern, 'u'), `${path} does not match ${definition.pattern}`);
    }
  }
  if (typeof value === 'number' && definition.minimum !== undefined) {
    assert.ok(value >= definition.minimum, `${path} must be at least ${definition.minimum}`);
  }
  if (Array.isArray(value)) {
    if (definition.minItems !== undefined) {
      assert.ok(value.length >= definition.minItems, `${path} must contain at least ${definition.minItems} items`);
    }
    if (definition.maxItems !== undefined) {
      assert.ok(value.length <= definition.maxItems, `${path} must contain at most ${definition.maxItems} items`);
    }
    if (definition.uniqueItems) {
      const stable = value.map((item) => JSON.stringify(item));
      assert.equal(new Set(stable).size, stable.length, `${path} must contain unique items`);
    }
    if (definition.items) {
      value.forEach((item, index) => validate(item, definition.items, `${path}[${index}]`));
    }
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of definition.required ?? []) {
      assert.ok(Object.hasOwn(value, key), `${path} is missing required property ${key}`);
    }
    if (definition.additionalProperties === false) {
      const allowed = new Set(Object.keys(definition.properties ?? {}));
      for (const key of Object.keys(value)) {
        assert.ok(allowed.has(key), `${path}.${key} is not allowed by the schema`);
      }
    }
    for (const [key, child] of Object.entries(definition.properties ?? {})) {
      if (Object.hasOwn(value, key)) validate(value[key], child, `${path}.${key}`);
    }
  }
}

const unsignedEnvelope = buildAgentCommerceDecisionEnvelope(baseInput());
const hmacEnvelope = buildAgentCommerceDecisionEnvelope({
  ...baseInput(),
  signingSecret: 'reference-shape-validation-secret',
});
const { privateKey } = generateKeyPairSync('ed25519');
const signedEnvelope = buildAgentCommerceDecisionEnvelope({
  ...baseInput(),
  signingPrivateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});

for (const envelope of [unsignedEnvelope, hmacEnvelope, signedEnvelope]) {
  validate(envelope, schema);
  assert.equal(envelope.authenticator.protectedHash, envelope.decisionHash);
}

const committedEnvelope = JSON.parse(
  readFileSync('examples/travel-backpack-envelope.json', 'utf8'),
);
validate(committedEnvelope, schema);

assert.deepEqual(
  schema.$defs.action.enum,
  [...AGENT_COMMERCE_DECISION_ACTIONS],
  'schema action vocabulary must match the runtime vocabulary',
);
assert.deepEqual(
  schema.properties.surface.enum,
  [...AGENT_COMMERCE_DECISION_SURFACES],
  'schema surface vocabulary must match the runtime vocabulary',
);
assert.deepEqual(
  schema.$defs.actor.properties.actorType.enum,
  [...AGENT_COMMERCE_DECISION_ACTOR_TYPES],
  'schema actor vocabulary must match the runtime vocabulary',
);
assert.deepEqual(
  schema.$defs.eligibility.properties.source.enum,
  [...AGENT_COMMERCE_DECISION_ELIGIBILITY_SOURCES],
  'schema eligibility-source vocabulary must match the runtime vocabulary',
);
assert.deepEqual(
  schema.$defs.nextSafeAction.properties.owner.enum,
  [...AGENT_COMMERCE_DECISION_NEXT_SAFE_ACTION_OWNERS],
  'schema next-safe-action owner vocabulary must match the runtime vocabulary',
);
assert.deepEqual(
  schema.$defs.projectionStatus.enum,
  [...AGENT_COMMERCE_DECISION_ELIGIBILITY_RESULTS],
  'schema result vocabulary must match the runtime vocabulary',
);

assert.deepEqual(
  schema.$defs.authority.properties.result.enum,
  [...AGENT_COMMERCE_DECISION_AUTHORITY_RESULTS],
  'schema authority vocabulary must match the runtime vocabulary',
);
assert.deepEqual(
  schema.$defs.payment.oneOf.map((option) => option.properties.authorityResult.const),
  [...AGENT_COMMERCE_DECISION_PAYMENT_AUTHORITY_RESULTS],
  'schema payment authority vocabulary must match the runtime vocabulary',
);

assert.deepEqual(
  schema.$defs.generatedClaims.properties.status.enum,
  [...GENERATED_CLAIM_STATUS],
  'schema generated-claim statuses must match the runtime vocabulary',
);
assert.deepEqual(
  schema.$defs.generatedClaims.properties.axes.required,
  [...GENERATED_CLAIM_AXIS_KEYS],
  'schema generated-claim axes must match the runtime vocabulary',
);

const invalidDateEnvelope = structuredClone(unsignedEnvelope);
invalidDateEnvelope.evaluatedAt = '2026-07-06T10:12:00Z';
assert.throws(
  () => validate(invalidDateEnvelope, schema),
  /does not match/u,
  'schema must require canonical UTC timestamps with milliseconds',
);

const invalidSignatureEnvelope = structuredClone(signedEnvelope);
invalidSignatureEnvelope.authenticator.value = 'not-a-canonical-ed25519-signature';
assert.throws(
  () => validate(invalidSignatureEnvelope, schema),
  /does not match/u,
  'schema must reject malformed Ed25519 signatures',
);

const unexpectedFieldEnvelope = structuredClone(unsignedEnvelope);
unexpectedFieldEnvelope.unexpected = true;
assert.throws(
  () => validate(unexpectedFieldEnvelope, schema),
  /not allowed/u,
  'schema must reject unrecognized canonical-envelope fields',
);

const contradictoryAxisEnvelope = structuredClone(unsignedEnvelope);
contradictoryAxisEnvelope.generatedClaims.axes.payload = {
  status: 'not_evaluated',
  blockerCodes: ['generated_claim_requires_review'],
};
assert.throws(
  () => validate(contradictoryAxisEnvelope, schema),
  /must match exactly one schema option/u,
  'schema must reject blockers on passed or not-evaluated axes',
);

const contradictoryPaymentEnvelope = structuredClone(unsignedEnvelope);
contradictoryPaymentEnvelope.payment = {
  paymentDispatchAttempted: false,
  authorityResult: 'not_evaluated',
  blockerCodes: ['invalid_checkout_state'],
};
assert.throws(
  () => validate(contradictoryPaymentEnvelope, schema),
  /must match exactly one schema option/u,
  'schema must reject blockers on unevaluated payment authority',
);

console.log('schema validation passed');
