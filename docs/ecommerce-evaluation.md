# Ecommerce scenario evaluation

The scenario runner evaluates one decision architecture across eight deterministic
commerce situations. Seven scenarios begin with an allowed decision, change one
authoritative dependency, stop use of the stale decision, and produce a fresh
non-allowed outcome. The eighth scenario exercises verified-state identity with
a caller-controlled runtime object.

Run:

```bash
npm run scenarios
```

The command prints machine-readable JSON. The focused test is also included in
`npm test`. Execute dependency comparison only after trusted integrity and
request-binding verification, or with an envelope built inside the trusted
process.

## Scenarios

1. price changes before checkout completion;
2. promotion eligibility changes;
3. inventory is exhausted;
4. the checkout total exceeds delegated authority;
5. a generated product claim loses supporting evidence;
6. a delivery promise becomes stale;
7. a return request conflicts with the current policy; and
8. runtime state changes after its first read.

## Measures

Each result reports whether the initial decision was usable, whether changed
state was stopped, whether a fresh decision was required, whether refreshed
surface projections agreed, and whether decision and dependency hashes remained
available for traceability.

The scenarios are realistic deterministic fixtures, not merchant production
transactions. They establish executable architecture behavior within the
reference implementation; they do not establish production security, legal
compliance, payment-network interoperability, or performance.
