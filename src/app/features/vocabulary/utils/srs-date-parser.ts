/**
 * Central SRS date parser utility.
 * Parses ISO timestamps from backend into UTC epoch milliseconds.
 *
 * If the string contains an explicit timezone offset ('Z', '+HH:MM', '-HH:MM'),
 * it is parsed directly as an absolute instant.
 *
 * If the string lacks a timezone offset (legacy format, e.g. "2026-09-19T18:30:00"),
 * it is defensively interpreted as UTC by appending 'Z', preventing browser-local
 * timezone drift (e.g. avoiding the +300m / 5-hour offset bug in America/Bogota UTC-5).
 */
export function parseSrsDate(dateStr: string | null | undefined): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  let isoStr = trimmed;
  // Check if string already contains a timezone indicator:
  // Ends with 'Z'/'z' OR ends with an offset like '+00:00', '-05:00', '+00', '-0500'
  const hasTimezone = /[zZ]$|[+-]\d{2}(?::?\d{2})?$/.test(trimmed);
  if (!hasTimezone) {
    isoStr = `${trimmed}Z`;
  }

  const timestamp = Date.parse(isoStr);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Calculates remaining delta minutes from now until the given SRS timestamp.
 * Returns null if the timestamp is missing or invalid.
 */
export function getDeltaMinutesFromNow(dateStr: string | null | undefined, now = Date.now()): number | null {
  const timestamp = parseSrsDate(dateStr);
  if (timestamp === null) return null;
  const diffMs = timestamp - now;
  return Math.max(0, Math.round(diffMs / 60000));
}
