// lib/venueFetch.ts
//
// Card Imagery Build Spec Phase 2 §5.3 — the "fetch candidates for a venue" core,
// extracted so both the Venues tab's own route and the Live-catalog follow-up
// (2026-07-10) share ONE implementation instead of drifting. Server-only (service
// role writes to venue_photos + the shared image_spend cap counter).

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchGooglePhotoCandidates, wikimediaGeosearch, rankWikimediaCandidates,
  monthKey, loadSpend, saveSpend, CAP,
} from "@/ingest/images";

// Wikimedia is free and its URLs never expire, so it never touches the shared
// refresh cap; Google costs both a cap slot up front AND an ongoing nightly
// refresh once approved into a pool. Google auto-fires only when Wikimedia alone
// doesn't clear this bar; `includeGoogle: true` always forces it regardless
// (the "Fetch via Google" override button in both cockpit surfaces).
const WIKIMEDIA_SUFFICIENT_COUNT = 3;

export interface VenueFetchStats {
  count: number;
  wikimediaCount: number;
  googleFetched: boolean;
  googleCount: number;
}

/** Top-5 gated Wikimedia geosearch results (if the venue has lat/lng) + up to 10
 *  Google photos (if the venue has a place_id AND either `includeGoogle` is set or
 *  Wikimedia came up thin) — persisted as UNAPPROVED venue_photos rows, deduped on
 *  (venue_id, stable_ref) so a repeat fetch is safe to call but won't duplicate
 *  rows (Google's own photos[] is a fixed, unpaginated list — nothing new to find
 *  on a re-fetch unless Google's own listing changed). */
export async function fetchCandidatesForVenue(
  sb: SupabaseClient,
  venue: { id: string; display_name: string; place_id: string | null; lat: number | null; lng: number | null },
  includeGoogle: boolean,
): Promise<VenueFetchStats> {
  const rows: { venue_id: string; source: string; stable_ref: string; serving_url: string; attribution: string | null; approved: boolean }[] = [];

  let wikimediaCount = 0;
  if (venue.lat != null && venue.lng != null) {
    const wm = await wikimediaGeosearch(venue.lat, venue.lng);
    const ranked = rankWikimediaCandidates(wm, { title: venue.display_name }).slice(0, 5);
    wikimediaCount = ranked.length;
    for (const c of ranked) {
      rows.push({
        venue_id: venue.id, source: "wikimedia", stable_ref: c.title, serving_url: c.url,
        attribution: `${c.artist} · ${c.license} · Wikimedia Commons`, approved: false,
      });
    }
  }

  let googleFetched = false;
  let googleCount = 0;
  const shouldFetchGoogle = !!venue.place_id && (includeGoogle || wikimediaCount < WIKIMEDIA_SUFFICIENT_COUNT);
  if (shouldFetchGoogle) {
    googleFetched = true;
    const month = monthKey();
    const spend = await loadSpend(sb, month);
    let calls = spend.google_calls;
    const hasBudget = () => calls < CAP;
    const onCall = () => { calls++; };
    const google = await fetchGooglePhotoCandidates(venue.place_id as string, onCall, hasBudget, 10);
    await saveSpend(sb, month, calls, spend.over_cap);
    googleCount = google.length;
    for (const g of google) {
      rows.push({ venue_id: venue.id, source: "google", stable_ref: g.stable_ref, serving_url: g.preview_url, attribution: g.attribution, approved: false });
    }
  }

  if (rows.length) {
    await sb.from("venue_photos").upsert(rows, { onConflict: "venue_id,stable_ref", ignoreDuplicates: true });
  }

  return { count: rows.length, wikimediaCount, googleFetched, googleCount };
}
