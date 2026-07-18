import { describe, it, expect } from 'vitest';
import { MARQUEE_VENUES, matchMarqueeVenue, haversineMeters } from './marqueeVenues';

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters(34.42, -119.70, 34.42, -119.70)).toBe(0);
  });
  it('returns a plausible distance for two nearby SB landmarks (Arlington -> Granada, ~a few hundred meters)', () => {
    const d = haversineMeters(34.4242051, -119.7069644, 34.4240477, -119.7045845);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(400);
  });
});

describe('matchMarqueeVenue', () => {
  it('matches by exact venue name token, case-insensitively', () => {
    const v = matchMarqueeVenue({ title: 'Live Jazz Night at the Santa Barbara Bowl' });
    expect(v?.key).toBe('sb-bowl');
  });
  it('matches a title containing a shorter alias token', () => {
    const v = matchMarqueeVenue({ title: 'Family Day at MOXI' });
    expect(v?.key).toBe('moxi');
  });
  it('matches by haversine proximity when the title has no venue name but coords are close', () => {
    const bowl = MARQUEE_VENUES.find((v) => v.key === 'sb-bowl')!;
    const v = matchMarqueeVenue({ title: 'Some Touring Band', lat: bowl.lat + 0.0005, lng: bowl.lng });
    expect(v?.key).toBe('sb-bowl');
  });
  it('returns null when neither name nor coords match any venue', () => {
    const v = matchMarqueeVenue({ title: 'Trivia Night at Lama Dog', lat: 34.30, lng: -119.85 });
    expect(v).toBeNull();
  });
  it('returns null with no coords and no name match', () => {
    expect(matchMarqueeVenue({ title: 'Farmers Market Downtown' })).toBeNull();
  });
  it('every registry entry ships with an empty pinnedPhoto (Phase 1, Jim pins later)', () => {
    for (const v of MARQUEE_VENUES) expect(v.pinnedPhoto).toBeUndefined();
  });
});
