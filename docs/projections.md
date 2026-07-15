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

A projection may add or redact fields. It must not independently calculate commercial eligibility, checkout validity, payment authority, or generated-claim status.

## Trusted external boundary

`projectTrustedAgentCommerceDecisionEnvelope` captures input once into a detached, deeply frozen JSON-compatible snapshot, then verifies the target surface, authenticator policy, trusted key identity, complete envelope integrity, and freshness before projecting that same snapshot. A stale envelope cannot cross this boundary as an allowed decision; a blocked envelope may still be projected so the recipient receives the safe refusal and its remediation context. For feed, tool, checkout, and protocol output, it also requires an `expectedRequest` containing the live requested action, subject, and actor and rejects any mismatch with the protected envelope.

Admin and support projections may inspect historical decisions, so live request binding is optional for those surfaces. A state-changing consumer must still verify the owning aggregate's current authoritative state—such as a checkout revision or command fence, mandate lifecycle state, or current product decision. Envelope freshness limits artifact lifetime but does not establish that an older decision has not been superseded.
