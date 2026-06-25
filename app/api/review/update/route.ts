import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { NEIGHBORHOODS, filterTags } from "@/lib/review";

export const dynamic = "force-dynamic";

// POST { id, blurb, blurb_long, neighborhood, tags } -> founder inline edit.
// Edits voice + classification ONLY. The start time is intentionally NOT editable
// here (to change a time, reject & re-ingest so the gate re-runs).
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as {
    id?: string;
    blurb?: string;
    blurb_long?: string;
    neighborhood?: string | null;
    tags?: string[];
  };
  if (!body.id) return NextResponse.json({ error: "no id" }, { status: 400 });

  // Pull the row's facts so the negative tag rules can be enforced server-side.
  const { data: row } = await sb
    .from("things")
    .select("is_21_plus, price_band")
    .eq("id", body.id)
    .single();

  const neighborhood =
    body.neighborhood && (NEIGHBORHOODS as readonly string[]).includes(body.neighborhood)
      ? body.neighborhood
      : null;
  const tags = filterTags(body.tags ?? [], {
    is_21_plus: row?.is_21_plus ?? null,
    price_band: row?.price_band ?? null,
  });

  const { error: upErr } = await sb
    .from("things")
    .update({
      blurb: body.blurb?.trim() || null,
      blurb_long: body.blurb_long?.trim() || null,
      neighborhood,
    })
    .eq("id", body.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Replace the row's tags with the founder-approved set (tag_source='founder').
  await sb.from("thing_tags").delete().eq("thing_id", body.id);
  if (tags.length) {
    await sb.from("thing_tags").insert(
      tags.map((tag) => ({ thing_id: body.id, tag, confidence: 1.0, tag_source: "founder" })),
    );
  }

  await sb.from("audit_log").insert({
    entity_type: "thing",
    entity_id: body.id,
    action: "edit",
    actor: "founder",
    payload: { neighborhood, tags },
  });

  return NextResponse.json({ ok: true, tags, neighborhood });
}
