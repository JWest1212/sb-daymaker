// Gate 4 · G4.4, zone-level parking truth. Hand-authored local knowledge (the
// guides already teach "park once on Anacapa above Yanonali; the Funk Zone lots
// are a trap"), so every plan that passes through a zone inherits it. Refreshable
// by hand; never fetched. Pure data. No em dash (Golden Rule).

import type { AreaKey } from "@/lib/areas";

/** The one thing a local would tell you about parking in each area. Null-safe:
 *  an area with nothing worth saying returns null and no note renders. */
// R1 W4.1: keyed by the 8 public areas. The two areas the old 6-value system
// could not express get their own local truth rather than inheriting Downtown's.
export const PARKING_BY_ZONE: Partial<Record<AreaKey, string>> = {
  funk_zone: "park once in the Funk Zone lot off Garden, then walk it all",
  downtown_state: "the city lots off State are free for 75 minutes, use one and walk",
  waterfront_harbor: "the Harbor and Palm lots fill by 11am, come early or park up on Cabrillo",
  montecito_carpinteria: "street parking on Coast Village is 2 hours, plan around it",
  mesa: "free street parking on the Mesa, just mind the permit blocks near the cliffs",
  goleta_isla_vista: "everything in Goleta has a free lot, park right at the door",
  mission_riviera: "park on the street below the Mission and walk up, the lot fills early",
  upper_state: "upper State has free lots behind the shops, use one instead of the street",
};

/** The parking note for a zone (or null when we cannot name one). */
export function parkingNote(zone: AreaKey | null | undefined): string | null {
  if (!zone) return null;
  return PARKING_BY_ZONE[zone] ?? null;
}
