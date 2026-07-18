import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { NEIGHBORHOODS, OCCASION_TAGS, filterTags, type EditPayload } from "@/lib/review";
import { deriveNearbyZone } from "@/lib/geo";

export const dynamic = "force-dynamic";

// POST { thing_id, payload } -> apply a founder edit DIRECTLY to the live published
// row (no review queue). The admin trusts their own edits, so changes go live
// immediately (revalidatePublic). Start time is never editable here.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id, payload } = (await req.json()) as { thing_id?: string; payload?: EditPayload };
  if (!thing_id || !payload) return NextResponse.json({ error: "thing_id + payload required" }, { status: 400 });

  const { data: row } = await sb
    .from("things").select("is_21_plus, price_band, status, lat, lng").eq("id", thing_id).single();
  if (!row) return NextResponse.json({ error: "thing not found" }, { status: 404 });
  if (row.status !== "published") return NextResponse.json({ error: "only published things are editable here" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = { last_confirmed: today };
  const changed: Record<string, unknown> = {};
  if (typeof payload.title === "string" && payload.title.trim()) { patch.title = payload.title.trim(); changed.title = patch.title; }
  if (payload.blurb !== undefined) { patch.blurb = (payload.blurb ?? "").toString().trim() || null; changed.blurb = patch.blurb; }
  if (payload.blurb_long !== undefined) { patch.blurb_long = (payload.blurb_long ?? "").toString().trim() || null; changed.blurb_long = patch.blurb_long; }
  if (payload.neighborhood !== undefined) {
    patch.neighborhood = payload.neighborhood && (NEIGHBORHOODS as readonly string[]).includes(payload.neighborhood) ? payload.neighborhood : null;
    changed.neighborhood = patch.neighborhood;
    // LC-6: a neighborhood edit can move the Near-Me/Coverage zone, recompute
    // with the same rule ingest/land.ts lands new rows with (lib/geo.ts).
    patch.nearby_zone = deriveNearbyZone(patch.neighborhood as string | null, row.lat, row.lng);
    changed.nearby_zone = patch.nearby_zone;
  }

  let tags: string[] | undefined;
  if (payload.tags !== undefined) {
    tags = filterTags(payload.tags, { is_21_plus: row.is_21_plus, price_band: row.price_band });
    const illegal = payload.tags.filter((t) => (OCCASION_TAGS as readonly string[]).includes(t) && !tags!.includes(t));
    if (illegal.length) return NextResponse.json({ error: `Tag not allowed for this item: ${illegal.join(", ")}` }, { status: 400 });
    changed.tags = tags;
  }

  const { error } = await sb.from("things").update(patch).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (tags !== undefined) {
    await sb.from("thing_tags").delete().eq("thing_id", thing_id);
    if (tags.length) {
      await sb.from("thing_tags").insert(tags.map((tag) => ({ thing_id, tag, confidence: 1.0, tag_source: "founder" })));
    }
  }

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "catalog_edit", actor: "founder", payload: { edits: changed },
  });
  revalidatePublic(); // live immediately
  return NextResponse.json({ ok: true, applied: thing_id });
}
