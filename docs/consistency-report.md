# Consistency report

This report records how the contract, schema, runtime modules, examples, and tests agree within this repository.

## Contract consistency

| Contract concept | Reference implementation |
|---|---|
| Contract version | `agent-commerce-decision-envelope-v4` |
| Schema version | `agent-commerce-decision-envelope-schema-v4` |
| Default rule set | `agent-commerce-decision-rules-v4` |
| Rule-set identity | `ruleSetRef` + `ruleSetHash` |
| Origin/authenticity | `authenticator` union |
| Digital signature | detached Ed25519 |
| Shared-secret authenticator | detached HMAC-SHA-256 |
| Unsigned state | explicit, non-verifiable |
| Actions | nine canonical actions including `show_generated_claim` and `explain` |
| Eligibility results | includes `requires_confirmation` |
| Generated-claim state | status, seven axes, inherited refusal, fact refs |
| Derived-claim provenance | verified projection hashes, direct dependency refs, causal lineage, bounded overflow |
| Evidence | required SHA-256 value on each reference |
| Hash boundaries | protected decision identity plus input dependency, result, and decision hashes |
| Projections | common canonical projection plus surface additions |

## Architecture coverage

| Architectural invariant | Repository support |
|---|---|
| Decision reasons are computed beside the result | `src/core/decision-basis.mjs` |
| Eligibility is distinct from authority | envelope sections and focused tests |
| Payment artifacts are evidence, not permission | payment-artifact example |
| Generated claims are scoped capabilities | generated-claim module and example |
| Derived claims bind all direct parent projections | projection identity, dependency binding, and multi-hop tests |
| Evidence refs are hash-pinned | evidence module |
| Projections can self-expire without erasing hard blockers | freshness and public projection |
| Rule-set changes are detectable | content-addressed rule-set fields |
| Envelope origin can be verified | authenticator module |
| Projections do not reconstruct meaning | projection module consumes the canonical basis |

## Deliberate compactness

The repository does not copy a full commerce system. It omits catalog persistence, checkout storage, payment providers, order management, operator queues, and protocol servers. Those systems supply inputs to and consume outputs from the reference decision contract.

## Runtime consistency

The runtime modules consistently enforce strict date normalization, evidence identity and explicit content hashes, freshness dependency identity and conservative horizon merging, protected decision identity, hard-block precedence, semantic section coherence, token-based reason classification, generated-claim fail-closed normalization, verified direct parent-projection binding, deterministic dependency ordering, causal multi-hop refusal propagation, explicit lineage overflow, Ed25519 metadata and key validation, hash recomputation, exact reason/component reconciliation, and verified external projection.

## Schema consistency

The v4 schema is constrained to the runtime’s canonical output: UTC timestamps with millisecond precision, the exact unpadded 64-byte base64url representation used for detached Ed25519 signatures, and non-empty authenticator identifiers.

`npm run validate:shape` traverses the complete canonical JSON Schema without external dependencies. It validates unsigned, HMAC, Ed25519, and committed Travel Backpack envelopes; rejects unknown fields, malformed canonical timestamps, and malformed Ed25519 values; and tests schema action, surface, actor, eligibility-source, result, authority, payment-authority, next-safe-action owner, generated-claim status, and generated-claim axis vocabularies against the runtime constants.
