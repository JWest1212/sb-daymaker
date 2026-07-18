import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { pickFromPool } from "@/lib/venuePool";
import { sbDay } from "@/lib/explore";

export const dynamic = "force-dynamic";

// POST { thing_id, venue_id } -> approve a fuzzy match (Card Imagery Build Spec
// Phase 2 §5.3 "Matches to review" pane). Writes things.venue_id, the ONLY way a
// fuzzy match is ever persisted (the resolver only auto-attaches on an EXACT
// place_id hit; this route is the founder-reviewed path for everything else).
// If the venue already has an approved photo pool, also apply today's rotation
// pick immediately (pickFromPool) so the founder sees the result right away
// instead of waiting for the next nightly run or backfill.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id, venue_id } = (await req.json()) as { thing_id?: string; venue_id?: string };
  if (!thing_id || !venue_id) return NextResponse.json({ error: "thing_id + venue_id required" }, { status: 400 });

  const { error } = await sb.from("things").update({ venue_id }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pool } = await sb
    .from("venue_photos")
    .select("source, serving_url, attribution")
    .eq("venue_id", venue_id)
    .eq("approved", true)
    .order("sort_order", { ascending: true });
  if (pool?.length) {
    const idx = pickFromPool(thing_id, sbDay(Date.now()), pool.length);
    const picked = pool[idx];
    if (picked.serving_url) {
      await sb.from("things").update({
        photo_url: picked.serving_url, photo_source: picked.source, photo_attribution: picked.attribution ?? null,
      }).eq("id", thing_id);
    }
  }

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "venue_match_approved", actor: "founder",
    payload: { venue_id },
  });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
