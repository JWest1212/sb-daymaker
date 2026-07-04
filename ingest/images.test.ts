import { describe, it, expect } from 'vitest';
import { cacheKey, imageQuery, rankOptions, pickUnused, isCivicImage, CATEGORY_QUERY, type ImageOption } from './images';

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

describe('pickUnused — W2.3 per-batch dedupe', () => {
  const ranked: ImageOption[] = [
    { url: 'a', source: 'pexels' },
    { url: 'b', source: 'pexels' },
    { url: 'c', source: 'wikimedia' },
    { url: '', source: 'placeholder' },
  ];
  it('keeps the top pick when it is not yet used', () => {
    expect(pickUnused(ranked, new Set()).map((o) => o.url)).toEqual(['a', 'b', 'c', '']);
  });
  it('bumps the first not-yet-used option to the front when the top pick is taken', () => {
    // 'a' already used → 'b' (first unused) leads; placeholder stays last.
    expect(pickUnused(ranked, new Set(['a'])).map((o) => o.url)).toEqual(['b', 'a', 'c', '']);
  });
  it('skips multiple used urls to the first free one', () => {
    expect(pickUnused(ranked, new Set(['a', 'b'])).map((o) => o.url)).toEqual(['c', 'a', 'b', '']);
  });
  it('falls back to the top pick when every real option is used (repeat only as last resort)', () => {
    expect(pickUnused(ranked, new Set(['a', 'b', 'c'])).map((o) => o.url)).toEqual(['a', 'b', 'c', '']);
  });
  it('placeholder-only input is unchanged', () => {
    expect(pickUnused([{ url: '', source: 'placeholder' }], new Set(['a'])).map((o) => o.source)).toEqual(['placeholder']);
  });
});

describe('rankOptions', () => {
  it('orders real sources (pexels > wikimedia > google) and appends placeholder last', () => {
    const found: ImageOption[] = [
      { url: 'g', source: 'google' },
      { url: 'w', source: 'wikimedia' },
      { url: 'p', source: 'pexels' },
    ];
    expect(rankOptions(found).map((o) => o.source)).toEqual(['pexels', 'wikimedia', 'google', 'placeholder']);
  });
  it('drops empty urls and still ends on placeholder', () => {
    expect(rankOptions([{ url: '', source: 'pexels' }]).map((o) => o.source)).toEqual(['placeholder']);
  });
  it('placeholder-only when nothing was found', () => {
    const r = rankOptions([]);
    expect(r).toEqual([{ url: '', source: 'placeholder' }]);
  });
});
