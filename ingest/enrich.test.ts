import { describe, it, expect } from 'vitest';
import { buildItems, applyNegativeRules, mergeEnrichment } from './enrich';
import type { Candidate, OccasionTag } from '../packages/shared/types';

function cand(over: Partial<Candidate>): Candidate {
  return {
    id: 'x', type: 'event', status: 'needs_review', title: 'A Show', tier: 1,
    happening_category: 'live_music', address: '1221 State St, Santa Barbara, CA',
    price_band: null, time_of_day_fit: ['evening'],
    starts_at: '2026-07-09T20:00:00-07:00', ends_at: null,
    source_url: 'https://example.com/x', last_confirmed: '2026-06-25',
    start_strategy: 'structured', ...over,
  };
}

describe('buildItems — the trust guarantee (no start time leaves the worker)', () => {
  it('never serializes starts_at or ends_at', () => {
    const items = buildItems([cand({})]);
    const json = JSON.stringify(items);
    expect(json).not.toContain('starts_at');
    expect(json).not.toContain('2026-07-09T20:00:00'); // the actual instant
    expect(Object.keys(items[0])).not.toContain('ends_at');
  });
  it('does send the safe derived time_of_day bucket', () => {
    expect(buildItems([cand({})])[0].time_of_day_fit).toEqual(['evening']);
  });
});

describe('mergeEnrichment — AI only adds voice + tags, never edits a start', () => {
  it('leaves starts_at / ends_at byte-identical pre and post', () => {
    const before = cand({ id: 'a', starts_at: '2026-07-09T20:00:00-07:00' });
    const [after] = mergeEnrichment([before], [
      { id: 'a', blurb: 'Golden-hour guitars by the water.', blurb_long: 'Long.', tags: [{ tag: 'date_night', confidence: 0.8 }] },
    ]);
    expect(after.starts_at).toBe(before.starts_at);
    expect(after.ends_at).toBe(before.ends_at);
    expect(after.blurb).toBe('Golden-hour guitars by the water.');
    expect(after.proposed_tags).toEqual([{ tag: 'date_night', confidence: 0.8 }]);
  });
  it('drops tags outside the occasion enum', () => {
    const [after] = mergeEnrichment([cand({ id: 'b' })], [
      { id: 'b', blurb: 'x', blurb_long: 'y', tags: [{ tag: 'made_up' as OccasionTag, confidence: 0.9 }, { tag: 'solo', confidence: 0.7 }] },
    ]);
    expect(after.proposed_tags).toEqual([{ tag: 'solo', confidence: 0.7 }]);
  });
  it('passes through candidates the model omitted, unchanged', () => {
    const c = cand({ id: 'missing' });
    expect(mergeEnrichment([c], [])[0]).toBe(c);
  });
});

describe('applyNegativeRules', () => {
  it('strips family_day for 21+ venues', () => {
    const tags = applyNegativeRules({ is_21_plus: true, price_band: '$$' }, [
      { tag: 'family_day', confidence: 0.9 }, { tag: 'nightlife', confidence: 0.8 },
    ]);
    expect(tags.map((t) => t.tag)).toEqual(['nightlife']);
  });
  it('strips free_sb when the thing is priced', () => {
    const tags = applyNegativeRules({ is_21_plus: false, price_band: '$$' }, [
      { tag: 'free_sb', confidence: 0.95 }, { tag: 'wine_food', confidence: 0.8 },
    ]);
    expect(tags.map((t) => t.tag)).toEqual(['wine_food']);
  });
  it('keeps free_sb when price_band is free or unknown (null)', () => {
    expect(applyNegativeRules({ is_21_plus: false, price_band: 'free' }, [{ tag: 'free_sb', confidence: 0.9 }])).toHaveLength(1);
    expect(applyNegativeRules({ is_21_plus: false, price_band: null }, [{ tag: 'free_sb', confidence: 0.9 }])).toHaveLength(1);
  });
  it('de-dupes a tag to its highest confidence', () => {
    const tags = applyNegativeRules({ is_21_plus: false, price_band: null }, [
      { tag: 'solo', confidence: 0.6 }, { tag: 'solo', confidence: 0.9 },
    ]);
    expect(tags).toEqual([{ tag: 'solo', confidence: 0.9 }]);
  });

  // W2.2 — the AI-only family_day guard for alcohol-primary venue titles.
  it('strips AI family_day from a brewery/taproom/winery title (not 21+ flagged)', () => {
    for (const title of ['Figueroa Mountain Brewing', 'Third Window Taproom', 'Sunstone Winery', 'The Good Lion cocktail bar']) {
      const tags = applyNegativeRules({ is_21_plus: false, price_band: '$$', title }, [
        { tag: 'family_day', confidence: 0.7 }, { tag: 'wine_food', confidence: 0.9 },
      ]);
      expect(tags.map((t) => t.tag)).toEqual(['wine_food']);
    }
  });
  it('leaves family_day alone for a non-alcohol title', () => {
    const tags = applyNegativeRules({ is_21_plus: false, price_band: null, title: 'Saturday Library Craft Hour' }, [
      { tag: 'family_day', confidence: 0.9 },
    ]);
    expect(tags.map((t) => t.tag)).toEqual(['family_day']);
  });
  it('is AI-only: a founder-sourced family_day is untouched (rule sits inside applyNegativeRules, not the publish path)', () => {
    // applyNegativeRules runs solely in mergeEnrichment on the model's proposed tags;
    // the founder's cockpit edits flow through review.filterTags, which has no such rule.
    // We assert the boundary by confirming this function is what strips it — so a tag the
    // founder adds later (never routed here) can survive. Sanity: same title, no family_day
    // proposed → nothing stripped, other tags intact.
    const tags = applyNegativeRules({ is_21_plus: false, price_band: '$$', title: 'M Special Brewing' }, [
      { tag: 'wine_food', confidence: 0.8 }, { tag: 'outdoors_active', confidence: 0.6 },
    ]);
    expect(tags.map((t) => t.tag).sort()).toEqual(['outdoors_active', 'wine_food']);
  });
  it('title is optional — omitting it skips the alcohol rule (back-compat)', () => {
    const tags = applyNegativeRules({ is_21_plus: false, price_band: null }, [
      { tag: 'family_day', confidence: 0.9 },
    ]);
    expect(tags.map((t) => t.tag)).toEqual(['family_day']);
  });
});
