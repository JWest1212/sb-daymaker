// lib/venuesServer.ts
//
// Card Imagery Build Spec Phase 2 §5.3 — server-only data access for the cockpit's
// Venues tab. Mirrors lib/reviewServer.ts / lib/heroServer.ts's pattern: service-role
// reads, no auth check here (the route/page caller gates via getAdminUser()).

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import { bestVenueMatch, type MatchableThing, type MatchableVenue } from "./venuePool";

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

export interface VenuesData {
  venues: VenueRow[];
  matches: MatchProposal[];
  /** 2026-07-10 addendum: archived venues, so an accidental archive is recoverable
   *  (the editor's "Archive venue" button has no separate confirm step). */
  archivedVenues: ArchivedVenue[];
}

const MAX_MATCHES_PER_THING = 1; // surface only the single best-scoring venue per thing
const MAX_MATCH_PROPOSALS = 200; // a generous cap on the review pane, not a silent truncation of the underlying scan

export async function loadVenuesData(): Promise<VenuesData> {
  const sb = getAdminSupabase();
  if (!sb) return { venues: [], matches: [], archivedVenues: [] };

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
      .select("id, title, address, lat, lng, place_id, happening_tier")
      .is("venue_id", null)
      .in("status", ["published", "needs_review"])
      .not("address", "is", null),
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

  const matches: MatchProposal[] = [];
  for (const t of unmatchedRes.data ?? []) {
    if (matches.length >= MAX_MATCH_PROPOSALS) break;
    const thing: MatchableThing = {
      title: t.title as string, address: (t.address as string) ?? null,
      lat: (t.lat as number) ?? null, lng: (t.lng as number) ?? null,
      place_id: (t.place_id as string) ?? null,
    };
    const best = bestVenueMatch(thing, matchableVenues);
    if (!best) continue;
    const venue = venueById.get(best.venue.id);
    if (!venue) continue;
    for (let i = 0; i < MAX_MATCHES_PER_THING; i++) {
      matches.push({
        thing_id: t.id as string, title: t.title as string, address: (t.address as string) ?? null,
        happening_tier: Number(t.happening_tier), venue_id: best.venue.id,
        venue_key: venue.key as string, venue_display_name: venue.display_name as string,
        score: best.score,
      });
    }
  }
  matches.sort((a, b) => b.score - a.score);

  const archivedVenues: ArchivedVenue[] = (archivedRes.data ?? []).map((v) => ({
    id: v.id as string, key: v.key as string, display_name: v.display_name as string,
  }));

  return { venues, matches, archivedVenues };
}
