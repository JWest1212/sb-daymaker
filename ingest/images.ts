// ingest/images.ts
//
// Image resolution (Doc 11 §7b/§7c). For each card, walk a waterfall and attach a
// REAL image plus ranked alternates for the cockpit picker — stop at the first hit:
//   0. image_cache (per place)  -> zero cost, never re-pay
//   1. Pexels        (free)
//   2. Wikimedia     (free)
//   3. Google Place Photo (PAID) -> only if free tiers miss, the card has a place_id,
//      and the persisted monthly counter is under the cap. Counts every Google call.
//   4. branded placeholder      -> ONLY if the cap is hit or no image exists anywhere.
//
// Cost control (audit flag B6): free-first + per-place caching keep real spend ≈ $0;
// the hard monthly cap is the runaway guard. We store the Google photoUri (a URL, not
// bytes) keyed by place so a place is never paid for twice.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Candidate, PhotoSource, HappeningCategory } from '../packages/shared/types';
import { classifyWeight } from './weight';

const CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1400); // ~$10 at $0.007/call
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;

export interface ImageOption {
  url: string;
  source: PhotoSource;
  attribution?: string;
}
export interface ResolveStats { resolved: number; free: number; google: number; placeholder: number; overCap: number; }

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

/** Rank found options and always append the placeholder as the final alternate. */
export function rankOptions(found: ImageOption[]): ImageOption[] {
  const order: PhotoSource[] = ['owned', 'pexels', 'wikimedia', 'google'];
  const real = found.filter((o) => o.url).sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source));
  return [...real, { url: '', source: 'placeholder' as const }];
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

// ---- network sources (isolated; each returns null on miss/error) -----------

/** Set when Pexels answers 429 (free tier: ~200 searches/hour). Once tripped, the
 *  resolver stops treating empty Pexels results as a genuine free-tier miss — so it
 *  will NOT fall through to paid Google for rows Pexels could cover for free later
 *  (the 2026-07-04 threshold-1 run burned 6 Google calls exactly this way). */
let pexelsRateLimited = false;
export function isPexelsRateLimited(): boolean { return pexelsRateLimited; }

/** Up to `n` Pexels results — the first is the pick, the rest are swap-able
 *  alternates for the cockpit picker. */
async function pexelsMany(query: string, n = 3): Promise<ImageOption[]> {
  if (!PEXELS_KEY || pexelsRateLimited) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${n}&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
    if (res.status === 429) {
      pexelsRateLimited = true;
      console.log('  [images] Pexels rate limit hit (429) — remaining rows resolve without Pexels; re-run in ~1 hour');
      return [];
    }
    if (!res.ok) return [];
    const json: any = await res.json();
    return (json?.photos ?? [])
      .filter((p: any) => p?.src?.large)
      .map((p: any) => ({ url: p.src.large, source: 'pexels' as const, attribution: `Photo by ${p.photographer} on Pexels` }));
  } catch { return []; }
}

async function wikimedia(query: string): Promise<ImageOption | null> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
      + `&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=3`
      + `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&origin=*`;
    const res = await fetch(url, { headers: { 'user-agent': 'SBDaymaker-ingest/1.0' } });
    if (!res.ok) return null;
    const json: any = await res.json();
    const pages = json?.query?.pages ? Object.values(json.query.pages) : [];
    for (const pg of pages as any[]) {
      const info = pg?.imageinfo?.[0];
      const u = info?.thumburl || info?.url;
      if (u && /\.(jpe?g|png|webp)$/i.test(u)) {
        const artist = info?.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '') ?? 'Wikimedia Commons';
        return { url: u, source: 'wikimedia', attribution: `${artist} (Wikimedia Commons)` };
      }
    }
    return null;
  } catch { return null; }
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
    if (!detRes.ok) return null;
    const det: any = await detRes.json();
    const photo = det?.photos?.[0];
    if (!photo?.name) return null;
    onCall(); // Place Photo media
    const medRes = await fetch(
      `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      { headers: { 'X-Goog-Api-Key': GOOGLE_KEY } },
    );
    if (!medRes.ok) return null;
    const med: any = await medRes.json();
    if (!med?.photoUri) return null;
    const attr = photo?.authorAttributions?.[0]?.displayName;
    return { url: med.photoUri, source: 'google', attribution: attr ? `${attr} (Google)` : 'Google' };
  } catch { return null; }
}

// ---- spend counter ---------------------------------------------------------

function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
}
async function loadSpend(sb: SupabaseClient, month: string): Promise<{ google_calls: number; over_cap: number }> {
  const { data } = await sb.from('image_spend').select('google_calls, over_cap').eq('month', month).maybeSingle();
  return { google_calls: data?.google_calls ?? 0, over_cap: data?.over_cap ?? 0 };
}
async function saveSpend(sb: SupabaseClient, month: string, google_calls: number, over_cap: number) {
  await sb.from('image_spend').upsert(
    { month, google_calls, over_cap, updated_at: new Date().toISOString() },
    { onConflict: 'month' },
  );
}

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

// ---- the resolver ----------------------------------------------------------

export async function resolveImages(
  cands: Candidate[],
  sb: SupabaseClient,
  opts: { force?: boolean } = {},
): Promise<{ cands: Candidate[]; stats: ResolveStats }> {
  const stats: ResolveStats = { resolved: 0, free: 0, google: 0, placeholder: 0, overCap: 0 };
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

  const out: Candidate[] = [];
  for (const c of cands) {
    const key = cacheKey(c);
    const cached = cache.get(key);
    if (!opts.force && cached && cached.photo_source && cached.photo_source !== 'placeholder') {
      if (cached.photo_url) bump(cached.photo_url as string);
      out.push({ ...c, photo_url: cached.photo_url ?? undefined, photo_source: cached.photo_source as PhotoSource,
        photo_options: (cached.photo_options as ImageOption[]) ?? [] });
      stats.resolved++;
      continue;
    }

    // Gather ALL free alternates first (the picker arrows through them). W2.3: civic
    // meetings skip the network entirely — a neutral placeholder beats a misleading
    // stock photo (found stays empty → rankOptions yields the placeholder).
    const found: ImageOption[] = [];
    if (!isCivicImage(c)) {
      const q = imageQuery(c);
      // 8 options (not 3): clusters of similar events (90+ library programs) share one
      // result pool — a deeper pool is what lets the dedupe actually spread them.
      found.push(...await pexelsMany(q, 8));
      const wm = await wikimedia(q); if (wm) found.push(wm);
      // Paid fallback — only when every free tier GENUINELY missed. A Pexels 429 is
      // not a miss: those rows resolve free on a later run, so don't pay Google now.
      if (!found.length && !pexelsRateLimited && c.place_id && GOOGLE_KEY) {
        if (calls < CAP) {
          const g = await googlePhoto(c.place_id, () => { calls++; });
          if (g) found.push(g);
        } else {
          stats.overCap++; // free missed, would have paid, but the cap is hit
        }
      }
    }

    // W2.3: least-used option leads; repeats spread evenly when the pool is exhausted.
    const options = pickUnused(rankOptions(found), used);
    const chosen = options[0];
    if (!chosen.url) stats.placeholder++;
    else { if (chosen.source === 'google') stats.google++; else stats.free++; bump(chosen.url); }
    stats.resolved++;

    const resolved: Candidate = {
      ...c,
      photo_url: chosen.url || undefined,
      photo_source: chosen.source,
      photo_options: options,
    };
    out.push(resolved);

    // Persist the per-place resolution so we never re-fetch/re-pay.
    await sb.from('image_cache').upsert({
      place_key: key,
      photo_url: chosen.url || null,
      photo_source: chosen.source,
      photo_options: options,
      attribution: chosen.attribution ?? null,
      resolved_at: new Date().toISOString(),
    }, { onConflict: 'place_key' });
  }

  await saveSpend(sb, month, calls, spend.over_cap + stats.overCap);
  return { cands: out, stats };
}
