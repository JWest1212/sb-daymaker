// lib/venuesServer.ts
//
// Card Imagery Build Spec Phase 2 §5.3 — server-only data access for the cockpit's
// Venues tab. Mirrors lib/reviewServer.ts / lib/heroServer.ts's pattern: service-role
// reads, no auth check here (the route/page caller gates via getAdminUser()).

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "./supabaseAdmin";
import { bestVenueMatch, slugifyVenueKey, type MatchableThing, type MatchableVenue } from "./venuePool";

export interface ApprovedPhoto {
  id: string;
  source: string;
  serving_url: string | null;
  attribution: string | null;
  sort_order: number;
}

export interface CandidatePhoto {
  id: string;
  source: string;
  serving_url: string | null;
  attribution: string | null;
}

export interface VenueRow {
  id: string;
  key: string;
  display_name: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  name_patterns: string[];
  attachedCount: number;
  approvedPhotos: ApprovedPhoto[];
  candidatePhotos: CandidatePhoto[];
}

export interface MatchProposal {
  thing_id: string;
  title: string;
  address: string | null;
  happening_tier: number;
  venue_id: string;
  venue_key: string;
  venue_display_name: string;
  score: number;
}

export interface ArchivedVenue {
  id: string;
  key: string;
  display_name: string;
}

/** Phase 6 (V-5) — a low-confidence guess surfaced ONLY for a no-match-catcher
 *  row: bestVenueMatch scored it above zero, but it didn't qualify for the main
 *  "Matches to review" pane (no address, so it was never in that scan). */
export interface WeakGuess {
  venue_id: string;
  venue_display_name: string;
  score: number;
}

/** Phase 6 (V-1) — an unattached, un-dismissed thing that either has no address
 *  (never scored against the venue registry at all) or scored zero against
 *  every active venue. Surfaced so it doesn't just silently sit on a motif. */
export interface NoMatchThing {
  id: string;
  title: string;
  address: string | null;
  happening_tier: number;
  starts_at: string | null;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  weakGuess?: WeakGuess;
}

export interface VenuesData {
  venues: VenueRow[];
  matches: MatchProposal[];
  /** 2026-07-10 addendum: archived venues, so an accidental archive is recoverable
   *  (the editor's "Archive venue" button has no separate confirm step). */
  archivedVenues: ArchivedVenue[];
  /** Phase 6 (V-1) — the no-match catcher, all tiers, sorted soonest-first with
   *  T1 on top (lib/venuesServer.ts's own sort, not user-configurable). */
  noMatchCatcher: NoMatchThing[];
}

const MAX_MATCHES_PER_THING = 1; // surface only the single best-scoring venue per thing
const MAX_MATCH_PROPOSALS = 200; // a display cap — the scoring pass itself no longer breaks early at this count (Phase 6 fix: the venues-audit flagged the old early-break as a silent scan truncation, not just a display cap)
// Phase 6 — a generous, documented bound on the unattached-candidate scan (matches
// + catcher combined), not a silent truncation: the UI pages through everything
// this returns rather than hard-slicing and hiding the rest.
const MAX_UNATTACHED_SCAN = 1000;

export async function loadVenuesData(): Promise<VenuesData> {
  const sb = getAdminSupabase();
  if (!sb) return { venues: [], matches: [], archivedVenues: [], noMatchCatcher: [] };

  const [venuesRes, photosRes, attachedRes, unmatchedRes, archivedRes] = await Promise.all([
    sb.from("venues")
      .select("id, key, display_name, place_id, lat, lng, radius_m, name_patterns")
      .eq("status", "active")
      .order("display_name", { ascending: true }),
    sb.from("venue_photos")
      .select("id, venue_id, source, serving_url, attribution, approved, sort_order")
      .order("sort_order", { ascending: true }),
    sb.from("things")
      .select("venue_id")
      .not("venue_id", "is", null)
      .in("status", ["published", "needs_review"]),
    sb.from("things")
      .select("id, title, address, lat, lng, place_id, happening_tier, starts_at")
      .is("venue_id", null)
      .in("status", ["published", "needs_review"])
      .eq("no_venue_ack", false)
      .limit(MAX_UNATTACHED_SCAN),
    sb.from("venues")
      .select("id, key, display_name")
      .eq("status", "archived")
      .order("display_name", { ascending: true }),
  ]);

  const attachedCounts = new Map<string, number>();
  for (const t of attachedRes.data ?? []) {
    const id = t.venue_id as string;
    attachedCounts.set(id, (attachedCounts.get(id) ?? 0) + 1);
  }

  const photosByVenue = new Map<string, { approved: ApprovedPhoto[]; candidates: CandidatePhoto[] }>();
  for (const p of photosRes.data ?? []) {
    const vid = p.venue_id as string;
    if (!photosByVenue.has(vid)) photosByVenue.set(vid, { approved: [], candidates: [] });
    const bucket = photosByVenue.get(vid)!;
    if (p.approved) {
      bucket.approved.push({
        id: p.id as string, source: p.source as string,
        serving_url: (p.serving_url as string) ?? null, attribution: (p.attribution as string) ?? null,
        sort_order: (p.sort_order as number) ?? 0,
      });
    } else {
      bucket.candidates.push({
        id: p.id as string, source: p.source as string,
        serving_url: (p.serving_url as string) ?? null, attribution: (p.attribution as string) ?? null,
      });
    }
  }

  const venueRows = venuesRes.data ?? [];
  const venues: VenueRow[] = venueRows.map((v) => {
    const bucket = photosByVenue.get(v.id as string);
    return {
      id: v.id as string, key: v.key as string, display_name: v.display_name as string,
      place_id: (v.place_id as string) ?? null, lat: (v.lat as number) ?? null, lng: (v.lng as number) ?? null,
      radius_m: (v.radius_m as number) ?? 150, name_patterns: (v.name_patterns as string[]) ?? [],
      attachedCount: attachedCounts.get(v.id as string) ?? 0,
      approvedPhotos: bucket?.approved ?? [],
      candidatePhotos: bucket?.candidates ?? [],
    };
  });

  // Fuzzy matches to review: the single best-scoring venue for every unattached
  // thing, computed live (no persisted queue — see the ledger's judgment-call note:
  // the additive-only Phase 2 DDL has no rejection-tracking table, so "reject" is a
  // client-side dismiss for this render, not a durable write).
  const matchableVenues: MatchableVenue[] = venueRows.map((v) => ({
    id: v.id as string, place_id: (v.place_id as string) ?? null,
    lat: (v.lat as number) ?? null, lng: (v.lng as number) ?? null,
    radius_m: (v.radius_m as number) ?? 150, name_patterns: (v.name_patterns as string[]) ?? [],
  }));
  const venueById = new Map(venueRows.map((v) => [v.id as string, v]));

  // Phase 6 (V-1): one scan drives BOTH the existing "matches to review" pane AND
  // the new no-match catcher, so a thing is never silently dropped between the
  // two — every unattached, un-acked candidate lands in exactly one of them.
  // Addressed + scores > 0 -> matches (unchanged, existing pane). Everything else
  // (no address at all, OR addressed but scores zero against every active venue)
  // -> the catcher, carrying a weakGuess when bestVenueMatch still found something
  // (only possible for the no-address case — a zero score IS "nothing at all").
  const matches: MatchProposal[] = [];
  const noMatchCatcher: NoMatchThing[] = [];
  for (const t of unmatchedRes.data ?? []) {
    const address = (t.address as string) ?? null;
    const thing: MatchableThing = {
      title: t.title as string, address,
      lat: (t.lat as number) ?? null, lng: (t.lng as number) ?? null,
      place_id: (t.place_id as string) ?? null,
    };
    const best = bestVenueMatch(thing, matchableVenues);
    const venue = best ? venueById.get(best.venue.id) : undefined;

    if (address != null && best && venue) {
      for (let i = 0; i < MAX_MATCHES_PER_THING; i++) {
        matches.push({
          thing_id: t.id as string, title: t.title as string, address,
          happening_tier: Number(t.happening_tier), venue_id: best.venue.id,
          venue_key: venue.key as string, venue_display_name: venue.display_name as string,
          score: best.score,
        });
      }
    } else {
      noMatchCatcher.push({
        id: t.id as string, title: t.title as string, address,
        happening_tier: Number(t.happening_tier), starts_at: (t.starts_at as string) ?? null,
        place_id: (t.place_id as string) ?? null, lat: (t.lat as number) ?? null, lng: (t.lng as number) ?? null,
        ...(best && venue ? { weakGuess: { venue_id: best.venue.id, venue_display_name: venue.display_name as string, score: best.score } } : {}),
      });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  const matchesCapped = matches.slice(0, MAX_MATCH_PROPOSALS);

  // Soonest-first, T1 on top: dated T1 by starts_at ascending, then T1-without-a-
  // start-time, then T2/T3 alphabetical.
  const catcherSortKey = (t: NoMatchThing): [number, string] => {
    if (t.happening_tier === 1 && t.starts_at) return [0, t.starts_at];
    if (t.happening_tier === 1) return [1, t.title.toLowerCase()];
    return [2, t.title.toLowerCase()];
  };
  noMatchCatcher.sort((a, b) => {
    const ka = catcherSortKey(a), kb = catcherSortKey(b);
    return ka[0] !== kb[0] ? ka[0] - kb[0] : ka[1].localeCompare(kb[1]);
  });

  const archivedVenues: ArchivedVenue[] = (archivedRes.data ?? []).map((v) => ({
    id: v.id as string, key: v.key as string, display_name: v.display_name as string,
  }));

  return { venues, matches: matchesCapped, archivedVenues, noMatchCatcher };
}

export interface CreatedVenue {
  id: string;
  key: string;
  display_name: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
}

/** Card Imagery Build Spec Phase 2 §5, factored out of the Live-catalog
 *  follow-up's inline auto-create-venue block (2026-07-10) so the no-match
 *  catcher's "Create venue from here" (Phase 6, V-3) shares the exact same
 *  key-slugging + collision handling instead of a second, divergence-prone
 *  copy. `dedupeSeed` (a thing_id, when the caller has one) keeps the
 *  collision-suffix deterministic the way the original inline version did;
 *  falls back to a short random suffix when omitted. */
export async function createVenue(
  sb: SupabaseClient,
  input: { display_name: string; place_id?: string | null; lat?: number | null; lng?: number | null; dedupeSeed?: string },
): Promise<CreatedVenue> {
  let key = slugifyVenueKey(input.display_name);
  const { data: collision } = await sb.from("venues").select("id").eq("key", key).maybeSingle();
  if (collision) {
    const suffix = input.dedupeSeed ? input.dedupeSeed.slice(0, 8) : Math.random().toString(36).slice(2, 8);
    key = `${key}-${suffix}`;
  }

  const { data: created, error } = await sb
    .from("venues")
    .insert({
      key, display_name: input.display_name,
      place_id: input.place_id ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      radius_m: 150,
    })
    .select("id, key, display_name, place_id, lat, lng")
    .single();
  if (error || !created) throw new Error(error?.message ?? "venue creation failed");

  return {
    id: created.id as string, key: created.key as string, display_name: created.display_name as string,
    place_id: (created.place_id as string) ?? null, lat: (created.lat as number) ?? null, lng: (created.lng as number) ?? null,
  };
}
