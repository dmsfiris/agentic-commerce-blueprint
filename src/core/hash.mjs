import crypto from 'node:crypto';

export function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

export function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

export function sha256Hex(value) {
  const payload = typeof value === 'string' ? value : stableJson(value);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function isSha256Hex(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value.toLowerCase());
}

export function normalizeSha256(value) {
  return isSha256Hex(value) ? value.toLowerCase() : null;
}

export function stableCommercialJsonHash(value) {
  return sha256Hex(value);
}

export function hashTagged(tag, value) {
  return stableCommercialJsonHash({ tag, value });
}
