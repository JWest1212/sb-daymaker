// lib/imagesServer.ts
//
// Images desk (cockpit Images tab, 2026-07-11), server-only data access for the
// backlog of published things with no real photo (photo_url null, or sitting on
// the placeholder gradient / a motif). Mirrors lib/venuesServer.ts's pattern:
// service-role reads, no auth check here (the route/page caller gates via
// getAdminUser()). One scan drives the whole desk; the client filters/pages.

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import { bestVenueMatch, type MatchableThing, type MatchableVenue } from "./venuePool";
import { dropRetiredPhotoOptions, STRONG_MATCH_SCORE, type PhotoOption } from "./review";

// Re-exported for the API routes that import it from here.
export { STRONG_MATCH_SCORE };

export interface ImagesVenueOption {
  id: string;
  display_name: string;
  approved_count: number;
}

export interface VenueSuggestion {
  venue_id: string;
  display_name: string;
  score: number;
  approved_count: number;
}

export interface ImagesDeskRow {
  id: string;
  title: string;
  address: string | null;
  neighborhood: string | null;
  happening_tier: number;
  starts_at: string | null;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  venue_id: string | null;
  /** Display name + approved-pool size of the already-attached venue (null/0 when
   *  unattached), an attached-but-empty-pool row stays in this queue, and the UI
   *  should say so instead of re-suggesting a venue it already has. */
  venue_name: string | null;
  venue_approved_count: number;
  photo_url: string | null;
  photo_source: string | null;
  photo_attribution: string | null;
  photo_options: PhotoOption[];
  /** Best fuzzy venue match for an UNattached row (score > 0), or null. Computed
   *  live like the Venues tab's proposals, never persisted. */
  suggestion: VenueSuggestion | null;
}

export interface ImagesDeskData {
  rows: ImagesDeskRow[];
  venues: ImagesVenueOption[];
  /** True when the scan hit MAX_SCAN, there are more imageless rows than one
   *  load returns; the UI should say "showing the first N" instead of implying
   *  the whole backlog is on screen. */
  scanCapped: boolean;
  /** Coverage stat: how many things are published at all, and how many of those
   *  lack a real photo (INCLUDING photo_ack-dismissed ones, the stat reports
   *  honest image coverage, the queue reports remaining work). */
  publishedTotal: number;
  noImageTotal: number;
}

// Same generous, documented bound as the venues scan, the UI pages through
// everything this returns rather than hard-slicing and hiding the rest.
const MAX_SCAN = 1000;

/** S1 (Today screen), the backlog's true count without the full desk payload
 *  (venues, photo options, fuzzy suggestions). Same photo_ack-filtered/
 *  fallback pattern as loadImagesDesk's scan, just a head-count instead of rows. */
export async function countImagesBacklog(): Promise<number> {
  const sb = getAdminSupabase();
  if (!sb) return 0;
  const base = () =>
    sb.from("things")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .or("photo_url.is.null,photo_source.in.(placeholder,motif)");
  const filtered = await base().eq("photo_ack", false);
  if (!filtered.error) return filtered.count ?? 0;
  const fallback = await base();
  return fallback.count ?? 0;
}

export async function loadImagesDesk(): Promise<ImagesDeskData> {
  const sb = getAdminSupabase();
  if (!sb) return { rows: [], venues: [], scanCapped: false, publishedTotal: 0, noImageTotal: 0 };

  // The imageless scan, photo_ack-filtered when the column exists. Before that
  // migration lands, fall back to the unfiltered scan (a dismissed item
  // reappearing is a far better failure than a convincingly empty queue).
  const scanThings = async () => {
    const base = () =>
      sb.from("things")
        .select("id, title, address, neighborhood, happening_tier, starts_at, place_id, lat, lng, venue_id, photo_url, photo_source, photo_attribution, photo_options")
        .eq("status", "published")
        .or("photo_url.is.null,photo_source.in.(placeholder,motif)")
        .limit(MAX_SCAN);
    const filtered = await base().eq("photo_ack", false);
    if (!filtered.error) return filtered;
    console.warn("[images] photo_ack filter unavailable (run the 20260711_images_desk migration):", filtered.error.message);
    return base();
  };

  const [thingsRes, venuesRes, photosRes, pubCountRes, noImgCountRes] = await Promise.all([
    scanThings(),
    sb.from("venues")
      .select("id, display_name, place_id, lat, lng, radius_m, name_patterns")
      .eq("status", "active")
      .order("display_name", { ascending: true }),
    sb.from("venue_photos")
      .select("venue_id")
      .eq("approved", true),
    sb.from("things")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    sb.from("things")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .or("photo_url.is.null,photo_source.in.(placeholder,motif)"),
  ]);

  // A missing photo_ack column (migration not applied yet) fails the scan, // surface it instead of rendering a convincingly empty queue.
  if (thingsRes.error) console.error("[images] scan failed:", thingsRes.error.message);

  const approvedCounts = new Map<string, number>();
  for (const p of photosRes.data ?? []) {
    const id = p.venue_id as string;
    approvedCounts.set(id, (approvedCounts.get(id) ?? 0) + 1);
  }

  const venueRows = venuesRes.data ?? [];
  const venues: ImagesVenueOption[] = venueRows.map((v) => ({
    id: v.id as string,
    display_name: v.display_name as string,
    approved_count: approvedCounts.get(v.id as string) ?? 0,
  }));
  const venueById = new Map(venues.map((v) => [v.id, v]));

  const matchableVenues: MatchableVenue[] = venueRows.map((v) => ({
    id: v.id as string, place_id: (v.place_id as string) ?? null,
    lat: (v.lat as number) ?? null, lng: (v.lng as number) ?? null,
    radius_m: (v.radius_m as number) ?? 150, name_patterns: (v.name_patterns as string[]) ?? [],
  }));

  const rows: ImagesDeskRow[] = (thingsRes.data ?? []).map((t) => {
    const venue_id = (t.venue_id as string) ?? null;
    const attached = venue_id ? venueById.get(venue_id) : undefined;

    let suggestion: VenueSuggestion | null = null;
    if (!venue_id) {
      const thing: MatchableThing = {
        title: t.title as string, address: (t.address as string) ?? null,
        lat: (t.lat as number) ?? null, lng: (t.lng as number) ?? null,
        place_id: (t.place_id as string) ?? null,
      };
      const best = bestVenueMatch(thing, matchableVenues);
      const v = best ? venueById.get(best.venue.id) : undefined;
      if (best && v) {
        suggestion = { venue_id: v.id, display_name: v.display_name, score: best.score, approved_count: v.approved_count };
      }
    }

    return {
      id: t.id as string,
      title: t.title as string,
      address: (t.address as string) ?? null,
      neighborhood: (t.neighborhood as string) ?? null,
      happening_tier: Number(t.happening_tier),
      starts_at: (t.starts_at as string) ?? null,
      place_id: (t.place_id as string) ?? null,
      lat: (t.lat as number) ?? null,
      lng: (t.lng as number) ?? null,
      venue_id,
      venue_name: attached?.display_name ?? null,
      venue_approved_count: attached?.approved_count ?? 0,
      photo_url: (t.photo_url as string) ?? null,
      photo_source: (t.photo_source as string) ?? null,
      photo_attribution: (t.photo_attribution as string) ?? null,
      photo_options: dropRetiredPhotoOptions((t.photo_options as PhotoOption[]) ?? []),
      suggestion,
    };
  });

  // Soonest-first, T1 on top, same order as the venues no-match catcher, so the
  // items whose cards the public sees next get imagery first.
  const sortKey = (r: ImagesDeskRow): [number, string] => {
    if (r.happening_tier === 1 && r.starts_at) return [0, r.starts_at];
    if (r.happening_tier === 1) return [1, r.title.toLowerCase()];
    return [2, r.title.toLowerCase()];
  };
  rows.sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    return ka[0] !== kb[0] ? ka[0] - kb[0] : ka[1].localeCompare(kb[1]);
  });

  return {
    rows, venues, scanCapped: (thingsRes.data ?? []).length >= MAX_SCAN,
    publishedTotal: pubCountRes.count ?? 0,
    noImageTotal: noImgCountRes.count ?? 0,
  };
}
