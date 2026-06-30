import { describe, it, expect } from 'vitest';
import { resolveYearlessDate } from './inferYear';

// Run date anchor for all tests: 2026-06-30 (a Tuesday)
const RUN = '2026-06-30T00:00:00Z';

describe('resolveYearlessDate', () => {
  it('resolves an upcoming Saturday in the same year', () => {
    // July 4, 2026 is a Saturday (dow 6)
    const result = resolveYearlessDate({ month: 7, day: 4, weekday: 6, timeHHmm: '20:00' }, RUN);
    expect(result).toBe('2026-07-04T20:00:00-07:00');
  });

  it('resolves when no weekday checksum is provided', () => {
    const result = resolveYearlessDate({ month: 7, day: 15, timeHHmm: '19:30' }, RUN);
    expect(result).toBe('2026-07-15T19:30:00-07:00');
  });

  it('advances to next year when the date already passed this year', () => {
    // Jan 10 already passed in 2026 relative to run date of Jun 30
    const result = resolveYearlessDate({ month: 1, day: 10, timeHHmm: '18:00' }, RUN);
    expect(result).toBe('2027-01-10T18:00:00-08:00');
  });

  it('returns null when weekday does not match either this year or next', () => {
    // 2026-07-04 = Saturday (6); 2027-07-04 = Sunday (0) — neither is Tuesday (2)
    expect(resolveYearlessDate({ month: 7, day: 4, weekday: 2, timeHHmm: '20:00' }, RUN)).toBeNull();
  });

  it('returns null when no time is provided', () => {
    expect(resolveYearlessDate({ month: 7, day: 4, weekday: 6 }, RUN)).toBeNull();
  });

  it('returns null for an impossible date (Feb 30)', () => {
    expect(resolveYearlessDate({ month: 2, day: 30, timeHHmm: '18:00' }, RUN)).toBeNull();
  });

  it('returns null when the only weekday-matching occurrence is > 400 days out', () => {
    // 2026-08-15 = Saturday (6); 2027-08-15 = Sunday (0) which is 411 days from runDate
    // weekday:0 skips 2026-08-15, then 2027-08-15 fails the 400-day guard → null
    expect(resolveYearlessDate({ month: 8, day: 15, weekday: 0, timeHHmm: '19:00' }, RUN)).toBeNull();
  });

  it('resolves the run date itself (same day is in-window)', () => {
    // June 30, 2026 is a Tuesday (dow 2)
    const result = resolveYearlessDate({ month: 6, day: 30, weekday: 2, timeHHmm: '08:00' }, RUN);
    expect(result).toBe('2026-06-30T08:00:00-07:00');
  });
});
