import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { OCCASION_TAGS } from "@/lib/review";
import { ZONES } from "@/lib/zones";
import { COVERAGE_WINDOWS, type CoverageWindow } from "@/lib/coverage";

export const dynamic = "force-dynamic";

const ZONE_KEYS = ZONES.map((z) => z.zone) as string[];

/** Trigger the ingest workflow's Run-now pass for one directive via the GitHub
 *  REST API. The token is read here (server-only) and never reaches the client. */
async function dispatchRunNow(directiveId: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { ok: false, error: "GITHUB_DISPATCH_TOKEN is not configured on the server" };
  const repo = process.env.GITHUB_REPO || "JWest1212/sb-daymaker";
  const workflow = process.env.GITHUB_WORKFLOW_FILE || "ingest.yml";
  const ref = process.env.GITHUB_WORKFLOW_REF || "main";
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "sb-daymaker-cockpit",
      },
      body: JSON.stringify({ ref, inputs: { directive_id: directiveId } }),
    });
    if (res.status === 204) return { ok: true };
    const body = await res.text().catch(() => "");
    return { ok: false, error: `GitHub dispatch ${res.status}: ${body.slice(0, 180)}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// POST { scope_kind:'vibe'|'zone', scope_key, window_days, when:'tonight'|'now' }
// Queues a restock directive the worker consumes. when='now' also dispatches the
// ingest workflow immediately (C2b). The scope_key is validated against the
// occasion-tag / nearby_zone vocab.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { scope_kind, scope_key, window_days, when } = (await req.json()) as {
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
    payload: { scope_kind: kind, scope_key, window_days: win, when: when === "now" ? "now" : "tonight" },
  });

  // Run-now: dispatch the workflow immediately. On success mark it running; on
  // failure leave it queued (tonight's run still consumes it) and tell the client.
  if (when === "now") {
    const dispatch = await dispatchRunNow(data.id);
    if (dispatch.ok) {
      await sb.from("restock_directives")
        .update({ status: "running", started_at: new Date().toISOString() }).eq("id", data.id);
      return NextResponse.json({ ok: true, id: data.id, dispatched: true });
    }
    return NextResponse.json({ ok: false, id: data.id, queued: true, error: dispatch.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
