// ingest/activityBackfill.ts
//
// Doc 21 §4 — the deterministic `happening_category` -> `activities[]` mapping.
// Pure, no AI, no per-request calls. Used by the one-time backfill
// (scripts/backfill_activities.mts, Doc 21 Phase 2/3) and the nightly land-step
// self-heal (toThingRow, Doc 21 Phase 4). All 16 HappeningCategory values are
// covered; a category can map to more than one slug since `activities[]` is
// multi-valued (Doc 20 §1).

import type { HappeningCategory } from '../packages/shared/types';
import type { ActivityKey } from '../lib/activities';

const CATEGORY_TO_ACTIVITIES: Record<HappeningCategory, ActivityKey[]> = {
  live_music: ['live-music'],
  recurring_nightlife: ['live-music', 'nightlife'],
  arts_theater: ['arts-galleries', 'film-talks'],
  culture_spot: ['arts-galleries'],
  recurring_arts: ['arts-galleries'],
  food_drink_event: ['food-drink'],
  food_drink_spot: ['food-drink'],
  weekly_special: ['food-drink'],
  sports_outdoors_event: ['outdoors', 'wellness-fitness'],
  outdoor_activity: ['outdoors'],
  recurring_outdoors: ['outdoors', 'wellness-fitness'],
  scenic_chill: ['outdoors'],
  recurring_market: ['markets'],
  shopping_browse: ['markets'],
  festival_fair: ['community-festivals'],
  community_gathering: ['community-festivals'],
};

/** Pure. Unknown/null categories map to no slugs rather than throwing — the
 *  land step and the backfill script both see hand-typed strings from the DB. */
export function categoryToActivities(category: string | null | undefined): ActivityKey[] {
  if (!category) return [];
  return CATEGORY_TO_ACTIVITIES[category as HappeningCategory] ?? [];
}
