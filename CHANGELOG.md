# Changelog

## 0.9.0 - ecommerce scenario evaluation

### Architecture and evaluation

- Added one execution-time dependency comparison that stops use of a decision
  when a protected price, inventory, policy, checkout, mandate, payment,
  authority, generated-claim, or evidence dependency is missing, changed, or
  expired.
- Added eight deterministic ecommerce scenarios covering price, promotion,
  inventory, delegated spending, generated claims, delivery promises, returns,
  and verified-state identity.
- Added one focused scenario test and a machine-readable scenario command.
- Bounded array allocation before capture to avoid allocating beyond the
  configured node budget.
- Kept one canonical v4 envelope and one trusted external projection boundary.

### Documentation

- Documented the scenario design, measures, limits, and execution-time use of
  authoritative dependency snapshots.

## 0.8.1 - verified-state identity correction

### Security and correctness

- Trusted projection now captures caller-controlled input once into a detached,
  deeply frozen JSON-compatible snapshot before any trust, integrity, freshness,
  request-binding, or projection operation.
- Verification and projection now consume the same captured representation.
- Sparse arrays, cycles, non-JSON values, unsupported prototypes, enumerable
  symbol keys, and access failures are rejected at the boundary.
- Added regression coverage for top-level and nested changing accessors,
  detachment, deep freezing, sparse arrays, hostile getters, custom iterators,
  cycles, and non-JSON values.

### API

- The canonical v4 envelope and projection output shapes are unchanged.
- `projectTrustedAgentCommerceDecisionEnvelope` now accepts `unknown` input and
  normalizes it at the trust boundary.
- Low-level projection helpers remain intended only for already trusted,
  internally built envelopes.
