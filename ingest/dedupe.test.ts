import { describe, it, expect } from 'vitest';
import { dedupe, titleSimilarity, type ExistingRow } from './dedupe';
import type { Candidate } from '../packages/shared/types';

function cand(over: Partial<Candidate>): Candidate {
  return {
    id: 'id-' + Math.round(titleSimilarity(over.title ?? 'x', over.title ?? 'x') * 0), // placeholder; override
    type: 'event',
    status: 'needs_review',
    title: 'Untitled',
    tier: 1,
    happening_category: 'live_music',
    address: '1221 State St, Santa Barbara, CA',
    price_band: null,
    time_of_day_fit: ['evening'],
    starts_at: '2026-07-09T20:00:00-07:00',
    ends_at: null,
    source_url: 'https://example.com/x',
    last_confirmed: '2026-06-25',
    start_strategy: 'structured',
    ...over,
  } as Candidate;
}

describe('titleSimilarity (Dice over trigrams, ~pg_trgm)', () => {
  it('is high for the same show with minor cross-source title variance', () => {
    expect(titleSimilarity('Molly Miller Trio', 'Molly Miller Trio (Live)')).toBeGreaterThan(0.55);
  });
  it('is low for unrelated titles', () => {
    expect(titleSimilarity('Molly Miller Trio', 'Andre Nickatina')).toBeLessThan(0.3);
  });
  it('does NOT match a short name against a much longer tour title (known limit)', () => {
    // Like pg_trgm similarity(), a big length gap dilutes the score — these stay
    // distinct rows; the human reviewer merges if needed. Documented, not a bug.
    expect(titleSimilarity('Royel Otis', 'Royel Otis: meet me in the car tour')).toBeLessThan(0.55);
  });
});

describe('dedupe', () => {
  it('drops an exact uuid5 id repeat within the batch', () => {
    const a = cand({ id: 'dup', title: 'Show A' });
    const b = cand({ id: 'dup', title: 'Show A' });
    const { keep, drops } = dedupe([a, b]);
    expect(keep).toHaveLength(1);
    expect(drops).toHaveLength(1);
    expect(drops[0].reason).toBe('duplicate');
  });

  it('drops an id already present in the DB', () => {
    const a = cand({ id: 'x1', title: 'Show A' });
    const existing: ExistingRow[] = [{ id: 'x1', title: 'Show A', starts_at: a.starts_at, source: 's' }];
    const { keep, drops } = dedupe([a], existing);
    expect(keep).toHaveLength(0);
    expect(drops[0].detail).toContain('already in DB');
  });

  it('on a same-day near-match, keeps the venue-owned (SOhO) over Ticketmaster', () => {
    const tm = cand({ id: 'tm', title: 'Molly Miller Trio', source_url: 'https://www.ticketmaster.com/event/123' });
    const soho = cand({ id: 'soho', title: 'Molly Miller Trio (Live)', source_url: 'https://tickets.sohosb.com/e/molly-miller-trio' });
    const { keep, drops } = dedupe([tm, soho]);
    expect(keep).toHaveLength(1);
    expect(keep[0].source_url).toContain('sohosb.com');
    expect(drops).toHaveLength(1);
    expect(drops[0].source).toBe('ticketmaster');
  });

  it('does NOT dedupe similar titles on different days', () => {
    const a = cand({ id: 'a', title: 'Open Mic Night', starts_at: '2026-07-09T20:00:00-07:00' });
    const b = cand({ id: 'b', title: 'Open Mic Night', starts_at: '2026-07-16T20:00:00-07:00' });
    const { keep } = dedupe([a, b]);
    expect(keep).toHaveLength(2);
  });
});
