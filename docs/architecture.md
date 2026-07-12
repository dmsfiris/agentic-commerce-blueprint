# Architecture

The central rule is: projections do not recreate commercial meaning locally.

A canonical commerce decision is built once in the domain path and then projected to feed/public, MCP-style tool, checkout, admin/operator, support, or protocol surfaces. A surface may redact, expire, or reshape the decision, but it does not independently infer eligibility, checkout validity, payment authority, or generated-claim permission.

## Decision path

1. Source-backed commercial facts
2. Policy applicability and quotability
3. Action-specific eligibility
4. Actor and delegated authority
5. Checkout state
6. Payment authority
7. Generated-claim projection state
8. Evidence and freshness
9. Canonical decision envelope
10. Surface projections
11. Operator next actions

## Reference ownership

- `actions.mjs` owns the action vocabulary and action characteristics.
- `decision-basis.mjs` owns action-aware reasons and result status.
- `decision-envelope.mjs` owns canonical assembly and hash boundaries.
- `authenticator.mjs` owns detached integrity/authenticity mechanisms.
- `generated-claims.mjs` owns generated-claim capability semantics and direct dependency-projection binding.
- `freshness.mjs` and `evidence.mjs` own dependency horizons and SHA-256 pins.
- `projections.mjs` owns surface translation.

## Anti-drift design

The decision basis is computed beside the decision. Hard blocks dominate softer confirmation, revalidation, and review outcomes. Projections consume `basis.reasonCodes` and `basis.components`; they do not infer reasons from unrelated fields.

The envelope separates:

- `inputDependencyHash`: decision identity, declared surface, requested action, actor, subject, refs, rule-set pin, evaluation time, evidence pins, and freshness dependencies;
- `resultHash`: computed eligibility, authority, checkout, payment, generated-claim state, derived freshness outcome, basis, and next-action output;
- `decisionHash`: contract/schema version plus both hashes.

The authenticator protects the decision hash together with the schema version, rule-set hash, key identifier, and verification-key reference.


## Derived generated-claim provenance

A derived claim commits to every direct projection actually used to produce it, including successful parents. Each projection receives a canonical `projectionHash` that covers its source envelope and evidence pin, source record, axis state, blockers, inherited lineage, and requested surface/use context. The child provenance hash covers its payload hash and normalized dependency references.

This keeps provenance causal and deterministic: dependency order does not change the child hash, a parent or request-context change does, unrelated refusals do not contaminate the child, and a projection whose stored hash no longer matches its semantics is rejected. Inherited-refusal lineage is retained completely up to one explicit bound; overflow fails instead of silently truncating provenance.
