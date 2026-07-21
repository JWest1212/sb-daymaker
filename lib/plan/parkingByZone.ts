// Gate 4 · G4.4, zone-level parking truth. Hand-authored local knowledge (the
// guides already teach "park once on Anacapa above Yanonali; the Funk Zone lots
// are a trap"), so every plan that passes through a zone inherits it. Refreshable
// by hand; never fetched. Pure data. No em dash (Golden Rule).

import type { Zone } from "@/lib/zones";

/** The one thing a local would tell you about parking in each zone. Null-safe:
 *  a zone with nothing worth saying returns null and no note renders. */
export const PARKING_BY_ZONE: Record<Zone, string> = {
  funk: "park once in the Funk Zone lot off Garden, then walk it all",
  downtown: "the city lots off State are free for 75 minutes, use one and walk",
  waterfront: "the Harbor and Palm lots fill by 11am, come early or park up on Cabrillo",
  montecito: "street parking on Coast Village is 2 hours, plan around it",
  mesa: "free street parking on the Mesa, just mind the permit blocks near the cliffs",
  goleta: "everything in Goleta has a free lot, park right at the door",
};

/** The parking note for a zone (or null when we cannot name one). */
export function parkingNote(zone: Zone | null | undefined): string | null {
  if (!zone) return null;
  return PARKING_BY_ZONE[zone] ?? null;
}
