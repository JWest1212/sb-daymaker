// The 10 occasion tags (the "Lens"). Keys match the schema `occasion_tag` enum.
// `color` is a token CSS var used as a decorative fill behind the icon.
// `text`  is the AA-safe text color on that fill (always --paper or --ink).

export type OccasionKey =
  | "date_night"
  | "family_day"
  | "nightlife"
  | "catch_a_show"
  | "arts_culture"
  | "outdoors_active"
  | "wine_food"
  | "free_sb"
  | "hosting_visitors"
  | "solo";

export interface Occasion {
  key: OccasionKey;
  label: string;
  pillLabel: string; // short label for the on-photo pill (never wraps at 90px max-width)
  icon: string;
  color: string; // token CSS var — fill
  text: string;  // token CSS var — text on that fill (AA-safe)
}

export const OCCASIONS: Occasion[] = [
  { key: "date_night",       label: "Date Night",       pillLabel: "Date Night",    icon: "🍷",   color: "var(--terracotta)",  text: "var(--paper)" },
  { key: "family_day",       label: "Family Day",       pillLabel: "Family Day",    icon: "👨‍👩‍👧",  color: "var(--sage)",        text: "var(--paper)" },
  { key: "nightlife",        label: "Nightlife",        pillLabel: "Nightlife",     icon: "🌃",   color: "var(--ink)",         text: "var(--paper)" },
  { key: "catch_a_show",     label: "Catch a Show",     pillLabel: "Catch a Show",  icon: "🎭",   color: "var(--pacific)",     text: "var(--paper)" },
  { key: "arts_culture",     label: "Arts & Culture",   pillLabel: "Arts",          icon: "🎨",   color: "var(--purple)",      text: "var(--paper)" },
  { key: "outdoors_active",  label: "Outdoors & Active",pillLabel: "Outdoors",      icon: "⛰️",  color: "var(--forest)",      text: "var(--paper)" },
  { key: "wine_food",        label: "Wine & Food",      pillLabel: "Wine & Food",   icon: "🍇",   color: "var(--pacific-dark)",text: "var(--paper)" },
  { key: "free_sb",          label: "Free in SB",       pillLabel: "Free in SB",    icon: "🏷️",  color: "var(--gold)",        text: "var(--ink)"   },
  { key: "hosting_visitors", label: "Hosting Visitors", pillLabel: "Hosting",       icon: "🧑‍🤝‍🧑", color: "var(--pacific)",     text: "var(--paper)" },
  { key: "solo",             label: "Solo",             pillLabel: "Solo",          icon: "🚶",   color: "var(--ink-2)",       text: "var(--paper)" },
];

export const OCCASION_BY_KEY: Record<OccasionKey, Occasion> = Object.fromEntries(
  OCCASIONS.map((o) => [o.key, o]),
) as Record<OccasionKey, Occasion>;

// Doc 22 §2.2 — the Occasion door's tile vocabulary. `catch_a_show`,
// `arts_culture`, `outdoors_active`, `wine_food` are now served by the Activity
// door and drop out of this list, but stay in OCCASIONS/OCCASION_BY_KEY above so
// existing thing_tags data still renders (card pills, admin tools, search).
// `dog_friendly` and `rainy_day` join once their data exists (Doc 22 Phases 4-5).
const DOOR_OCCASION_KEYS: OccasionKey[] = [
  "date_night",
  "family_day",
  "nightlife",
  "hosting_visitors",
  "solo",
  "free_sb",
];

export const DOOR_OCCASIONS: Occasion[] = DOOR_OCCASION_KEYS.map((k) => OCCASION_BY_KEY[k]);
