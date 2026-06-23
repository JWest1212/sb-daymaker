// The 10 occasion tags (the "Lens"). Keys match the schema `occasion_tag` enum.
// `color` is a token CSS var used as a decorative fill behind the icon.

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
  icon: string;
  color: string; // token CSS var
}

export const OCCASIONS: Occasion[] = [
  { key: "date_night", label: "Date Night", icon: "🍷", color: "var(--terracotta)" },
  { key: "family_day", label: "Family Day", icon: "👨‍👩‍👧", color: "var(--sage)" },
  { key: "nightlife", label: "Nightlife", icon: "🌃", color: "var(--ink)" },
  { key: "catch_a_show", label: "Catch a Show", icon: "🎭", color: "var(--pacific)" },
  { key: "arts_culture", label: "Arts & Culture", icon: "🎨", color: "var(--purple)" },
  { key: "outdoors_active", label: "Outdoors & Active", icon: "⛰️", color: "var(--forest)" },
  { key: "wine_food", label: "Wine & Food", icon: "🍇", color: "var(--pacific-dark)" },
  { key: "free_sb", label: "Free in SB", icon: "🏷️", color: "var(--gold)" },
  { key: "hosting_visitors", label: "Hosting Visitors", icon: "🧑‍🤝‍🧑", color: "var(--pacific)" },
  { key: "solo", label: "Solo", icon: "🚶", color: "var(--ink-2)" },
];

export const OCCASION_BY_KEY: Record<OccasionKey, Occasion> = Object.fromEntries(
  OCCASIONS.map((o) => [o.key, o]),
) as Record<OccasionKey, Occasion>;
