// The Near Me anchors — the six coarse `nearby_zone` values the UI exposes.
// Centroids are approximate Santa Barbara coordinates, used only to pick the
// nearest zone from a device location. No map (v9): Near Me is a sort.

export type Zone = "funk" | "downtown" | "waterfront" | "montecito" | "mesa" | "goleta";

export interface ZoneAnchor {
  zone: Zone;
  label: string;
  lat: number;
  lng: number;
}

export const ZONES: ZoneAnchor[] = [
  { zone: "funk", label: "Funk Zone", lat: 34.4142, lng: -119.6889 },
  { zone: "downtown", label: "Downtown / State St.", lat: 34.4208, lng: -119.6982 },
  { zone: "waterfront", label: "The Waterfront", lat: 34.4096, lng: -119.6896 },
  { zone: "montecito", label: "Montecito", lat: 34.4367, lng: -119.6313 },
  { zone: "mesa", label: "The Mesa", lat: 34.403, lng: -119.718 },
  { zone: "goleta", label: "Goleta", lat: 34.4358, lng: -119.8276 },
];

export const ZONE_LABEL: Record<Zone, string> = Object.fromEntries(
  ZONES.map((z) => [z.zone, z.label]),
) as Record<Zone, string>;

// The 11 granular `neighborhood` values collapse into the 6 coarse `nearby_zone`
// anchors. Each mapping matches what nearestZone() returns for that neighborhood's
// coordinates (Riviera/Mission Canyon/Upper State sit nearest Downtown; Carpinteria
// sits nearest Montecito). `other` has no meaningful zone.
export const NEIGHBORHOOD_ZONE: Record<string, Zone | null> = {
  funk_zone: "funk",
  downtown: "downtown",
  upper_state: "downtown",
  riviera: "downtown",
  mission_canyon: "downtown",
  waterfront: "waterfront",
  mesa: "mesa",
  montecito: "montecito",
  carpinteria: "montecito",
  goleta: "goleta",
  other: null,
};

/** Coarse zone for a granular neighborhood value, or null (unknown / 'other'). */
export function zoneForNeighborhood(neighborhood: string | null | undefined): Zone | null {
  return neighborhood ? (NEIGHBORHOOD_ZONE[neighborhood] ?? null) : null;
}

/** Nearest anchor zone to a device location (simple squared-distance). */
export function nearestZone(lat: number, lng: number): Zone {
  let best = ZONES[0];
  let bestD = Infinity;
  for (const z of ZONES) {
    const d = (z.lat - lat) ** 2 + (z.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return best.zone;
}
