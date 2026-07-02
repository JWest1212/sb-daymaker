import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { OCCASION_TAGS } from "@/lib/review";
import { ZONES } from "@/lib/zones";
import { COVERAGE_WINDOWS, type CoverageWindow } from "@/lib/coverage";

export const dynamic = "force-dynamic";

const ZONE_KEYS = ZONES.map((z) => z.zone) as string[];

// POST { scope_kind:'vibe'|'zone', scope_key, window_days, when } -> queue a restock
// directive tonight's worker consumes. Run-now dispatch arrives in C2b; C2 always
// queues. The scope_key is validated against the occasion-tag / nearby_zone vocab.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { scope_kind, scope_key, window_days } = (await req.json()) as {
    scope_kind?: string; scope_key?: string; window_days?: number; when?: string;
  };

  const kind = scope_kind === "vibe" || scope_kind === "zone" ? scope_kind : null;
  if (!kind) return NextResponse.json({ error: "scope_kind must be vibe|zone" }, { status: 400 });

  const validKey = kind === "vibe"
    ? (OCCASION_TAGS as readonly string[]).includes(scope_key ?? "")
    : ZONE_KEYS.includes(scope_key ?? "");
  if (!validKey) return NextResponse.json({ error: `unknown ${kind} key` }, { status: 400 });

  const win = Number(window_days) as CoverageWindow;
  if (!COVERAGE_WINDOWS.includes(win)) return NextResponse.json({ error: "window_days must be 7|14|30|45" }, { status: 400 });

  const { data, error } = await sb.from("restock_directives")
    .insert({ scope_kind: kind, scope_key, window_days: win, status: "queued" })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "restock_directive", entity_id: data.id, action: "restock_request", actor: "founder",
    payload: { scope_kind: kind, scope_key, window_days: win },
  });

  return NextResponse.json({ ok: true, id: data.id });
}
