import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id } (single) or { ids: string[] } (bulk, Phase 5) -> queue an
// enrich_directives row per id, status='queued'. Batch-AI-only: this fires NO
// Claude call, tonight's worker (ingest/enrichDirectives.ts) picks it up,
// re-drafts, and lands the result as a pending thing_edits overlay for a normal
// glance-and-approve. Skips ids that already have a queued directive so a
// founder re-clicking doesn't pile up redundant redrafts.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as { thing_id?: string; ids?: string[] };
  const ids = body.ids?.length ? body.ids : body.thing_id ? [body.thing_id] : [];
  if (!ids.length) return NextResponse.json({ error: "thing_id or ids required" }, { status: 400 });

  const { data: already } = await sb
    .from("enrich_directives").select("thing_id").eq("status", "queued").in("thing_id", ids);
  const alreadyQueued = new Set((already ?? []).map((r) => r.thing_id as string));
  const toQueue = ids.filter((id) => !alreadyQueued.has(id));

  if (toQueue.length) {
    const { error } = await sb.from("enrich_directives")
      .insert(toQueue.map((thing_id) => ({ thing_id, status: "queued" })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await sb.from("audit_log").insert(
      toQueue.map((thing_id) => ({
        entity_type: "thing", entity_id: thing_id, action: "redraft_queued", actor: "founder",
      })),
    );
  }

  return NextResponse.json({ ok: true, queued: toQueue.length, already_queued: alreadyQueued.size });
}
