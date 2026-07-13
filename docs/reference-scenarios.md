# Reference scenarios

## Travel Backpack

The primary scenario models:

- price below the buyer’s delegated threshold;
- stale inventory;
- missing return-policy coverage;
- a mandate artifact that otherwise authorizes the actor;
- checkout in `requires_revalidation`;
- payment authority left `not_evaluated` because checkout is invalid;
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
generated-claim status: inherited_refusal
explain: allowed from the decision basis
payment.authorityResult: not_evaluated
paymentDispatchAttempted: false
```

The committed envelope focuses on `delegate_payment`. Its action-aware basis is blocked by eligibility and checkout conditions, not by payment authority or generated-claim state. The generated-claim section remains visible and resolves to `inherited_refusal` while preserving stale, use, and taint detail in separate axes.

## Stale projection

The feed projection self-expires and returns `requires_revalidation` rather than locally rebuilding a decision.

## Generated-claim capability

A generated claim is usable only when intended use, surface, axes, inherited-refusal state, and value hash pass. The same example also binds one usable and one refused parent projection into a derived claim, preserving causal refusal while committing both parents and their request context.

## Payment artifact

A payment artifact is evidence supplied to a payment-authority decision. Its presence does not itself authorize provider dispatch. This example uses a valid checkout so a payment-specific mandate failure is evaluated and represented as `blocked`, keeping that result distinct from the Travel Backpack scenario's upstream checkout failure.
