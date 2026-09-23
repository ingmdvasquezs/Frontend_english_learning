import { describe, expect, it } from 'vitest';
import { formatIntervalSeconds } from './interval-formatter';

describe('formatIntervalSeconds', () => {
  it('handles null, undefined, NaN, and negative values gracefully', () => {
    expect(formatIntervalSeconds(null)).toBe('');
    expect(formatIntervalSeconds(undefined)).toBe('');
    expect(formatIntervalSeconds(NaN)).toBe('');
    expect(formatIntervalSeconds(-10)).toBe('');
  });

  it('formats sub-hour intervals as Xm (< 60 min)', () => {
    expect(formatIntervalSeconds(0)).toBe('1m');
    expect(formatIntervalSeconds(30)).toBe('1m');
    expect(formatIntervalSeconds(60)).toBe('1m');
    expect(formatIntervalSeconds(600)).toBe('10m'); // Again example: 600s = 10m
    expect(formatIntervalSeconds(1500)).toBe('25m');
    expect(formatIntervalSeconds(3540)).toBe('59m');
  });

  it('formats sub-day intervals as Xh (< 24 h)', () => {
    expect(formatIntervalSeconds(3600)).toBe('1h');
    expect(formatIntervalSeconds(7200)).toBe('2h');
    expect(formatIntervalSeconds(43200)).toBe('12h'); // Hard example: 43200s = 12h
    expect(formatIntervalSeconds(82800)).toBe('23h');
  });

  it('formats multi-day intervals as Xd (>= 24 h)', () => {
    expect(formatIntervalSeconds(86400)).toBe('1d');
    expect(formatIntervalSeconds(345600)).toBe('4d'); // Good example: 345600s = 4d
    expect(formatIntervalSeconds(1209600)).toBe('14d'); // Easy example: 1209600s = 14d
    expect(formatIntervalSeconds(2592000)).toBe('30d');
  });

  it('formats mature multi-month intervals as Xmo (>= 31 d)', () => {
    expect(formatIntervalSeconds(4924800)).toBe('1.9mo'); // 57d = 1.9mo
    expect(formatIntervalSeconds(5184000)).toBe('2mo'); // 60d = 2mo
  });
});
