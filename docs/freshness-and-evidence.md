# Freshness and evidence

Every canonical evidence reference contains:

```text
type
id
hash
hashAlgorithm: sha256
```

If a valid SHA-256 hash is supplied, it is preserved. Otherwise the evidence identity and source are deterministically hashed.

Freshness dependencies cover:

- product
- price
- inventory
- policy
- checkout
- mandate
- generated claim
- authority
- payment
- evidence

Each dependency has a stable hash and may carry `validUntil` or `staleAfter`.

The envelope’s freshness horizon lets a feed or other projection self-expire without reinterpreting commercial truth. A stale feed projection may return `requires_revalidation` while operator and tool projections still expose the canonical decision and its original basis.
