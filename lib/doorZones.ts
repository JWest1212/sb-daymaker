// lib/doorZones.ts
//
// R1 Wave 4 (W4.1). This file is now a THIN ADAPTER over lib/areas.ts, which is
// the single definition of the 8 public areas.
//
// It used to be one of two competing area systems (the other being the 6-value
// `nearby_zone` vocabulary in lib/zones.ts), each with its own labels. The names
// below are kept because the cockpit's Neighborhood Sweep, the search index and
// the Explore door all import them; keeping the names and moving the DATA is a
// smaller, safer change than renaming across five admin surfaces mid-wave.
//
// New code should import from lib/areas.ts directly. Nothing here defines an
// area, a label or a mapping of its own any more.

import type { Neighborhood } from "../packages/shared/types";
import {
  AREAS,
  AREA_BY_KEY,
  AREA_CANONICAL_NEIGHBORHOOD,
  areaForNeighborhood,
  type Area,
  type AreaKey,
} from "./areas";

/** @deprecated Use `AreaKey` from lib/areas.ts. */
export type DoorZoneKey = AreaKey;
/** @deprecated Use `Area` from lib/areas.ts. */
export type DoorZone = Area;

/** @deprecated Use `AREAS` from lib/areas.ts. */
export const DOOR_ZONES: Area[] = AREAS;

/** @deprecated Use `AREA_BY_KEY` from lib/areas.ts. */
export const DOOR_ZONE_BY_KEY: Record<AreaKey, Area> = AREA_BY_KEY;

/** @deprecated Use `areaForNeighborhood` from lib/areas.ts. */
export function doorZoneForNeighborhood(neighborhood: string | null | undefined): AreaKey | null {
  return areaForNeighborhood(neighborhood);
}

/** @deprecated Use `AREA_CANONICAL_NEIGHBORHOOD` from lib/areas.ts. */
export const DOOR_ZONE_CANONICAL_NEIGHBORHOOD: Partial<Record<AreaKey, Neighborhood>> =
  AREA_CANONICAL_NEIGHBORHOOD;

/** The `neighborhood` value to store when triage assigns a whole area rather
 *  than a specific dictionary venue. Finer distinctions (riviera vs
 *  mission_canyon, carpinteria vs montecito) survive for known venues; only the
 *  hand-triaged residue collapses to the canonical value. */
export function canonicalNeighborhoodForZone(key: AreaKey): Neighborhood {
  return AREA_CANONICAL_NEIGHBORHOOD[key];
}
