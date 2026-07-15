# Semantic tests

The focused test suite covers the behavior most likely to drift across implementations and projections:

1. contract, schema, action, surface, actor, eligibility-source, result, authority, payment-authority, next-safe-action owner, generated-claim status, and axis vocabularies;
2. content-addressed rule-set references;
3. deterministic input, result, and decision hashes, including protected `decisionId`;
4. protected surface and derived freshness outcomes;
5. action-aware result precedence, contradictory-section rejection, and exact reason/component reconciliation;
6. payment non-evaluation when actor authority or checkout validity prevents evaluation, while preserving genuine payment-specific blocking after those prerequisites pass;
7. strict ISO date-times and canonical UTC output;
8. evidence identity, explicit hashes, and conflict rejection;
9. dependency identity, conservative horizon merging, and evidence-backed hash preservation;
10. canonical generated-claim precedence, axis/blocker coherence, clean absence, required allowed-use scope, case-sensitive opaque identities, action-aware causality, value-hash drift, direct parent-projection binding, deterministic dependency order, request-context invalidation, multi-hop inherited refusal, causal taint, mutation detection, and explicit lineage overflow;
11. HMAC-SHA-256, Ed25519, and explicit unsigned authenticator behavior;
12. authenticator metadata, key type, signature encoding, and protected-payload binding;
13. full-envelope integrity recomputation and rejection of non-canonical generated-claim state;
14. trusted projection surface, key, authenticator, freshness, and live requested-action, subject, and actor boundaries;
15. projection preservation of canonical hashes, hard blockers, reasons, and next actions;
16. token-based reason semantics that do not trigger on unrelated substrings; and
17. six controlled-ablation regression tests covering dependency revalidation, verified-state capture, surface binding, live request binding, refusal propagation, and deterministic corpus completeness.

Run:

```bash
npm test
npm run validate:shape
npm run ablations
```

## Canonical schema validation

The shape-validation entry point performs a complete dependency-free traversal of the JSON Schema subset used by the v4 envelope: references, alternatives, conjunctions, conditionals, constants, enums, types, required and unknown properties, item schemas, item-count constraints, uniqueness, minimums, minimum lengths, and regular-expression constraints. It validates all three authenticator variants and the committed canonical example.

Negative tests cover non-canonical timestamps, malformed Ed25519 values, unexpected fields, blockers on `passed` or `not_evaluated` claim axes, blockers on `not_evaluated` payment authority, allowed claims without allowed uses, incomplete generated-claim capability requests, and case-distinct opaque claim identities. Runtime and schema vocabularies are compared directly so action, surface, actor, eligibility-source, result, authority, payment-authority, next-safe-action owner, generated-claim status, and axis drift fails the normal `npm run check` command.

Aggregate-owned current state remains a production integration responsibility rather than a field invented by this compact repository. Consumers that mutate checkout, mandate, order, or product-decision state must verify the authoritative owner state in addition to using the trusted envelope boundary.
