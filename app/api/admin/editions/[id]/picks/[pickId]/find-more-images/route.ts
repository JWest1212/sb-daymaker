import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { discoverMoreImages } from "@/lib/edition/imageDiscovery";

export const dynamic = "force-dynamic";

// POST — widen the search for this pick's underlying thing and persist any new
// options onto things.photo_options (spec §3.5's on-demand candidate discovery).
// Free source only (Wikimedia — Pexels retired Phase 3 §6.2) — no Google, so
// repeated clicks never risk the paid cap. Writing to the canonical thing is
// deliberate here (unlike every other edit in this module): more real photo
// choices is a catalog-wide quality improvement, the same kind of thing
// ingest's own image backfill does, not edition-scoped editorial content.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; pickId: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const { pickId } = await params;

  const { data: pick, error: pickErr } = await sb
    .from("edition_picks").select("thing_id").eq("id", pickId).maybeSingle();
  if (pickErr || !pick) return NextResponse.json({ error: "pick not found" }, { status: 404 });

  const { data: thing, error: thingErr } = await sb
    .from("things")
    .select("id, neighborhood, happening_category, photo_options")
    .eq("id", pick.thing_id)
    .maybeSingle();
  if (thingErr || !thing) return NextResponse.json({ error: "thing not found" }, { status: 404 });

  const options = await discoverMoreImages({
    neighborhood: thing.neighborhood,
    happening_category: thing.happening_category,
    photo_options: thing.photo_options ?? [],
  });

  const { error: upErr } = await sb.from("things").update({ photo_options: options }).eq("id", thing.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, photo_options: options });
}
