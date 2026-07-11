# Freshness and evidence

Every canonical evidence reference contains:

```text
type
id
hash
hashAlgorithm: sha256
```

The hash is required and must identify the evidence content or a canonical snapshot. Missing or malformed hashes are rejected; the implementation does not substitute an identifier-derived fingerprint for canonical evidence.

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

## Identity and hash rules

Canonical evidence is identified by `(type, id)` and requires an explicit SHA-256 hash of the content or canonical snapshot. A second hash for the same identity is rejected. Freshness dependencies are identified by `(kind, ref)`; duplicate horizons merge to the earliest value. An evidence-backed dependency retains the evidence content hash when an explicit dependency adds only a horizon. Identifier-only dependencies may use a deterministic reference fingerprint, but they are not presented as evidence.
