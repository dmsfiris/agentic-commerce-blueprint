# Authenticators

The v4 contract uses the term `authenticator` because a digital signature and a message-authentication code are not the same cryptographic object.

## Detached Ed25519 digital signature

```json
{
  "kind": "digital_signature",
  "algorithm": "ed25519",
  "format": "detached",
  "keyId": "...",
  "verificationKeyRef": "...",
  "protectedHash": "...",
  "value": "...",
  "verifiable": true
}
```

A verifier uses the Ed25519 public key referenced by `verificationKeyRef`.

## Detached HMAC-SHA-256

```json
{
  "kind": "message_authentication_code",
  "algorithm": "hmac-sha256",
  "format": "detached",
  "keyId": "...",
  "verificationKeyRef": "...",
  "protectedHash": "...",
  "value": "...",
  "verifiable": true
}
```

HMAC establishes authenticity only inside a trust domain whose participants possess the shared secret. It is not an independently verifiable digital signature.

## Unsigned local output

When neither signing key nor shared secret is supplied, the builder emits:

```json
{
  "kind": "unsigned",
  "algorithm": "none",
  "format": "none",
  "protectedHash": "...",
  "verifiable": false,
  "warning": "missing_platform_signing_key"
}
```

Verification rejects this by default. It can be accepted only when `allowUnsignedLocalDevelopment` is explicitly enabled.

## Protected payload

The detached authenticator covers canonical metadata containing:

- `envelopeSchemaVersion`
- `decisionHash`
- `ruleSetHash`
- `keyId`
- `verificationKeyRef`

A change to any of those values invalidates verification.
