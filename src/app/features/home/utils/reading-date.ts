const SPANISH_SHORT_MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Formats an ISO or date string to short Spanish date (e.g. "14 sep").
 * Avoids timezone drift by parsing YYYY-MM-DD components directly when available.
 */
export function formatShortDate(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const day = Number.parseInt(match[3], 10);
    const monthIndex = Number.parseInt(match[2], 10) - 1;
    const month = SPANISH_SHORT_MONTHS[monthIndex];
    if (month && !Number.isNaN(day)) {
      return `${day} ${month}`;
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getDate()} ${SPANISH_SHORT_MONTHS[parsed.getMonth()]}`;
}

/**
 * Formats a startedAt ISO date into user-facing context: "Iniciada el {day} {month}".
 * E.g. "2026-09-14T10:00:00Z" -> "Iniciada el 14 sep".
 */
export function formatStartedAt(dateStr: string | null | undefined): string | null {
  const shortDate = formatShortDate(dateStr);
  return shortDate ? `Iniciada el ${shortDate}` : null;
}
