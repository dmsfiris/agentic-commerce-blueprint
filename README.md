# Agentic Commerce Blueprint

A compact, dependency-free reference implementation of the Agentic Commerce Blueprint architecture.

The repository makes the architecture’s core invariants executable without reproducing a full catalog, checkout, payment, order-management, or operator platform.

## Implementation guarantees

The reference implementation enforces strict ISO date-time normalization, explicit evidence content hashes, identity-based dependency merging, canonical generated-claim precedence and axis coherence, deterministic binding of every direct generated-claim dependency projection, protected decision identity, action-aware result precedence, semantic section coherence, token-based reason classification, Ed25519 key and signature validation, full hash recomputation, reason/component reconciliation, live request rebinding at the trusted projection boundary, and dependency-free validation of the complete canonical JSON Schema against unsigned, HMAC, Ed25519, and committed example envelopes.

The low-level projection helpers remain available for inspecting surface shapes. Use `projectTrustedAgentCommerceDecisionEnvelope` at an external boundary. It first captures caller-controlled input into one detached, deeply frozen JSON-compatible snapshot; surface binding, authenticator policy, hash integrity, key identity, freshness, live request binding, and projection then consume that same snapshot. A stale envelope is never projected as an allowed decision; a blocked envelope may remain projectable so the recipient can receive the safe refusal and its remediation context. State-changing consumers must separately revalidate the owning aggregate’s current authoritative state. Snapshot identity preserves what was verified; it does not replace execution-time revalidation of price, inventory, policy, mandate, or other mutable aggregate state.

## Version note

Repository version 0.9.1 keeps one canonical v4 envelope and one trusted external projection boundary. It retains execution-time comparison of protected dependencies and strengthens the eight-scenario ecommerce evaluation by deriving refreshed safe outcomes from structured raw facts through seven explicit synthetic domain rules, rather than accepting caller-selected blocked flags or blocker codes.

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
- eight deterministic ecommerce evaluation scenarios, including seven outcomes derived from structured raw facts;
- execution-time comparison of protected dependencies with current authoritative snapshots;
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
    verified-state-identity.md
    ecommerce-evaluation.md
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
      execution.mjs
      projections.mjs
      boundary.mjs
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
      ecommerce-domain-rules.mjs
      ecommerce-scenarios.mjs
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
    boundary-snapshot.test.mjs
    ecommerce-domain-rules.test.mjs
    ecommerce-scenarios.test.mjs

  .github/workflows/ci.yml
```

## Ownership rule

- Core modules own reusable commercial decisions.
- The decision-basis module computes reasons beside the result.
- The authenticator module protects the canonical decision hash.
- Generated-claim modules own projection eligibility, allowed use, dependency state, direct projection binding, and inherited refusal.
- Freshness and evidence modules own dependency horizons and evidence pins.
- The execution module compares protected dependencies with current authoritative snapshots immediately before use.
- Projection modules translate one envelope into surface-safe forms without rebuilding commercial meaning.
- Synthetic domain-rule functions derive the seven refreshed commerce outcomes from structured facts; example fixtures then demonstrate the resulting envelopes and projections.
- Focused tests verify semantic consistency and contract alignment.

A production platform will normally distribute these responsibilities across its existing commerce domains. The folder structure is a reference implementation, not a required deployment topology.

## Run

Requires Node.js 20 or later and no external dependencies.

```bash
npm test
npm run validate:shape
npm run examples
npm run scenarios
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

This repository is a reference implementation, not a production payment or checkout system. The ecommerce scenarios use deterministic synthetic fixtures. Demo secrets and generated examples must never be reused as operational key material.
