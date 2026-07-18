import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id, weight } -> immediate editorial_weight nudge + audit (W2.1c).
// The ▲/▼ cockpit gesture. Metadata-immediate like hero-eligible: no re-review,
// touches no status. `editorial_weight` is founder curation the ranker is allowed
// to read, NOT sponsor status (the ranker never reads is_featured/sponsor_id).
// revalidatePublic() because a weight change can move the live hero/order.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id, weight } = (await req.json()) as {
    thing_id?: string;
    weight?: number;
  };
  if (!thing_id || typeof weight !== "number" || !Number.isInteger(weight) || weight < -5 || weight > 5) {
    return NextResponse.json({ error: "thing_id + integer weight in −5..+5 required" }, { status: 400 });
  }

  const { error } = await sb.from("things").update({ editorial_weight: weight }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing",
    entity_id: thing_id,
    action: "weight_set",
    actor: "founder",
    payload: { editorial_weight: weight },
  });

  revalidatePublic(); // a boost/lower can change the live hero + section order
  return NextResponse.json({ ok: true, weight });
}
