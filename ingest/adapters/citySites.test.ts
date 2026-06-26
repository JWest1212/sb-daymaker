import { describe, it, expect } from 'vitest';
import { parseCityAria, classifyCity } from './citySites';

describe('parseCityAria', () => {
  it('extracts title + an exact, year-bearing SB start from the aria-label', () => {
    const out = parseCityAria('View Details - "Bob Baker Marionettes | Plaza del Mar" on Saturday, June 27, 2026 @ 11:00am');
    expect(out).toEqual({ title: 'Bob Baker Marionettes | Plaza del Mar', startISO: '2026-06-27T11:00:00-07:00' });
  });
  it('handles pm times', () => {
    expect(parseCityAria('View Details - "X" on Thursday, June 25, 2026 @ 6:00pm')?.startISO)
      .toBe('2026-06-25T18:00:00-07:00');
  });
  it('returns null on a non-matching label', () => {
    expect(parseCityAria('Some other text')).toBeNull();
  });
});

describe('classifyCity', () => {
  it('does not let "party" match arts (word boundary)', () => {
    expect(classifyCity('World Cup Watch Party: USA vs. Turkey')).toBe('community_gathering');
  });
  it('classifies recreation + arts + music', () => {
    expect(classifyCity('Recreation Swim | Oak Park')).toBe('sports_outdoors_event');
    expect(classifyCity('Bob Baker Marionettes | Plaza del Mar Band Shell')).toBe('arts_theater');
    expect(classifyCity('Summer Concert in the Park')).toBe('live_music');
  });
});
