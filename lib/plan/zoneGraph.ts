// Gate 4 · G4.3/G4.4, the deterministic geography the concierge engine reasons
// over. No map tiles, no routing API (CLAUDE.md §2): a hand-authored zone graph
// plus a coarse distance→time model. Every number here is a local-truth estimate,
// refreshable by hand, never fetched. Pure module.

import { AREAS, AREA_BY_KEY, type AreaKey } from "@/lib/areas";
import type { Transport } from "./types";

/** The compact, mutually-walkable SB core: park once, walk the rest. Funk Zone,
 *  Downtown/State, and the Waterfront knit together on foot. Everything else is a
 *  short drive from it. Each other zone is its own single-member cluster. */
// R1 W4.1: expressed over the 8 public areas, so the engine reasons in the same
// vocabulary the visitor chose from. Mission and Riviera and Upper State are up
// the hill and north of the core respectively: near Downtown by car, not on foot.
export const WALKABLE_CLUSTERS: AreaKey[][] = [
  ["funk_zone", "downtown_state", "waterfront_harbor"],
  ["mesa"],
  ["mission_riviera"],
  ["upper_state"],
  ["montecito_carpinteria"],
  ["goleta_isla_vista"],
];

/** The cluster (walkable group) an area belongs to. */
export function clusterOf(area: AreaKey): AreaKey[] {
  return WALKABLE_CLUSTERS.find((c) => c.includes(area)) ?? [area];
}

/** Two areas share a walkable cluster (reachable on foot). */
export function sameWalkCluster(a: AreaKey, b: AreaKey): boolean {
  return clusterOf(a).includes(b);
}

// Adjacency for a car/bike day: which zones sit next to which (a single hop that
// doesn't cross the county). The walkable core is adjacent to Mesa and Montecito;
// Goleta hangs off Downtown to the west.
const ADJACENT: Record<AreaKey, AreaKey[]> = {
  funk_zone:             ["downtown_state", "waterfront_harbor", "mesa", "montecito_carpinteria"],
  downtown_state:        ["funk_zone", "waterfront_harbor", "mesa", "mission_riviera", "upper_state", "goleta_isla_vista", "montecito_carpinteria"],
  waterfront_harbor:     ["funk_zone", "downtown_state", "mesa", "montecito_carpinteria"],
  mesa:                  ["waterfront_harbor", "downtown_state", "funk_zone"],
  mission_riviera:       ["downtown_state", "upper_state"],
  upper_state:           ["downtown_state", "mission_riviera", "goleta_isla_vista"],
  goleta_isla_vista:     ["downtown_state", "upper_state"],
  montecito_carpinteria: ["funk_zone", "waterfront_harbor", "downtown_state"],
};

/** Areas directly adjacent (one hop) to `area`. */
export function adjacentZones(area: AreaKey): AreaKey[] {
  return ADJACENT[area] ?? [];
}

const AREA_LATLNG: Record<AreaKey, { lat: number; lng: number }> = Object.fromEntries(
  AREAS.map((a) => [a.key, { lat: a.lat, lng: a.lng }]),
) as Record<AreaKey, { lat: number; lng: number }>;

/** Great-circle km between two points. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Point {
  lat: number | null;
  lng: number | null;
  zone: AreaKey | null;
}

/** Km between two stops. Prefer real coordinates; fall back to zone centroids;
 *  0 when we truly cannot tell (same-place assumption keeps the day from
 *  inventing a drive out of missing data). */
export function distanceKm(a: Point, b: Point): number {
  const pa = a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : a.zone ? AREA_LATLNG[a.zone] : null;
  const pb = b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : b.zone ? AREA_LATLNG[b.zone] : null;
  if (!pa || !pb) return 0;
  return haversineKm(pa, pb);
}

export interface Hop {
  mode: "walk" | "drive";
  minutes: number;
}

// Coarse pace model: ~12 min/km on foot, ~2.4 min/km driving plus a 3-min base
// (parking, lights). Deterministic; rounded to a friendly integer.
const WALK_MIN_PER_KM = 12;
const DRIVE_MIN_PER_KM = 2.4;
const DRIVE_BASE_MIN = 3;
// Beyond this, walking stops being credible; the hop becomes a drive.
const WALK_MAX_KM = 1.6;

/** The realistic hop between two stops for a transport mode. Walking a distance
 *  past the credible cap (or across walk-clusters) is quietly upgraded to a drive
 *  for the estimate, so the annotation never claims a 40-minute walk. */
export function hopBetween(a: Point, b: Point, transport: Transport): Hop {
  const km = distanceKm(a, b);
  const walkable =
    (transport === "walk" || transport === "bike") &&
    km <= WALK_MAX_KM &&
    (!a.zone || !b.zone || sameWalkCluster(a.zone, b.zone));
  if (walkable) {
    const minutes = Math.max(1, Math.round(km * (transport === "bike" ? WALK_MIN_PER_KM / 3 : WALK_MIN_PER_KM)));
    return { mode: "walk", minutes };
  }
  const minutes = Math.max(2, Math.round(DRIVE_BASE_MIN + km * DRIVE_MIN_PER_KM));
  return { mode: "drive", minutes };
}
