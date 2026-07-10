# Reference scenarios

## Travel Backpack

The primary scenario models:

- price below the buyer’s delegated threshold;
- stale inventory;
- missing return-policy coverage;
- a mandate artifact that otherwise authorizes the actor;
- checkout in `requires_revalidation`;
- payment dispatch blocked before provider execution;
- generated claims requiring review;
- inherited refusal carried through the taint axis.

Expected results include:

```text
discover: allowed in the conceptual scenario
quote_policy: blocked
add_to_cart: requires_revalidation
prepare_checkout: blocked
delegate_payment: blocked
show_generated_claim: requires_review
explain: allowed from the decision basis
paymentDispatchAttempted: false
```

The committed envelope focuses on `delegate_payment` and demonstrates the v4 authenticator and rule-set pin.

## Stale projection

The feed projection self-expires and returns `requires_revalidation` rather than locally rebuilding a decision.

## Generated-claim capability

A generated claim is usable only when intended use, surface, axes, inherited-refusal state, and value hash pass.

## Payment artifact

A payment artifact is evidence supplied to a payment-authority decision. Its presence does not itself authorize provider dispatch.
