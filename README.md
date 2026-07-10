# Agentic Commerce Blueprint

A compact, dependency-free reference implementation for the architecture described in *The Agentic Commerce Blueprint*.

The repository makes the article’s core claims executable without reproducing a full catalog, checkout, payment, order-management, or operator platform.

## What it demonstrates

- canonical agent-commerce decision envelope v4;
- action-aware eligibility and decision basis;
- eligibility separated from actor authority;
- checkout and payment state carried without adapter-owned business logic;
- content-addressed rule-set references;
- distinct input, result, and decision hashes;
- detached Ed25519 digital signatures;
- detached HMAC-SHA-256 message-authentication codes;
- explicit unsigned local-development output;
- SHA-256 evidence pins;
- freshness horizons and dependency refs;
- generated-claim projection gates, axes, and inherited refusal;
- feed/public, MCP-style, checkout, operator, and support projections;
- a runnable Travel Backpack reference scenario;
- focused semantic checks.

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
    article-integration.md
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
- Generated-claim modules own projection eligibility, allowed use, dependency state, and inherited refusal.
- Freshness and evidence modules own dependency horizons and evidence pins.
- Projection modules translate one envelope into surface-safe forms without rebuilding commercial meaning.
- Example fixtures demonstrate the reference scenarios.
- Focused checks verify semantic consistency and contract alignment.

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

Run the complete local check:

```bash
npm run check
```

## Publication status

This repository is a reference implementation, not a production payment or checkout system. Demo secrets and generated examples must never be reused as operational key material.
