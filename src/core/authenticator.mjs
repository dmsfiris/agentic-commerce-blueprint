import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign,
  timingSafeEqual,
  verify,
} from 'node:crypto';
import { stableJson } from './hash.mjs';
import { text } from './text.mjs';

export function authenticatorPayload({
  decisionHash,
  envelopeSchemaVersion,
  ruleSetHash,
  keyId,
  verificationKeyRef,
}) {
  return stableJson({
    envelopeSchemaVersion,
    decisionHash,
    ruleSetHash,
    keyId,
    verificationKeyRef,
  });
}

function ed25519SignatureBytes(value) {
  const normalized = text(value);
  if (
    !normalized ||
    normalized.length !== 86 ||
    !/^[A-Za-z0-9_-]+$/u.test(normalized)
  ) {
    return null;
  }
  const decoded = Buffer.from(normalized, 'base64url');
  return decoded.length === 64 && decoded.toString('base64url') === normalized
    ? decoded
    : null;
}

function constantTimeSha256HexEqual(left, right) {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function createDecisionEnvelopeAuthenticator({
  decisionHash,
  envelopeSchemaVersion,
  keyId,
  verificationKeyRef,
  ruleSetHash,
  signingSecret,
  signingPrivateKeyPem,
}) {
  const payload = authenticatorPayload({
    decisionHash,
    envelopeSchemaVersion,
    ruleSetHash,
    keyId,
    verificationKeyRef,
  });
  const privateKeyPem = text(signingPrivateKeyPem);
  if (privateKeyPem) {
    const privateKey = createPrivateKey(privateKeyPem);
    if (privateKey.asymmetricKeyType !== 'ed25519') {
      throw new TypeError(
        'Agent-commerce decision signatures require an Ed25519 private key.',
      );
    }
    return {
      kind: 'digital_signature',
      algorithm: 'ed25519',
      format: 'detached',
      keyId,
      verificationKeyRef,
      protectedHash: decisionHash,
      value: sign(null, Buffer.from(payload, 'utf8'), privateKey).toString(
        'base64url',
      ),
      verifiable: true,
    };
  }

  const secret = text(signingSecret);
  if (secret) {
    return {
      kind: 'message_authentication_code',
      algorithm: 'hmac-sha256',
      format: 'detached',
      keyId,
      verificationKeyRef,
      protectedHash: decisionHash,
      value: createHmac('sha256', secret).update(payload).digest('hex'),
      verifiable: true,
    };
  }

  return {
    kind: 'unsigned',
    algorithm: 'none',
    format: 'none',
    protectedHash: decisionHash,
    verifiable: false,
    warning: 'missing_platform_signing_key',
  };
}

export function verifyDecisionEnvelopeAuthenticator({
  decisionHash,
  envelopeSchemaVersion,
  ruleSetHash,
  authenticator,
  signingSecret,
  verificationPublicKeyPem,
  allowUnsignedLocalDevelopment = false,
}) {
  if (!authenticator || authenticator.protectedHash !== decisionHash) {
    return false;
  }
  if (authenticator.kind === 'unsigned') {
    return (
      authenticator.algorithm === 'none' &&
      authenticator.format === 'none' &&
      authenticator.verifiable === false &&
      authenticator.warning === 'missing_platform_signing_key' &&
      allowUnsignedLocalDevelopment === true
    );
  }
  if (
    !text(authenticator.keyId) ||
    !text(authenticator.verificationKeyRef) ||
    authenticator.format !== 'detached' ||
    authenticator.verifiable !== true
  ) {
    return false;
  }

  const payload = authenticatorPayload({
    decisionHash,
    envelopeSchemaVersion,
    ruleSetHash,
    keyId: authenticator.keyId,
    verificationKeyRef: authenticator.verificationKeyRef,
  });

  if (authenticator.kind === 'digital_signature') {
    if (authenticator.algorithm !== 'ed25519') return false;
    const publicKeyPem = text(verificationPublicKeyPem);
    if (!publicKeyPem) return false;
    try {
      const publicKey = createPublicKey(publicKeyPem);
      if (publicKey.asymmetricKeyType !== 'ed25519') return false;
      const signature = ed25519SignatureBytes(authenticator.value);
      if (!signature) return false;
      return verify(
        null,
        Buffer.from(payload, 'utf8'),
        publicKey,
        signature,
      );
    } catch {
      return false;
    }
  }

  if (
    authenticator.kind !== 'message_authentication_code' ||
    authenticator.algorithm !== 'hmac-sha256'
  ) {
    return false;
  }
  const secret = text(signingSecret);
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  return constantTimeSha256HexEqual(expected, authenticator.value);
}
