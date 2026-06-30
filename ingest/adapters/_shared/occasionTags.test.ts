import { describe, it, expect } from 'vitest';
import { seedOccasionTags } from './occasionTags';

describe('seedOccasionTags', () => {
  it('returns base category tags for live_music', () => {
    const tags = seedOccasionTags({ category: 'live_music' });
    expect(tags).toContain('catch_a_show');
    expect(tags).toContain('nightlife');
    expect(tags).toContain('date_night');
  });

  it('returns base category tags for recurring_market', () => {
    const tags = seedOccasionTags({ category: 'recurring_market' });
    expect(tags).toContain('wine_food');
    expect(tags).toContain('free_sb');
    expect(tags).toContain('family_day');
  });

  it('adds family_day from text keyword', () => {
    const tags = seedOccasionTags({ category: 'live_music', text: 'A great show for kids' });
    expect(tags).toContain('family_day');
    expect(tags).toContain('catch_a_show'); // still keeps base tags
  });

  it('adds free_sb from "free" in text', () => {
    const tags = seedOccasionTags({ category: 'arts_theater', text: 'Free admission all summer' });
    expect(tags).toContain('free_sb');
  });

  it('adds wine_food from sourceCategory', () => {
    const tags = seedOccasionTags({ category: 'community_gathering', sourceCategory: 'wine tasting' });
    expect(tags).toContain('wine_food');
  });

  it('deduplicates tags', () => {
    const tags = seedOccasionTags({ category: 'food_drink_event', text: 'wine pairing event' });
    const counts = tags.filter((t) => t === 'wine_food').length;
    expect(counts).toBe(1);
  });

  it('returns base tags for arts_theater', () => {
    const tags = seedOccasionTags({ category: 'arts_theater' });
    expect(tags).toContain('arts_culture');
    expect(tags).toContain('date_night');
  });

  it('returns base tags for recurring_outdoors', () => {
    const tags = seedOccasionTags({ category: 'recurring_outdoors' });
    expect(tags).toContain('outdoors_active');
    expect(tags).toContain('free_sb');
  });
});
