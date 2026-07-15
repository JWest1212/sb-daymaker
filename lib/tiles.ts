// Home Rework spec §7/§11.2 — assembles the tile grid each DiscoverySheet shows,
// one list per dimension, sourced from the founder-maintained registries
// (lib/zones.ts, lib/occasions.ts, lib/activities.ts). Counts are computed against
// the horizon-scoped set only (not also cross-filtered by the other two active
// dimensions) — spec §18 open decision #2 defaults to the simpler version for v1.

import type { Thing } from "./things";
import { DOOR_ZONES, doorZoneForNeighborhood } from "./doorZones";
import { DOOR_OCCASIONS, OCCASION_BY_KEY } from "./occasions";
import { ACTIVITIES } from "./activities";

export interface Tile {
  key: string;
  label: string;
  image: string;
  count: number;
}

// Doc 22 §2.1 — the Place door's 8 zones, a no-DDL code mapping over the
// existing `neighborhood` field (lib/doorZones.ts, built for the Neighborhood
// Sweep). Distinct from lib/zones.ts's 6-value `nearby_zone` anchors, which
// remain the Near Me sort's own system (NearMeSheet.tsx, Saved).
export function placeTiles(inHorizon: Thing[]): Tile[] {
  return DOOR_ZONES.map((z) => ({
    key: z.key,
    label: z.label,
    image: `/tiles/place/${z.key}.jpg`,
    count: inHorizon.filter((t) => doorZoneForNeighborhood(t.neighborhood) === z.key).length,
  }));
}

// Rainy Day was weather-gated (gray/rain days only) through Doc 22; by founder
// request (2026-07-14) it's now always visible, so it lives in the static
// DOOR_OCCASIONS list (lib/occasions.ts) like every other entry.
// Occasion Tags spec §3 — Dog Friendly stays conditional, but self-gated: no
// external signal to pass in, it just checks whether the current horizon has
// any dog_friendly thing at all (populated by lib/things.ts's read-time venue
// derivation). Never dead-ends — the tile can't appear before it has content.
export function vibeTiles(inHorizon: Thing[]): Tile[] {
  const showDogFriendly = inHorizon.some((t) => t.tags.includes("dog_friendly"));
  const occasions = [
    ...DOOR_OCCASIONS,
    ...(showDogFriendly ? [OCCASION_BY_KEY.dog_friendly] : []),
  ];
  return occasions.map((o) => ({
    key: o.key,
    label: o.label,
    image: `/tiles/vibe/${o.key}.jpg`,
    count: inHorizon.filter((t) => t.tags.includes(o.key)).length,
  }));
}

export function activityTiles(inHorizon: Thing[]): Tile[] {
  return ACTIVITIES.map((a) => ({
    key: a.key,
    label: a.label,
    image: a.tile,
    count: inHorizon.filter((t) => t.activities.includes(a.key)).length,
  }));
}

export type Dimension = "place" | "vibe" | "activity";

/** Dispatches to the right tile builder — DiscoverySheet doesn't need to know
 *  which dimension is open beyond this one call. */
export function tilesFor(dimension: Dimension, inHorizon: Thing[]): Tile[] {
  if (dimension === "place") return placeTiles(inHorizon);
  if (dimension === "vibe") return vibeTiles(inHorizon);
  return activityTiles(inHorizon);
}
