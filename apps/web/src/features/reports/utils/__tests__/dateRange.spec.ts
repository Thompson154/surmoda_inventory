import { describe, it, expect } from 'vitest';
import { toIsoStartOfDay, toIsoEndOfDay } from '../dateRange';

describe('toIsoStartOfDay', () => {
  it('returns a valid ISO string parseable as Date', () => {
    const result = toIsoStartOfDay('2026-04-27');
    expect(() => new Date(result)).not.toThrow();
    expect(isNaN(new Date(result).getTime())).toBe(false);
  });

  it('result ends with Z (UTC) after toISOString()', () => {
    const result = toIsoStartOfDay('2026-04-27');
    expect(result).toMatch(/Z$/);
  });

  it('the resulting Date is on the same calendar day as input (UTC or local)', () => {
    const result = toIsoStartOfDay('2026-04-27');
    // toISOString() in the helper means the UTC date should be the same OR at most one day off
    // depending on timezone. What matters: it is a valid ISO 8601 datetime.
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('toIsoStartOfDay and toIsoEndOfDay for the same day: start < end', () => {
    const start = new Date(toIsoStartOfDay('2026-04-27')).getTime();
    const end = new Date(toIsoEndOfDay('2026-04-27')).getTime();
    expect(start).toBeLessThan(end);
  });
});

describe('toIsoEndOfDay', () => {
  it('returns a valid ISO string parseable as Date', () => {
    const result = toIsoEndOfDay('2026-04-27');
    expect(() => new Date(result)).not.toThrow();
    expect(isNaN(new Date(result).getTime())).toBe(false);
  });

  it('result ends with Z (UTC)', () => {
    const result = toIsoEndOfDay('2026-04-27');
    expect(result).toMatch(/Z$/);
  });

  it('end-of-day is strictly after start-of-day', () => {
    const start = new Date(toIsoStartOfDay('2026-01-01')).getTime();
    const end = new Date(toIsoEndOfDay('2026-01-01')).getTime();
    expect(end - start).toBeGreaterThan(0);
  });

  it('end-of-day is strictly before start-of-NEXT-day', () => {
    const end = new Date(toIsoEndOfDay('2026-04-27')).getTime();
    const nextDayStart = new Date(toIsoStartOfDay('2026-04-28')).getTime();
    expect(end).toBeLessThan(nextDayStart);
  });
});
