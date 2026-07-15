# Security

This repository is a reference implementation. It does not process real payments, credentials, or customer data.

Do not add live API keys, payment credentials, production signing keys, customer records, or operational endpoints.

The committed HMAC secret is deliberately public demonstration material used only to make generated examples deterministic. It provides no operational security.

Security-sensitive boundaries demonstrated here:

- payment artifacts are evidence, not payment permission;
- Ed25519 signatures and HMAC-SHA-256 authenticators are modeled separately;
- unsigned envelopes are rejected unless local-development acceptance is explicit;
- evidence refs are SHA-256 pinned;
- generated claims require scoped capability gates;
- projections do not reconstruct commercial meaning locally.

Report security issues privately to the repository owner before public disclosure.
## Verified-state identity

External runtime objects are not trusted merely because their hashes or authenticators validate. A caller-controlled object can contain accessors, proxies, mutable aliases, sparse arrays, or nested state that changes between reads. The current implementation therefore captures external envelope input once into a detached, deeply frozen JSON-compatible snapshot. Integrity verification, request binding, freshness checks, and projection all consume that same snapshot.

Use `projectTrustedAgentCommerceDecisionEnvelope` for every external boundary. Low-level projection helpers are suitable only for envelopes built and retained within a trusted process. State-changing consumers must still revalidate current authoritative aggregate state immediately before mutation.

## Execution-time state

A valid immutable envelope records what was decided. Before a state-changing
operation, first verify the envelope at the trusted boundary, then compare every
protected dependency with the current authoritative snapshot by using
`evaluateAgentCommerceDecisionExecution`. A missing, changed,
or expired dependency stops use of the old decision and requires a new one.

Boundary capture also rejects arrays whose declared length exceeds the configured
node budget before allocating the detached copy.
