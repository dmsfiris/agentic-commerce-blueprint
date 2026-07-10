export function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function optionalText(value) {
  return text(value) ?? undefined;
}

export function iso(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
  const normalized = text(value);
  if (!normalized) return new Date().toISOString();
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
}

export function optionalIso(value) {
  if (value == null || (text(value) === null && !(value instanceof Date))) return null;
  return iso(value);
}

export function uniqueTexts(values) {
  return Array.from(new Set((values ?? [])
    .map((value) => text(value)?.toLowerCase())
    .filter(Boolean)))
    .sort();
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
