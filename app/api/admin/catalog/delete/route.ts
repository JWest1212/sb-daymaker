import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id } -> remove the entry from the live site by archiving it
// (status='archived'). Reversible (the row is retained), disappears from the
// public site + catalog immediately. Not a permanent DB delete.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id } = (await req.json()) as { thing_id?: string };
  if (!thing_id) return NextResponse.json({ error: "thing_id required" }, { status: 400 });

  const { error } = await sb.from("things").update({ status: "archived" }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "archive", actor: "founder",
    payload: { via: "catalog_delete" },
  });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
