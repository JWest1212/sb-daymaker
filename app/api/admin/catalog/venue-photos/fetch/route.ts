import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { fetchCandidatesForVenue } from "@/lib/venueFetch";
import { createVenue } from "@/lib/venuesServer";
import type { PhotoOption } from "@/lib/review";

export const dynamic = "force-dynamic";

// POST { thing_id, include_google?: boolean } -> Card Imagery Build Spec Phase 2,
// Live-catalog follow-up (Jim's ask, 2026-07-10, per his own confirmed design:
// "venue-backed, invisible to me" + "auto-create a dedicated venue"). Makes the
// Catalog tab's photo fetch a thin, thing-centric front end onto the SAME
// compliant venue/pool system the Venues tab uses — so a Google photo picked here
// still gets the 7-day refresh + dead-photo fallback + digest notification, rather
// than being stored as a raw, never-refreshed URL directly on the thing (the exact
// gap Phase 2 itself was built to close).
//
// Attachment logic, in order:
//   1. Thing already has venue_id -> use that venue (its existing pool, if any).
//   2. Thing has no venue_id but has a place_id that EXACTLY matches an existing
//      active venue's place_id -> attach to that venue (a deterministic dedup
//      check, not fuzzy matching — Jim explicitly declined guessing).
//   3. Otherwise -> auto-create a new venue seeded from the thing's own title/
//      place_id/lat/lng (whatever it has; a venue with neither still gets
//      created, it just can't fetch anything until one is added via the
//      inline place_id/lat/lng fields the picker also exposes).
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id, include_google } = (await req.json()) as { thing_id?: string; include_google?: boolean };
  if (!thing_id) return NextResponse.json({ error: "thing_id required" }, { status: 400 });

  const { data: thing, error: tErr } = await sb
    .from("things").select("id, title, place_id, lat, lng, venue_id").eq("id", thing_id).maybeSingle();
  if (tErr || !thing) return NextResponse.json({ error: tErr?.message ?? "thing not found" }, { status: 404 });

  type VenueRow = { id: string; display_name: string; place_id: string | null; lat: number | null; lng: number | null };
  let venue: VenueRow | null = null;
  let venueWasCreated = false;

  if (thing.venue_id) {
    const { data } = await sb.from("venues").select("id, display_name, place_id, lat, lng").eq("id", thing.venue_id as string).maybeSingle();
    venue = (data as VenueRow) ?? null;
  }

  if (!venue && thing.place_id) {
    const { data } = await sb.from("venues").select("id, display_name, place_id, lat, lng")
      .eq("place_id", thing.place_id as string).eq("status", "active").maybeSingle();
    if (data) {
      venue = data as VenueRow;
      await sb.from("things").update({ venue_id: venue.id }).eq("id", thing_id);
      await sb.from("audit_log").insert({
        entity_type: "thing", entity_id: thing_id, action: "venue_auto_attached", actor: "founder",
        payload: { venue_id: venue.id, reason: "exact place_id match" },
      });
    }
  }

  if (!venue) {
    const title = (thing.title as string) ?? "Untitled";
    let created;
    try {
      created = await createVenue(sb, {
        display_name: title,
        place_id: (thing.place_id as string) ?? null,
        lat: (thing.lat as number) ?? null,
        lng: (thing.lng as number) ?? null,
        dedupeSeed: thing_id as string,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "venue creation failed" }, { status: 500 });
    }
    venue = created;
    venueWasCreated = true;

    await sb.from("things").update({ venue_id: venue.id }).eq("id", thing_id);
    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: thing_id, action: "venue_auto_created", actor: "founder",
      payload: { venue_id: venue.id, key: created.key },
    });
  }

  const stats = await fetchCandidatesForVenue(sb, venue, !!include_google);

  // Return the venue's FULL current option set (approved pool first, then fresh
  // unapproved candidates) as PhotoOption[] — the catalog picker just merges this
  // into its existing single-photo cycle UI, same as "Try fetching a photo"
  // already does for free sources (no new grid UI needed).
  const { data: photoRows } = await sb
    .from("venue_photos").select("id, source, serving_url, attribution, approved, sort_order")
    .eq("venue_id", venue.id)
    .order("approved", { ascending: false })
    .order("sort_order", { ascending: true });
  const options: PhotoOption[] = (photoRows ?? [])
    .filter((p) => p.serving_url)
    .map((p) => ({
      url: p.serving_url as string, source: p.source as string,
      attribution: (p.attribution as string) ?? undefined, venuePhotoId: p.id as string,
    }));

  return NextResponse.json({
    ok: true, venue_id: venue.id, venue_created: venueWasCreated,
    venue_has_place_id: !!venue.place_id, venue_has_coords: venue.lat != null && venue.lng != null,
    options, ...stats,
  });
}
