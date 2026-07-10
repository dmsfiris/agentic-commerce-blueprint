import { canUseGeneratedClaimCapability, sha256Hex } from '../index.mjs';
import { allowedGeneratedClaims } from './fixtures.mjs';

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

console.log(JSON.stringify({ scenario: 'generated claim capability gate', allowed, drifted }, null, 2));
