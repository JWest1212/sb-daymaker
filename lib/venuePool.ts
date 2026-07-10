// lib/venuePool.ts
//
// Card Imagery Build Spec Phase 2 (docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md
// §5) — the pure, unit-tested functions shared by the ingest resolver (venue-pool
// rotation at ingest time), the app-side feed assembly (per-feed dedupe at render
// time), and the cockpit Venues tab (fuzzy match scoring, venue-name extraction for
// the one-off seeding script). Lives in lib/ (not ingest/) so both sides can import
// it — ingest/ already depends one-way on lib/, never the reverse.

import { haversineMeters } from './geo';
import { assignVisual } from './visualAssignment';
import type { HappeningCategory } from '../packages/shared/types';

export type VenuePhotoSource = 'google' | 'wikimedia' | 'owned';

export interface PoolPhoto {
  url: string;
  source: VenuePhotoSource;
  attribution: string | null;
}

// ---- §5.4 — deterministic pool rotation -----------------------------------

/** A tiny, fast, deterministic string hash (FNV-1a-ish — good enough for picking an
 *  index, not for anything cryptographic). Same input -> same output always, which
 *  is the only property §5.4 actually needs ("date-hash so it rotates day to day").
 *  Exported (Card Imagery Build Spec Phase 3 §6.2) so `lib/visualAssignment.ts`
 *  shares this exact hash for `visual_seed` instead of a second, divergence-prone
 *  implementation. */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

/** §5.4 — `pool[hash(thing_id + date) % pool.length]` semantics: the same thing on
 *  the same SB-local calendar day always picks the same pool index (idempotent
 *  re-runs); a new day reshuffles. `poolLen <= 0` returns 0 (caller's problem to not
 *  call this with an empty pool). */
export function pickFromPool(thingId: string, isoDate: string, poolLen: number): number {
  if (poolLen <= 0) return 0;
  return hashString(`${thingId}|${isoDate}`) % poolLen;
}

// ---- §5.4 — per-feed dedupe at render time ---------------------------------

export interface FeedDedupeItem {
  id: string;
  venue_id: string | null;
  photo_url: string | null;
  photo_source: string | null;
  photo_attribution?: string | null;
  /** 2026-07-10 — needed only for the exhaustion fallback below (`assignVisual`'s
   *  category pool); every real caller is a `Thing`, which already carries this. */
  happening_category?: HappeningCategory | string | null;
  visual_kind?: string | null;
  visual_key?: string | null;
  visual_seed?: number | null;
}

/** Walks a already-ordered feed; if a venue's pool photo has already appeared
 *  earlier in this same render, advances the repeat to the next pool photo not yet
 *  used THIS render (searching forward circularly from its own persisted pick, so a
 *  non-colliding item is never touched); once every pool slot is claimed for that
 *  venue this render, falls through to a motif/big-type assignment (Card Imagery
 *  Build Spec Phase 3 §6.2 — this used to fall to the bare gradient placeholder
 *  before Phase 3 existed to fall through TO; that's what the spec's own §5.4 line
 *  "falls through to the gradient (motif is Phase 3)" meant. Wired up 2026-07-10
 *  once real venue-pool curation made this reachable in production — SOhO alone
 *  has 59 published dated events sharing a 3-photo pool, so most weeks exhaust it).
 *
 *  Deliberately scoped to items whose CURRENT photo is actually a member of the
 *  matched venue's approved pool (`pool.some(p => p.url === item.photo_url)`) — a
 *  card resolved some other way (direct-Google food, a founder's one-off "find more
 *  options" pick, a gated Wikimedia pick unrelated to the pool) is left untouched
 *  even if it shares a venue_id, matching §5.4's last line: "Founder per-thing
 *  picker overrides always win over rotation." There's still no photo_locked column
 *  (the same pre-existing gap Phase 0/1 already flagged) to check directly — this is
 *  the safest proxy available: only pool members are ever reassigned. */
export function dedupeFeedVenuePhotos<T extends FeedDedupeItem>(
  items: T[],
  pools: Record<string, PoolPhoto[]>,
): T[] {
  const usedByVenue = new Map<string, Set<number>>();
  return items.map((item) => {
    if (!item.venue_id) return item;
    const pool = pools[item.venue_id];
    if (!pool || pool.length === 0) return item;
    const startIdx = pool.findIndex((p) => p.url === item.photo_url);
    if (startIdx === -1) return item;

    let used = usedByVenue.get(item.venue_id);
    if (!used) { used = new Set(); usedByVenue.set(item.venue_id, used); }
    if (!used.has(startIdx)) {
      used.add(startIdx);
      return item;
    }
    for (let step = 1; step < pool.length; step++) {
      const idx = (startIdx + step) % pool.length;
      if (!used.has(idx)) {
        used.add(idx);
        const p = pool[idx];
        return { ...item, photo_url: p.url, photo_source: p.source, photo_attribution: p.attribution };
      }
    }
    // Every pool slot already claimed by an earlier card this render — a
    // deterministic motif/big-type beats repeating a photo a 4th/5th time or
    // showing a blank gradient. No network (assignVisual is a pure hash); the
    // marquee-venue override is skipped here (it needs the marquee KEY, which
    // this render-time item shape doesn't carry — a pool-exhausted item is by
    // definition already at a real curated venue, so the category-level motif is
    // the right fallback, not a landmark-specific one it can't look up anyway).
    const visual = assignVisual({ id: item.id, happening_category: item.happening_category as HappeningCategory | null | undefined });
    return {
      ...item, photo_url: null, photo_source: 'motif', photo_attribution: null,
      visual_kind: visual.visual_kind, visual_key: visual.visual_key, visual_seed: visual.visual_seed,
    };
  });
}

// ---- §5.2 — fuzzy thing -> venue matcher scoring ---------------------------

export interface MatchableVenue {
  id: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  name_patterns: string[]; // lowercase match tokens
}

export interface MatchableThing {
  title: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Score a thing/venue pair for the cockpit's "matches to review" pane. Exact
 *  place_id match scores far above anything else (that case auto-attaches and
 *  shouldn't even reach this scorer in practice — see the nightly matcher — but the
 *  score still reflects it correctly if it's ever surfaced). Name-pattern substring
 *  hits (against the thing's title OR address — venue names are often embedded in
 *  the address string, e.g. "SOhO Restaurant & Music Club, 1221 State St...") add a
 *  flat bonus per matching pattern. Proximity within radius_m adds a distance-graded
 *  bonus (closer scores higher); outside radius_m contributes nothing. Zero means
 *  "no match at all" — the caller should not surface a zero-score pair. */
export function scoreVenueMatch(thing: MatchableThing, venue: MatchableVenue): number {
  let score = 0;
  if (thing.place_id && venue.place_id && thing.place_id === venue.place_id) score += 100;

  const titleNorm = normalizeText(thing.title);
  const addrNorm = thing.address ? normalizeText(thing.address) : '';
  for (const pattern of venue.name_patterns) {
    const p = normalizeText(pattern);
    if (!p) continue;
    if (titleNorm.includes(p) || (addrNorm && addrNorm.includes(p))) score += 10;
  }

  if (thing.lat != null && thing.lng != null && venue.lat != null && venue.lng != null) {
    const d = haversineMeters(thing.lat, thing.lng, venue.lat, venue.lng);
    if (d <= venue.radius_m) score += Math.max(0, 5 - (d / venue.radius_m) * 5);
  }
  return score;
}

/** Best-scoring venue for a thing, or null if nothing scores above 0. */
export function bestVenueMatch(
  thing: MatchableThing,
  venues: MatchableVenue[],
): { venue: MatchableVenue; score: number } | null {
  let best: { venue: MatchableVenue; score: number } | null = null;
  for (const venue of venues) {
    const score = scoreVenueMatch(thing, venue);
    if (score > 0 && (!best || score > best.score)) best = { venue, score };
  }
  return best;
}

// ---- §5.2 — venue-name extraction for the seeding script -------------------

/** A normalized address commonly carries a venue name as a leading, comma-separated
 *  segment (adapter-dependent — e.g. "SOhO Restaurant & Music Club, 1221 State
 *  Street, Santa Barbara, CA" vs. plain "1221 State St, Santa Barbara, CA" for the
 *  same real place). Extracts that leading segment as a display-name candidate WHEN
 *  it doesn't itself look like a street address (doesn't start with a number) —
 *  otherwise returns null so the caller falls back to the raw address (the venue
 *  editor, §5.3, exists precisely to let the founder rename a rough auto-seed). */
export function extractVenueNameFromAddress(address: string): string | null {
  const first = address.split(',')[0]?.trim();
  if (!first) return null;
  if (/^\d/.test(first)) return null; // starts with a house number -> not a venue name
  return titleCase(first);
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** venues.key slug — shared by the ingest seeding script and the Live-catalog
 *  auto-create-a-venue follow-up (2026-07-10) so both produce the same shape. */
export function slugifyVenueKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'venue';
}

/** Card Imagery Build Spec Phase 2, place_id-lookup follow-up (2026-07-10) — the
 *  SAME "starts with a digit -> not a venue name, it's an address" signal as
 *  `extractVenueNameFromAddress`, reused to detect a Google Text Search result
 *  that just geocoded a bare address back rather than finding a real named
 *  business/POI there (a technically-successful match with nothing useful behind
 *  it for photo-fetching — no business generally means no Google photos either). */
export function isWeakPlaceMatch(matchedName: string): boolean {
  return /^\d/.test(matchedName.trim());
}
