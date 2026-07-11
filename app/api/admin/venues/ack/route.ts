import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id } -> Phase 6 (V-4) "Leave on motif": persists the dismissal
// so this thing stops reappearing in the no-match catcher on future loads.
// Purely a cockpit-side flag — doesn't touch anything the public site renders,
// so no revalidatePublic() here.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id } = (await req.json()) as { thing_id?: string };
  if (!thing_id) return NextResponse.json({ error: "thing_id required" }, { status: 400 });

  const { error } = await sb.from("things").update({ no_venue_ack: true }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "no_venue_ack", actor: "founder",
  });
  return NextResponse.json({ ok: true });
}
