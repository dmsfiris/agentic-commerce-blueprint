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
