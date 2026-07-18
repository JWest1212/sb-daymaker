import { describe, it, expect } from 'vitest';
import { sbISO } from './tz';

describe('sbISO, America/Los_Angeles offset stamping', () => {
  it('uses PDT (-07:00) in summer', () => {
    expect(sbISO(2026, 7, 12, 19, 0)).toBe('2026-07-12T19:00:00-07:00');
  });

  it('uses PST (-08:00) in winter', () => {
    expect(sbISO(2026, 12, 9, 20, 0)).toBe('2026-12-09T20:00:00-08:00');
  });

  it('handles the day after DST ends (Nov 1 2026) as PST', () => {
    expect(sbISO(2026, 11, 5, 20, 0)).toBe('2026-11-05T20:00:00-08:00');
  });

  it('handles a date still in DST (late Oct) as PDT', () => {
    expect(sbISO(2026, 10, 16, 17, 30)).toBe('2026-10-16T17:30:00-07:00');
  });

  it('produces a string that parses to the correct UTC instant', () => {
    // 7:00 PM PDT == 02:00 UTC next day.
    const iso = sbISO(2026, 7, 12, 19, 0);
    expect(new Date(iso).toISOString()).toBe('2026-07-13T02:00:00.000Z');
  });

  it('passes the gate’s deterministic-start regex (has T and clock)', () => {
    expect(/\d[T ]\d{2}:\d{2}/.test(sbISO(2026, 8, 1, 9, 5))).toBe(true);
  });
});
