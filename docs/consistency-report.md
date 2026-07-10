# Consistency report

The repository is synchronized with the current application-facing decision-envelope contract while remaining a compact, platform-neutral reference implementation.

## Contract alignment

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
| Evidence | required SHA-256 value on each reference |
| Hash boundaries | input dependency, result, and decision hashes |
| Projections | common canonical projection plus surface additions |

## Article alignment

| Article claim | Repository support |
|---|---|
| Decision reasons are computed beside the result | `src/core/decision-basis.mjs` |
| Eligibility is distinct from authority | envelope sections and focused tests |
| Payment artifacts are evidence, not permission | payment-artifact example |
| Generated claims are scoped capabilities | generated-claim module and example |
| Evidence refs are hash-pinned | evidence module |
| Projections can self-expire | freshness and public projection |
| Rule-set changes are detectable | content-addressed rule-set fields |
| Envelope origin can be checked | authenticator module |
| Projections do not reconstruct meaning | projection module consumes the canonical basis |

## Deliberate compactness

The repository does not copy a full commerce system. It omits catalog persistence, checkout storage, payment providers, order management, operator queues, and protocol servers. Those systems supply inputs to and consume outputs from the reference decision contract.
