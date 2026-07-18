import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id } -> reverse a dedupe merge (Data Arch Redesign 26 Phase 5).
// The row was landed at merge time as status='archived' with merged_into set
// to its survivor (never actually deleted) — un-merge just restores it to
// needs_review and clears merged_into, so it reappears in the queue next to
// the survivor. Always reversible: the row never left the DB.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id } = (await req.json()) as { thing_id?: string };
  if (!thing_id) return NextResponse.json({ error: "thing_id required" }, { status: 400 });

  const { data: row, error: readErr } = await sb
    .from("things").select("id, merged_into, status").eq("id", thing_id).maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!row?.merged_into) return NextResponse.json({ error: "not a merged row" }, { status: 400 });

  const { error } = await sb
    .from("things")
    .update({ status: "needs_review", merged_into: null })
    .eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing",
    entity_id: thing_id,
    action: "unmerge",
    actor: "founder",
    payload: { was_merged_into: row.merged_into },
  });

  revalidatePublic(); // the un-merged row can now surface once approved
  return NextResponse.json({ ok: true });
}
