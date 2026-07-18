import { describe, it, expect } from 'vitest';
import { dedupe, dedupeVenueAware, evaluateMatch, titleSimilarity, type ExistingRow } from './dedupe';
import type { VenueDictEntry } from './eventKey';
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

  it('on a same-day near-match, keeps the higher-authority source (SOhO over Ticketmaster)', () => {
    const tm = cand({ id: 'tm', title: 'Molly Miller Trio', source_url: 'https://www.ticketmaster.com/event/123' });
    const soho = cand({ id: 'soho', title: 'Molly Miller Trio (Live)', source_url: 'https://tickets.sohosb.com/e/molly-miller-trio' });
    const authority = new Map([['ticketmaster', 0.90], ['soho', 1.00]]); // matches supabase/migrations/20260715_sources.sql
    const { keep, drops } = dedupe([tm, soho], [], authority);
    expect(keep).toHaveLength(1);
    expect(keep[0].source_url).toContain('sohosb.com');
    expect(drops).toHaveLength(1);
    expect(drops[0].source).toBe('ticketmaster');
  });

  it('resolves a Phase-2-added source correctly regardless of batch order (regression: these used to fall back to a raw hostname string that could never match a sources.key, so they always lost ties)', () => {
    const authority = new Map([['alcazar', 0.94], ['eventbrite', 0.40]]);
    const alcazar = cand({ id: 'alc', title: 'Comedy Night', source_url: 'https://thealcazar.org/events/comedy-night' });
    const eb = cand({ id: 'eb', title: 'Comedy Night (SB)', source_url: 'https://www.eventbrite.com/e/comedy-night-12345' });
    const { keep } = dedupe([eb, alcazar], [], authority); // fed in reverse-authority order on purpose
    expect(keep).toHaveLength(1);
    expect(keep[0].id).toBe('alc');
  });

  it('does NOT dedupe similar titles on different days', () => {
    const a = cand({ id: 'a', title: 'Open Mic Night', starts_at: '2026-07-09T20:00:00-07:00' });
    const b = cand({ id: 'b', title: 'Open Mic Night', starts_at: '2026-07-16T20:00:00-07:00' });
    const { keep } = dedupe([a, b]);
    expect(keep).toHaveLength(2);
  });
});

const SOHO_DICT: VenueDictEntry[] = [
  { name_norm: 'soho restaurant music club', place_id: null, aliases: ['soho'] },
];

describe('evaluateMatch (Data Arch Redesign 26 Phase 2 — venue signal)', () => {
  it('matches (merge) a clear same-day title match with venue unknown on both sides, same as the old matcher', () => {
    const a = { title: 'Molly Miller Trio', starts_at: '2026-07-09T20:00:00-07:00' };
    const b = { title: 'Molly Miller Trio (Live)', starts_at: '2026-07-09T20:00:00-07:00' };
    const v = evaluateMatch(a, b, []);
    expect(v.outcome).toBe('merge');
    expect(v.venue).toBe('unknown');
    expect(v.signal).toBe('day');
  });

  it('kills the false-merge (split): same/near-identical title, same day, but DIFFERENT known venues', () => {
    const a = { title: 'Live Music Night', starts_at: '2026-07-09T20:00:00-07:00', address: 'SOhO, 1221 State St' };
    const b = { title: 'Live Music Night', starts_at: '2026-07-09T20:00:00-07:00', address: '4916 Carpinteria Ave' };
    const v = evaluateMatch(a, b, SOHO_DICT);
    expect(v.outcome).toBe('split');
    expect(v.venue).toBe('disagree');
  });

  it('is ambiguous (NOT auto-merged) for a mid-band title match even when venue agrees — held for Phase 3, not resolved deterministically', () => {
    // An earlier version of this matcher auto-merged this case; the live
    // shadow report against the real catalog caught it producing false
    // merges (e.g. two distinct same-day Music Academy masterclasses whose
    // titles both end in "Masterclass"). Spec 26 §3.3 explicitly routes
    // "same-or-unknown venue" mid-band pairs to AI adjudication, not a
    // lowered deterministic threshold.
    const a = { title: 'An Evening with Molly Miller', starts_at: '2026-07-09T20:00:00-07:00', address: 'SOhO' };
    const b = { title: 'Molly Miller Trio', starts_at: '2026-07-09T20:00:00-07:00', address: 'SOhO Restaurant & Music Club' };
    const sim = titleSimilarity(a.title, b.title);
    expect(sim).toBeGreaterThan(0.35);
    expect(sim).toBeLessThanOrEqual(0.55);
    const v = evaluateMatch(a, b, SOHO_DICT);
    expect(v.outcome).toBe('ambiguous');
    expect(v.venue).toBe('agree');
  });

  it('is also ambiguous (not split, not merged) for a mid-band title match when venue is unknown on both sides', () => {
    const a = { title: 'An Evening with Molly Miller', starts_at: '2026-07-09T20:00:00-07:00', address: null };
    const b = { title: 'Molly Miller Trio', starts_at: '2026-07-09T20:00:00-07:00', address: null };
    const v = evaluateMatch(a, b, SOHO_DICT);
    expect(v.outcome).toBe('ambiguous');
    expect(v.venue).toBe('unknown');
  });

  it('matches (merge) a recurring/time-TBD pair on venue + title + cadence when neither side has a start time, given a clear title match', () => {
    const a = { title: 'Wine Down Wednesday', starts_at: null, address: 'SOhO', recurring: [{ day_of_week: 3, frequency: 'weekly' }] };
    const b = { title: 'Wine Down Wednesday', starts_at: null, address: 'SOhO Restaurant & Music Club', recurring: [{ day_of_week: 3, frequency: 'weekly' }] };
    const v = evaluateMatch(a, b, SOHO_DICT);
    expect(v.outcome).toBe('merge');
    expect(v.signal).toBe('cadence');
  });

  it('does NOT match (split) two recurring rows at the same venue with different cadences', () => {
    const a = { title: 'Trivia Night', starts_at: null, address: 'SOhO', recurring: [{ day_of_week: 2, frequency: 'weekly' }] };
    const b = { title: 'Trivia Night', starts_at: null, address: 'SOhO', recurring: [{ day_of_week: 4, frequency: 'weekly' }] };
    const v = evaluateMatch(a, b, SOHO_DICT);
    expect(v.outcome).toBe('split');
  });

  it('splits below the ambiguous floor, even with venue agreement', () => {
    const a = { title: 'Andre Nickatina', starts_at: '2026-07-09T20:00:00-07:00', address: 'SOhO' };
    const b = { title: 'Molly Miller Trio', starts_at: '2026-07-09T20:00:00-07:00', address: 'SOhO' };
    const v = evaluateMatch(a, b, SOHO_DICT);
    expect(v.outcome).toBe('split');
  });

  it('treats a generic city-level placeholder address as unknown venue, not a false agreement between two unrelated events', () => {
    const a = { title: 'Parks & Recreation Commission Special Meeting', starts_at: '2026-07-09T20:00:00-07:00', address: 'Santa Barbara, Santa Barbara, CA' };
    const b = { title: 'Historic Landmarks Commission - Consent', starts_at: '2026-07-09T20:00:00-07:00', address: 'Santa Barbara, Santa Barbara, CA' };
    const v = evaluateMatch(a, b, []);
    expect(v.venue).toBe('unknown');
    expect(v.outcome).not.toBe('merge'); // mid/low title similarity + unknown venue must never auto-merge
  });
});

describe('dedupeVenueAware (Phase 2 — orchestration parity with dedupe(), venue-aware matching)', () => {
  it('does NOT merge an ambiguous (mid-band) same-venue title match — both stay (held for Phase 3)', () => {
    const authority = new Map([['ticketmaster', 0.90], ['soho', 1.00]]);
    const tm = cand({
      id: 'tm', title: 'An Evening with Molly Miller', source_url: 'https://www.ticketmaster.com/event/123',
      address: 'SOhO Restaurant & Music Club',
    });
    const soho = cand({
      id: 'soho', title: 'Molly Miller Trio', source_url: 'https://tickets.sohosb.com/e/molly-miller-trio',
      address: 'SOhO Restaurant & Music Club',
    });
    const { keep, drops } = dedupeVenueAware([tm, soho], [], authority, SOHO_DICT);
    expect(keep).toHaveLength(2);
    expect(drops).toHaveLength(0);
  });

  it('splits (keeps both) a same-titled pair at two different known venues that the OLD matcher would have merged', () => {
    const a = cand({ id: 'a', title: 'Trivia Night', address: 'SOhO Restaurant & Music Club' });
    const b = cand({ id: 'b', title: 'Trivia Night', address: '4916 Carpinteria Ave' });
    const oldResult = dedupe([a, b]);
    expect(oldResult.keep).toHaveLength(1); // old behavior: false-merge

    const newResult = dedupeVenueAware([a, b], [], new Map(), SOHO_DICT);
    expect(newResult.keep).toHaveLength(2); // new behavior: split, both kept
  });
});

describe('dedupeVenueAware — event_key on drops (Data Arch Redesign 26 Phase 4 — corroboration)', () => {
  it('carries the SURVIVING candidate\'s event_key on an in-batch near-dupe drop', () => {
    const tm = cand({
      id: 'tm', title: 'Molly Miller Trio', source_url: 'https://www.ticketmaster.com/event/123',
      address: 'SOhO Restaurant & Music Club',
    });
    const soho = cand({
      id: 'soho', title: 'Molly Miller Trio (Live)', source_url: 'https://tickets.sohosb.com/e/molly-miller-trio',
      address: 'SOhO Restaurant & Music Club',
    });
    const authority = new Map([['ticketmaster', 0.90], ['soho', 1.00]]);
    const { keep, drops } = dedupeVenueAware([tm, soho], [], authority, SOHO_DICT);
    expect(keep).toHaveLength(1);
    expect(drops).toHaveLength(1);
    expect(drops[0].event_key).toBeTruthy();
    expect(typeof drops[0].event_key).toBe('string');
  });

  it('carries the EXISTING row\'s own event_key (read from the DB, not recomputed) on a vs-existing drop', () => {
    const c = cand({ id: 'c', title: 'Molly Miller Trio', address: 'SOhO Restaurant & Music Club' });
    const existing: ExistingRow[] = [{
      id: 'x1', title: 'Molly Miller Trio (Live)', starts_at: c.starts_at, source: 'https://tickets.sohosb.com/e/x',
      address: 'SOhO Restaurant & Music Club', event_key: 'deadbeef-existing-key',
    }];
    const { keep, drops } = dedupeVenueAware([c], existing, new Map(), SOHO_DICT);
    expect(keep).toHaveLength(0);
    expect(drops[0].event_key).toBe('deadbeef-existing-key');
  });

  it('carries merged_into (the survivor\'s own id) and evidence on an in-batch near-dupe drop (Phase 5 — reversible merge log)', () => {
    const tm = cand({
      id: 'tm', title: 'Molly Miller Trio', source_url: 'https://www.ticketmaster.com/event/123',
      address: 'SOhO Restaurant & Music Club',
    });
    const soho = cand({
      id: 'soho', title: 'Molly Miller Trio (Live)', source_url: 'https://tickets.sohosb.com/e/molly-miller-trio',
      address: 'SOhO Restaurant & Music Club',
    });
    const authority = new Map([['ticketmaster', 0.90], ['soho', 1.00]]);
    const { keep, drops } = dedupeVenueAware([tm, soho], [], authority, SOHO_DICT);
    expect(keep[0].id).toBe('soho'); // higher authority survives
    expect(drops[0].id).toBe('tm'); // the dropped candidate's own id
    expect(drops[0].merged_into).toBe('soho'); // survivor's id
    expect(drops[0].evidence?.venue).toBe('agree');
    expect(drops[0].evidence?.signal).toBe('day');
    expect(drops[0].evidence?.titleSim).toBeGreaterThan(0.55);
  });

  it('carries merged_into (the existing row\'s id) on a vs-existing near-dupe drop', () => {
    const c = cand({ id: 'c', title: 'Molly Miller Trio', address: 'SOhO Restaurant & Music Club' });
    const existing: ExistingRow[] = [{
      id: 'existing-row-id', title: 'Molly Miller Trio (Live)', starts_at: c.starts_at, source: 'https://tickets.sohosb.com/e/x',
      address: 'SOhO Restaurant & Music Club', event_key: 'deadbeef-existing-key',
    }];
    const { drops } = dedupeVenueAware([c], existing, new Map(), SOHO_DICT);
    expect(drops[0].id).toBe('c');
    expect(drops[0].merged_into).toBe('existing-row-id');
  });

  it('does NOT set event_key on an exact-id drop (same source re-emitting, not new corroboration)', () => {
    const a = cand({ id: 'dup', title: 'Show A' });
    const b = cand({ id: 'dup', title: 'Show A' });
    const { drops } = dedupeVenueAware([a, b], [], new Map(), []);
    expect(drops).toHaveLength(1);
    expect(drops[0].event_key).toBeUndefined();
  });
});
