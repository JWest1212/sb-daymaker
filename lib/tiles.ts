// Home Rework spec §7/§11.2 — assembles the tile grid each DiscoverySheet shows,
// one list per dimension, sourced from the founder-maintained registries
// (lib/zones.ts, lib/occasions.ts, lib/activities.ts). Counts are computed against
// the horizon-scoped set only (not also cross-filtered by the other two active
// dimensions) — spec §18 open decision #2 defaults to the simpler version for v1.

import type { Thing } from "./things";
import { ZONES } from "./zones";
import { OCCASIONS } from "./occasions";
import { ACTIVITIES } from "./activities";

export interface Tile {
  key: string;
  label: string;
  image: string;
  count: number;
}

export function placeTiles(inHorizon: Thing[]): Tile[] {
  return ZONES.map((z) => ({
    key: z.zone,
    label: z.label,
    image: `/tiles/place/${z.zone}.jpg`,
    count: inHorizon.filter((t) => t.nearby_zone === z.zone).length,
  }));
}

export function vibeTiles(inHorizon: Thing[]): Tile[] {
  return OCCASIONS.map((o) => ({
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
