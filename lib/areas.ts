// lib/areas.ts
//
// R1 Wave 4 (W4.1). ONE area vocabulary for the whole product.
//
// Before this there were two, over two different database columns, and they
// disagreed about how many areas Santa Barbara has:
//
//   lib/zones.ts      6 values over `nearby_zone`, used by Saved's Near Me sort
//                     and Plan's area step
//   lib/doorZones.ts  8 values over `neighborhood`, used by Explore's Place door
//
// A visitor filtering to "Downtown / State St." in one place and "Downtown &
// State Street" in another was looking at two different systems that happened to
// be spelled similarly (TP-A2-01, TP-A2-02). The 8 door areas are the public
// vocabulary (D5), and this module is the only place they are defined.
//
// `nearby_zone` is MAPPED here, not migrated (D5). Two areas, Mission and
// Riviera and Upper State, have no `nearby_zone` of their own because the
// 6-value system folded both into "downtown"; they are resolvable from
// `neighborhood` only, which is why resolution reads `neighborhood` first.

import type { Neighborhood } from "../packages/shared/types";
import type { Thing } from "./things";
import type { Zone } from "./zones";

export type AreaKey =
  | "downtown_state"
  | "funk_zone"
  | "waterfront_harbor"
  | "mesa"
  | "mission_riviera"
  | "upper_state"
  | "goleta_isla_vista"
  | "montecito_carpinteria";

export interface Area {
  key: AreaKey;
  /** The one display string, used verbatim on every surface. */
  label: string;
  /** The compact form for chips and card meta lines. */
  short: string;
  /** `neighborhood` enum values that roll up to this area. */
  neighborhoods: Neighborhood[];
  /** The `nearby_zone` value that maps here, where one exists. Null where the
   *  older 6-value system had no equivalent. */
  nearbyZone: Zone | null;
  /** Approximate centre, used only to resolve a row that has coordinates but no
   *  stored area (W4.4 rule 2). Not a boundary. */
  lat: number;
  lng: number;
}

/**
 * The 8 public areas, in the order they are offered.
 *
 * Labels are final (W4.1) and spelled with "and", not an ampersand, so the same
 * string can be read aloud, put in an email and shown in a chip without
 * rewriting.
 */
export const AREAS: Area[] = [
  { key: "downtown_state",        label: "Downtown and State Street",            short: "Downtown",           neighborhoods: ["downtown"],                     nearbyZone: "downtown",   lat: 34.4208, lng: -119.6982 },
  { key: "funk_zone",             label: "Funk Zone",                            short: "Funk Zone",          neighborhoods: ["funk_zone"],                    nearbyZone: "funk",       lat: 34.4142, lng: -119.6889 },
  { key: "waterfront_harbor",     label: "Waterfront and Harbor",                short: "Waterfront",         neighborhoods: ["waterfront"],                   nearbyZone: "waterfront", lat: 34.4096, lng: -119.6896 },
  { key: "mesa",                  label: "The Mesa",                             short: "The Mesa",           neighborhoods: ["mesa"],                         nearbyZone: "mesa",       lat: 34.4030, lng: -119.7180 },
  { key: "mission_riviera",       label: "Mission and Riviera",                  short: "Mission and Riviera", neighborhoods: ["mission_canyon", "riviera"],   nearbyZone: null,         lat: 34.4383, lng: -119.7104 },
  { key: "upper_state",           label: "Upper State",                          short: "Upper State",        neighborhoods: ["upper_state"],                  nearbyZone: null,         lat: 34.4398, lng: -119.7372 },
  { key: "goleta_isla_vista",     label: "Goleta and Isla Vista",                short: "Goleta",             neighborhoods: ["goleta"],                       nearbyZone: "goleta",     lat: 34.4358, lng: -119.8276 },
  { key: "montecito_carpinteria", label: "Montecito, Summerland, and Carpinteria", short: "Montecito",        neighborhoods: ["montecito", "carpinteria"],     nearbyZone: "montecito",  lat: 34.4367, lng: -119.6313 },
];

export const AREA_BY_KEY: Record<AreaKey, Area> = Object.fromEntries(
  AREAS.map((a) => [a.key, a]),
) as Record<AreaKey, Area>;

/** The one string for "no area chosen", shared by Plan and Saved. */
export const ANYWHERE_LABEL = "Anywhere in SB";

const BY_NEIGHBORHOOD: Partial<Record<Neighborhood, AreaKey>> = Object.fromEntries(
  AREAS.flatMap((a) => a.neighborhoods.map((n) => [n, a.key] as const)),
);

const BY_NEARBY_ZONE: Partial<Record<Zone, AreaKey>> = Object.fromEntries(
  AREAS.filter((a) => a.nearbyZone).map((a) => [a.nearbyZone as Zone, a.key] as const),
);

/** Area for a `neighborhood` enum value, or null. "other" is not an area: it is
 *  the absence of one, and it must never reach a screen (W4.1). */
export function areaForNeighborhood(neighborhood: string | null | undefined): AreaKey | null {
  if (!neighborhood || neighborhood === "other") return null;
  return BY_NEIGHBORHOOD[neighborhood as Neighborhood] ?? null;
}

/** Area for a `nearby_zone` value, or null. */
export function areaForNearbyZone(zone: string | null | undefined): AreaKey | null {
  if (!zone) return null;
  return BY_NEARBY_ZONE[zone as Zone] ?? null;
}

/**
 * The area a thing belongs to, or null when nobody knows.
 *
 * `neighborhood` first, because it is the finer of the two columns and the only
 * one that can express Mission and Riviera or Upper State. `nearby_zone` is the
 * fallback. Null means unknown, and unknown displays as NOTHING: not "OTHER",
 * not "Santa Barbara". A label that says nothing useful is worse than no label,
 * because it looks like an answer.
 */
export function areaForThing(t: Pick<Thing, "neighborhood" | "nearby_zone">): AreaKey | null {
  return areaForNeighborhood(t.neighborhood) ?? areaForNearbyZone(t.nearby_zone);
}

/** The display label for a thing's area, or null when unknown. */
export function areaLabelForThing(t: Pick<Thing, "neighborhood" | "nearby_zone">): string | null {
  const key = areaForThing(t);
  return key ? AREA_BY_KEY[key].label : null;
}

/** The short display label for a thing's area, or null when unknown. */
export function areaShortForThing(t: Pick<Thing, "neighborhood" | "nearby_zone">): string | null {
  const key = areaForThing(t);
  return key ? AREA_BY_KEY[key].short : null;
}

/** Nearest area to a coordinate, by simple squared distance. Used by the W4.4
 *  backfill and by "Use my location". Always returns an area: the caller has
 *  asserted it has a real Santa Barbara coordinate. */
export function nearestArea(lat: number, lng: number): AreaKey {
  let best = AREAS[0];
  let bestD = Infinity;
  for (const a of AREAS) {
    const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best.key;
}

/** The canonical `neighborhood` value to store for an area. Used by the backfill
 *  and by cockpit triage, where a finer distinction (riviera vs mission_canyon)
 *  is not available. */
export const AREA_CANONICAL_NEIGHBORHOOD: Record<AreaKey, Neighborhood> = {
  downtown_state: "downtown",
  funk_zone: "funk_zone",
  waterfront_harbor: "waterfront",
  mesa: "mesa",
  mission_riviera: "mission_canyon",
  upper_state: "upper_state",
  goleta_isla_vista: "goleta",
  montecito_carpinteria: "montecito",
};
