import { parseSrsDate, getDeltaMinutesFromNow } from './srs-date-parser';

describe('srs-date-parser', () => {
  it('parses timestamps with explicit Z as UTC', () => {
    const timestamp = parseSrsDate('2026-09-19T18:30:00Z');
    expect(timestamp).toBe(Date.UTC(2026, 8, 19, 18, 30, 0));
  });

  it('parses timestamps with explicit offset correctly', () => {
    const timestamp = parseSrsDate('2026-09-19T13:30:00-05:00');
    expect(timestamp).toBe(Date.UTC(2026, 8, 19, 18, 30, 0));
  });

  it('defensively parses legacy timestamp without timezone as UTC', () => {
    const timestamp = parseSrsDate('2026-09-19T18:30:00');
    expect(timestamp).toBe(Date.UTC(2026, 8, 19, 18, 30, 0));
  });

  it('returns null for null, undefined, or invalid date strings', () => {
    expect(parseSrsDate(null)).toBeNull();
    expect(parseSrsDate(undefined)).toBeNull();
    expect(parseSrsDate('')).toBeNull();
    expect(parseSrsDate('invalid-date')).toBeNull();
    expect(parseSrsDate('2026-13-45T99:99:99Z')).toBeNull();
    expect(parseSrsDate('NaN')).toBeNull();
  });

  it('calculates 10m delta for Again (+10m) without recurrence of 310m', () => {
    const baseNow = Date.UTC(2026, 8, 19, 18, 30, 0);
    const futureDateStr = '2026-09-19T18:40:00Z';
    const delta = getDeltaMinutesFromNow(futureDateStr, baseNow);
    expect(delta).toBe(10);

    // Also verify legacy timestamp without Z
    const legacyFutureStr = '2026-09-19T18:40:00';
    const legacyDelta = getDeltaMinutesFromNow(legacyFutureStr, baseNow);
    expect(legacyDelta).toBe(10);
  });

  it('calculates 15m delta for Hard (+15m) without drift', () => {
    const baseNow = Date.UTC(2026, 8, 19, 18, 30, 0);
    const futureDateStr = '2026-09-19T18:45:00Z';
    const delta = getDeltaMinutesFromNow(futureDateStr, baseNow);
    expect(delta).toBe(15);
  });
});
