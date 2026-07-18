import { describe, it, expect, afterEach } from 'vitest';
import { adjudicatePairs, applyAmbiguousAdjudication, SYSTEM } from './dedupeAdjudicate';
import type { ExistingRow } from './dedupe';
import type { Candidate } from '../packages/shared/types';

function cand(over: Partial<Candidate>): Candidate {
  return {
    id: 'id-' + Math.random(),
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

// Mirrors imageRelevance.test.ts / enrich.test.ts's scope: exercise the
// deterministic guard behavior (empty input, missing key) without making a
// live Claude call. The chunking/prompt/schema plumbing is exercised
// end-to-end via the real shadow report, not here.

describe('adjudicatePairs, fail-soft guard behavior', () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it('returns no verdicts and $0 cost for empty input (no call attempted)', async () => {
    const result = await adjudicatePairs([]);
    expect(result.verdicts).toHaveLength(0);
    expect(result.costUsd).toBe(0);
  });

  it('returns no verdicts and $0 cost when ANTHROPIC_API_KEY is unset, caller default is "stays split"', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await adjudicatePairs([
      {
        pairId: 'a|b', titleA: 'Clarinet Masterclass', titleB: 'Double Bass Masterclass',
        venueA: 'music academy of the west', venueB: 'music academy of the west',
        whenA: '2026-07-17', whenB: '2026-07-17', addressA: null, addressB: null,
      },
    ]);
    expect(result.verdicts).toHaveLength(0);
    expect(result.costUsd).toBe(0);
  });
});

describe('SYSTEM prompt', () => {
  it('instructs a bias toward same_event=false when uncertain (spec 26 bias toward split)', () => {
    expect(SYSTEM.toLowerCase()).toContain('same_event=false');
  });
});

describe('applyAmbiguousAdjudication (Data Arch Redesign 26 Phase 3, live wiring)', () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it('passes through unchanged when no candidate is pairwise ambiguous with anything (no AI call, no cost)', async () => {
    const a = cand({ id: 'a', title: 'Andre Nickatina', address: 'SOhO' });
    const b = cand({ id: 'b', title: 'Totally Unrelated Farmers Market', address: 'Elsewhere' });
    const result = await applyAmbiguousAdjudication([a, b], [], new Map(), []);
    expect(result.keep.map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(result.drops).toHaveLength(0);
    expect(result.pairsAdjudicated).toBe(0);
    expect(result.costUsd).toBe(0);
  });

  it('with no ANTHROPIC_API_KEY, an ambiguous in-batch pair is sent but stays split (bias toward split when adjudication is unavailable)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const a = cand({
      id: 'a', title: 'An Evening with Molly Miller', address: 'SOhO Restaurant & Music Club, 1221 State St',
      source_url: 'https://tickets.sohosb.com/e/a',
    });
    const b = cand({
      id: 'b', title: 'Molly Miller Trio', address: 'SOhO Restaurant & Music Club, 1221 State St',
      source_url: 'https://tickets.sohosb.com/e/b',
    });
    const result = await applyAmbiguousAdjudication([a, b], [], new Map(), []);
    expect(result.pairsAdjudicated).toBe(1);
    expect(result.mergesApplied).toBe(0);
    expect(result.drops).toHaveLength(0);
    expect(result.keep.map((c) => c.id).sort()).toEqual(['a', 'b']); // both land, never merged without a real verdict
  });

  it('with no ANTHROPIC_API_KEY, an ambiguous candidate-vs-existing pair also stays split', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const c = cand({
      id: 'c', title: 'Molly Miller Trio', address: 'SOhO Restaurant & Music Club, 1221 State St',
    });
    const existing: ExistingRow[] = [{
      id: 'existing-1', title: 'An Evening with Molly Miller', starts_at: c.starts_at, source: 'https://tickets.sohosb.com/e/x',
      address: 'SOhO Restaurant & Music Club, 1221 State St', event_key: 'deadbeef',
    }];
    const result = await applyAmbiguousAdjudication([c], existing, new Map(), []);
    expect(result.pairsAdjudicated).toBe(1);
    expect(result.mergesApplied).toBe(0);
    expect(result.keep.map((k) => k.id)).toEqual(['c']); // candidate still lands as its own row
  });
});
