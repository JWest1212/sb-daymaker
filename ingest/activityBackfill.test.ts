import { describe, it, expect } from 'vitest';
import { categoryToActivities } from './activityBackfill';

describe('categoryToActivities, Doc 21 §4 mapping', () => {
  it('covers all 16 happening_category values', () => {
    expect(categoryToActivities('live_music')).toEqual(['live-music']);
    expect(categoryToActivities('recurring_nightlife')).toEqual(['live-music', 'nightlife']);
    expect(categoryToActivities('arts_theater')).toEqual(['arts-galleries', 'film-talks']);
    expect(categoryToActivities('culture_spot')).toEqual(['arts-galleries']);
    expect(categoryToActivities('recurring_arts')).toEqual(['arts-galleries']);
    expect(categoryToActivities('food_drink_event')).toEqual(['food-drink']);
    expect(categoryToActivities('food_drink_spot')).toEqual(['food-drink']);
    expect(categoryToActivities('weekly_special')).toEqual(['food-drink']);
    expect(categoryToActivities('sports_outdoors_event')).toEqual(['outdoors', 'wellness-fitness']);
    expect(categoryToActivities('outdoor_activity')).toEqual(['outdoors']);
    expect(categoryToActivities('recurring_outdoors')).toEqual(['outdoors', 'wellness-fitness']);
    expect(categoryToActivities('scenic_chill')).toEqual(['outdoors']);
    expect(categoryToActivities('recurring_market')).toEqual(['markets']);
    expect(categoryToActivities('shopping_browse')).toEqual(['markets']);
    expect(categoryToActivities('festival_fair')).toEqual(['community-festivals']);
    expect(categoryToActivities('community_gathering')).toEqual(['community-festivals']);
  });

  it('is pure and total: unknown or missing categories map to no slugs, never throw', () => {
    expect(categoryToActivities(null)).toEqual([]);
    expect(categoryToActivities(undefined)).toEqual([]);
    expect(categoryToActivities('')).toEqual([]);
    expect(categoryToActivities('not_a_real_category')).toEqual([]);
  });
});
