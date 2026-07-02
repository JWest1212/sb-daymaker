import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id, hero_eligible } -> immediate metadata flag + audit (§1.7).
// Applies from Queue or Catalog with NO re-review round-trip; touches no status.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id, hero_eligible } = (await req.json()) as {
    thing_id?: string;
    hero_eligible?: boolean;
  };
  if (!thing_id || typeof hero_eligible !== "boolean") {
    return NextResponse.json({ error: "thing_id + hero_eligible required" }, { status: 400 });
  }

  const { error } = await sb.from("things").update({ hero_eligible }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing",
    entity_id: thing_id,
    action: "hero_toggle",
    actor: "founder",
    payload: { hero_eligible },
  });

  return NextResponse.json({ ok: true, hero_eligible });
}
