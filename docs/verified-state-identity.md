# Verified-state identity

A valid hash or authenticator establishes integrity for a particular
representation. It does not guarantee that later application code will consume
that same representation.

At an external JavaScript boundary, a runtime object can expose changing
accessors, proxy behavior, mutable aliases, sparse arrays, or nested values that
change between verification and projection. The trusted boundary therefore:

1. accepts input as untrusted runtime data;
2. captures every enumerable JSON property at most once;
3. rejects unsupported or ambiguous runtime shapes;
4. detaches the captured value from the caller;
5. deeply freezes the captured value;
6. performs trust, integrity, freshness, and live-request checks on it; and
7. creates the surface projection from that exact same value.

This control protects verified-state identity. It does not replace
execution-time revalidation of mutable commerce facts such as price, inventory,
promotion eligibility, tax, delivery availability, or payment-mandate state.
