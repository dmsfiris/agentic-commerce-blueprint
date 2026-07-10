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
    return {
      kind: 'digital_signature',
      algorithm: 'ed25519',
      format: 'detached',
      keyId,
      verificationKeyRef,
      protectedHash: decisionHash,
      value: sign(null, Buffer.from(payload), createPrivateKey(privateKeyPem))
        .toString('base64url'),
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
    return allowUnsignedLocalDevelopment === true;
  }

  const payload = authenticatorPayload({
    decisionHash,
    envelopeSchemaVersion,
    ruleSetHash,
    keyId: authenticator.keyId,
    verificationKeyRef: authenticator.verificationKeyRef,
  });

  if (authenticator.kind === 'digital_signature') {
    const publicKeyPem = text(verificationPublicKeyPem);
    if (!publicKeyPem) return false;
    return verify(
      null,
      Buffer.from(payload),
      createPublicKey(publicKeyPem),
      Buffer.from(authenticator.value, 'base64url'),
    );
  }

  const secret = text(signingSecret);
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(authenticator.value, 'utf8');
  return expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer);
}
