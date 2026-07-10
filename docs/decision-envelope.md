# Decision envelope

`buildAgentCommerceDecisionEnvelope` produces the canonical v4 envelope.

## Required identity and integrity fields

- `contractVersion`
- `envelopeSchemaVersion`
- `decisionId`
- `decisionHash`
- `inputDependencyHash`
- `resultHash`
- `evaluatedAt`
- `ruleSetVersion`
- `ruleSetRef`
- `ruleSetHash`
- `authenticator`

## Decision fields

- `freshness`
- `basis`
- optional `surface`
- `subject`
- `actor`
- `requestedAction`
- optional `inputRefs`
- `eligibility`
- `authority`
- optional `checkout`
- optional `payment`
- optional `generatedClaims`
- `evidenceRefs`
- `nextSafeActions`

## Contract and schema

```text
agent-commerce-decision-envelope-v4
agent-commerce-decision-envelope-schema-v4
```

The JSON Schema is published at:

```text
schemas/agent-commerce-decision-envelope.v4.schema.json
```

## Hash semantics

`inputDependencyHash` changes when the decision’s upstream context changes, even when the visible outcome remains blocked.

`resultHash` changes when computed decision meaning changes.

`decisionHash` wraps the contract version, schema version, dependency hash, and result hash.

The authenticator does not replace those hashes. It protects the decision hash and selected envelope metadata so a verifier can confirm origin or shared-secret authenticity.
