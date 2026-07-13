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

## Payment semantics

Checkout validity, payment-authority evaluation, and payment dispatch are separate. When actor authority is not allowed or checkout is not valid for the requested action, the canonical payment section is `not_evaluated`, carries no payment blocker codes, and records no dispatch attempt. A `blocked` payment-authority result is reserved for a payment-specific evaluation that actually ran and failed.

## Generated-claim semantics

Generated-claim aggregate status is derived from claim identity, axes, blockers, local refusal, and inherited-refusal state. For an identified claim, precedence is `inherited_refusal`, `refused_here`, `stale`, `out_of_scope`, `requires_review`, then `allowed`; `absent` is reserved for no claim identity. `passed` and `not_evaluated` axes carry no blockers, while `failed` axes carry at least one.

## Recipient binding

Integrity proves which action, subject, and actor were evaluated; it does not prove that they belong to the live request currently being processed. The trusted external projection boundary therefore compares the protected requested action, subject, and actor with an explicit live request binding. Before a mutation, the consumer must also verify the owning aggregate's current revision or lifecycle state because envelope freshness alone does not establish that the decision remains authoritative.
