# Projections

The reference implementation exposes projections for:

- feed/public
- MCP-style tool
- checkout
- admin/operator
- support
- generic protocol

All projections preserve:

- schema version
- rule-set reference and hash
- authenticator
- decision, input, and result hashes
- requested action
- decision status and reasons
- freshness summary
- checkout/payment state when present
- generated-claim state when present
- next safe actions

Surface-specific additions include:

- feed/public: `exportable` and self-expiry behavior that preserves canonical hard blockers and next actions;
- MCP-style tool: `tool_result_type` and payment dispatch state;
- checkout: `mutationAllowed`;
- admin/operator: owner codes;
- support: a compact blocker summary.

A projection may add or redact fields. It must not independently calculate commercial eligibility or payment authority.
