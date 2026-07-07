import { describe, it, expect } from 'vitest';
import { parseIndependentDate, classifyIndependent } from './independent';

describe('parseIndependentDate', () => {
  it('combines a year-less date + time and stamps SB offset', () => {
    // The function infers the year (this year, or next if the date already passed
    // by > a week) relative to "now" — mirror that same rule here instead of a
    // hardcoded year, so the test doesn't rot as the calendar rolls forward.
    const now = new Date();
    const year = now.getUTCFullYear();
    const guess = new Date(Date.UTC(year, 5, 27)); // June = month index 5
    const expectedYear = guess.getTime() < now.getTime() - 7 * 86_400_000 ? year + 1 : year;
    expect(parseIndependentDate('Sat, Jun 27', '2:00 PM')).toBe(`${expectedYear}-06-27T14:00:00-07:00`);
  });
  it('returns null when there is no clock time (gate will drop it)', () => {
    expect(parseIndependentDate('Sat, Jun 27', 'All Day')).toBeNull();
  });
});

describe('classifyIndependent', () => {
  it('maps event-category-* classes to a happening_category', () => {
    expect(classifyIndependent('events event-category-jazz')).toBe('live_music');
    expect(classifyIndependent('events event-category-arts-2')).toBe('arts_theater');
    expect(classifyIndependent('events event-category-wine')).toBe('food_drink_event');
    expect(classifyIndependent('events event-category-outdoors-recreation')).toBe('sports_outdoors_event');
    expect(classifyIndependent('events event-category-anniversary')).toBe('community_gathering');
  });
});
