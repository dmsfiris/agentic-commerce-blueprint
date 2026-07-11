export function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function optionalText(value) {
  return text(value) ?? undefined;
}

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

export function normalizedIso(value, field = 'date-time') {
  if (typeof value === 'string' && !ISO_DATE_TIME_PATTERN.test(value.trim())) {
    throw new TypeError(`${field} must be a valid ISO-8601 date-time.`);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`${field} must be a valid ISO-8601 date-time.`);
  }
  return parsed.toISOString();
}

export function iso(value, field = 'evaluatedAt') {
  if (value instanceof Date) return normalizedIso(value, field);
  const normalized = text(value);
  return normalized ? normalizedIso(normalized, field) : new Date().toISOString();
}

export function optionalIso(value, field = 'freshness horizon') {
  if (value == null || (text(value) === null && !(value instanceof Date))) {
    return null;
  }
  return normalizedIso(value, field);
}

export function uniqueTexts(values) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => text(value)?.toLowerCase())
        .filter(Boolean),
    ),
  ).sort();
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
