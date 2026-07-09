import { describe, it, expect } from 'vitest';
import {
  cacheKey, imageQuery, rankOptions, pickUnused, isCivicImage, CATEGORY_QUERY,
  meetsQualityBar, MIN_IMAGE_WIDTH, MIN_IMAGE_HEIGHT, eventDefaultsToNoPhoto, type ImageOption,
} from './images';

describe('cacheKey', () => {
  it('prefers the Google place_id', () => {
    expect(cacheKey({ place_id: 'ChIJabc', title: 'Topa Topa', neighborhood: 'funk_zone' })).toBe('ChIJabc');
  });
  it('falls back to a normalized title|hood', () => {
    expect(cacheKey({ place_id: undefined, title: "Lizard's Mouth!", neighborhood: 'goleta' }))
      .toBe('lizard s mouth|goleta');
  });
});

describe('imageQuery', () => {
  it('is concrete and SB-scoped', () => {
    expect(imageQuery({ title: 'Stearns Wharf', neighborhood: 'waterfront' }))
      .toBe('Stearns Wharf waterfront Santa Barbara');
  });

  // W2.3 — category-aware templates so distinct categories don't draw the same stock.
  it('appends the category template when the happening_category has one', () => {
    expect(imageQuery({ title: 'Jason Libs Band', neighborhood: undefined, happening_category: 'live_music' }))
      .toBe(`Jason Libs Band ${CATEGORY_QUERY.live_music} Santa Barbara`);
    expect(imageQuery({ title: 'Saturday Market', neighborhood: 'downtown', happening_category: 'recurring_market' }))
      .toBe(`Saturday Market downtown ${CATEGORY_QUERY.recurring_market} Santa Barbara`);
  });
  it('differentiates categories: live_music and community_gathering get different queries', () => {
    const a = imageQuery({ title: 'X', neighborhood: undefined, happening_category: 'live_music' });
    const b = imageQuery({ title: 'X', neighborhood: undefined, happening_category: 'community_gathering' });
    expect(a).not.toBe(b);
  });
  it('falls back to the plain title query when the category is unknown/absent', () => {
    expect(imageQuery({ title: 'Some Place', neighborhood: undefined, happening_category: 'not_a_real_category' }))
      .toBe('Some Place Santa Barbara');
  });
});

describe('isCivicImage — W2.3 civic items skip stock, go to placeholder', () => {
  it('flags civic-meeting titles (reuses the W2.1b classifier)', () => {
    expect(isCivicImage({ title: 'Street Tree Advisory Committee' })).toBe(true);
    expect(isCivicImage({ title: 'City Council' })).toBe(true);
  });
  it('leaves genuine leisure titles alone', () => {
    expect(isCivicImage({ title: 'Friday Night Live Music' })).toBe(false);
  });
});

describe('pickUnused — W2.3 per-batch dedupe (least-used-first)', () => {
  const ranked: ImageOption[] = [
    { url: 'a', source: 'pexels' },
    { url: 'b', source: 'pexels' },
    { url: 'c', source: 'wikimedia' },
    { url: '', source: 'placeholder' },
  ];
  const counts = (o: Record<string, number>) => new Map(Object.entries(o));

  it('keeps the top pick when nothing is used yet', () => {
    expect(pickUnused(ranked, counts({})).map((o) => o.url)).toEqual(['a', 'b', 'c', '']);
  });
  it('bumps the first unused option to the front when the top pick is taken', () => {
    expect(pickUnused(ranked, counts({ a: 1 })).map((o) => o.url)).toEqual(['b', 'c', 'a', '']);
  });
  it('skips multiple used urls to the first free one', () => {
    expect(pickUnused(ranked, counts({ a: 1, b: 1 })).map((o) => o.url)).toEqual(['c', 'a', 'b', '']);
  });
  it('spreads repeats evenly when the whole pool is used (least-used leads, not first)', () => {
    // a used 3×, b 1×, c 2× → b leads. This is the ×93 pile-up fix: repeats rotate
    // across the pool instead of collapsing back onto option a.
    expect(pickUnused(ranked, counts({ a: 3, b: 1, c: 2 })).map((o) => o.url)).toEqual(['b', 'c', 'a', '']);
  });
  it('breaks equal-count ties by the original source ranking', () => {
    expect(pickUnused(ranked, counts({ a: 2, b: 2, c: 2 })).map((o) => o.url)).toEqual(['a', 'b', 'c', '']);
  });
  it('simulated cluster: 9 similar events over a 3-photo pool land 3-3-3, never 7-1-1', () => {
    const used = counts({});
    const picks: string[] = [];
    for (let i = 0; i < 9; i++) {
      const top = pickUnused(ranked, used)[0];
      picks.push(top.url);
      used.set(top.url, (used.get(top.url) ?? 0) + 1);
    }
    expect(picks.filter((u) => u === 'a')).toHaveLength(3);
    expect(picks.filter((u) => u === 'b')).toHaveLength(3);
    expect(picks.filter((u) => u === 'c')).toHaveLength(3);
  });
  it('placeholder-only input is unchanged', () => {
    expect(pickUnused([{ url: '', source: 'placeholder' }], counts({ a: 1 })).map((o) => o.source)).toEqual(['placeholder']);
  });
});

describe('meetsQualityBar — addendum Part B retina-safe HD floor', () => {
  it('passes an option at or above the floor', () => {
    expect(meetsQualityBar({ width: MIN_IMAGE_WIDTH, height: MIN_IMAGE_HEIGHT })).toBe(true);
    expect(meetsQualityBar({ width: 1920, height: 1080 })).toBe(true);
  });
  it('rejects an option below the floor on either dimension', () => {
    expect(meetsQualityBar({ width: MIN_IMAGE_WIDTH - 1, height: MIN_IMAGE_HEIGHT })).toBe(false);
    expect(meetsQualityBar({ width: MIN_IMAGE_WIDTH, height: MIN_IMAGE_HEIGHT - 1 })).toBe(false);
    expect(meetsQualityBar({ width: 200, height: 120 })).toBe(false);
  });
  it('passes through options with no reported size (permissive, e.g. owned/manual entries)', () => {
    expect(meetsQualityBar({})).toBe(true);
    expect(meetsQualityBar({ width: 100 })).toBe(true);
    expect(meetsQualityBar({ height: 100 })).toBe(true);
  });
});

describe('rankOptions — Card Imagery Build Spec Phase 0 §3.1.1, relevance-first', () => {
  it('orders real sources (owned > wikimedia > google > pexels) and appends placeholder last', () => {
    const found: ImageOption[] = [
      { url: 'p', source: 'pexels' },
      { url: 'g', source: 'google' },
      { url: 'o', source: 'owned' },
      { url: 'w', source: 'wikimedia' },
    ];
    expect(rankOptions(found).map((o) => o.source)).toEqual(['owned', 'wikimedia', 'google', 'pexels', 'placeholder']);
  });
  it('demotes pexels below wikimedia and google (the Phase 0 flip)', () => {
    const found: ImageOption[] = [
      { url: 'w', source: 'wikimedia' },
      { url: 'p', source: 'pexels' },
    ];
    expect(rankOptions(found).map((o) => o.source)).toEqual(['wikimedia', 'pexels', 'placeholder']);
  });
  it('drops empty urls and still ends on placeholder', () => {
    expect(rankOptions([{ url: '', source: 'pexels' }]).map((o) => o.source)).toEqual(['placeholder']);
  });
  it('placeholder-only when nothing was found', () => {
    const r = rankOptions([]);
    expect(r).toEqual([{ url: '', source: 'placeholder' }]);
  });
});

describe('eventDefaultsToNoPhoto — Card Imagery Build Spec Phase 0 §3.1.2', () => {
  it('is true for Tier-1 dated events', () => {
    expect(eventDefaultsToNoPhoto({ tier: 1 })).toBe(true);
  });
  it('is false for Tier-2 recurring and Tier-3 evergreen places', () => {
    expect(eventDefaultsToNoPhoto({ tier: 2 })).toBe(false);
    expect(eventDefaultsToNoPhoto({ tier: 3 })).toBe(false);
  });
});
