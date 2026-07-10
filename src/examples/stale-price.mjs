import {
  buildAgentCommerceDecisionEnvelope,
  publicDecisionProjection,
} from '../index.mjs';
import { baseInput, allowedGeneratedClaims } from './fixtures.mjs';

const envelope = buildAgentCommerceDecisionEnvelope(
  baseInput({
    requestedAction: 'discover',
    eligibility: { result: 'allowed', blockerCodes: [], source: 'product' },
    authority: { result: 'not_required', blockerCodes: [] },
    payment: undefined,
    checkout: undefined,
    generatedClaims: allowedGeneratedClaims(),
    freshness: {
      validUntil: '2026-07-06T10:12:01.000Z',
      staleAfter: '2026-07-06T10:12:01.000Z',
      reasonCodes: [],
      dependencies: [
        {
          ref: 'price:travel-backpack:EUR:old',
          kind: 'price',
          validUntil: '2026-07-06T10:12:01.000Z',
        },
      ],
    },
    nextSafeActions: [],
  }),
);

console.log(
  JSON.stringify(
    {
      scenario: 'stale price projection',
      projection: publicDecisionProjection(envelope, {
        now: '2026-07-06T10:12:02.000Z',
      }),
    },
    null,
    2,
  ),
);
