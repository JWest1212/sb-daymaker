import { describe, it, expect } from 'vitest';
import { assignVisual, MOTIF_KEYS, VENUE_MOTIFS } from './visualAssignment';
import type { HappeningCategory } from '../packages/shared/types';

const ALL_CATEGORIES: HappeningCategory[] = [
  'live_music', 'festival_fair', 'arts_theater', 'community_gathering',
  'food_drink_event', 'sports_outdoors_event',
  'weekly_special', 'recurring_nightlife', 'recurring_market',
  'recurring_arts', 'recurring_outdoors',
  'outdoor_activity', 'food_drink_spot', 'culture_spot', 'shopping_browse', 'scenic_chill',
];

describe('assignVisual', () => {
  it('is deterministic, same thing id always gets the same assignment', () => {
    const a = assignVisual({ id: 'thing-1', happening_category: 'live_music' });
    const b = assignVisual({ id: 'thing-1', happening_category: 'live_music' });
    expect(a).toEqual(b);
  });

  it('every visual_key it can produce is a real ported motif', () => {
    for (let i = 0; i < 200; i++) {
      const a = assignVisual({ id: `thing-${i}`, happening_category: 'scenic_chill' });
      if (a.visual_key) expect(MOTIF_KEYS).toContain(a.visual_key);
    }
  });

  it('every HappeningCategory produces SOME assignment (never throws, never both-null)', () => {
    for (const category of ALL_CATEGORIES) {
      for (let i = 0; i < 20; i++) {
        const a = assignVisual({ id: `${category}-${i}`, happening_category: category });
        expect(['motif', 'bigtype']).toContain(a.visual_kind);
        if (a.visual_kind === 'motif') expect(a.visual_key).not.toBeNull();
        else expect(a.visual_key).toBeNull();
      }
    }
  });

  it('occasionally substitutes big-type even for a category with a motif pool (variety, not a gap)', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      kinds.add(assignVisual({ id: `arts-${i}`, happening_category: 'arts_theater' }).visual_kind);
    }
    expect(kinds.has('motif')).toBe(true);
    expect(kinds.has('bigtype')).toBe(true);
  });

  it('a category with no mapped pool falls straight to bigtype', () => {
    const a = assignVisual({ id: 'x', happening_category: 'not_a_real_category' as HappeningCategory });
    expect(a).toEqual({ visual_kind: 'bigtype', visual_key: null, visual_seed: a.visual_seed });
  });

  it('no category with no happening_category falls to bigtype', () => {
    const a = assignVisual({ id: 'y' });
    expect(a.visual_kind).toBe('bigtype');
    expect(a.visual_key).toBeNull();
  });

  it('scenic_chill draws from both its variants (sunset, beach) across many ids', () => {
    const keys = new Set<string | null>();
    for (let i = 0; i < 200; i++) {
      keys.add(assignVisual({ id: `sc-${i}`, happening_category: 'scenic_chill' }).visual_key);
    }
    expect(keys.has('sunset')).toBe(true);
    expect(keys.has('beach')).toBe(true);
  });

  it('a venue-family match overrides the category pool with the landmark motif', () => {
    const a = assignVisual({ id: 'mission-event', happening_category: 'community_gathering' }, 'old-mission');
    expect(a).toEqual({ visual_kind: 'motif', visual_key: 'mission', visual_seed: a.visual_seed });
    const b = assignVisual({ id: 'wharf-event', happening_category: 'live_music' }, 'stearns-wharf');
    expect(b.visual_key).toBe('wharf');
  });

  it('an unmapped venue key (no override) falls through to the category pool unchanged', () => {
    const withVenue = assignVisual({ id: 'thing-2', happening_category: 'trail' as HappeningCategory }, 'sb-bowl');
    const withoutVenue = assignVisual({ id: 'thing-2', happening_category: 'trail' as HappeningCategory });
    expect(withVenue).toEqual(withoutVenue);
  });

  it('VENUE_MOTIFS only ever points at real ported motif keys', () => {
    for (const key of Object.values(VENUE_MOTIFS)) {
      expect(MOTIF_KEYS).toContain(key);
    }
  });
});
