import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { workflowRunsUrl } from "@/lib/githubActions";

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
  // Table may not exist yet (migration pending), degrade to empty rather than 500.
  if (error) return NextResponse.json({ directives: [], note: "restock_directives unavailable" });

  // QW8, "view runs" is the same Actions page for every in-flight directive.
  const runsUrl = workflowRunsUrl();
  const directives = (data ?? []).map((d) => (
    d.status === "running" || d.status === "queued" ? { ...d, runsUrl } : d
  ));
  return NextResponse.json({ directives });
}
