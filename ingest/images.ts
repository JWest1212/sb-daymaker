// ingest/images.ts
//
// Image resolution (Doc 11 §7b/§7c; Card Imagery Build Spec Phases 0-3). For each
// card, gather source candidates per the Build Spec §2 priority order and attach a
// REAL image plus ranked alternates for the cockpit picker:
//   0. image_cache (per place)     -> zero cost, never re-pay
//   1. Venue pool (Phase 2)/Marquee-venue pin (Phase 1) -> a founder-approved
//      rotation or a founder-pinned landmark photo
//   2. Direct Google (Phase 1)     -> food/drink venues with a place_id, tried
//      before Wikimedia (still capped, cached, counted)
//   3. Wikimedia (free, SB-specific) -> geosearch-gated when lat/lng exist, else a
//      title-search fallback (places only, never events — Phase 1 §4.1/§4.2)
//   4. Google Place Photo (PAID)   -> only if every free tier genuinely missed, the
//      card has a place_id, and the persisted monthly counter is under the cap.
//   5. Motif / big-type (Phase 3)  -> the cap is hit, no image exists anywhere, the
//      item is a civic meeting (isCivicImage), OR the item is a Tier-1 dated event,
//      which always defaults to no photo (eventDefaultsToNoPhoto) — a deterministic
//      house-drawn motif (or the big-type fallback) from `lib/visualAssignment.ts`,
//      never Pexels stock, never AI at runtime.
//   6. branded gradient            -> the code-level final safety net (ListCard's
//      occasion-gradient fallback), only reached if a `visual` is somehow missing.
//
// Pexels retired Phase 3 (§6.2) — the `'pexels'` enum value stays (historical rows
// re-resolve through this file same as anything else; the value just never gets
// assigned again). PEXELS_API_KEY is no longer read anywhere in this file.
//
// Cost control (audit flag B6; re-verified against Google's live pricing 2026-07-09,
// see the Build Deltas ledger): free-first + per-place caching keep real spend ≈ $0;
// the hard monthly cap is the runaway guard. We store the Google photoUri (a URL, not
// bytes) keyed by place so a place is never paid for twice.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Candidate, PhotoSource, HappeningCategory } from '../packages/shared/types';
import { classifyWeight } from './weight';
import { checkImageRelevance } from './imageRelevance';
import { matchMarqueeVenue, haversineMeters } from './marqueeVenues';
import { pickFromPool, type PoolPhoto } from '../lib/venuePool';
import { assignVisual, type VisualAssignment } from '../lib/visualAssignment';
import { sbDay } from '../lib/explore';

// Card Imagery Build Spec Phase 0 §3.1.4 (re-verified Phase 1 §4.5, 2026-07-09 —
// see the Build Deltas ledger): of the two billable calls per Google photo, only the
// second (Place Photo media) actually costs money — $7.00/1,000 (Enterprise tier,
// 1,000 free/mo); the first (Place Details, fieldmask=photos) is Essentials-IDs-Only,
// $0/unlimited. `onCall()` still counts BOTH toward the shared cap below (a call-
// count runaway guard, not a dollar meter) — cheaper in practice than the cap number
// implies. Default cap dropped 1400 -> 500; Jim sets the env var explicitly in Phase 2.
// Counter is shared with the closure-check feature.
const CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 500);
const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;

export interface ImageOption {
  url: string;
  source: PhotoSource;
  width?: number;
  height?: number;
  attribution?: string;
}
export interface ResolveStats {
  resolved: number; free: number; google: number; motif: number; placeholder: number; overCap: number;
  rejectedQuality: number; rejectedRelevance: number;
}

/** Addendum Part B — quality bar: a retina-safe HD floor. Free-tier searches
 *  occasionally return thumbnail-sized or cropped-down images; this screens those
 *  out before they can become the auto-pick or a cockpit alternate. Options with no
 *  reported size (shouldn't happen for pexels/wikimedia/google after the capture
 *  below, but keeps 'owned'/manually-set entries permissive) pass through. */
export const MIN_IMAGE_WIDTH = 960;
export const MIN_IMAGE_HEIGHT = 540;
export function meetsQualityBar(o: Pick<ImageOption, 'width' | 'height'>): boolean {
  if (o.width == null || o.height == null) return true;
  return o.width >= MIN_IMAGE_WIDTH && o.height >= MIN_IMAGE_HEIGHT;
}

// ---- pure helpers (unit-tested) --------------------------------------------

/** Cache/search key: the Google place_id if present, else a normalized title|hood. */
export function cacheKey(c: Pick<Candidate, 'place_id' | 'title' | 'neighborhood'>): string {
  if (c.place_id) return c.place_id;
  const t = c.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${t}|${c.neighborhood ?? ''}`;
}

/** W2.3 — category-keyed query phrases so a community_gathering doesn't draw the same
 *  generic stock as a live_music. Appended to the title so per-title variety survives
 *  while the imagery gains thematic relevance. This is a BRIDGE: the motif SVG library
 *  (separate design track) will supersede most of these. Civic-meeting items are handled
 *  separately (isCivicImage → straight to placeholder), not here. */
export const CATEGORY_QUERY: Partial<Record<HappeningCategory, string>> = {
  // Tier 1 — dated events
  live_music: 'live band small venue stage',
  festival_fair: 'outdoor street festival crowd',
  arts_theater: 'theater stage performance',
  community_gathering: 'community gathering people outdoors',
  food_drink_event: 'food festival tasting table',
  sports_outdoors_event: 'outdoor sports race coast',
  // Tier 2 — recurring
  weekly_special: 'restaurant bar drinks',
  recurring_nightlife: 'nightlife bar lounge evening',
  recurring_market: 'farmers market produce stall california',
  recurring_arts: 'art gallery exhibit',
  recurring_outdoors: 'coastal trail nature walk',
  // Tier 3 — evergreen places
  outdoor_activity: 'coastal trail outdoors california',
  food_drink_spot: 'restaurant food plating',
  culture_spot: 'museum gallery interior',
  shopping_browse: 'boutique storefront shopping',
  scenic_chill: 'ocean coastline scenic view',
};

/** True when an item is a civic/government meeting (by title, via the W2.1b classifier).
 *  W2.3: for these, a neutral branded placeholder beats a misleading stock photo — we
 *  skip the network sources entirely (a fake "council chamber" photo is worse than none). */
export function isCivicImage(c: Pick<Candidate, 'title'>): boolean {
  return classifyWeight({ title: c.title }) < 0;
}

/** Free-source search query — concrete and SB-scoped, category-aware (W2.3). */
export function imageQuery(
  c: Pick<Candidate, 'title' | 'neighborhood'> & { happening_category?: HappeningCategory | string | null },
): string {
  const hood = c.neighborhood ? ` ${c.neighborhood.replace(/_/g, ' ')}` : '';
  const cat = c.happening_category ? CATEGORY_QUERY[c.happening_category as HappeningCategory] : undefined;
  const catPart = cat ? ` ${cat}` : '';
  return `${c.title}${hood}${catPart} Santa Barbara`;
}

/** Rank found options and always append the placeholder as the final alternate
 *  (the resolver below replaces it with a motif/big-type assignment when nothing
 *  real was found — this sentinel is what "nothing found" looks like to the
 *  caller). Card Imagery Build Spec Phase 0 §3.1.1 — relevance-first: an
 *  SB-specific free source (Wikimedia) outranks Google. Phase 3 §6.2 retired
 *  Pexels from this order entirely — a source not in `order` (a historical
 *  'pexels' entry surviving in a thing's stored `photo_options`, the only way
 *  one can still reach this function) ranks LAST among real options, same
 *  demoted spot it held before retirement, not first (a naive `indexOf` of -1
 *  would incorrectly sort it ahead of everything). */
export function rankOptions(found: ImageOption[]): ImageOption[] {
  const order: PhotoSource[] = ['owned', 'wikimedia', 'google'];
  const rank = (s: PhotoSource) => { const i = order.indexOf(s); return i === -1 ? order.length : i; };
  const real = found.filter((o) => o.url).sort((a, b) => rank(a.source) - rank(b.source));
  return [...real, { url: '', source: 'placeholder' as const }];
}

/** Card Imagery Build Spec Phase 0 §3.1.2 — Tier-1 dated events default to no photo:
 *  a house-drawn motif (Phase 3) beats a generic/mismatched stock photo for the 87%
 *  of the catalog that's happenings, not places. Pure so it's unit-testable
 *  independent of the resolver's DB/network calls. */
export function eventDefaultsToNoPhoto(c: Pick<Candidate, 'tier'>): boolean {
  return c.tier === 1;
}

/** Card Imagery Build Spec Phase 1 §4.5 — food/drink venues route to direct Google
 *  ahead of Wikimedia. Pure so the resolver's branch and the scoped backfill's row
 *  selection share one definition instead of drifting. */
export function isDirectGoogleFoodCandidate(c: Pick<Candidate, 'happening_category' | 'type'>): boolean {
  return c.happening_category === 'food_drink_spot' || c.happening_category === 'weekly_special' || c.type === 'happyhour';
}

/** W2.3 per-batch dedupe (PURE). Given ranked options and per-url usage COUNTS from
 *  this run (seeded with the catalog's existing counts), reorder so the LEAST-used real
 *  option leads; source rank breaks ties. Placeholder stays last. Count-based (not a
 *  yes/no set) so that when a cluster of similar events exhausts its shared option pool,
 *  repeats spread evenly across the pool instead of piling back onto the first option —
 *  the threshold-1 run showed ~90 library events collapsing onto one photo without this. */
export function pickUnused(options: ImageOption[], used: Map<string, number>): ImageOption[] {
  const real = options.filter((o) => o.url);
  const placeholder = options.filter((o) => !o.url);
  // Stable sort by usage count asc — unused (0) first, then least-used; original
  // source ranking (pexels > wikimedia > google) breaks ties.
  const sorted = real
    .map((o, i) => [o, i] as const)
    .sort(([a, ia], [b, ib]) => (used.get(a.url) ?? 0) - (used.get(b.url) ?? 0) || ia - ib)
    .map(([o]) => o);
  return [...sorted, ...placeholder];
}

// ---- Wikimedia geosearch + quality gate (Card Imagery Build Spec Phase 1 §4.1/§4.2) ----
//
// Geosearch mode (candidate has lat/lng) replaces the old title-only search as the
// primary Wikimedia path; title-search remains as a fallback for PLACES only (never
// events — §4.1's explicit rule: an event with no coords never gets a title-searched,
// unverified-location photo). Both modes route their raw candidates through the same
// gate + scorer below, so this is the single authoritative Wikimedia quality check —
// the outer resolver no longer re-applies the generic meetsQualityBar() to a
// wikimedia() result (its 800px floor + aspect/blocklist/MIME checks are stricter and
// more source-specific than that generic 960px bar).

export const WIKIMEDIA_GEOSEARCH_RADIUS_M = 200;
export const WIKIMEDIA_GEOSEARCH_LIMIT = 10;
export const WIKIMEDIA_MIN_WIDTH = 800;
export const WIKIMEDIA_MIN_ASPECT = 1;
export const WIKIMEDIA_MAX_ASPECT = 2.2;
export const WIKIMEDIA_MIN_SCORE = 2;

const WIKIMEDIA_BLOCKLIST =
  /\b(maps?|plans?|diagrams?|logos?|seals?|coat[_ ]of[_ ]arms|documents?|scans?|pages?|sheets?|charts?|svg|pdf|books?|newspapers?)\b/i;
const WIKIMEDIA_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** A parsed Wikimedia Commons candidate, pre-gate. `distanceM` is set only in
 *  geosearch mode (the origin point comes from the caller, not the API result). */
export interface WikimediaCandidate {
  url: string;
  title: string; // "File:...jpg" — checked against the blocklist + scored for keyword overlap
  description: string;
  width: number;
  height: number;
  mime: string;
  artist: string;
  license: string; // Commons' LicenseShortName, e.g. "CC BY-SA 4.0", "Public domain"
  distanceM?: number;
}

/** Reject: undersized, wrong aspect ratio, a blocklisted filename (maps/logos/scans/
 *  etc.), or a non-web-safe MIME. (§4.2) */
export function passesWikimediaGate(c: Pick<WikimediaCandidate, 'title' | 'width' | 'height' | 'mime'>): boolean {
  if (!c.width || !c.height || c.width < WIKIMEDIA_MIN_WIDTH) return false;
  const ratio = c.width / c.height;
  if (ratio < WIKIMEDIA_MIN_ASPECT || ratio > WIKIMEDIA_MAX_ASPECT) return false;
  // Commons filenames use underscores as word separators (e.g. "Santa_Barbara_Map_
  // 1875.jpg") — normalize to spaces first so \b boundaries actually land between
  // words instead of treating "_" as a word character and missing the match.
  if (WIKIMEDIA_BLOCKLIST.test(c.title.replace(/[_-]+/g, ' '))) return false;
  if (!WIKIMEDIA_ALLOWED_MIME.has(c.mime)) return false;
  return true;
}

/** PD/CC0 +3, CC BY +2, CC BY-SA +1, anything else 0 (and effectively flagged by
 *  scoring low — an unrecognized license still renders via the attribution string). */
function licenseScore(license: string): number {
  const s = license.toLowerCase();
  if (/\bcc0\b|public domain|\bpd\b/.test(s)) return 3;
  if (/cc[\s-]?by-sa/.test(s)) return 1;
  if (/cc[\s-]?by\b/.test(s)) return 2;
  return 0;
}

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length >= 3);
}

/** +2 per overlapping token between the candidate's title/description and the
 *  thing's title/neighborhood, plus the license score above. */
export function scoreWikimediaCandidate(
  c: Pick<WikimediaCandidate, 'title' | 'description' | 'license'>,
  ctx: { title: string; neighborhood?: string },
): number {
  const haystack = new Set([...tokens(c.title), ...tokens(c.description)]);
  const needle = new Set([...tokens(ctx.title), ...(ctx.neighborhood ? tokens(ctx.neighborhood) : [])]);
  let kw = 0;
  for (const t of needle) if (haystack.has(t)) kw += 2;
  return kw + licenseScore(c.license);
}

/** Gate, score, and rank every survivor above the minimum threshold, best first
 *  (distance breaks equal-score ties ascending, geosearch mode only). Card Imagery
 *  Build Spec Phase 2 §5.3 — the cockpit's "top-5 gated Wikimedia geosearch results"
 *  for a venue reuses this instead of forking a second gate/scorer. Pure — the
 *  network fetchers hand it their parsed candidate list; independently unit-tested. */
export function rankWikimediaCandidates(
  cands: WikimediaCandidate[],
  ctx: { title: string; neighborhood?: string },
): WikimediaCandidate[] {
  return cands
    .filter(passesWikimediaGate)
    .map((c) => ({ c, score: scoreWikimediaCandidate(c, ctx) }))
    .filter(({ score }) => score >= WIKIMEDIA_MIN_SCORE)
    .sort((a, b) => b.score - a.score || (a.c.distanceM ?? Infinity) - (b.c.distanceM ?? Infinity))
    .map(({ c }) => c);
}

/** Gate, score, and pick the best Wikimedia candidate. Below-threshold survivors
 *  are a miss (falls through to the next source) rather than a forced pick. */
export function pickBestWikimedia(
  cands: WikimediaCandidate[],
  ctx: { title: string; neighborhood?: string },
): WikimediaCandidate | null {
  return rankWikimediaCandidates(cands, ctx)[0] ?? null;
}

function wikimediaAttribution(c: Pick<WikimediaCandidate, 'artist' | 'license'>): string {
  return `${c.artist} · ${c.license} · Wikimedia Commons`;
}

function toWikimediaOption(c: WikimediaCandidate): ImageOption {
  return { url: c.url, source: 'wikimedia', width: c.width, height: c.height, attribution: wikimediaAttribution(c) };
}

// ---- network sources (isolated; each returns null on miss/error) -----------
// Pexels retired here Phase 3 §6.2 (pexelsMany, the rate-limit flag, and the
// PEXELS_API_KEY read all removed) — Wikimedia/Google/motif cover every case it
// used to fill.

function parseWikimediaPage(pg: any): Omit<WikimediaCandidate, 'distanceM'> | null {
  const info = pg?.imageinfo?.[0];
  const u = info?.thumburl || info?.url;
  if (!u) return null;
  const artist = (info?.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || 'Wikimedia Commons';
  const license = info?.extmetadata?.LicenseShortName?.value ?? 'Unknown license';
  const description = (
    info?.extmetadata?.ImageDescription?.value ?? info?.extmetadata?.ObjectName?.value ?? ''
  ).replace(/<[^>]+>/g, '');
  return {
    url: u,
    title: pg?.title ?? '',
    description,
    // Original dimensions (Wikimedia never upscales the thumb beyond them) — the
    // right quality-bar signal even though we serve the capped 1200px-wide thumb.
    width: info?.width ?? 0,
    height: info?.height ?? 0,
    mime: info?.mime ?? '',
    artist,
    license,
  };
}

/** §4.1 geosearch mode: candidates within WIKIMEDIA_GEOSEARCH_RADIUS_M of a point,
 *  distance-annotated via `coordinates` (the API's geosearch generator doesn't carry
 *  `dist` through like its list-module form does, so distance is computed here).
 *  Exported (Phase 2 §5.3) for the cockpit's per-venue Wikimedia candidate fetch. */
export async function wikimediaGeosearch(lat: number, lng: number): Promise<WikimediaCandidate[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
      + `&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=${WIKIMEDIA_GEOSEARCH_RADIUS_M}`
      + `&ggslimit=${WIKIMEDIA_GEOSEARCH_LIMIT}&ggsnamespace=6`
      + `&prop=imageinfo|coordinates&iiprop=url|extmetadata|size|mime&iiurlwidth=1200&origin=*`;
    const res = await fetch(url, { headers: { 'user-agent': 'SBDaymaker-ingest/1.0' } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const pages = json?.query?.pages ? Object.values(json.query.pages) : [];
    const out: WikimediaCandidate[] = [];
    for (const pg of pages as any[]) {
      const parsed = parseWikimediaPage(pg);
      if (!parsed) continue;
      const coord = pg?.coordinates?.[0];
      out.push({ ...parsed, distanceM: coord ? haversineMeters(lat, lng, coord.lat, coord.lon) : undefined });
    }
    return out;
  } catch { return []; }
}

/** §4.1 title mode: fallback when a candidate has no lat/lng. Restricted to PLACES
 *  by the caller (`wikimedia()` below) — never used for a Tier-1 dated event. */
async function wikimediaTitleSearch(query: string): Promise<WikimediaCandidate[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
      + `&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=5`
      + `&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1200&origin=*`;
    const res = await fetch(url, { headers: { 'user-agent': 'SBDaymaker-ingest/1.0' } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const pages = json?.query?.pages ? Object.values(json.query.pages) : [];
    return (pages as any[])
      .map(parseWikimediaPage)
      .filter((c): c is Omit<WikimediaCandidate, 'distanceM'> => c != null);
  } catch { return []; }
}

/** Orchestrator: geosearch when the candidate has lat/lng (works at any tier);
 *  title-search fallback only for places (never a Tier-1 event with no coords — §4.1).
 *  Both modes route through the same gate + scorer (§4.2) before a pick is returned. */
async function wikimedia(
  c: { title: string; neighborhood?: string; lat?: number; lng?: number; tier?: number },
  query: string,
): Promise<ImageOption | null> {
  let cands: WikimediaCandidate[];
  if (c.lat != null && c.lng != null) {
    cands = await wikimediaGeosearch(c.lat, c.lng);
  } else if (c.tier === 1) {
    return null;
  } else {
    cands = await wikimediaTitleSearch(query);
  }
  const best = pickBestWikimedia(cands, { title: c.title, neighborhood: c.neighborhood });
  return best ? toWikimediaOption(best) : null;
}

/** Google Place Photo (New): Place Details(photos) -> Place Photo media URL.
 *  Calls `onCall()` once per billable request so the caller can enforce the cap. */
async function googlePhoto(placeId: string, onCall: () => void): Promise<ImageOption | null> {
  if (!GOOGLE_KEY) return null;
  try {
    onCall(); // Place Details
    const detRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'photos' },
    });
    if (!detRes.ok) {
      console.log(`  [images] googlePhoto details ${detRes.status} for ${placeId}: ${(await detRes.text()).slice(0, 600)}`);
      return null;
    }
    const det: any = await detRes.json();
    const photo = det?.photos?.[0];
    if (!photo?.name) {
      console.log(`  [images] googlePhoto: no photos[] for ${placeId}`);
      return null;
    }
    onCall(); // Place Photo media
    const medRes = await fetch(
      `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      { headers: { 'X-Goog-Api-Key': GOOGLE_KEY } },
    );
    if (!medRes.ok) {
      console.log(`  [images] googlePhoto media ${medRes.status} for ${placeId}: ${(await medRes.text()).slice(0, 600)}`);
      return null;
    }
    const med: any = await medRes.json();
    if (!med?.photoUri) return null;
    const attr = photo?.authorAttributions?.[0]?.displayName;
    return {
      url: med.photoUri, source: 'google', width: photo?.widthPx, height: photo?.heightPx,
      attribution: attr ? `${attr} (Google)` : 'Google',
    };
  } catch { return null; }
}

/** 2026-07-10 — distinguishes a CONFIRMED-gone photo from an ambiguous failure, so
 *  the refresh step can react to a real death immediately instead of waiting out a
 *  grace period on every failure. 'not_found' = Google's API itself says this exact
 *  photo resource no longer exists (a real HTTP 404 on the media endpoint) — the
 *  business removed the photo, Google's moderation pulled it, or the place itself
 *  is gone. Every other failure (rate limit, 5xx, network error, or an ambiguous
 *  403 that could just as easily mean an API-key/billing problem as a dead photo)
 *  is 'error' — NOT treated as confirmed dead, because reacting to those instantly
 *  risks a false-positive mass-reassignment (e.g. a billing hiccup would make many
 *  unrelated photos fail at once; that's a config problem to fix, not hundreds of
 *  venues suddenly needing new photos). */
export type GoogleRefreshResult =
  | { status: 'ok'; url: string }
  | { status: 'not_found' }
  | { status: 'error' };

/** Card Imagery Build Spec Phase 2 §5.5 — the compliant refresh step's own call:
 *  re-request a fresh Place Photo media URL for an ALREADY-KNOWN photo resource
 *  name (`venue_photos.stable_ref`). One billable call, no Place Details re-fetch —
 *  the whole point of persisting the stable resource name instead of just the URI. */
export async function refreshGoogleMediaUri(photoResourceName: string): Promise<GoogleRefreshResult> {
  if (!GOOGLE_KEY) return { status: 'error' };
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${photoResourceName}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      { headers: { 'X-Goog-Api-Key': GOOGLE_KEY } },
    );
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'error' };
    const json: any = await res.json();
    return json?.photoUri ? { status: 'ok', url: json.photoUri } : { status: 'error' };
  } catch { return { status: 'error' }; }
}

export interface PlaceSearchResult {
  placeId: string;
  lat: number;
  lng: number;
  name: string;
  formattedAddress: string;
}

/** Card Imagery Build Spec Phase 2 follow-up, 2026-07-10 — Jim's ask: find a
 *  venue's Google place_id automatically instead of a manual Place ID Finder
 *  lookup per venue. Text Search (New), field mask limited to
 *  id/location/displayName/formattedAddress — verified pricing: this field
 *  combination is Text Search PRO ($32/1,000, 5,000 free/month; `id` alone would
 *  be the free Essentials tier, but location + displayName both require Pro —
 *  Google bills the whole request at the highest SKU any requested field
 *  touches). At this feature's actual volume (one-off + occasional new-venue
 *  lookups, nowhere near thousands/month) this is realistically $0 forever.
 *  Returns only the FIRST (best) match — the caller shows it to a human for
 *  confirmation before writing anything, so a second-best result is never
 *  silently used. */
export async function searchPlaceByText(query: string): Promise<PlaceSearchResult | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.location,places.displayName,places.formattedAddress',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textQuery: query }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const place = json?.places?.[0];
    if (!place?.id || !place?.location) return null;
    return {
      placeId: place.id as string,
      lat: place.location.latitude as number,
      lng: place.location.longitude as number,
      name: (place.displayName?.text as string) ?? query,
      formattedAddress: (place.formattedAddress as string) ?? '',
    };
  } catch { return null; }
}

/** Card Imagery Build Spec Phase 2, place_id-lookup follow-up (2026-07-10) —
 *  when `searchPlaceByText` only geocodes a bare address back (no real business
 *  found — see `isWeakPlaceMatch` in lib/venuePool.ts), Nearby Search (New) at a
 *  tight radius around that exact point surfaces the real named POIs actually
 *  sitting there (verified live: a 60m search around a bare "40 E Anapamu St"
 *  geocode correctly surfaces "Santa Barbara Public Library" as its first
 *  result). Same field mask/pricing tier as Text Search Pro. Filters out any
 *  result that's ITSELF just an address echo, so the caller only ever sees
 *  genuinely-named candidates. Returns Google's own relevance ranking as-is
 *  (a human picks the right one, if any, in the review UI — this never
 *  auto-selects). */
export async function searchNearbyNamedPlaces(lat: number, lng: number, radiusMeters: number, limit = 5): Promise<PlaceSearchResult[]> {
  if (!GOOGLE_KEY) return [];
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.location,places.displayName,places.formattedAddress',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxResultCount: limit,
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters } },
      }),
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    const places = (json?.places ?? []) as any[];
    return places
      .filter((p) => p?.id && p?.location && p?.displayName?.text)
      .map((p) => ({
        placeId: p.id as string, lat: p.location.latitude as number, lng: p.location.longitude as number,
        name: p.displayName.text as string, formattedAddress: (p.formattedAddress as string) ?? '',
      }))
      .filter((p) => !/^\d/.test(p.name.trim())); // drop any candidate that's ALSO just an address echo
  } catch { return []; }
}

export interface GooglePhotoCandidate {
  stable_ref: string; // photo resource name — persisted verbatim as venue_photos.stable_ref
  preview_url: string;
  attribution: string | null;
  width?: number;
  height?: number;
}

/** Card Imagery Build Spec Phase 2 §5.3 — the cockpit's "Fetch candidates" action:
 *  up to `max` Google photos for a venue's place_id (1 free-tier Place Details call,
 *  then one billable Place Photo media call PER candidate preview — "batch the
 *  preview media calls" per the spec means fetch on demand per venue, not eagerly
 *  for every venue, not that a single fetch's own previews are batched down). Stops
 *  early if `hasBudget()` goes false mid-loop so a founder's click can never blow
 *  through the shared monthly cap. */
export async function fetchGooglePhotoCandidates(
  placeId: string,
  onCall: () => void,
  hasBudget: () => boolean,
  max = 10,
): Promise<GooglePhotoCandidate[]> {
  if (!GOOGLE_KEY || !hasBudget()) return [];
  try {
    onCall(); // Place Details — Essentials IDs Only SKU, $0/unlimited (verified Phase 1)
    const detRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'photos' },
    });
    if (!detRes.ok) return [];
    const det: any = await detRes.json();
    const photos = (det?.photos ?? []).slice(0, max);
    const out: GooglePhotoCandidate[] = [];
    for (const photo of photos) {
      if (!hasBudget()) break;
      if (!photo?.name) continue;
      onCall(); // Place Photo media — Enterprise SKU, billable
      const medRes = await fetch(
        `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
        { headers: { 'X-Goog-Api-Key': GOOGLE_KEY } },
      );
      if (!medRes.ok) continue;
      const med: any = await medRes.json();
      if (!med?.photoUri) continue;
      const attr = photo?.authorAttributions?.[0]?.displayName;
      out.push({
        stable_ref: photo.name as string, preview_url: med.photoUri as string,
        attribution: attr ? `${attr} (Google)` : 'Google',
        width: photo?.widthPx, height: photo?.heightPx,
      });
    }
    return out;
  } catch { return []; }
}

/** On-demand widening for the cockpit's "find more options" action (edition_build_spec
 *  §3.5 — "and lazily for candidates on demand"). Free, no Google — an operator
 *  clicking repeatedly should never risk the paid cap. Wikimedia only since Phase 3
 *  retired Pexels (§6.2); the cockpit's motif-tier alternates (if any) come from
 *  the registry directly, not this widening action. Merges with the caller's
 *  existing real options, deduped by URL, and re-appends the placeholder sentinel
 *  via rankOptions (never forking that logic). */
export async function findMoreOptions(query: string, existing: ImageOption[]): Promise<ImageOption[]> {
  const existingReal = existing.filter((o) => o.url);
  const seen = new Set(existingReal.map((o) => o.url));
  const fresh: ImageOption[] = [];
  // No candidate object here (this action is query-string-only, on demand) — always
  // title-search mode, gated exactly like the main resolver's fallback path.
  const wmBest = pickBestWikimedia(await wikimediaTitleSearch(query), { title: query });
  const wm = wmBest ? toWikimediaOption(wmBest) : null;
  if (wm && !seen.has(wm.url)) fresh.push(wm);
  return rankOptions([...existingReal, ...fresh]);
}

// ---- spend counter ----------------------------------------------------------
// Exported (Phase 2 §5.5) so the nightly venue-photo refresh step in ingest/run.ts
// shares this exact counter instead of a second, divergence-prone bookkeeping path
// — it's the same shared monthly cap the resolver above enforces.

export function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
}
export async function loadSpend(sb: SupabaseClient, month: string): Promise<{ google_calls: number; over_cap: number }> {
  const { data } = await sb.from('image_spend').select('google_calls, over_cap').eq('month', month).maybeSingle();
  return { google_calls: data?.google_calls ?? 0, over_cap: data?.over_cap ?? 0 };
}
export async function saveSpend(sb: SupabaseClient, month: string, google_calls: number, over_cap: number) {
  await sb.from('image_spend').upsert(
    { month, google_calls, over_cap, updated_at: new Date().toISOString() },
    { onConflict: 'month' },
  );
}
export { CAP };

/** W2.3 — cheap image_cache scan: per-url usage counts across the catalog. Seeds the
 *  per-batch dedupe so fresh resolutions steer away from already-popular photos (and
 *  spread evenly when a shared pool is exhausted). Read-only; cost-free. */
async function loadUrlCounts(sb: SupabaseClient): Promise<Map<string, number>> {
  const { data } = await sb.from('image_cache').select('photo_url').not('photo_url', 'is', null);
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const u = r.photo_url as string;
    if (u) counts.set(u, (counts.get(u) ?? 0) + 1);
  }
  return counts;
}

// ---- Phase 2 §5 — venue registry + photo pools -----------------------------

export interface LoadedVenue {
  id: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  name_patterns: string[];
}

/** Batch-load every active venue + its approved photo pool (ordered) once per run —
 *  same shape as the image_cache/url-count batch loads above. Cheap: ~dozens of
 *  venues, a few hundred pool rows at most. Exported (2026-07-10 venue-pool-beats-
 *  Tier-1-default fix) so `ingest/run.ts`'s no-network Tier-1 backfill fast path can
 *  check for a pool match the same way the live resolver does, instead of a second,
 *  divergence-prone lookup. */
export async function loadVenuePools(sb: SupabaseClient): Promise<{
  byId: Map<string, LoadedVenue>;
  byPlaceId: Map<string, LoadedVenue>;
  poolsByVenueId: Map<string, PoolPhoto[]>;
}> {
  const byId = new Map<string, LoadedVenue>();
  const byPlaceId = new Map<string, LoadedVenue>();
  const poolsByVenueId = new Map<string, PoolPhoto[]>();

  const { data: venueRows } = await sb
    .from('venues')
    .select('id, place_id, lat, lng, radius_m, name_patterns')
    .eq('status', 'active');
  for (const v of venueRows ?? []) {
    const venue: LoadedVenue = {
      id: v.id as string,
      place_id: (v.place_id as string) ?? null,
      lat: (v.lat as number) ?? null,
      lng: (v.lng as number) ?? null,
      radius_m: (v.radius_m as number) ?? 150,
      name_patterns: (v.name_patterns as string[]) ?? [],
    };
    byId.set(venue.id, venue);
    if (venue.place_id) byPlaceId.set(venue.place_id, venue);
  }

  if (byId.size) {
    const { data: photoRows } = await sb
      .from('venue_photos')
      .select('venue_id, source, serving_url, attribution, sort_order')
      .eq('approved', true)
      .order('sort_order', { ascending: true });
    for (const p of photoRows ?? []) {
      if (!p.serving_url) continue; // an approved row should always have one; never render null
      const list = poolsByVenueId.get(p.venue_id as string) ?? [];
      list.push({ url: p.serving_url as string, source: p.source as PoolPhoto['source'], attribution: (p.attribution as string) ?? null });
      poolsByVenueId.set(p.venue_id as string, list);
    }
  }
  return { byId, byPlaceId, poolsByVenueId };
}

/** Card Imagery Build Spec Phase 2 §5.2 — "exact place_id match auto-attaches;
 *  fuzzy matches queue for review." A candidate that already carries a venue_id
 *  (an already-landed thing whose fuzzy match a founder approved in the cockpit)
 *  keeps it; otherwise an exact place_id hit against the loaded registry attaches
 *  one fresh. No fuzzy/proximity guessing here — that's the cockpit's job.
 *  Exported alongside `loadVenuePools` for the same reason. */
export function matchVenueForCandidate(
  c: Pick<Candidate, 'venue_id' | 'place_id'>,
  byId: Map<string, LoadedVenue>,
  byPlaceId: Map<string, LoadedVenue>,
): LoadedVenue | null {
  if (c.venue_id && byId.has(c.venue_id)) return byId.get(c.venue_id)!;
  if (c.place_id && byPlaceId.has(c.place_id)) return byPlaceId.get(c.place_id)!;
  return null;
}

// ---- the resolver ----------------------------------------------------------

export async function resolveImages(
  cands: Candidate[],
  sb: SupabaseClient,
  opts: { force?: boolean } = {},
): Promise<{ cands: Candidate[]; stats: ResolveStats }> {
  const stats: ResolveStats = {
    resolved: 0, free: 0, google: 0, motif: 0, placeholder: 0, overCap: 0,
    rejectedQuality: 0, rejectedRelevance: 0,
  };
  if (!cands.length) return { cands, stats };

  const month = monthKey();
  const spend = await loadSpend(sb, month);
  let calls = spend.google_calls;

  // Batch-load the cache for every key up front.
  const keys = cands.map(cacheKey);
  const { data: cacheRows } = await sb
    .from('image_cache')
    .select('place_key, photo_url, photo_source, photo_options, attribution')
    .in('place_key', [...new Set(keys)]);
  const cache = new Map((cacheRows ?? []).map((r) => [r.place_key as string, r]));

  // W2.3 per-batch dedupe: per-url usage counts (this run + the existing catalog) so
  // fresh picks prefer the least-used photo and shared pools spread evenly.
  const used = await loadUrlCounts(sb);
  const bump = (u: string) => used.set(u, (used.get(u) ?? 0) + 1);

  // Phase 2 §5.4 — active venues + their approved photo pools, batch-loaded once.
  const { byId: venuesById, byPlaceId: venuesByPlaceId, poolsByVenueId } = await loadVenuePools(sb);
  const today = sbDay(Date.now());

  const out: Candidate[] = [];
  // Freshly-resolved rows whose auto-pick still needs the Part B relevance guard
  // before it can be finalized/persisted — cache hits skip straight to `out` above
  // (once vetted, always vetted; re-checking every run would just burn tokens).
  // `skipRelevance` (Phase 1 §4.4 / Phase 2 §5.4): a marquee-venue pin or a venue-pool
  // pick is a founder-approved choice, not an auto-pick — the vision guard exists to
  // catch a WRONG auto-match, so it has nothing to check here.
  const pending: { c: Candidate; key: string; options: ImageOption[]; skipRelevance?: boolean; poolMatched: boolean; marqueeKey: string | null; venue_id?: string }[] = [];

  for (const c of cands) {
    const key = cacheKey(c);
    const cached = cache.get(key);
    // Phase 2 §5.2 — auto-attach on an exact place_id match only; a candidate that
    // already carries venue_id (a founder-approved fuzzy match from a prior cockpit
    // review) keeps it. Computed BEFORE the cache-hit branch below: venue_id is a
    // structural thing-attribute, independent of the place-level photo cache.
    const matchedVenue = matchVenueForCandidate(c, venuesById, venuesByPlaceId);
    const matchedPool = matchedVenue ? poolsByVenueId.get(matchedVenue.id) : undefined;
    const hasPoolOverride = !!(matchedPool && matchedPool.length > 0);
    // Phase 1 §4.4 — landmark match, computed once up front so BOTH the cache-hit
    // fast path below and the fresh-gather path (and Phase 3's motif assignment,
    // either way) share the same result instead of two divergent lookups.
    const marquee = matchMarqueeVenue(c);

    if (!opts.force && !hasPoolOverride && cached && cached.photo_source && cached.photo_source !== 'placeholder') {
      // Phase 0 §3.1.2 / Phase 3 §6.2: a cached PLACE-level real photo still isn't
      // shown on a Tier-1 event — e.g. a second same-venue event landing after the
      // first already cached a real find; it gets its own motif/big-type instead.
      // The cache itself is untouched (still holds the real place-level resolution
      // for a future non-event candidate).
      const cacheDisplay = eventDefaultsToNoPhoto(c)
        ? { url: undefined, source: 'motif' as PhotoSource, ...assignVisual(c, marquee?.key) }
        : { url: cached.photo_url ?? undefined, source: cached.photo_source as PhotoSource };
      if (cacheDisplay.url) bump(cacheDisplay.url);
      out.push({ ...c, photo_url: cacheDisplay.url, photo_source: cacheDisplay.source,
        photo_options: (cached.photo_options as ImageOption[]) ?? [],
        photo_attribution: cacheDisplay.url ? ((cached.attribution as string) ?? undefined) : undefined,
        ...('visual_kind' in cacheDisplay ? { visual_kind: cacheDisplay.visual_kind, visual_key: cacheDisplay.visual_key ?? undefined, visual_seed: cacheDisplay.visual_seed } : {}),
        ...(matchedVenue ? { venue_id: matchedVenue.id } : {}) });
      stats.resolved++;
      continue;
    }

    // Gather alternates first (the picker arrows through them). W2.3: civic meetings
    // skip the network entirely — a neutral placeholder beats a misleading stock
    // photo (found stays empty → rankOptions yields the placeholder).
    const found: ImageOption[] = [];
    let skipRelevance = false;
    if (!isCivicImage(c)) {
      // Phase 2 §5.4 — DB venue pool (priority 2, "venue pool"), checked before the
      // Phase 1 marquee file-pin: once a venue has real approved photos (curated via
      // the cockpit's Venues tab), this is the live mechanism; the marquee file-pin
      // below is the pre-Phase-2 fallback for a venue that's matched but has no
      // approved pool yet (in practice a no-op today — every marqueeVenues.ts entry
      // ships with pinnedPhoto empty, per the Phase 1 ledger note).
      if (hasPoolOverride) {
        const idx = pickFromPool(c.id, today, matchedPool!.length);
        const picked = matchedPool![idx];
        found.push({ url: picked.url, source: picked.source, attribution: picked.attribution ?? undefined });
        skipRelevance = true;
      } else {
      // Phase 1 §4.4 — marquee-venue inheritance. A match with no pinnedPhoto yet (the
      // registry ships empty; Jim pins later) is a no-op — falls through unchanged.
      const pin = marquee?.pinnedPhoto;
      if (pin) {
        found.push({ url: pin.url, source: pin.source, attribution: pin.attribution });
        skipRelevance = true;
      } else {
        const q = imageQuery(c);
        // Phase 1 §4.5 — direct Google for food/drink venues, tried BEFORE Wikimedia
        // (priority 3, ahead of gated Wikimedia at priority 4). A hit here IS the
        // found real photo: no point also spending free-tier quota confirming it.
        const isFoodVenue = isDirectGoogleFoodCandidate(c) && !!c.place_id;
        if (isFoodVenue && GOOGLE_KEY) {
          if (calls < CAP) {
            const g = await googlePhoto(c.place_id!, () => { calls++; });
            if (g) { if (meetsQualityBar(g)) found.push(g); else stats.rejectedQuality++; }
          } else {
            stats.overCap++;
          }
        }
        if (!found.length) {
          // §4.1/§4.2 — geosearch-gated when the candidate has lat/lng, else a
          // title-search fallback for places only; already gated internally, so no
          // meetsQualityBar() re-check here (that's the generic 960px bar; Wikimedia's
          // own 800px + aspect/blocklist/MIME gate is the authoritative one for it).
          const wm = await wikimedia(c, q);
          if (wm) found.push(wm);
          // Paid fallback — only when every free tier GENUINELY missed.
          // Phase 0 §3.1.2: never spend a paid call on a Tier-1 event — its auto-pick is
          // forced to a motif/big-type below regardless, so a Google call here would be
          // spent on a photo nobody ever sees. `!isFoodVenue`: a food venue already
          // tried this exact place_id above — retrying would just repeat the same
          // (empty) result and burn cap for nothing.
          if (!found.length && c.place_id && GOOGLE_KEY && !eventDefaultsToNoPhoto(c) && !isFoodVenue) {
            if (calls < CAP) {
              const g = await googlePhoto(c.place_id, () => { calls++; });
              if (g) { if (meetsQualityBar(g)) found.push(g); else stats.rejectedQuality++; }
            } else {
              stats.overCap++; // free missed, would have paid, but the cap is hit
            }
          }
        }
      }
      }
    }

    // W2.3: least-used option leads; repeats spread evenly when the pool is exhausted.
    const options = pickUnused(rankOptions(found), used);
    pending.push({ c, key, options, skipRelevance, poolMatched: hasPoolOverride, marqueeKey: marquee?.key ?? null, ...(matchedVenue ? { venue_id: matchedVenue.id } : {}) });
  }

  // Addendum Part B — one batched vision call over every fresh auto-pick with a real
  // image (never over the alternates; those are the cockpit's human-reviewed picker).
  // Phase 0 §3.1.2: Tier-1 events are excluded — their auto-pick is forced to the
  // placeholder below no matter what the vision check would say, so checking them
  // would just burn tokens on a verdict that's discarded.
  const relevanceCandidates = pending
    .filter((p) => p.options[0]?.url && !eventDefaultsToNoPhoto(p.c) && !p.skipRelevance)
    .map((p) => ({ id: p.c.id, title: p.c.title, category: p.c.happening_category, imageUrl: p.options[0].url }));
  const relevance = await checkImageRelevance(relevanceCandidates);

  for (const p of pending) {
    let chosen = p.options[0];
    if (chosen.url && !p.skipRelevance && relevance.get(p.c.id) === false) {
      // A wrong image is worse than a clean branded gradient — fall back, don't guess
      // at the next-ranked alternate (it wasn't vetted either).
      stats.rejectedRelevance++;
      chosen = { url: '', source: 'placeholder' };
    }

    // Persist the per-PLACE resolution so we never re-fetch/re-pay/re-check — this is
    // what was actually FOUND for the place, independent of whether today's candidate
    // is allowed to display it. Keeps a later non-event candidate at the same place
    // (place_key) from silently inheriting a Tier-1 event's forced placeholder.
    await sb.from('image_cache').upsert({
      place_key: p.key,
      photo_url: chosen.url || null,
      photo_source: chosen.source,
      photo_options: p.options,
      attribution: chosen.attribution ?? null,
      resolved_at: new Date().toISOString(),
    }, { onConflict: 'place_key' });

    // Phase 0 §3.1.2: Tier-1 dated events default to no photo on the THING itself,
    // even when a real photo was found for the place — photo_options still carries
    // the real alternates below so the cockpit picker can hand-assign one per event.
    // 2026-07-10 exception (Jim's ask, after the Phase 3 backfill made visible that
    // ~80-100 events at his 18 curated venues were silently never showing the pool
    // photo he approved): a venue-POOL match (`poolMatched` — the Phase 2 DB
    // registry, not the Phase 1 marquee file-pin) now wins over the Tier-1 default,
    // matching the Build Spec §2 priority table verbatim ("Venue pool... any card
    // (place or dated event)", ranked above "Motif... all remaining dated events").
    // A non-pool Tier-1 pick (generic Wikimedia/Google) still defaults to no photo.
    // Phase 3 §6.2: every other miss (forced or genuine — including a relevance-
    // rejected pick, whose `chosen` is already the empty placeholder sentinel above)
    // gets a deterministic motif/big-type assignment instead of the bare gradient.
    const noPhoto = !chosen.url || (eventDefaultsToNoPhoto(p.c) && !p.poolMatched);
    const display: ImageOption & Partial<VisualAssignment> = noPhoto
      ? { url: '', source: 'motif', ...assignVisual(p.c, p.marqueeKey) }
      : chosen;

    if (!display.url) stats.motif++;
    else { if (display.source === 'google') stats.google++; else stats.free++; bump(display.url); }
    stats.resolved++;

    const resolved: Candidate = {
      ...p.c,
      photo_url: display.url || undefined,
      photo_source: display.source,
      ...(p.venue_id ? { venue_id: p.venue_id } : {}),
      photo_options: p.options,
      photo_attribution: display.url ? display.attribution : undefined,
      ...(display.visual_kind
        ? { visual_kind: display.visual_kind, visual_key: display.visual_key ?? undefined, visual_seed: display.visual_seed }
        : {}),
    };
    out.push(resolved);
  }

  await saveSpend(sb, month, calls, spend.over_cap + stats.overCap);
  return { cands: out, stats };
}
