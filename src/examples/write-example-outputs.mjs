import { mkdirSync, writeFileSync } from 'node:fs';
import {
  bindDerivedGeneratedClaimProvenance,
  buildAgentCommerceDecisionEnvelope,
  canUseGeneratedClaimCapability,
  createGeneratedClaimDependencyProjection,
  mcpDecisionProjection,
  operatorDecisionProjection,
  publicDecisionProjection,
  sha256Hex,
} from '../index.mjs';
import {
  allowedGeneratedClaims,
  baseInput,
  blockedGeneratedClaims,
} from './fixtures.mjs';

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
const allowedCapability = canUseGeneratedClaimCapability(
  allowedGeneratedClaims(),
  {
    claimId: 'claim:cabin-size-compatible',
    use: 'quote',
    surface: 'product_detail',
    requiredValueHash: sha256Hex({ claimValue }),
    observedValue: claimValue,
  },
);
const driftedCapability = canUseGeneratedClaimCapability(
  allowedGeneratedClaims(),
  {
    claimId: 'claim:cabin-size-compatible',
    use: 'quote',
    surface: 'product_detail',
    requiredValueHash: sha256Hex({ claimValue }),
    observedValue: 'Waterproof expedition backpack.',
  },
);
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
  childPayloadHash: sha256Hex(
    'Cabin-size compatible with return terms unavailable.',
  ),
  dependencyProjections: [productProjection, policyProjection],
});
writeFileSync(
  'examples/generated-claim-capability.json',
  `${JSON.stringify(
    {
      scenario: 'generated claim capability and derived provenance',
      capabilityGate: {
        allowed: allowedCapability,
        drifted: driftedCapability,
      },
      derivedProvenance,
    },
    null,
    2,
  )}\n`,
);
console.log('example outputs written');
