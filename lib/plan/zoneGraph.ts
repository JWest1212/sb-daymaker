// Gate 4 · G4.3/G4.4, the deterministic geography the concierge engine reasons
// over. No map tiles, no routing API (CLAUDE.md §2): a hand-authored zone graph
// plus a coarse distance→time model. Every number here is a local-truth estimate,
// refreshable by hand, never fetched. Pure module.

import type { Zone } from "@/lib/zones";
import { ZONES } from "@/lib/zones";
import type { Transport } from "./types";

/** The compact, mutually-walkable SB core: park once, walk the rest. Funk Zone,
 *  Downtown/State, and the Waterfront knit together on foot. Everything else is a
 *  short drive from it. Each other zone is its own single-member cluster. */
export const WALKABLE_CLUSTERS: Zone[][] = [
  ["funk", "downtown", "waterfront"],
  ["mesa"],
  ["montecito"],
  ["goleta"],
];

/** The cluster (walkable group) a zone belongs to. */
export function clusterOf(zone: Zone): Zone[] {
  return WALKABLE_CLUSTERS.find((c) => c.includes(zone)) ?? [zone];
}

/** Two zones share a walkable cluster (reachable on foot). */
export function sameWalkCluster(a: Zone, b: Zone): boolean {
  return clusterOf(a).includes(b);
}

// Adjacency for a car/bike day: which zones sit next to which (a single hop that
// doesn't cross the county). The walkable core is adjacent to Mesa and Montecito;
// Goleta hangs off Downtown to the west.
const ADJACENT: Record<Zone, Zone[]> = {
  funk:       ["downtown", "waterfront", "mesa", "montecito"],
  downtown:   ["funk", "waterfront", "mesa", "goleta", "montecito"],
  waterfront: ["funk", "downtown", "mesa", "montecito"],
  mesa:       ["waterfront", "downtown", "funk"],
  montecito:  ["funk", "waterfront", "downtown"],
  goleta:     ["downtown"],
};

/** Zones directly adjacent (one hop) to `zone`. */
export function adjacentZones(zone: Zone): Zone[] {
  return ADJACENT[zone] ?? [];
}

const ZONE_LATLNG: Record<Zone, { lat: number; lng: number }> = Object.fromEntries(
  ZONES.map((z) => [z.zone, { lat: z.lat, lng: z.lng }]),
) as Record<Zone, { lat: number; lng: number }>;

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
  zone: Zone | null;
}

/** Km between two stops. Prefer real coordinates; fall back to zone centroids;
 *  0 when we truly cannot tell (same-place assumption keeps the day from
 *  inventing a drive out of missing data). */
export function distanceKm(a: Point, b: Point): number {
  const pa = a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : a.zone ? ZONE_LATLNG[a.zone] : null;
  const pb = b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : b.zone ? ZONE_LATLNG[b.zone] : null;
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
