import { normalizeSha256, stableCommercialJsonHash } from './hash.mjs';
import { text } from './text.mjs';

export function sha256EvidenceHash({ providedHash, id, type, source }) {
  return normalizeSha256(providedHash)
    ?? normalizeSha256(id)
    ?? stableCommercialJsonHash({
      type: text(type) ?? 'unknown',
      id: text(id) ?? 'unknown',
      source: source ?? null,
    });
}

export function normalizeEvidenceRefs(values) {
  const refs = (values ?? [])
    .map((ref) => {
      const type = text(ref?.type ?? ref?.kind);
      const id = text(ref?.id);
      if (!type || !id) return null;
      return {
        type,
        id,
        hash: sha256EvidenceHash({
          providedHash: ref.hash,
          id,
          type,
          source: ref.source ?? null,
        }),
        hashAlgorithm: 'sha256',
      };
    })
    .filter(Boolean);
  return Array.from(
    new Map(refs.map((ref) => [`${ref.type}:${ref.id}:${ref.hash}`, ref])).values(),
  ).sort((left, right) =>
    `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`),
  );
}
