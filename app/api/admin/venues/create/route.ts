import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { createVenue } from "@/lib/venuesServer";

export const dynamic = "force-dynamic";

// POST { display_name, place_id?, lat?, lng?, from_thing_id? } -> shares
// lib/venuesServer.ts's createVenue() with the catalog's own auto-create-venue
// flow so every creation path produces the same key-slugging/collision
// handling. `from_thing_id` (Phase 6, V-3 "Create venue from here") attaches
// that thing in the same request; omitted (Phase 7, V-11 "New venue" in the
// Venues grid header) it just creates a bare venue with nothing attached yet.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as {
    display_name?: string; place_id?: string | null; lat?: number | null; lng?: number | null; from_thing_id?: string;
  };
  if (!body.display_name?.trim()) return NextResponse.json({ error: "display_name required" }, { status: 400 });

  let venue;
  try {
    venue = await createVenue(sb, {
      display_name: body.display_name.trim(),
      place_id: body.place_id ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      dedupeSeed: body.from_thing_id,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "venue creation failed" }, { status: 500 });
  }

  if (body.from_thing_id) {
    const { error } = await sb.from("things").update({ venue_id: venue.id }).eq("id", body.from_thing_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: body.from_thing_id, action: "venue_created_from_catcher", actor: "founder",
      payload: { venue_id: venue.id, key: venue.key },
    });
    revalidatePublic();
  } else {
    await sb.from("audit_log").insert({
      entity_type: "venue", entity_id: venue.id, action: "venue_created", actor: "founder", payload: { key: venue.key },
    });
  }

  return NextResponse.json({ ok: true, venue });
}
