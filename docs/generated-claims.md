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

`canUseGeneratedClaimCapability` demonstrates a final value-hash check before a surface uses generated text. The envelope itself does not need to expose raw claim text.

## Fail-closed normalization

A generated claim cannot remain `allowed` when an axis failed, a required axis was not evaluated, blockers exist, or inherited refusal is present. Inconsistent allowed inputs are normalized to `stale`, `out_of_scope`, `inherited_refusal`, `absent`, or `requires_review`, with canonical blocker codes describing the failed axes.


## Direct dependency-projection binding

`createGeneratedClaimDependencyProjection` gives each parent projection a canonical identity over:

- the source envelope and evidence-pin hashes;
- the source record key;
- requested surface, use, market, locale, jurisdiction, and channel;
- projection status, refusal kind, axis state, blockers, and inherited lineage.

`bindDerivedGeneratedClaimProvenance` then hash-verifies every supplied projection, normalizes dependency order, and binds both usable and refused parents into the child’s canonical provenance hash. This means a changed usable parent or changed consumption context invalidates the child even when its visible text is unchanged.

Taint remains causal: only projections actually supplied as derivation dependencies can contribute inherited refusal. Multi-hop lineage is deduplicated and preserved completely up to the exported 256-entry limit. Construction fails above that limit rather than emitting partial lineage.

The owning generated-claim record retains `dependencyRefs` and `inheritedRefusals`. A canonical decision envelope can continue to expose compact projection state—axes, blocker codes, derived fact references, and `inheritedRefusalCount`—without carrying the full provenance graph or raw claim text.

## Related work and public feedback

Public feedback from Sergei Parfenov ([GitHub](https://github.com/P0rt)) helped sharpen two details represented here: explicit propagation of inherited refusal through derived claims, and preservation of separate provenance axes so each consuming surface can apply its own policy. Related discussions appear in [“Trust Isn’t a Scalar: Typed Provenance for Agent Chains”](https://dev.to/p0rt/trust-isnt-a-scalar-typed-provenance-for-agent-chains-229p) and [“Your Provenance Vector Dies at the Storage Boundary”](https://dev.to/p0rt/your-provenance-vector-dies-at-the-storage-boundary-4cc).
