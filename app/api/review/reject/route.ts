import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { id, reason } -> archive + audit. The uuid5 id keeps it dq'd on re-ingest.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { id, reason, overlay_id } = (await req.json()) as { id?: string; reason?: string; overlay_id?: string };

  // ---- overlay rejection: discard the pending edit; the live row is untouched ----
  if (overlay_id) {
    const { data: overlay } = await sb.from("thing_edits").select("thing_id, status").eq("id", overlay_id).single();
    if (!overlay || overlay.status !== "pending") return NextResponse.json({ error: "overlay not pending" }, { status: 400 });
    await sb.from("thing_edits").update({ status: "discarded", resolved_at: new Date().toISOString() }).eq("id", overlay_id);
    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: overlay.thing_id, action: "edit_discarded", actor: "founder",
      payload: { overlay_id, reason: reason ?? null },
    });
    return NextResponse.json({ ok: true, discarded: overlay_id });
  }

  if (!id) return NextResponse.json({ error: "no id" }, { status: 400 });

  const { error } = await sb.from("things").update({ status: "archived" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing",
    entity_id: id,
    action: "reject",
    actor: "founder",
    payload: { reason: reason ?? null },
  });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
