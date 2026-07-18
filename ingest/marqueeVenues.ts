// ingest/marqueeVenues.ts
//
// Card Imagery Build Spec Phase 1 §4.4, the founder-maintained marquee-venue
// registry (same pattern as ingest/adapters/recurringRegistry.ts): the ~12 SB
// landmarks whose events should inherit a founder-pinned, genuinely beautiful photo
// instead of resolving generically per-event. Code-level, no DDL, `pinnedPhoto`
// ships empty; Jim fills it in later (cockpit pinning flow is a follow-up, not this
// phase, see the 2026-07-09 Build Deltas ledger entry).
//
// Resolver priority (Build Spec §2 table): checked between "owned" and "direct
// Google for food" (priority 2, "venue pool"). A match with no pinnedPhoto yet is a
// no-op, the candidate falls through to the rest of the waterfall unchanged.
//
// Coordinates geocoded via OpenStreetMap Nominatim, 2026-07-09 (same method as the
// 2026-07-08 State Street ledger entry).

import type { PhotoSource } from '../packages/shared/types';
// Card Imagery Build Spec Phase 2 §5.2, moved to lib/geo.ts so app-side code
// (lib/venuePool.ts) can share it too (lib/ can't import from ingest/); re-exported
// here unchanged so this file's own existing haversineMeters call + every other
// import site (ingest/images.ts, ingest/marqueeVenues.test.ts) keeps working as-is.
export { haversineMeters } from '../lib/geo';
import { haversineMeters } from '../lib/geo';

export interface MarqueeVenue {
  key: string;
  names: string[]; // lowercase-normalized substring match tokens against a candidate's title
  lat: number;
  lng: number;
  radiusM: number;
  pinnedPhoto?: { url: string; source: Extract<PhotoSource, 'wikimedia' | 'owned'>; attribution: string };
}

export const MARQUEE_VENUES: MarqueeVenue[] = [
  { key: 'sb-bowl', names: ['santa barbara bowl', 'sb bowl'], lat: 34.435115, lng: -119.693409, radiusM: 200 },
  { key: 'arlington-theatre', names: ['arlington theatre', 'arlington theater'], lat: 34.4242051, lng: -119.7069644, radiusM: 100 },
  { key: 'granada-theatre', names: ['granada theatre', 'granada theater'], lat: 34.4240477, lng: -119.7045845, radiusM: 100 },
  { key: 'lobero-theatre', names: ['lobero theatre', 'lobero theater'], lat: 34.4216681, lng: -119.7000209, radiusM: 100 },
  { key: 'courthouse-sunken-gardens', names: ['santa barbara county courthouse', 'sb county courthouse', 'sunken gardens'], lat: 34.4243265, lng: -119.7025115, radiusM: 150 },
  { key: 'old-mission', names: ['old mission', 'mission santa barbara', 'santa barbara mission'], lat: 34.4383718, lng: -119.7132291, radiusM: 150 },
  { key: 'stearns-wharf', names: ['stearns wharf'], lat: 34.4099523, lng: -119.6857949, radiusM: 200 },
  { key: 'moxi', names: ['moxi'], lat: 34.4134617, lng: -119.6916752, radiusM: 100 },
  { key: 'sb-museum-of-art', names: ['santa barbara museum of art', 'sb museum of art', 'sbma'], lat: 34.4233305, lng: -119.704024, radiusM: 100 },
  { key: 'chase-palm-park', names: ['chase palm park'], lat: 34.4155526, lng: -119.6825894, radiusM: 200 },
  { key: 'alameda-park', names: ['alameda park'], lat: 34.4277923, lng: -119.705461, radiusM: 150 },
  { key: 'sb-zoo', names: ['santa barbara zoo', 'sb zoo'], lat: 34.4193485, lng: -119.6654607, radiusM: 200 },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Match a candidate to a marquee venue by name-token match OR haversine proximity
 *  (§4.4). Name match first (cheap, works with no coords); falls back to distance
 *  when the candidate has lat/lng. Pure, unit-tested independent of the resolver. */
export function matchMarqueeVenue(c: { title: string; lat?: number; lng?: number }): MarqueeVenue | null {
  const title = normalize(c.title);
  for (const v of MARQUEE_VENUES) {
    if (v.names.some((n) => title.includes(normalize(n)))) return v;
  }
  if (c.lat != null && c.lng != null) {
    for (const v of MARQUEE_VENUES) {
      if (haversineMeters(c.lat, c.lng, v.lat, v.lng) <= v.radiusM) return v;
    }
  }
  return null;
}
