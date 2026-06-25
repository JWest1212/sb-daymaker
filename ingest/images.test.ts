import { describe, it, expect } from 'vitest';
import { cacheKey, imageQuery, rankOptions, type ImageOption } from './images';

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
