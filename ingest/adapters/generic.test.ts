import { describe, it, expect } from 'vitest';
import {
  parsePriceLow, isExplicitlyFree, combineStartISO, toRawCandidate,
  hashText, isSourceDue, selectSourcesForRun, GENERIC_LANE_PAGE_CAP, isPastDate,
} from './generic';
import type { ExtractedEvent } from '../extract';

describe('parsePriceLow', () => {
  it('reads a plain price', () => expect(parsePriceLow('$15')).toBe(15));
  it('takes the lower end of a range', () => expect(parsePriceLow('$20-$35')).toBe(20));
  it('returns null for "Free"', () => expect(parsePriceLow('Free')).toBeNull());
  it('returns null when omitted', () => expect(parsePriceLow(undefined)).toBeNull());
});

describe('isExplicitlyFree', () => {
  it('matches "Free"', () => expect(isExplicitlyFree('Free Admission, 21+')).toBe(true));
  it('does not match a priced string', () => expect(isExplicitlyFree('$15')).toBe(false));
  it('is false when omitted', () => expect(isExplicitlyFree(undefined)).toBe(false));
});

describe('combineStartISO — never guesses', () => {
  it('combines a full date + time into an SB-local instant', () => {
    const iso = combineStartISO('2026-07-24', '19:00');
    expect(iso).toBe('2026-07-24T19:00:00-07:00');
  });
  it('returns undefined when time is missing', () => {
    expect(combineStartISO('2026-07-24', undefined)).toBeUndefined();
  });
  it('returns undefined when date is missing', () => {
    expect(combineStartISO(undefined, '19:00')).toBeUndefined();
  });
  it('returns undefined for a malformed (partial) date', () => {
    expect(combineStartISO('2026-07', '19:00')).toBeUndefined();
  });
});

describe('toRawCandidate — the trust firewall boundary', () => {
  const sourceRow = { key: 'carrwinery.com', url: 'https://carrwinery.com/events/', category_hints: ['food_drink_event'] };

  it('marks a fully-dated event ai_extracted with a deterministic start', () => {
    const e: ExtractedEvent = {
      title: 'Barrel Room Sessions', start_date: '2026-07-24', start_time: '19:00',
      venue: 'Carr Winery', address: 'Santa Barbara, CA', price: 'Free', confidence: 'high',
    };
    const c = toRawCandidate(e, sourceRow, sourceRow.url);
    expect(c.startStrategy).toBe('ai_extracted');
    expect(c.startISO).toBe('2026-07-24T19:00:00-07:00');
    expect(c.explicitlyFree).toBe(true);
  });

  it('never invents a start — emits none when the model gave no clock time', () => {
    const e: ExtractedEvent = { title: 'All Day Happy Hour', start_date: '2026-07', confidence: 'low' };
    const c = toRawCandidate(e, sourceRow, sourceRow.url);
    expect(c.startStrategy).toBe('none');
    expect(c.startISO).toBeUndefined();
  });

  it('falls back to the source category_hints, then the catch-all default', () => {
    const e: ExtractedEvent = { title: 'x', confidence: 'low' };
    expect(toRawCandidate(e, sourceRow, sourceRow.url).category).toBe('food_drink_event');
    expect(toRawCandidate(e, { ...sourceRow, category_hints: [] }, sourceRow.url).category).toBe('community_gathering');
  });

  it('uses the address as stated, never resolving/inventing one', () => {
    const e: ExtractedEvent = { title: 'x', venue: 'Carr Winery', confidence: 'low' };
    expect(toRawCandidate(e, sourceRow, sourceRow.url).address).toBe('Carr Winery'); // falls back to venue text only
  });

  describe('venue_address — the last-resort fallback', () => {
    const rowWithHome = { ...sourceRow, venue_address: '414 N Salsipuedes St, Santa Barbara, CA 93103' };

    it('falls back to the source\'s own known address when the page named neither an address nor a venue', () => {
      const e: ExtractedEvent = { title: 'Justice & Equity Team', confidence: 'high' };
      expect(toRawCandidate(e, rowWithHome, rowWithHome.url).address).toBe('414 N Salsipuedes St, Santa Barbara, CA 93103');
    });

    it('never overrides a stated address', () => {
      const e: ExtractedEvent = { title: 'x', address: '123 Elsewhere Ave', confidence: 'high' };
      expect(toRawCandidate(e, rowWithHome, rowWithHome.url).address).toBe('123 Elsewhere Ave');
    });

    it('never overrides a stated venue — a different named venue must not silently become this source\'s address', () => {
      const e: ExtractedEvent = { title: 'Books & Bubbles', venue: 'Ryon Park', confidence: 'high' };
      expect(toRawCandidate(e, rowWithHome, rowWithHome.url).address).toBe('Ryon Park');
    });

    it('is a no-op for sources with no confirmed home address (multi-location sources)', () => {
      const e: ExtractedEvent = { title: 'x', confidence: 'low' };
      expect(toRawCandidate(e, sourceRow, sourceRow.url).address).toBeUndefined();
    });
  });

  it('never lands a stale date from a cached page — treats a past year as no start at all', () => {
    // Live Phase 4 finding: a real page echoed "2024-07-25" while the run happened in July 2026.
    const e: ExtractedEvent = {
      title: 'Livia Zirkel Reception', start_date: '2024-07-25', start_time: '16:00',
      venue: 'Community Arts Workshop', confidence: 'high',
    };
    const c = toRawCandidate(e, sourceRow, sourceRow.url, new Date('2026-07-17T12:00:00-07:00'));
    expect(c.startStrategy).toBe('none');
    expect(c.startISO).toBeUndefined();
  });

  it('still lands a same-day event even if the clock has moved past it', () => {
    const e: ExtractedEvent = { title: 'Morning Market', start_date: '2026-07-17', start_time: '09:00', confidence: 'high' };
    const c = toRawCandidate(e, sourceRow, sourceRow.url, new Date('2026-07-17T18:00:00-07:00'));
    expect(c.startStrategy).toBe('ai_extracted');
  });
});

describe('isPastDate', () => {
  it('flags a date before today (SB calendar day)', () => {
    expect(isPastDate('2024-07-25T16:00:00-07:00', new Date('2026-07-17T12:00:00-07:00'))).toBe(true);
  });
  it('does not flag today or a future date', () => {
    expect(isPastDate('2026-07-17T09:00:00-07:00', new Date('2026-07-17T18:00:00-07:00'))).toBe(false);
    expect(isPastDate('2026-08-01T09:00:00-07:00', new Date('2026-07-17T18:00:00-07:00'))).toBe(false);
  });
});

describe('hashText — change-detection signal', () => {
  it('is deterministic for identical text', () => {
    expect(hashText('Trivia Night, Wednesdays')).toBe(hashText('Trivia Night, Wednesdays'));
  });
  it('differs when the text changes', () => {
    expect(hashText('Trivia Night, Wednesdays')).not.toBe(hashText('Trivia Night, Thursdays'));
  });
});

describe('isSourceDue — source-specific scheduling (spec 25 §3)', () => {
  const now = new Date('2026-07-17T00:00:00Z');

  it('nightly sources are always due', () => {
    expect(isSourceDue({ crawl_frequency: 'nightly', last_ok_at: now.toISOString() }, now)).toBe(true);
  });
  it('reserve sources are never auto-scheduled', () => {
    expect(isSourceDue({ crawl_frequency: 'reserve', last_ok_at: null }, now)).toBe(false);
  });
  it('weekly sources are due when never checked', () => {
    expect(isSourceDue({ crawl_frequency: 'weekly', last_ok_at: null }, now)).toBe(true);
  });
  it('weekly sources are not due before 7 days have passed', () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSourceDue({ crawl_frequency: 'weekly', last_ok_at: twoDaysAgo }, now)).toBe(false);
  });
  it('weekly sources are due once 7 days have passed', () => {
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSourceDue({ crawl_frequency: 'weekly', last_ok_at: eightDaysAgo }, now)).toBe(true);
  });
});

describe('selectSourcesForRun — the per-run page cap', () => {
  it('caps the selection and prefers the longest-overdue sources first', () => {
    const sources = [
      { last_ok_at: '2026-07-10T00:00:00Z' },
      { last_ok_at: null }, // never checked — most overdue
      { last_ok_at: '2026-07-15T00:00:00Z' },
    ];
    expect(selectSourcesForRun(sources, 2)).toEqual([
      { last_ok_at: null },
      { last_ok_at: '2026-07-10T00:00:00Z' },
    ]);
  });
  it('defaults to GENERIC_LANE_PAGE_CAP when no cap is given', () => {
    const sources = Array.from({ length: GENERIC_LANE_PAGE_CAP + 5 }, (_, i) => ({ last_ok_at: `2026-07-${10 + i}T00:00:00Z` }));
    expect(selectSourcesForRun(sources)).toHaveLength(GENERIC_LANE_PAGE_CAP);
  });
  it('does not mutate the input array', () => {
    const sources = [{ last_ok_at: '2026-07-15T00:00:00Z' }, { last_ok_at: '2026-07-10T00:00:00Z' }];
    const copy = [...sources];
    selectSourcesForRun(sources);
    expect(sources).toEqual(copy);
  });
});
