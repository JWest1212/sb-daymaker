import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { searchPlaceByText, searchNearbyNamedPlaces } from "@/ingest/images";
import { isWeakPlaceMatch } from "@/lib/venuePool";

export const dynamic = "force-dynamic";

// A Nearby Search this tight only makes sense once we already have a precise
// geocoded point (from the address-only Text Search result itself) — wide enough
// to catch a POI sitting at the same street address, narrow enough not to pull in
// unrelated neighbors.
const NEARBY_RADIUS_M = 75;
const NEARBY_LIMIT = 5;

export interface PlaceCandidate {
  place_id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
}

export interface StrongMatch {
  venue_id: string;
  venue_key: string;
  venue_display_name: string;
  proposed_place_id: string;
  proposed_lat: number;
  proposed_lng: number;
  proposed_name: string;
  proposed_address: string;
}

export interface WeakMatch {
  venue_id: string;
  venue_key: string;
  venue_display_name: string;
  /** The bare-geocode result itself — still offered as a last-resort pick (it IS
   *  a real place_id, just not obviously a photographed business). */
  addressOnlyMatch: PlaceCandidate;
  /** Real named POIs found within NEARBY_RADIUS_M of that geocoded point, if any
   *  (e.g. "Santa Barbara Public Library" sitting at a venue named "40 E Anapamu
   *  St"). Empty when nothing better was found nearby. */
  nearbyCandidates: PlaceCandidate[];
}

export interface NoMatch {
  venue_id: string;
  venue_display_name: string;
}

function toCandidate(r: { placeId: string; lat: number; lng: number; name: string; formattedAddress: string }): PlaceCandidate {
  return { place_id: r.placeId, lat: r.lat, lng: r.lng, name: r.name, address: r.formattedAddress };
}

// POST { venue_id?: string, query?: string } -> Card Imagery Build Spec Phase 2
// follow-up, 2026-07-10. No `venue_id` -> bulk mode (every active venue missing a
// place_id, the Venues tab's own button). `venue_id` given -> single-venue mode
// (the Live-catalog "Look up automatically" button, or a "search again with my
// own text" retry on a weak match), operating on exactly that venue regardless
// of its current place_id state. `query` (only meaningful with `venue_id`) lets
// the caller override the auto-built "{display_name}, Santa Barbara, CA" search
// text — the editable-retry box for weak matches, so Jim can type the real name
// he already knows (e.g. "Santa Barbara Public Library") instead of the venue's
// own bare-address display_name.
//
// A "weak" match (searchPlaceByText geocoded a bare address back rather than
// finding a real business — see isWeakPlaceMatch) triggers a follow-up Nearby
// Search around that exact point, surfacing any real named POI actually sitting
// there. WRITES NOTHING in either case — every result (strong, weak, or a nearby
// candidate) is a proposal for the cockpit to show a human before anything is
// applied via the existing /api/admin/venues/edit route.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { venue_id, query } = (await req.json().catch(() => ({}))) as { venue_id?: string; query?: string };

  let venuesQuery = sb.from("venues").select("id, key, display_name").eq("status", "active");
  venuesQuery = venue_id ? venuesQuery.eq("id", venue_id) : venuesQuery.is("place_id", null);
  const { data: venues, error } = await venuesQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (venue_id && !venues?.length) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  const strongMatches: StrongMatch[] = [];
  const weakMatches: WeakMatch[] = [];
  const noMatches: NoMatch[] = [];

  for (const v of venues ?? []) {
    const displayName = v.display_name as string;
    const searchText = (venue_id && query?.trim()) ? query.trim() : `${displayName}, Santa Barbara, CA`;
    const result = await searchPlaceByText(searchText);
    if (!result) { noMatches.push({ venue_id: v.id as string, venue_display_name: displayName }); continue; }

    if (isWeakPlaceMatch(result.name)) {
      const nearby = await searchNearbyNamedPlaces(result.lat, result.lng, NEARBY_RADIUS_M, NEARBY_LIMIT);
      weakMatches.push({
        venue_id: v.id as string, venue_key: v.key as string, venue_display_name: displayName,
        addressOnlyMatch: toCandidate(result),
        nearbyCandidates: nearby.map(toCandidate),
      });
    } else {
      strongMatches.push({
        venue_id: v.id as string, venue_key: v.key as string, venue_display_name: displayName,
        proposed_place_id: result.placeId, proposed_lat: result.lat, proposed_lng: result.lng,
        proposed_name: result.name, proposed_address: result.formattedAddress,
      });
    }
  }

  return NextResponse.json({ ok: true, strongMatches, weakMatches, noMatches });
}
