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
