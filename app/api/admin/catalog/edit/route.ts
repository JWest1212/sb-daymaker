import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { NEIGHBORHOODS, OCCASION_TAGS, filterTags, type EditPayload } from "@/lib/review";

export const dynamic = "force-dynamic";

// POST { thing_id, payload } -> insert a pending thing_edits overlay for a LIVE thing.
// The live row is untouched; the edit goes to the top of the review queue. The
// unique-pending index means only one edit can await review per thing.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id, payload } = (await req.json()) as { thing_id?: string; payload?: EditPayload };
  if (!thing_id || !payload) return NextResponse.json({ error: "thing_id + payload required" }, { status: 400 });

  const { data: row } = await sb
    .from("things").select("is_21_plus, price_band, status").eq("id", thing_id).single();
  if (!row) return NextResponse.json({ error: "thing not found" }, { status: 404 });
  if (row.status !== "published") return NextResponse.json({ error: "only published things are editable here" }, { status: 400 });

  // Sanitize the payload to the allowed fields + enforce the negative tag rules.
  const clean: EditPayload = {};
  if (typeof payload.title === "string" && payload.title.trim()) clean.title = payload.title.trim();
  if (payload.blurb !== undefined) clean.blurb = (payload.blurb ?? "").toString().trim() || null;
  if (payload.blurb_long !== undefined) clean.blurb_long = (payload.blurb_long ?? "").toString().trim() || null;
  if (payload.neighborhood !== undefined) {
    clean.neighborhood = payload.neighborhood && (NEIGHBORHOODS as readonly string[]).includes(payload.neighborhood)
      ? payload.neighborhood : null;
  }
  if (payload.tags !== undefined) {
    const tags = filterTags(payload.tags, { is_21_plus: row.is_21_plus, price_band: row.price_band });
    const illegal = payload.tags.filter((t) => (OCCASION_TAGS as readonly string[]).includes(t) && !tags.includes(t));
    if (illegal.length) return NextResponse.json({ error: `Tag not allowed for this item: ${illegal.join(", ")}` }, { status: 400 });
    clean.tags = tags;
  }

  const { data: ins, error } = await sb
    .from("thing_edits").insert({ thing_id, payload: clean, status: "pending" }).select("id").single();
  if (error) {
    // unique_violation on the one-pending index
    if (error.code === "23505") return NextResponse.json({ error: "an edit is already awaiting review" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "edit_submitted", actor: "founder",
    payload: { overlay_id: ins.id, edits: clean },
  });

  return NextResponse.json({ ok: true, overlay_id: ins.id });
}
