// The four hand-authored day-shape skeletons (build doc §3.1). Each declares,
// per block, the kind of stop to fill it with (an ordered tag preference + an
// optional area hint), plus a caption and the zones it tends to anchor in.
//
// These are CONTENT, not code — a curated config refreshed seasonally, never
// generated at runtime. Authored against the live Santa Barbara content domain
// (waterfront/downtown/funk/montecito; outdoors/wine_food/arts/date_night), so
// the deterministic engine can always fill them from published `things`.

import type { DayShape } from "./types";

export const DAY_SHAPES: DayShape[] = [
  {
    id: "daymaker",
    name: "The Daymaker",
    caption: "A little of everything — water, town, and a good table to end on.",
    anchorZones: ["waterfront", "downtown", "funk"],
    slots: {
      morning: { tags: ["outdoors_active"], areaHint: "waterfront" },
      midday: { tags: ["wine_food"], areaHint: "downtown" }, // lunch bridge — a meal
      afternoon: { tags: ["arts_culture", "outdoors_active"], areaHint: "downtown" },
      evening: { tags: ["wine_food", "date_night"], areaHint: "funk" },
    },
  },
  {
    id: "coastal",
    name: "Classic Coastal",
    caption: "An easy day along the water and up through the old town.",
    anchorZones: ["waterfront", "downtown"],
    slots: {
      morning: { tags: ["outdoors_active"], areaHint: "waterfront" },
      midday: { tags: ["wine_food"], areaHint: "waterfront" }, // harbor lunch bridge
      afternoon: { tags: ["arts_culture", "outdoors_active"], areaHint: "downtown" },
      evening: { tags: ["date_night", "wine_food"], areaHint: "montecito" },
    },
  },
  {
    id: "funk",
    name: "Funk Zone & Wine",
    caption: "Tasting rooms, murals, and a long lunch in the Funk Zone.",
    anchorZones: ["funk", "waterfront"],
    slots: {
      morning: { tags: ["outdoors_active"], areaHint: "waterfront" },
      midday: { tags: ["wine_food"], areaHint: "funk" },
      afternoon: { tags: ["wine_food", "arts_culture"], areaHint: "funk" },
      evening: { tags: ["wine_food", "date_night"], areaHint: "funk" },
    },
  },
  {
    id: "arts",
    name: "Arts & State St.",
    caption: "Galleries, the museum, and a stroll down State to dinner.",
    anchorZones: ["downtown"],
    slots: {
      morning: { tags: ["outdoors_active", "free_sb"], areaHint: "downtown" },
      midday: { tags: ["wine_food"], areaHint: "downtown" },
      afternoon: { tags: ["arts_culture"], areaHint: "downtown" },
      evening: { tags: ["date_night", "wine_food"], areaHint: "downtown" },
    },
  },
];

export const DAY_SHAPE_BY_ID: Record<string, DayShape> = Object.fromEntries(
  DAY_SHAPES.map((s) => [s.id, s]),
);

/** The flagship "Make My Day" default shape (balanced, all-day, anchor-agnostic). */
export const DEFAULT_DAY_SHAPE = DAY_SHAPE_BY_ID.daymaker;

/**
 * The three themed pills shown on the results day-shape selector (mockup #dayopts).
 * `daymaker` is intentionally absent — it stays as the Make My Day engine default,
 * not a visible selector pill.
 */
export const PLAN_SELECTOR_SHAPES: DayShape[] = [
  DAY_SHAPE_BY_ID.coastal,
  DAY_SHAPE_BY_ID.funk,
  DAY_SHAPE_BY_ID.arts,
];
