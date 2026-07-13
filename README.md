# Agentic Commerce Blueprint

A compact, dependency-free reference implementation of the Agentic Commerce Blueprint architecture.

The repository makes the architecture’s core invariants executable without reproducing a full catalog, checkout, payment, order-management, or operator platform.

## Implementation guarantees

The reference implementation enforces strict ISO date-time normalization, explicit evidence content hashes, identity-based dependency merging, canonical generated-claim precedence and axis coherence, deterministic binding of every direct generated-claim dependency projection, protected decision identity, action-aware result precedence, semantic section coherence, token-based reason classification, Ed25519 key and signature validation, full hash recomputation, reason/component reconciliation, live request rebinding at the trusted projection boundary, and dependency-free validation of the complete canonical JSON Schema against unsigned, HMAC, Ed25519, and committed example envelopes.

The low-level projection helpers remain available for inspecting surface shapes. Use `projectTrustedAgentCommerceDecisionEnvelope` at an external boundary so surface binding, authenticator policy, hash integrity, key identity, freshness, and live requested-action, subject, and actor binding are verified before projection. State-changing consumers must separately revalidate the owning aggregate’s current authoritative state.

## Version note

Repository version 0.7.0 keeps the canonical v4 envelope shape while aligning the executable semantics with the reviewed article. Checkout or actor-authority failure leaves payment authority `not_evaluated`; generated-claim status follows one canonical precedence; axis status and blocker codes remain coherent; and trusted external projection rebinds the protected action, subject, and actor to the live request. These corrections change committed hash values. No compatibility branch is retained.

## What it demonstrates

- canonical agent-commerce decision envelope v4;
- action-aware eligibility and decision basis;
- eligibility separated from actor authority;
- checkout and payment state carried without adapter-owned business logic;
- payment-authority evaluation kept distinct from checkout blocking and provider dispatch;
- content-addressed rule-set references;
- distinct input, result, and decision hashes, with `decisionId` protected by the dependency hash;
- detached Ed25519 digital signatures;
- detached HMAC-SHA-256 message-authentication codes;
- explicit unsigned local-development output;
- SHA-256 evidence pins;
- freshness horizons and dependency refs;
- generated-claim projection gates, canonical status precedence, coherent axes, inherited refusal, and direct parent-projection binding;
- feed/public, MCP-style, checkout, operator, and support projections;
- a runnable Travel Backpack reference scenario;
- focused adversarial semantic tests, including contradictory sections, identity tampering, result precedence, and stale-projection behavior;
- dependency-free full canonical-envelope schema validation, including canonical timestamps and Ed25519 encoding.

## Canonical contract

The current contract identifiers are:

```text
contractVersion:       agent-commerce-decision-envelope-v4
envelopeSchemaVersion: agent-commerce-decision-envelope-schema-v4
default rule set:       agent-commerce-decision-rules-v4
```

The envelope carries:

- `decisionId`, `decisionHash`, `inputDependencyHash`, and `resultHash`;
- `ruleSetVersion`, content-addressed `ruleSetRef`, and `ruleSetHash`;
- an `authenticator` discriminated as a digital signature, message-authentication code, or unsigned local output;
- freshness dependencies and expiry horizons;
- a decision basis computed beside the result;
- action, subject, actor, input refs, eligibility, authority, checkout, and payment state;
- generated-claim projection state;
- hash-pinned evidence refs;
- owner-aware next safe actions.

## Authenticator model

The envelope does not label every integrity mechanism a “signature.”

- Ed25519 is represented as a detached `digital_signature`.
- HMAC-SHA-256 is represented as a detached `message_authentication_code`.
- Missing key material produces an explicit `unsigned` authenticator that verification rejects unless local-development acceptance is requested.

See [`docs/authenticators.md`](docs/authenticators.md).

## Repository map

```text
agentic-commerce-blueprint/
  README.md

  docs/
    architecture.md
    decision-envelope.md
    authenticators.md
    generated-claims.md
    freshness-and-evidence.md
    projections.md
    reference-scenarios.md
    semantic-tests.md
    contributor-review-vinicius.md
    consistency-report.md

  schemas/
    agent-commerce-decision-envelope.v4.schema.json

  src/
    core/
      actions.mjs
      authenticator.mjs
      decision-envelope.mjs
      decision-basis.mjs
      generated-claims.mjs
      freshness.mjs
      evidence.mjs
      projections.mjs
      normalizers.mjs
      hash.mjs
      text.mjs

    examples/
      fixtures.mjs
      travel-backpack.mjs
      stale-price.mjs
      generated-claim-capability.mjs
      payment-artifact-evidence.mjs
      projections.mjs
      shape-validation.mjs
      write-example-outputs.mjs

  examples/
    travel-backpack-envelope.json
    public-projection.json
    mcp-projection.json
    operator-projection.json
    generated-claim-capability.json

  tests/
    decision-envelope.test.mjs

  .github/workflows/ci.yml
```

## Ownership rule

- Core modules own reusable commercial decisions.
- The decision-basis module computes reasons beside the result.
- The authenticator module protects the canonical decision hash.
- Generated-claim modules own projection eligibility, allowed use, dependency state, direct projection binding, and inherited refusal.
- Freshness and evidence modules own dependency horizons and evidence pins.
- Projection modules translate one envelope into surface-safe forms without rebuilding commercial meaning.
- Example fixtures demonstrate the reference scenarios.
- Focused tests verify semantic consistency and contract alignment.

A production platform will normally distribute these responsibilities across its existing commerce domains. The folder structure is a reference implementation, not a required deployment topology.

## Run

Requires Node.js 20 or later and no external dependencies.

```bash
npm test
npm run validate:shape
npm run examples
```

Regenerate committed example outputs:

```bash
npm run write:examples
```

Run the full test, schema-validation, and example command:

```bash
npm run check
```

## Credits

- Architecture and implementation: Dimitrios S. Sfyris ([GitHub](https://github.com/dmsfiris))
- Technical architecture review contribution: Vinicius Pereira ([GitHub](https://github.com/vinimabreu), [DEV](https://dev.to/vinimabreu), [Website](https://www.vinimabreu.dev/))
- Public feedback on generated-claim provenance and subsequent semantic review: Sergei Parfenov ([GitHub](https://github.com/P0rt))

See [`docs/contributor-review-vinicius.md`](docs/contributor-review-vinicius.md) and the related-work note in [`docs/generated-claims.md`](docs/generated-claims.md).

## Scope and security

This repository is a reference implementation, not a production payment or checkout system. Demo secrets and generated examples must never be reused as operational key material.
