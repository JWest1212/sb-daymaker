import { describe, it, expect } from 'vitest';
import { eventCardWhen, eventClock, eventDetailWhen } from './eventTime';

const at = (localHHMM: string) => `2026-08-01T${localHHMM}:00-07:00`; // Sat, PDT

describe('eventClock, exact, no rounding', () => {
  it('shows minutes when present', () => {
    expect(eventClock(at('20:30'))).toBe('8:30 PM');
    expect(eventClock(at('18:15'))).toBe('6:15 PM');
  });
  it('omits :00 on the hour', () => {
    expect(eventClock(at('20:00'))).toBe('8 PM');
  });
});

describe('A0.3, card time is byte-identical to detail time', () => {
  for (const hhmm of ['20:30', '20:00', '11:05', '17:45']) {
    it(`clock token matches across card and detail at ${hhmm}`, () => {
      const iso = at(hhmm);
      const clock = eventClock(iso);
      // The card token is "<weekday> <clock>"; the detail is "<weekday>, <date>, <clock>".
      // Both must end with the exact same clock string.
      expect(eventCardWhen(iso).endsWith(clock)).toBe(true);
      expect(eventDetailWhen(iso).endsWith(clock)).toBe(true);
    });
  }
  it('card no longer drops minutes (the original bug)', () => {
    expect(eventCardWhen(at('20:30'))).toBe('Sat 8:30 PM');
    expect(eventDetailWhen(at('20:30'))).toBe('Saturday, Aug 1, 8:30 PM');
  });
});
