import { describe, it, expect } from 'vitest';
import { seriesKey, normalizeForKey, sbWeekday, groupBySeries, seriesCadence } from './series';

const SUN = '2026-09-27T17:00:00Z'; // Sunday 10am SB
const SUN2 = '2026-10-04T17:00:00Z';
const TUE = '2026-09-29T17:00:00Z';

describe('normalizeForKey (R1 W5.2)', () => {
  it('ignores case, accents, punctuation and spacing', () => {
    expect(normalizeForKey('Memory Café')).toBe(normalizeForKey('memory  cafe'));
    expect(normalizeForKey("Knit 'n' Needle")).toBe(normalizeForKey('Knit ’n’ Needle'));
  });

  it('keeps different things apart', () => {
    expect(normalizeForKey('Chess Club')).not.toBe(normalizeForKey('Scrabble Club'));
  });
});

describe('sbWeekday', () => {
  it('reads the weekday in Santa Barbara time, not UTC', () => {
    expect(sbWeekday(SUN)).toBe(0);
    expect(sbWeekday(TUE)).toBe(2);
    // 2026-09-28T02:00Z is still Sunday evening in Santa Barbara.
    expect(sbWeekday('2026-09-28T02:00:00Z')).toBe(0);
  });
});

describe('seriesKey (R1 W5.2)', () => {
  it('gives two occurrences of the same weekly thing one key', () => {
    const a = seriesKey({ title: 'Santa Barbara Arts & Crafts Show', venue_name: 'Cabrillo Boulevard', starts_at: SUN });
    const b = seriesKey({ title: 'Santa Barbara Arts & Crafts Show', venue_name: 'Cabrillo Boulevard', starts_at: SUN2 });
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it('separates the same title at two different venues', () => {
    // Recreation Swim runs at two pools; those are two series, not one.
    const oak = seriesKey({ title: 'Recreation Swim', venue_name: 'Oak Park Wading Pool', starts_at: SUN });
    const ortega = seriesKey({ title: 'Recreation Swim', venue_name: 'Ortega Park Pool', starts_at: SUN });
    expect(oak).not.toBe(ortega);
  });

  it('keeps a club that meets twice a week as ONE series', () => {
    // W5.2's prose says to include the weekday; its acceptance line says
    // Recreation Swim has two keys, one per pool. With the weekday it had 18.
    // One card per real series, with the cadence derived, is what D6 wants.
    const sun = seriesKey({ title: 'Chess Club', venue_name: 'Davis Center', starts_at: SUN });
    const tue = seriesKey({ title: 'Chess Club', venue_name: 'Davis Center', starts_at: TUE });
    expect(sun).toBe(tue);
  });

  it('returns null for an evergreen place, which is not a series', () => {
    expect(seriesKey({ title: 'Helena Avenue Bakery', starts_at: null })).toBeNull();
    expect(seriesKey({ title: 'Helena Avenue Bakery' })).toBeNull();
  });

  it('returns null rather than a meaningless key for an empty title', () => {
    expect(seriesKey({ title: '   ', starts_at: SUN })).toBeNull();
  });

  it('handles a missing venue without colliding unrelated things', () => {
    const a = seriesKey({ title: 'Farmers Market', starts_at: SUN });
    const b = seriesKey({ title: 'Farmers Market', venue_name: 'State Street', starts_at: SUN });
    expect(a).not.toBe(b);
  });

  it('reads as something a person can interpret in a log', () => {
    expect(seriesKey({ title: 'Chess Club', venue_name: 'Davis Center', starts_at: SUN }))
      .toBe('chess club :: davis center');
  });
});

describe('groupBySeries', () => {
  it('groups occurrences and orders the biggest series first', () => {
    const rows = [
      { title: 'Chess Club', venue_name: 'Davis', starts_at: SUN },
      { title: 'Arts Show', venue_name: 'Cabrillo', starts_at: SUN },
      { title: 'Chess Club', venue_name: 'Davis', starts_at: SUN2 },
      { title: 'Evergreen Place', starts_at: null },
    ];
    const g = groupBySeries(rows);
    expect([...g.values()][0]).toHaveLength(2);
    expect(g.size).toBe(2); // the evergreen row is not a series
  });
});

describe('seriesCadence (R1 W5.2)', () => {
  const at = (iso: string) => iso;
  it('says "Every Sunday" for a weekly series', () => {
    expect(seriesCadence([SUN, SUN2, at('2026-10-11T17:00:00Z')])).toBe('Every Sunday');
  });

  it('names both days for a twice-weekly series', () => {
    expect(seriesCadence([SUN, TUE, SUN2])).toBe('Sundays and Tuesdays');
  });

  it('says "Most days" for something that runs nearly daily', () => {
    const week = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']
      .map((d) => `${d}T17:00:00Z`);
    expect(seriesCadence(week)).toBe('Most days');
  });

  it('returns null for a single date, which is not a series', () => {
    expect(seriesCadence([SUN])).toBeNull();
    expect(seriesCadence([])).toBeNull();
  });
});
