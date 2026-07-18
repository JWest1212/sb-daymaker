import { describe, it, expect, afterEach } from 'vitest';
import { adjudicatePairs, SYSTEM } from './dedupeAdjudicate';

// Mirrors imageRelevance.test.ts / enrich.test.ts's scope: exercise the
// deterministic guard behavior (empty input, missing key) without making a
// live Claude call. The chunking/prompt/schema plumbing is exercised
// end-to-end via the real shadow report, not here.

describe('adjudicatePairs — fail-soft guard behavior', () => {
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

  it('returns no verdicts and $0 cost when ANTHROPIC_API_KEY is unset — caller default is "stays split"', async () => {
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
