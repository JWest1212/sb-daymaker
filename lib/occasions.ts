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
  | "solo"
  | "rainy_day"
  | "dog_friendly";

export interface Occasion {
  key: OccasionKey;
  label: string;
  pillLabel: string; // short label for the on-photo pill (never wraps at 90px max-width)
  color: string; // token CSS var, fill
  text: string;  // token CSS var, text on that fill (AA-safe)
}

export const OCCASIONS: Occasion[] = [
  { key: "date_night",       label: "Date Night",       pillLabel: "Date Night",   color: "var(--terracotta)",  text: "var(--paper)" },
  { key: "family_day",       label: "Family Day",       pillLabel: "Family Day",  color: "var(--sage)",        text: "var(--paper)" },
  { key: "nightlife",        label: "Nightlife",        pillLabel: "Nightlife",   color: "var(--ink)",         text: "var(--paper)" },
  { key: "catch_a_show",     label: "Catch a Show",     pillLabel: "Catch a Show",   color: "var(--pacific)",     text: "var(--paper)" },
  { key: "arts_culture",     label: "Arts & Culture",   pillLabel: "Arts",   color: "var(--purple)",      text: "var(--paper)" },
  { key: "outdoors_active",  label: "Outdoors & Active",pillLabel: "Outdoors",  color: "var(--forest)",      text: "var(--paper)" },
  { key: "wine_food",        label: "Wine & Food",      pillLabel: "Wine & Food",   color: "var(--pacific-dark)",text: "var(--paper)" },
  { key: "free_sb",          label: "Free in SB",       pillLabel: "Free in SB",  color: "var(--gold)",        text: "var(--ink)"   },
  { key: "hosting_visitors", label: "Hosting Visitors", pillLabel: "Hosting", color: "var(--pacific)",     text: "var(--paper)" },
  { key: "solo",             label: "Solo",             pillLabel: "Solo",   color: "var(--ink-2)",       text: "var(--paper)" },
  { key: "rainy_day",        label: "Rainy Day",        pillLabel: "Rainy Day",  color: "var(--pacific-dark)",text: "var(--paper)" },
  { key: "dog_friendly",     label: "Dog Friendly",     pillLabel: "Dog Friendly",   color: "var(--tile-light)",  text: "var(--ink)"   },
];

export const OCCASION_BY_KEY: Record<OccasionKey, Occasion> = Object.fromEntries(
  OCCASIONS.map((o) => [o.key, o]),
) as Record<OccasionKey, Occasion>;

// Doc 22 §2.2, the Occasion door's static tile vocabulary. `catch_a_show`,
// `arts_culture`, `outdoors_active`, `wine_food` are now served by the Activity
// door and drop out of this list, but stay in OCCASIONS/OCCASION_BY_KEY above so
// existing thing_tags data still renders (card pills, admin tools, search).
// `rainy_day` was originally weather-gated (shown only on gray/rain days); by
// founder request (2026-07-14) it's now always visible, same as every other
// entry here. `dog_friendly` (Occasion Tags spec §3) stays conditional, gated
// inside vibeTiles itself on whether any thing in the current horizon actually
// carries the tag, so that tile can never dead-end.
const DOOR_OCCASION_KEYS: OccasionKey[] = [
  "date_night",
  "family_day",
  "nightlife",
  "hosting_visitors",
  "solo",
  "free_sb",
  "rainy_day",
];

export const DOOR_OCCASIONS: Occasion[] = DOOR_OCCASION_KEYS.map((k) => OCCASION_BY_KEY[k]);
