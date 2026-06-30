// ingest/adapters/_shared/occasionTags.ts
//
// Seed-tag mapping: adapters pass category + optional text; this returns starter
// OccasionTag[]. Enrich (Claude) confirms / extends later — adapters only seed.
// These are hints, not final values: the negative rules (21+/non-free) are
// enforced after the AI call in enrich.ts. (§2.8)

import type { HappeningCategory, OccasionTag } from '../../../packages/shared/types';

const CATEGORY_SEEDS: Record<HappeningCategory, OccasionTag[]> = {
  // Tier-1
  live_music:          ['catch_a_show', 'nightlife', 'date_night'],
  festival_fair:       ['family_day', 'free_sb', 'outdoors_active', 'hosting_visitors'],
  arts_theater:        ['catch_a_show', 'arts_culture', 'date_night'],
  community_gathering: ['free_sb', 'family_day', 'solo'],
  food_drink_event:    ['wine_food', 'date_night', 'solo'],
  sports_outdoors_event: ['outdoors_active', 'family_day', 'hosting_visitors'],
  // Tier-2
  weekly_special:      ['nightlife', 'date_night'],
  recurring_nightlife: ['nightlife', 'date_night', 'solo'],
  recurring_market:    ['wine_food', 'free_sb', 'family_day', 'outdoors_active'],
  recurring_arts:      ['arts_culture', 'catch_a_show', 'free_sb'],
  recurring_outdoors:  ['outdoors_active', 'free_sb', 'solo', 'family_day'],
  // Tier-3
  outdoor_activity:    ['outdoors_active', 'solo', 'family_day'],
  food_drink_spot:     ['wine_food', 'date_night', 'solo'],
  culture_spot:        ['arts_culture', 'hosting_visitors', 'solo'],
  shopping_browse:     ['solo', 'hosting_visitors'],
  scenic_chill:        ['outdoors_active', 'solo', 'date_night'],
};

const TEXT_RULES: Array<[RegExp, OccasionTag]> = [
  [/\b(family|kids?|children|toddler|youth)\b/i, 'family_day'],
  [/\bfree\b|\bno cost\b|\bno charge\b|\bcomplimentary\b/i, 'free_sb'],
  [/\bwine\b|\btasting\b|\bvineyard\b|\bbeer\b|\bbrewer/i, 'wine_food'],
  [/\boutdoor|outside|park|beach|trail|hike/i, 'outdoors_active'],
  [/\bdate\b|\bromantic\b|\bcouples?\b/i, 'date_night'],
  [/\bsolo\b|\bsingle\b|\balone\b/i, 'solo'],
  [/\bvisit\b|\btourist\b|\bguest\b|\bweekend getaway\b/i, 'hosting_visitors'],
  [/\bnightlife\b|\bbar\b|\bclub\b|\bcocktail\b/i, 'nightlife'],
];

export function seedOccasionTags(input: {
  category: HappeningCategory;
  sourceCategory?: string;
  text?: string;
}): OccasionTag[] {
  const base: Set<OccasionTag> = new Set(CATEGORY_SEEDS[input.category] ?? []);
  const haystack = `${input.sourceCategory ?? ''} ${input.text ?? ''}`;
  for (const [rx, tag] of TEXT_RULES) {
    if (rx.test(haystack)) base.add(tag);
  }
  return [...base];
}
