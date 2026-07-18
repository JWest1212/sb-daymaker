// ingest/adapters/_shared/resolveNeighborhood.ts
//
// Doc 19 §4, the neighborhood resolver, the reusable core of the Neighborhood
// Sweep. Pure and side-effect-free: callers (the sweep and ingest/land.ts) pass
// in the already-fetched venue dictionary (the `venue_neighborhoods` table, NOT
// the unrelated image-matching `venues` table in lib/venuePool.ts) rather than
// this module doing its own DB I/O, same convention as bestVenueMatch there.
// No AI, no per-request calls, no paid geocoding.

import type { Neighborhood } from '../../../packages/shared/types';
import { sourceKeyOf } from '../../dedupe';

export type ResolveMethod =
  | 'place_id' | 'venue_name' | 'source' | 'point_in_polygon' | 'street' | 'existing' | 'unresolved';

export interface ResolveResult {
  neighborhood: Neighborhood | null;
  method: ResolveMethod;
  confidence: number;
}

export interface VenueDictEntry {
  name: string;
  name_norm: string;
  neighborhood: Neighborhood;
  place_id: string | null;
  aliases: string[];
}

export interface ResolvableThing {
  title: string;
  address: string | null;
  place_id: string | null;
  source_url: string | null;
  lat: number | null;
  lng: number | null;
  /** The thing's CURRENT neighborhood, if any, only ever surfaced by this
   *  resolver via method 'existing' (step 6), and only when nothing stronger
   *  fires. A residue-sweep caller always passes other/null here by construction. */
  neighborhood: Neighborhood | 'other' | null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// §4.1 step 3, source-implied venue. Reuses dedupe.ts's sourceKeyOf so the two
// never drift, then maps to a neighborhood ONLY for sources that imply exactly
// one venue. Aggregators and multi-location sources (independent, citysb,
// eventbrite, libraries, farmersMarkets, ticketmaster) are deliberately absent
// here, Doc 19 §5.2 resolves those per-event via address/coordinates instead.
const SOURCE_KEY_NEIGHBORHOOD: Partial<Record<string, Neighborhood>> = {
  soho: 'downtown',
  sbbowl: 'riviera',
  lobero: 'downtown',
  granada: 'downtown',
  arlington: 'downtown',
  ucsb: 'goleta',
  downtownSB: 'downtown',
};

// §4.1 step 5, street/address code table. State St is block-number-sensitive
// (400-1300 -> downtown, below 400 -> funk_zone) so it's handled separately.
const STREET_NEIGHBORHOOD: Array<[RegExp, Neighborhood]> = [
  [/coast village/i, 'montecito'],
  [/mission canyon/i, 'mission_canyon'],
  [/la cumbre|hope ave/i, 'upper_state'],
  [/hollister ave|calle real/i, 'goleta'],
  [/carpinteria ave|linden ave/i, 'carpinteria'],
  [/cabrillo blvd|harbor way/i, 'waterfront'],
  [/cliff dr|mesa ln/i, 'mesa'],
];

function streetMatch(address: string): Neighborhood | null {
  const stateMatch = address.match(/(\d+)\s+state\s+st/i);
  if (stateMatch) {
    const num = parseInt(stateMatch[1], 10);
    if (num >= 400 && num <= 1300) return 'downtown';
    if (num < 400) return 'funk_zone';
  }
  for (const [re, n] of STREET_NEIGHBORHOOD) if (re.test(address)) return n;
  return null;
}

// §4.1 step 4, point-in-polygon. Rough bounding boxes over SB's 11 neighborhood
// values (free; only uses lat/lng already stored). SB's linear coastal geography
// makes boxes workable per Doc 19 §8; edges are the acknowledged weak spot,
// which is why this sits below venue/source matches in trust order.
const ZONE_BOXES: Array<{ n: Neighborhood; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { n: 'funk_zone',      minLat: 34.405, maxLat: 34.418, minLng: -119.696, maxLng: -119.685 },
  { n: 'downtown',       minLat: 34.412, maxLat: 34.428, minLng: -119.712, maxLng: -119.685 },
  { n: 'waterfront',     minLat: 34.403, maxLat: 34.412, minLng: -119.700, maxLng: -119.680 },
  { n: 'mesa',           minLat: 34.395, maxLat: 34.412, minLng: -119.730, maxLng: -119.712 },
  { n: 'riviera',        minLat: 34.428, maxLat: 34.445, minLng: -119.700, maxLng: -119.685 },
  { n: 'mission_canyon', minLat: 34.445, maxLat: 34.470, minLng: -119.720, maxLng: -119.695 },
  { n: 'upper_state',    minLat: 34.428, maxLat: 34.445, minLng: -119.740, maxLng: -119.700 },
  { n: 'goleta',         minLat: 34.415, maxLat: 34.460, minLng: -119.880, maxLng: -119.780 },
  { n: 'montecito',      minLat: 34.425, maxLat: 34.445, minLng: -119.640, maxLng: -119.600 },
  { n: 'carpinteria',    minLat: 34.390, maxLat: 34.410, minLng: -119.530, maxLng: -119.500 },
];

function pointInPolygon(lat: number, lng: number): Neighborhood | null {
  for (const box of ZONE_BOXES) {
    if (lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng) return box.n;
  }
  return null;
}

/** The §4.1 waterfall, highest trust first. Pure, no DB, no network. */
export function resolveNeighborhood(thing: ResolvableThing, dictionary: VenueDictEntry[]): ResolveResult {
  // 1. place_id match, 0.98
  if (thing.place_id) {
    const hit = dictionary.find((v) => v.place_id === thing.place_id);
    if (hit) return { neighborhood: hit.neighborhood, method: 'place_id', confidence: 0.98 };
  }

  // 2. venue-name match (name_norm or an alias appears in the normalized title
  //    or address), 0.9
  const titleNorm = normalize(thing.title);
  const addrNorm = thing.address ? normalize(thing.address) : '';
  for (const v of dictionary) {
    const candidates = [v.name_norm, ...v.aliases.map(normalize)];
    for (const c of candidates) {
      if (!c) continue;
      if (titleNorm.includes(c) || (addrNorm && addrNorm.includes(c))) {
        return { neighborhood: v.neighborhood, method: 'venue_name', confidence: 0.9 };
      }
    }
  }

  // 3. source-implied venue, 0.85
  if (thing.source_url) {
    const n = SOURCE_KEY_NEIGHBORHOOD[sourceKeyOf(thing.source_url)];
    if (n) return { neighborhood: n, method: 'source', confidence: 0.85 };
  }

  // 4. point-in-polygon, 0.75
  if (thing.lat != null && thing.lng != null) {
    const n = pointInPolygon(thing.lat, thing.lng);
    if (n) return { neighborhood: n, method: 'point_in_polygon', confidence: 0.75 };
  }

  // 5. street/address match, 0.6 (soft suggestion; §4.2 write policy below
  //    decides this never auto-writes)
  if (thing.address) {
    const n = streetMatch(thing.address);
    if (n) return { neighborhood: n, method: 'street', confidence: 0.6 };
  }

  // 6. existing neighborhood, kept as-is if already real. Applies in the
  //    nightly path; a no-op for the residue sweep, whose inputs are always
  //    other/null by construction (Doc 19 §4.1 step 6).
  if (thing.neighborhood && thing.neighborhood !== 'other') {
    return { neighborhood: thing.neighborhood, method: 'existing', confidence: 1 };
  }

  // 7. unresolved
  return { neighborhood: null, method: 'unresolved', confidence: 0 };
}

/** §4.2 write policy, confidence at or above 0.75 (methods 1-4) writes
 *  `neighborhood` directly, no review. Everything else (street's 0.6, and
 *  unresolved's 0) is a triage candidate, not an auto-write. */
export function autoWrites(result: ResolveResult): boolean {
  return result.confidence >= 0.75;
}
