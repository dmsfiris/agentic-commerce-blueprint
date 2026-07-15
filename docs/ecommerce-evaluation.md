# Ecommerce scenario evaluation

The scenario runner evaluates one decision architecture across eight deterministic
commerce situations. Seven scenarios begin with an allowed decision, change one
authoritative dependency, stop use of the stale decision, derive a fresh safe
outcome from structured raw facts, build a new canonical envelope from that
derived outcome, and verify consistent trusted projections. The eighth scenario
exercises verified-state identity with a caller-controlled runtime object.

Run:

```bash
npm run scenarios
```

The command prints machine-readable JSON. Focused tests are also included in
`npm test`. Execute dependency comparison only after trusted integrity and
request-binding verification, or with an envelope built inside the trusted
process.

## Scenarios and deterministic domain rules

1. price equality compares quoted and current amount/currency;
2. promotion eligibility reads the current eligibility flag and region;
3. inventory availability compares available and requested quantity;
4. delegated spending compares checkout amount and currency with the mandate;
5. generated-claim support reads structured evidence availability;
6. delivery freshness compares the promise validity horizon with evaluation time;
7. return-policy applicability compares the return request with current returnability; and
8. verified-state identity ensures caller-controlled state cannot drift after capture.

The first seven rules are explicit synthetic evaluation rules in
`src/examples/ecommerce-domain-rules.mjs`. Callers do not supply a preselected
`blocked` flag or blocker code. The rules reject malformed facts and expose a
rule identifier and evaluated-field list in the machine-readable scenario output.
They are evaluation fixtures, not a production policy engine or legal ruleset.

## Measures

Each result reports whether the initial decision was usable, whether changed
state was stopped, whether a fresh decision was required, whether the domain
outcome was derived from raw facts, whether refreshed surface projections
agreed, and whether decision and dependency hashes remained available for
traceability.

The scenarios are deterministic synthetic transactions. They establish executable
architecture behavior and correct derivation under the seven declared rules; they
do not establish rule completeness, production security, legal compliance,
payment-network interoperability, performance, population error rates, or
independent replication.


## Controlled negative-control ablations

Version 0.9.2 adds five purpose-built ablations that bypass one safeguard at a
time while leaving the protected implementation unchanged. Run:

```bash
npm run ablations
```

The machine-readable output compares the protected path with an experiment-only
unsafe variant for:

1. execution-time dependency revalidation;
2. detached verified-state capture;
3. target-surface binding;
4. live action, actor, and subject rebinding; and
5. generated-claim refusal propagation.

The unsafe helpers are local to the experiment and are not exported by the
package. A successful negative control requires the protected path to reject or
contain the demonstrated failure while the ablated path exhibits the predicted
regression. The study does not estimate exploit prevalence, establish that the
threat model is complete, or prove that the protected controls are sufficient
for production deployment.
