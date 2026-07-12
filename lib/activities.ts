// The Activity door's controlled vocabulary (Home Rework spec §6.1) — the third
// discovery dimension alongside Place (lib/zones.ts) and Vibe (lib/occasions.ts).
// Founder-maintained, same convention as ingest/adapters/recurringRegistry.ts.
// Populated ONLY by the nightly batch-AI enrich path (ingest/enrich.ts) — never
// per-request AI. Written to the additive `things.activities text[]` column
// (supabase/migrations/15_activities.sql).

export type ActivityKey =
  | "live-music"
  | "arts-galleries"
  | "food-drink"
  | "outdoors"
  | "markets"
  | "family-kids"
  | "clubs-groups"
  | "film-talks"
  | "wellness-fitness"
  | "nightlife";

export interface Activity {
  key: ActivityKey;
  label: string;
  description: string;
  /** /public/tiles/activity/{key}.jpg — founder-curated (§6.3); missing files fall
   *  back to a token-colored tile (the Activity door's terracotta accent), label only. */
  tile: string;
}

export const ACTIVITIES: Activity[] = [
  { key: "live-music", label: "Live music", description: "Bands, DJs, and open mics.", tile: "/tiles/activity/live-music.jpg" },
  { key: "arts-galleries", label: "Arts & galleries", description: "Openings, exhibits, and studio visits.", tile: "/tiles/activity/arts-galleries.jpg" },
  { key: "food-drink", label: "Food & drink", description: "Restaurants, tastings, and pop-ups.", tile: "/tiles/activity/food-drink.jpg" },
  { key: "outdoors", label: "Outdoors", description: "Hikes, beaches, and open air.", tile: "/tiles/activity/outdoors.jpg" },
  { key: "markets", label: "Markets", description: "Farmers markets and maker fairs.", tile: "/tiles/activity/markets.jpg" },
  { key: "family-kids", label: "Family & kids", description: "All-ages, kid-friendly programming.", tile: "/tiles/activity/family-kids.jpg" },
  { key: "clubs-groups", label: "Clubs & groups", description: "Meetups, classes, and running clubs.", tile: "/tiles/activity/clubs-groups.jpg" },
  { key: "film-talks", label: "Film & talks", description: "Screenings, lectures, and author talks.", tile: "/tiles/activity/film-talks.jpg" },
  { key: "wellness-fitness", label: "Wellness & fitness", description: "Yoga, studios, and active recovery.", tile: "/tiles/activity/wellness-fitness.jpg" },
  { key: "nightlife", label: "Nightlife", description: "Bars, late sets, and after-dark spots.", tile: "/tiles/activity/nightlife.jpg" },
];

export const ACTIVITY_BY_KEY: Record<ActivityKey, Activity> = Object.fromEntries(
  ACTIVITIES.map((a) => [a.key, a]),
) as Record<ActivityKey, Activity>;

export const ACTIVITY_KEYS: ActivityKey[] = ACTIVITIES.map((a) => a.key);
