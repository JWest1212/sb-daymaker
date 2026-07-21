// Gate 4 · G4.3, geo-clustering. Bias the day toward one or two adjacent zones
// so it doesn't zig-zag across the county. The anchor sets the starting cluster;
// walking plans stay in a single walk-cluster; car plans may span two clusters
// with an explicit drive between them. Pure, no I/O, no AI.

import type { Thing } from "@/lib/things";
import type { Zone } from "@/lib/zones";
import type { ResolvedParams } from "./types";
import { clusterOf, sameWalkCluster, adjacentZones, distanceKm } from "./zoneGraph";

/** A soft proximity score for a candidate given the day's current cluster origin.
 *  Higher = closer/cohesive. Added to the ranker so the day stays tight without a
 *  hard cross-zone ban (car days can still make one deliberate hop). */
export function clusterBoost(
  t: Thing,
  originZone: Zone | null,
  params: ResolvedParams,
): number {
  if (!originZone || !t.nearby_zone) return 0;
  const z = t.nearby_zone as Zone;
  if (z === originZone) return 3;
  if (sameWalkCluster(originZone, z)) return 2;
  if (adjacentZones(originZone).includes(z)) {
    // A car day tolerates one adjacent hop; a walking day should not reward it.
    return params.transport === "walk" ? -1 : 1;
  }
  // Distant zone: penalize (car days may still take it if nothing closer exists).
  return params.transport === "walk" ? -4 : -2;
}

/** The zone the plan is anchored to: the chosen zone, else the most common zone
 *  among already-placed stops, else null (Anywhere / unknown). */
export function anchorZoneFor(
  params: ResolvedParams,
  placed: Thing[],
): Zone | null {
  if (params.zone) return params.zone;
  const counts = new Map<Zone, number>();
  for (const t of placed) {
    if (t.nearby_zone) counts.set(t.nearby_zone as Zone, (counts.get(t.nearby_zone as Zone) ?? 0) + 1);
  }
  let best: Zone | null = null;
  let bestN = 0;
  for (const [z, n] of counts) {
    if (n > bestN) {
      best = z;
      bestN = n;
    }
  }
  return best;
}

/** Does adding `next` to a set of placed stops keep the day within the allowed
 *  cluster footprint (walk = one walk-cluster; car/bike = at most two clusters)?
 *  Used by validation to flag zone zig-zag. */
export function withinClusterFootprint(
  placedZones: Zone[],
  next: Zone | null,
  params: ResolvedParams,
): boolean {
  if (!next) return true;
  const clusters = new Set<string>();
  for (const z of placedZones) clusters.add(clusterOf(z)[0]);
  clusters.add(clusterOf(next)[0]);
  const maxClusters = params.transport === "walk" ? 1 : 2;
  return clusters.size <= maxClusters;
}

/** The straight-line spread (km) of a set of stop coordinates/zones, for a coarse
 *  "is this day physically coherent" read in validation. */
export function daySpreadKm(points: { lat: number | null; lng: number | null; zone: Zone | null }[]): number {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, distanceKm(points[i], points[j]));
    }
  }
  return max;
}
