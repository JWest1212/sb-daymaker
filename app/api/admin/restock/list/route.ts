import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET -> recent restock directives for the rail (newest first).
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ directives: [] });

  const { data, error } = await sb.from("restock_directives")
    .select("id, scope_kind, scope_key, window_days, status, run_note, requested_at")
    .order("requested_at", { ascending: false })
    .limit(12);
  // Table may not exist yet (migration pending) — degrade to empty rather than 500.
  if (error) return NextResponse.json({ directives: [], note: "restock_directives unavailable" });
  return NextResponse.json({ directives: data ?? [] });
}
