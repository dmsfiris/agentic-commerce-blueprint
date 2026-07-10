import { mkdirSync, writeFileSync } from 'node:fs';
import {
  buildAgentCommerceDecisionEnvelope,
  canUseGeneratedClaimCapability,
  mcpDecisionProjection,
  operatorDecisionProjection,
  publicDecisionProjection,
  sha256Hex,
} from '../index.mjs';
import { allowedGeneratedClaims, baseInput } from './fixtures.mjs';

mkdirSync('examples', { recursive: true });
const travel = buildAgentCommerceDecisionEnvelope(baseInput());
writeFileSync(
  'examples/travel-backpack-envelope.json',
  `${JSON.stringify(travel, null, 2)}\n`,
);
writeFileSync(
  'examples/public-projection.json',
  `${JSON.stringify(
    publicDecisionProjection(travel, { now: travel.evaluatedAt }),
    null,
    2,
  )}\n`,
);
writeFileSync(
  'examples/mcp-projection.json',
  `${JSON.stringify(mcpDecisionProjection(travel), null, 2)}\n`,
);
writeFileSync(
  'examples/operator-projection.json',
  `${JSON.stringify(operatorDecisionProjection(travel), null, 2)}\n`,
);
const claimValue = 'Cabin-size compatible travel backpack.';
writeFileSync(
  'examples/generated-claim-capability.json',
  `${JSON.stringify(
    canUseGeneratedClaimCapability(allowedGeneratedClaims(), {
      claimId: 'claim:cabin-size-compatible',
      use: 'quote',
      surface: 'product_detail',
      requiredValueHash: sha256Hex({ claimValue }),
      observedValue: claimValue,
    }),
    null,
    2,
  )}\n`,
);
console.log('example outputs written');
