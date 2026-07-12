# Semantic tests

The focused test suite covers the behavior most likely to drift across implementations and projections:

1. contract, schema, action, surface, actor, eligibility-source, result, authority, payment-authority, next-safe-action owner, generated-claim status, and axis vocabularies;
2. content-addressed rule-set references;
3. deterministic input, result, and decision hashes, including protected `decisionId`;
4. protected surface and derived freshness outcomes;
5. hard-block precedence, contradictory-section rejection, and exact reason/component reconciliation;
6. strict ISO date-times and canonical UTC output;
7. evidence identity, explicit hashes, and conflict rejection;
8. dependency identity, conservative horizon merging, and evidence-backed hash preservation;
9. action-aware generated-claim causality, value-hash drift, fail-closed axes, direct parent-projection binding, deterministic dependency order, request-context invalidation, multi-hop inherited refusal, causal taint, mutation detection, and explicit lineage overflow;
10. HMAC-SHA-256, Ed25519, and explicit unsigned authenticator behavior;
11. authenticator metadata, key type, signature encoding, and protected-payload binding;
12. full-envelope integrity recomputation;
13. trusted projection surface, key, authenticator, and freshness boundaries;
14. projection preservation of canonical hashes, hard blockers, reasons, and next actions;
15. token-based reason semantics that do not trigger on unrelated substrings.

Run:

```bash
npm test
npm run validate:shape
```

## Canonical schema validation

The shape-validation entry point performs a complete dependency-free traversal of the JSON Schema subset used by the v4 envelope: references, alternatives, constants, enums, types, required and unknown properties, item schemas, uniqueness, minimums, minimum lengths, and regular-expression constraints. It validates all three authenticator variants and the committed canonical example.

Negative tests cover non-canonical timestamps, malformed Ed25519 values, and unexpected fields. Runtime and schema vocabularies are compared directly so action, surface, actor, eligibility-source, result, authority, payment-authority, next-safe-action owner, generated-claim status, and axis drift fails the normal `npm run check` command.
