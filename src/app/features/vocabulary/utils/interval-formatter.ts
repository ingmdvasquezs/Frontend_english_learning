/**
 * Formats SRS interval seconds according to FASE 14.3 requirements:
 * - < 60 min -> Xm
 * - < 24 h  -> Xh
 * - >= 24 h -> Xd
 */
export function formatIntervalSeconds(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds < 0) {
    return '';
  }

  const ONE_MINUTE = 60;
  const ONE_HOUR = 3600;
  const ONE_DAY = 86400;
  const ONE_MONTH = 30 * ONE_DAY;

  if (seconds < ONE_HOUR) {
    const mins = Math.max(1, Math.round(seconds / ONE_MINUTE));
    return `${mins}m`;
  }

  if (seconds < ONE_DAY) {
    const hours = Math.max(1, Math.round(seconds / ONE_HOUR));
    return `${hours}h`;
  }

  if (seconds < 31 * ONE_DAY) {
    const days = Math.max(1, Math.round(seconds / ONE_DAY));
    return `${days}d`;
  }

  const months = Math.round((seconds / ONE_MONTH) * 10) / 10;
  return `${months}mo`;
}
