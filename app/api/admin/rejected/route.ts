import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const RECENTLY_REJECTED_DAYS = 14;

// GET -> the last 14 days of founder rejects still sitting archived (not
// merged into a survivor, not otherwise moved on), newest first. One row
// per thing, deduped to its most recent reject if it was rejected more than
// once in the window.
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ rows: [] });

  const since = new Date(Date.now() - RECENTLY_REJECTED_DAYS * 86_400_000).toISOString();
  const { data: rejects, error } = await sb
    .from("audit_log")
    .select("entity_id, created_at, payload")
    .eq("action", "reject")
    .eq("actor", "founder")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ rows: [] });

  const latestByThing = new Map<string, { created_at: string; reason: string }>();
  for (const r of rejects ?? []) {
    const id = r.entity_id as string;
    if (latestByThing.has(id)) continue; // already have this thing's most recent reject
    const payload = r.payload as { reason?: string | null } | null;
    latestByThing.set(id, { created_at: r.created_at as string, reason: payload?.reason || "founder reject" });
  }
  const ids = [...latestByThing.keys()];
  if (!ids.length) return NextResponse.json({ rows: [] });

  const { data: things } = await sb.from("things").select("id, title, status, merged_into").in("id", ids);
  const rows = (things ?? [])
    .filter((t) => t.status === "archived" && t.merged_into == null)
    .map((t) => {
      const info = latestByThing.get(t.id as string)!;
      return { id: t.id as string, title: t.title as string, rejectedAt: info.created_at, reason: info.reason };
    })
    .sort((a, b) => b.rejectedAt.localeCompare(a.rejectedAt));

  return NextResponse.json({ rows });
}

// POST {id} -> restore a rejected thing to needs_review. Founder rejects are
// the only ones offered here (the GET already scopes to actor='founder'), so
// no separate ownership check is needed beyond "still archived, still unmerged".
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "no id" }, { status: 400 });

  const { data: thing } = await sb.from("things").select("id, status, merged_into").eq("id", id).maybeSingle();
  if (!thing || thing.status !== "archived" || thing.merged_into != null) {
    return NextResponse.json({ error: "not restorable" }, { status: 400 });
  }

  const { error } = await sb.from("things").update({ status: "needs_review" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({ entity_type: "thing", entity_id: id, action: "restore", actor: "founder" });
  // Not public-facing (needs_review never renders on the public site), so
  // unlike approve/reject this doesn't call revalidatePublic().
  return NextResponse.json({ ok: true });
}
