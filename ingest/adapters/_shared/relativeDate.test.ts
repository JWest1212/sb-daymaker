import { describe, it, expect } from 'vitest';
import { parseRelativeDate } from './relativeDate';

// Run date anchor: 2026-06-30 (a Tuesday)
const RUN = '2026-06-30T07:00:00Z'; // 2026-06-30 in SB local

describe('parseRelativeDate', () => {
  it('resolves "Today"', () => {
    expect(parseRelativeDate('Today', '20:00', RUN)).toBe('2026-06-30T20:00:00-07:00');
  });

  it('resolves "Tomorrow"', () => {
    expect(parseRelativeDate('Tomorrow', '18:30', RUN)).toBe('2026-07-01T18:30:00-07:00');
  });

  it('resolves a named weekday ahead', () => {
    // Next Saturday from 2026-06-30 (Tue) is 2026-07-04
    expect(parseRelativeDate('Saturday', '20:00', RUN)).toBe('2026-07-04T20:00:00-07:00');
  });

  it('resolves "this Saturday"', () => {
    expect(parseRelativeDate('This Saturday', '19:00', RUN)).toBe('2026-07-04T19:00:00-07:00');
  });

  it('resolves "next Friday" as the coming Friday', () => {
    // 2026-06-30 Tue → next Friday = 2026-07-03
    expect(parseRelativeDate('next Friday', '21:00', RUN)).toBe('2026-07-03T21:00:00-07:00');
  });

  it('resolves a 3-letter weekday abbrev', () => {
    // Fri from 2026-06-30 → 2026-07-03
    expect(parseRelativeDate('Fri', '20:00', RUN)).toBe('2026-07-03T20:00:00-07:00');
  });

  it('returns null when no time given', () => {
    expect(parseRelativeDate('Today', '', RUN)).toBeNull();
  });

  it('returns null on unknown phrase', () => {
    expect(parseRelativeDate('Soon', '19:00', RUN)).toBeNull();
  });
});
