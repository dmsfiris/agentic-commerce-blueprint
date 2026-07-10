# Semantic checks

The test suite is intentionally focused. It covers:

1. v4 contract and schema identifiers;
2. content-addressed rule-set references;
3. the complete action vocabulary;
4. `requires_confirmation` as a distinct state;
5. HMAC-SHA-256 creation and verification;
6. Ed25519 creation and public-key verification;
7. unsigned-envelope rejection by default;
8. authenticator binding to decision and rule-set hashes;
9. SHA-256 evidence pins;
10. dependency-hash changes independent of visible result;
11. decision-hash composition;
12. action-aware generated-claim causality;
13. generated-claim value-hash drift;
14. projection preservation of canonical hashes and reasons.

Run:

```bash
npm test
npm run validate:shape
```

This is a semantic reference check, not a test-per-file framework.
