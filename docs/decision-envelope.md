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

The JSON Schema is available at:

```text
schemas/agent-commerce-decision-envelope.v4.schema.json
```

## Hash semantics

`inputDependencyHash` changes when the decision identity or upstream context changes, even when the visible outcome remains blocked. The protected input includes `decisionId`, surface, action, subject, actor, input references, rule-set identity, evaluation time, evidence pins, and freshness dependencies.

`resultHash` changes when computed decision meaning changes. Hard blocks dominate confirmation, revalidation, and review outcomes, and contradictory sections such as `allowed` with blocker codes are rejected.

`decisionHash` wraps the contract version, schema version, dependency hash, and result hash.

The authenticator does not replace those hashes. It protects the decision hash and selected envelope metadata so a verifier can confirm origin or shared-secret authenticity.
