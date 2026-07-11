import { normalizeSha256 } from './hash.mjs';
import { text } from './text.mjs';

export function sha256EvidenceHash({ providedHash, id, type }) {
  const identity = `${text(type) ?? 'unknown'}:${text(id) ?? 'unknown'}`;
  const hash = normalizeSha256(providedHash);
  if (hash) return hash;
  throw new TypeError(
    `Canonical decision evidence ${identity} requires an explicit SHA-256 content or canonical-snapshot hash.`,
  );
}

export function normalizeEvidenceRefs(values) {
  const refsByIdentity = new Map();
  for (const ref of values ?? []) {
    const type = text(ref?.type ?? ref?.kind);
    const id = text(ref?.id);
    if (!type || !id) continue;
    const identity = `${type}:${id}`;
    const hash = sha256EvidenceHash({
      providedHash: ref.hash,
      id,
      type,
    });
    const existing = refsByIdentity.get(identity);
    if (existing && existing.hash !== hash) {
      throw new TypeError(
        `Canonical decision evidence ${identity} cannot carry conflicting SHA-256 hashes.`,
      );
    }
    refsByIdentity.set(identity, {
      type,
      id,
      hash,
      hashAlgorithm: 'sha256',
    });
  }
  return [...refsByIdentity.values()].sort((left, right) =>
    `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`),
  );
}
