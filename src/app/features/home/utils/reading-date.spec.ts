import { describe, it, expect } from 'vitest';
import { formatShortDate, formatStartedAt } from './reading-date';

describe('reading-date utils', () => {
  describe('formatShortDate', () => {
    it('formats ISO dates correctly into Spanish day and short month', () => {
      expect(formatShortDate('2026-09-14T10:00:00Z')).toBe('14 sep');
      expect(formatShortDate('2026-09-15T12:30:00')).toBe('15 sep');
      expect(formatShortDate('2026-01-01T00:00:00')).toBe('1 ene');
      expect(formatShortDate('2026-12-31T23:59:59')).toBe('31 dic');
      expect(formatShortDate('2026-09-04T09:00:00')).toBe('4 sep');
    });

    it('handles pure YYYY-MM-DD date strings', () => {
      expect(formatShortDate('2026-09-14')).toBe('14 sep');
    });

    it('returns null for empty, null, or invalid dates', () => {
      expect(formatShortDate(null)).toBeNull();
      expect(formatShortDate(undefined)).toBeNull();
      expect(formatShortDate('')).toBeNull();
      expect(formatShortDate('   ')).toBeNull();
      expect(formatShortDate('invalid-date')).toBeNull();
      expect(formatShortDate('2026-99-99')).toBeNull();
      expect(formatShortDate('2026-00-14')).toBeNull();
    });
  });

  describe('formatStartedAt', () => {
    it('returns user-facing "Iniciada el {date}" string', () => {
      expect(formatStartedAt('2026-09-14T10:00:00Z')).toBe('Iniciada el 14 sep');
      expect(formatStartedAt('2026-09-15T12:00:00Z')).toBe('Iniciada el 15 sep');
      expect(formatStartedAt('2026-09-04T10:00:00')).toBe('Iniciada el 4 sep');
    });

    it('returns null when date is invalid or absent', () => {
      expect(formatStartedAt(null)).toBeNull();
      expect(formatStartedAt(undefined)).toBeNull();
      expect(formatStartedAt('')).toBeNull();
    });
  });
});
