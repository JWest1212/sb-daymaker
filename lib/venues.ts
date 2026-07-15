// lib/venues.ts
//
// Card Imagery Build Spec Phase 2 §5.4 — public-side venue photo pool read, for the
// feed's per-feed dedupe pass. Mirrors lib/things.ts's getPublishedThings(): the
// anon/publishable key, RLS-gated (public_read_venue_photos exposes only
// approved=true rows). Small dataset (a few hundred rows at most) — safe to fetch
// in full alongside the things fetch.

import { getSupabase } from "./supabase";
import type { PoolPhoto } from "./venuePool";

/** venue_id -> its approved photo pool, ordered by sort_order. Only venues with at
 *  least one approved photo appear (an empty/absent pool is simply not a key). */
export async function getVenuePhotoPools(): Promise<Record<string, PoolPhoto[]>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb
    .from("venue_photos")
    .select("venue_id, source, serving_url, attribution, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data) return {};

  const pools: Record<string, PoolPhoto[]> = {};
  for (const row of data) {
    if (!row.serving_url) continue;
    const venueId = row.venue_id as string;
    (pools[venueId] ??= []).push({
      url: row.serving_url as string,
      source: row.source as PoolPhoto["source"],
      attribution: (row.attribution as string) ?? null,
    });
  }
  return pools;
}

/** Home Rework spec §9.2/§18 — venue id -> display name, for header search's
 *  "Venue" group. RLS (public_read_venues) already restricts this to active rows. */
export async function getVenueNames(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.from("venues").select("id, display_name");
  if (error || !data) return {};

  const names: Record<string, string> = {};
  for (const row of data) names[row.id as string] = row.display_name as string;
  return names;
}

/** Occasion Tags spec §3 — the ids of founder-marked dog-friendly venues.
 *  lib/things.ts joins this in at read time (same pattern as `indoor` ->
 *  `rainy_day`, Doc 22 §2.2): a thing at one of these venues is stamped
 *  `dog_friendly` live, no stored tag, always in sync with the venue flag. */
export async function getDogFriendlyVenueIds(): Promise<Set<string>> {
  const sb = getSupabase();
  if (!sb) return new Set();
  const { data, error } = await sb.from("venues").select("id").eq("dog_friendly", true);
  if (error || !data) return new Set();
  return new Set(data.map((row) => row.id as string));
}
