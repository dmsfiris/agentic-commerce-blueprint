import {
  bindDerivedGeneratedClaimProvenance,
  canUseGeneratedClaimCapability,
  createGeneratedClaimDependencyProjection,
  sha256Hex,
} from '../index.mjs';
import { allowedGeneratedClaims, blockedGeneratedClaims } from './fixtures.mjs';

const claimText = 'Cabin-size compatible travel backpack.';
const expectedHash = sha256Hex({ claimValue: claimText });
const allowed = canUseGeneratedClaimCapability(allowedGeneratedClaims(), {
  claimId: 'claim:cabin-size-compatible',
  use: 'quote',
  surface: 'product_detail',
  requiredValueHash: expectedHash,
  observedValue: claimText,
});
const drifted = canUseGeneratedClaimCapability(allowedGeneratedClaims(), {
  claimId: 'claim:cabin-size-compatible',
  use: 'quote',
  surface: 'product_detail',
  requiredValueHash: expectedHash,
  observedValue: 'Waterproof expedition backpack.',
});

const productProjection = createGeneratedClaimDependencyProjection({
  generatedClaims: allowedGeneratedClaims(),
  sourceEnvelopeHash: sha256Hex('envelope:product-facts:travel-backpack'),
  sourceEvidencePinHash: sha256Hex('evidence:product-facts:travel-backpack'),
  sourceRecordKey: 'generated-claim:product-summary',
  requestedSurface: 'product_detail',
  requestedUse: 'quote',
  marketCode: 'EU',
});
const policyProjection = createGeneratedClaimDependencyProjection({
  generatedClaims: blockedGeneratedClaims(),
  sourceEnvelopeHash: sha256Hex('envelope:return-policy:travel-bags'),
  sourceEvidencePinHash: sha256Hex('evidence:return-policy:travel-bags'),
  sourceRecordKey: 'generated-claim:return-policy-summary',
  requestedSurface: 'product_detail',
  requestedUse: 'quote',
  marketCode: 'EU',
});
const derivedProvenance = bindDerivedGeneratedClaimProvenance({
  childRecordKey: 'generated-claim:travel-backpack-comparison',
  childPayloadHash: sha256Hex('Cabin-size compatible with return terms unavailable.'),
  dependencyProjections: [productProjection, policyProjection],
});

console.log(JSON.stringify({
  scenario: 'generated claim capability and derived provenance',
  capabilityGate: { allowed, drifted },
  derivedProvenance,
}, null, 2));
