// lib/doorZones.ts
//
// Doc 18 §7.1 — the 8 Place-door zones, a read-time code mapping over the
// existing 11-value `neighborhood` enum. No DDL, no stored column. Distinct
// from lib/zones.ts's 6-value `nearby_zone` (the Near Me sort's coarse anchors);
// this is the newer Place-door grouping the Neighborhood Sweep (Doc 19) reports
// against and its triage chips write through.

import type { Neighborhood } from "../packages/shared/types";

export type DoorZoneKey =
  | "downtown_state"
  | "funk_zone"
  | "waterfront_harbor"
  | "mesa"
  | "mission_riviera"
  | "uptown_upper_state"
  | "goleta_isla_vista"
  | "montecito_carpinteria";

export interface DoorZone {
  key: DoorZoneKey;
  label: string;
  neighborhoods: Neighborhood[];
}

export const DOOR_ZONES: DoorZone[] = [
  { key: "downtown_state",        label: "Downtown & State Street",              neighborhoods: ["downtown"] },
  { key: "funk_zone",             label: "Funk Zone",                            neighborhoods: ["funk_zone"] },
  { key: "waterfront_harbor",     label: "Waterfront & Harbor",                  neighborhoods: ["waterfront"] },
  { key: "mesa",                  label: "The Mesa",                             neighborhoods: ["mesa"] },
  { key: "mission_riviera",       label: "Mission & Riviera",                    neighborhoods: ["mission_canyon", "riviera"] },
  { key: "uptown_upper_state",    label: "Uptown & Upper State",                 neighborhoods: ["upper_state"] },
  { key: "goleta_isla_vista",     label: "Goleta & Isla Vista",                  neighborhoods: ["goleta"] },
  { key: "montecito_carpinteria", label: "Montecito · Summerland · Carpinteria", neighborhoods: ["montecito", "carpinteria"] },
];

const NEIGHBORHOOD_TO_DOOR_ZONE: Partial<Record<Neighborhood, DoorZoneKey>> = Object.fromEntries(
  DOOR_ZONES.flatMap((z) => z.neighborhoods.map((n) => [n, z.key] as const)),
);

/** Door zone for a neighborhood, or null for other/null/unmapped (no door
 *  until the sweep resolves it). */
export function doorZoneForNeighborhood(neighborhood: string | null | undefined): DoorZoneKey | null {
  if (!neighborhood || neighborhood === "other") return null;
  return NEIGHBORHOOD_TO_DOOR_ZONE[neighborhood as Neighborhood] ?? null;
}

export const DOOR_ZONE_BY_KEY: Record<DoorZoneKey, DoorZone> = Object.fromEntries(
  DOOR_ZONES.map((z) => [z.key, z]),
) as Record<DoorZoneKey, DoorZone>;

// §4.3 — when triage assigns via a zone chip (not a specific dictionary venue),
// the two collapsed zones write this canonical neighborhood. Finer distinction
// (riviera vs mission_canyon, carpinteria vs montecito) is preserved for known
// dictionary venues; only the hand-triaged residue loses granularity.
export const DOOR_ZONE_CANONICAL_NEIGHBORHOOD: Partial<Record<DoorZoneKey, Neighborhood>> = {
  mission_riviera: "mission_canyon",
  montecito_carpinteria: "montecito",
};

/** The neighborhood a triage zone-chip tap writes: the §4.3 canonical override
 *  for the two collapsed zones, else the door zone's single neighborhood. */
export function canonicalNeighborhoodForZone(key: DoorZoneKey): Neighborhood {
  return DOOR_ZONE_CANONICAL_NEIGHBORHOOD[key] ?? DOOR_ZONE_BY_KEY[key].neighborhoods[0];
}
