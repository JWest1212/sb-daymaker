import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Data Arch Redesign 23 Phase 4 §5.3, the dead-man's-switch. Deliberately a
// SEPARATE Vercel Cron job, not a check inside the nightly GitHub Action: if
// the whole nightly job fails to start, nothing inside it can report that, // only an independent watcher can. Runs a few hours after the nightly ingest's
// normal 09:00 UTC start; alerts if no source_runs row has landed since.
// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically.
const MISSED_RUN_CUTOFF_HOURS = 30;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });

  const { data, error } = await sb
    .from("source_runs").select("started_at").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const lastRunAt = data?.started_at as string | undefined;
  const hoursSince = lastRunAt ? (Date.now() - new Date(lastRunAt).getTime()) / 3_600_000 : Infinity;
  const missed = hoursSince > MISSED_RUN_CUTOFF_HOURS;

  if (missed) {
    const to = process.env.DIGEST_TO;
    if (to) {
      await sendEmail({
        to,
        subject: "SB Daymaker, nightly ingest did not run",
        html: `<p>No ingest run has been recorded in the last ${MISSED_RUN_CUTOFF_HOURS} hours` +
          `${lastRunAt ? ` (last one started ${lastRunAt})` : " (none found at all)"}.` +
          ` Check the GitHub Action.</p>`,
      });
    }
  }
  return NextResponse.json({ ok: true, missed, lastRunAt: lastRunAt ?? null, hoursSince: Math.round(hoursSince) });
}
