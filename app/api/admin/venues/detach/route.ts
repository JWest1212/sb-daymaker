import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id } -> Phase 7 (V-8): clears things.venue_id. Deliberately
// leaves the thing's current photo fields untouched (Jim's default call), it
// re-resolves on the next nightly pass / backfill rather than being cleared to
// a gradient immediately, which would visibly regress the card before anything
// better has had a chance to land.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id } = (await req.json()) as { thing_id?: string };
  if (!thing_id) return NextResponse.json({ error: "thing_id required" }, { status: 400 });

  const { error } = await sb.from("things").update({ venue_id: null }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "venue_detached", actor: "founder",
  });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
