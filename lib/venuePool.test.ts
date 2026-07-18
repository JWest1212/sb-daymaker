import { describe, it, expect } from 'vitest';
import {
  pickFromPool,
  dedupeFeedVenuePhotos,
  scoreVenueMatch,
  bestVenueMatch,
  extractVenueNameFromAddress,
  type PoolPhoto,
  type MatchableVenue,
} from './venuePool';

describe('pickFromPool', () => {
  it('is deterministic, same thing + same day always picks the same index', () => {
    const a = pickFromPool('thing-1', '2026-07-09', 4);
    const b = pickFromPool('thing-1', '2026-07-09', 4);
    expect(a).toBe(b);
  });
  it('stays in range [0, poolLen)', () => {
    for (let i = 0; i < 50; i++) {
      const idx = pickFromPool(`thing-${i}`, '2026-07-09', 3);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    }
  });
  it('a different day can pick a different index (rotation)', () => {
    const picks = new Set<number>();
    for (const d of ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']) {
      picks.add(pickFromPool('soho-event', d, 5));
    }
    expect(picks.size).toBeGreaterThan(1);
  });
  it('poolLen <= 0 returns 0 rather than throwing', () => {
    expect(pickFromPool('x', '2026-07-09', 0)).toBe(0);
  });
});

describe('dedupeFeedVenuePhotos', () => {
  const pool: PoolPhoto[] = [
    { url: 'https://example.com/soho-1.jpg', source: 'google', attribution: 'A (Google)' },
    { url: 'https://example.com/soho-2.jpg', source: 'wikimedia', attribution: 'B · CC BY · Wikimedia Commons' },
    { url: 'https://example.com/soho-3.jpg', source: 'google', attribution: 'C (Google)' },
  ];
  const pools = { 'venue-soho': pool };

  it('the SOhO-style demo: 3 same-day events at one venue each get a distinct pool photo', () => {
    const feed = [
      { id: 'e1', venue_id: 'venue-soho', photo_url: pool[0].url, photo_source: 'google' },
      { id: 'e2', venue_id: 'venue-soho', photo_url: pool[0].url, photo_source: 'google' }, // collided at ingest time
      { id: 'e3', venue_id: 'venue-soho', photo_url: pool[0].url, photo_source: 'google' }, // collided at ingest time
    ];
    const out = dedupeFeedVenuePhotos(feed, pools);
    const urls = out.map((o) => o.photo_url);
    expect(new Set(urls).size).toBe(3); // three distinct photos
    expect(urls.every((u) => pool.some((p) => p.url === u))).toBe(true);
  });

  it('falls to a motif/big-type assignment once the pool is exhausted (4th event, 3-photo pool)', () => {
    const feed = [
      { id: 'e1', venue_id: 'venue-soho', photo_url: pool[0].url, photo_source: 'google', happening_category: 'live_music' },
      { id: 'e2', venue_id: 'venue-soho', photo_url: pool[0].url, photo_source: 'google', happening_category: 'live_music' },
      { id: 'e3', venue_id: 'venue-soho', photo_url: pool[0].url, photo_source: 'google', happening_category: 'live_music' },
      { id: 'e4', venue_id: 'venue-soho', photo_url: pool[0].url, photo_source: 'google', happening_category: 'live_music' },
    ];
    const out = dedupeFeedVenuePhotos(feed, pools);
    expect(out[3].photo_url).toBeNull();
    expect(out[3].photo_source).toBe('motif');
    expect(['motif', 'bigtype']).toContain(out[3].visual_kind);
  });

  it('leaves a non-colliding item alone (no other card shares its venue)', () => {
    const feed = [
      { id: 'e1', venue_id: 'venue-soho', photo_url: pool[1].url, photo_source: 'wikimedia' },
      { id: 'e2', venue_id: null, photo_url: 'https://example.com/other.jpg', photo_source: 'pexels' },
    ];
    const out = dedupeFeedVenuePhotos(feed, pools);
    expect(out[0].photo_url).toBe(pool[1].url);
    expect(out[1].photo_url).toBe('https://example.com/other.jpg');
  });

  it('never touches a card whose current photo is not a member of its venue\'s pool (founder override wins)', () => {
    const feed = [
      { id: 'e1', venue_id: 'venue-soho', photo_url: pool[0].url, photo_source: 'google' },
      // e2 shares the venue but its photo was a founder's one-off pick, not a pool member.
      { id: 'e2', venue_id: 'venue-soho', photo_url: 'https://example.com/founder-pick.jpg', photo_source: 'wikimedia' },
    ];
    const out = dedupeFeedVenuePhotos(feed, pools);
    expect(out[1].photo_url).toBe('https://example.com/founder-pick.jpg');
  });

  it('is a no-op when the venue has no pool entry', () => {
    const feed = [{ id: 'e1', venue_id: 'venue-unknown', photo_url: 'https://example.com/x.jpg', photo_source: 'wikimedia' }];
    expect(dedupeFeedVenuePhotos(feed, pools)).toEqual(feed);
  });
});

describe('scoreVenueMatch / bestVenueMatch', () => {
  const soho: MatchableVenue = {
    id: 'v1', place_id: 'ChIJ_soho_real', lat: 34.4208, lng: -119.6982, radius_m: 100,
    name_patterns: ['soho', 'soho restaurant'],
  };
  const bowl: MatchableVenue = {
    id: 'v2', place_id: null, lat: 34.435115, lng: -119.693409, radius_m: 200,
    name_patterns: ['santa barbara bowl', 'sb bowl'],
  };

  it('an exact place_id match scores far above a name/proximity-only match', () => {
    const exact = scoreVenueMatch(
      { title: 'Molly Miller Trio', address: '1221 State St', lat: null, lng: null, place_id: 'ChIJ_soho_real' },
      soho,
    );
    const nameOnly = scoreVenueMatch(
      { title: 'Salsa Night', address: 'SOhO Restaurant & Music Club, 1221 State St', lat: null, lng: null, place_id: null },
      soho,
    );
    expect(exact).toBeGreaterThan(nameOnly);
    expect(nameOnly).toBeGreaterThan(0);
  });

  it('matches a venue name embedded in the address, not just the title', () => {
    const score = scoreVenueMatch(
      { title: 'Jazz du Jour', address: 'soho restaurant & music club, 1221 state street', lat: null, lng: null, place_id: null },
      soho,
    );
    expect(score).toBeGreaterThan(0);
  });

  it('a proximity-only match (no name overlap) still scores within radius', () => {
    const score = scoreVenueMatch(
      { title: 'Rainbow Kitten Surprise', address: '1122 N Milpas St', lat: 34.435115, lng: -119.693409, place_id: null },
      bowl,
    );
    expect(score).toBeGreaterThan(0);
  });

  it('scores zero (no match) outside the radius with no name overlap', () => {
    const score = scoreVenueMatch(
      { title: 'Trivia Night', address: 'Lama Dog, 15 W Gutierrez St', lat: 34.30, lng: -119.85, place_id: null },
      bowl,
    );
    expect(score).toBe(0);
  });

  it('bestVenueMatch picks the higher-scoring venue and returns null on zero score', () => {
    const match = bestVenueMatch(
      { title: 'Molly Miller Trio', address: '1221 State St', lat: null, lng: null, place_id: 'ChIJ_soho_real' },
      [soho, bowl],
    );
    expect(match?.venue.id).toBe('v1');

    const noMatch = bestVenueMatch(
      { title: 'Trivia Night', address: 'Nowhere', lat: null, lng: null, place_id: null },
      [soho, bowl],
    );
    expect(noMatch).toBeNull();
  });
});

describe('extractVenueNameFromAddress', () => {
  it('extracts a leading venue-name segment, title-cased', () => {
    expect(extractVenueNameFromAddress('soho restaurant & music club, 1221 state street, santa barbara, ca'))
      .toBe('Soho Restaurant & Music Club');
    expect(extractVenueNameFromAddress('lobero theatre, 33 e. canon perdido st, santa barbara, ca 93101'))
      .toBe('Lobero Theatre');
  });
  it('returns null when the leading segment is itself a street address (starts with a number)', () => {
    expect(extractVenueNameFromAddress('40 e anapamu st, santa barbara, ca 93101')).toBeNull();
    expect(extractVenueNameFromAddress('1221 state st, santa barbara, ca 93101')).toBeNull();
  });
});
