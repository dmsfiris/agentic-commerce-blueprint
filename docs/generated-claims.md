# Generated claims

Generated commerce text is treated as a scoped capability, not a plain string field.

The canonical envelope carries:

- `allowed`
- `status`
- `claimIds`
- `sourceFactRefs`
- `derivedFactRefs`
- `allowedUses`
- `axes`
- `blockerCodes`
- `inheritedRefusalCount`

The seven axes are:

- source
- freshness
- scope
- surface
- use
- payload
- taint

Taint carries inherited refusal from upstream generated claims so rewording cannot make an unsafe dependency appear clean.

Approved-value, claim-text, and quote-text hashes can be carried as prefixed derived references. Surface projections expose them as `approvedValueHash`, `claimTextHash`, and `quoteTextHash` when present.

`canUseGeneratedClaimCapability` requires a concrete claim identity, requested use, surface, and observed or supplied value hash before a surface uses generated text. An allowed claim must declare at least one allowed use. Opaque claim and fact references preserve case; only controlled vocabularies such as allowed-use and blocker codes are normalized to lowercase. The envelope itself does not expose raw claim text.

## Canonical status and axes

When a claim identity exists and several non-allowed conditions apply, aggregate status follows one precedence:

```text
inherited_refusal
refused_here
stale
out_of_scope
requires_review
allowed
```

`absent` applies only when no claim identity exists. A `passed` or `not_evaluated` axis carries no blockers, while a `failed` axis carries at least one blocker. The normalizer derives the aggregate status from claim identity, inherited-refusal state, axes, blockers, and the requested local-refusal signal rather than accepting a caller-selected summary as authoritative.

This keeps claim-state visibility separate from action-state causality. A `delegate_payment` envelope may carry a refused or reviewable claim for visibility without making that claim the reason for a checkout or payment block. A separate `show_generated_claim` decision may return `requires_review` for the action while preserving a stronger canonical claim status such as `inherited_refusal`.

## Direct dependency-projection binding

`createGeneratedClaimDependencyProjection` gives each parent projection a canonical identity over:

- the source envelope and evidence-pin hashes;
- the source record key;
- requested surface, use, market, locale, jurisdiction, and channel;
- projection status, refusal kind, axis state, blockers, and inherited lineage.

`bindDerivedGeneratedClaimProvenance` then hash-verifies every supplied projection, normalizes dependency order, and binds both usable and refused parents into the child’s canonical provenance hash. This means a changed usable parent or changed consumption context invalidates the child even when its visible text is unchanged.

Taint remains causal: only projections actually supplied as derivation dependencies can contribute inherited refusal. Multi-hop lineage is deduplicated and preserved completely up to the exported 256-entry limit. Construction fails above that limit rather than emitting partial lineage.

The owning generated-claim record retains `dependencyRefs` and `inheritedRefusals`. A canonical decision envelope can continue to expose compact projection state—axes, blocker codes, derived fact references, and `inheritedRefusalCount`—without carrying the full provenance graph or raw claim text.

## Related work and review feedback

Public feedback from Sergei Parfenov ([GitHub](https://github.com/P0rt)) helped sharpen explicit inherited-refusal propagation and the separation of provenance axes, allowing a consuming surface to enforce declared surface- and use-specific constraints without reinterpreting the canonical decision. His subsequent review clarified payment-authority-versus-checkout semantics, canonical generated-claim status precedence, live request binding, and the distinction between envelope freshness and authoritative aggregate state. Related discussions appear in [“Trust Isn’t a Scalar: Typed Provenance for Agent Chains”](https://dev.to/p0rt/trust-isnt-a-scalar-typed-provenance-for-agent-chains-229p) and [“Your Provenance Vector Dies at the Storage Boundary”](https://dev.to/p0rt/your-provenance-vector-dies-at-the-storage-boundary-4cc).
