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

  const { id, reason } = (await req.json()) as { id?: string; reason?: string };
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
