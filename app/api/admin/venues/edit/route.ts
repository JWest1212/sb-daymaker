import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { venue_id, display_name?, radius_m?, name_patterns?, status?, place_id?,
// lat?, lng? } -> Card Imagery Build Spec Phase 2 §5.3 venue editor: rename, adjust
// radius, add name patterns, archive. 2026-07-10 addendum: place_id/lat/lng are
// editable too — several seeded venues (the address-cluster ones with neither) have
// no way to fetch ANY candidates without one of these set, and Google fetching
// specifically needs a place_id (Wikimedia only needs lat/lng). Send an empty
// string for place_id / null for lat or lng to clear it back out.
// Archiving (`status: "archived"`) drops the venue from public RLS reads
// (public_read_venues filters on status='active') and from the resolver/matcher's
// active-venues load — its already-attached things keep their venue_id and
// last-assigned photo, they just stop rotating/matching further.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as {
    venue_id?: string; display_name?: string; radius_m?: number; name_patterns?: string[];
    status?: "active" | "archived"; place_id?: string | null; lat?: number | null; lng?: number | null;
  };
  if (!body.venue_id) return NextResponse.json({ error: "venue_id required" }, { status: 400 });

  // updated_at is set by the trg_venues_updated trigger — no need to set it here.
  const patch: Record<string, unknown> = {};
  if (body.display_name !== undefined) patch.display_name = body.display_name;
  if (body.radius_m !== undefined) patch.radius_m = body.radius_m;
  if (body.name_patterns !== undefined) patch.name_patterns = body.name_patterns;
  if (body.status !== undefined) patch.status = body.status;
  if (body.place_id !== undefined) patch.place_id = body.place_id || null;
  if (body.lat !== undefined) patch.lat = body.lat;
  if (body.lng !== undefined) patch.lng = body.lng;

  const { error } = await sb.from("venues").update(patch).eq("id", body.venue_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "venue", entity_id: body.venue_id, action: "venue_edit", actor: "founder", payload: patch,
  });
  // V-16 — a corrected place_id/lat/lng should propagate promptly too, not just
  // an archive (an archived venue's things fall back to gradient/motif eventually).
  if (body.status === "archived" || body.place_id !== undefined || body.lat !== undefined || body.lng !== undefined) {
    revalidatePublic();
  }
  return NextResponse.json({ ok: true });
}
