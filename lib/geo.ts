// lib/geo.ts
//
// Shared pure geo math. Lives here (not ingest/) so both the ingest worker AND
// app-side code (lib/venuePool.ts, the cockpit) can import it — ingest/ already
// depends one-way on lib/, never the reverse. Originally defined in
// ingest/marqueeVenues.ts (Card Imagery Build Spec Phase 1 §4.4); re-exported from
// there unchanged so existing call sites don't need to change.

/** Haversine distance in meters between two lat/lng points. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
