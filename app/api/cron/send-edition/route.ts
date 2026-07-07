import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { sendEdition } from "@/lib/edition/send";
import { sbDay } from "@/lib/explore";

export const dynamic = "force-dynamic";

// Vercel Cron, Thursday + Sunday 07:00 America/Los_Angeles (see vercel.json —
// fixed-UTC schedule, same DST-drift tradeoff the nightly ingest already
// accepts). The edition_date IS the send date (windowDaysFor computes the
// days AFTER it), so "today" is exactly the row to send (spec §7.1/§7.2).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });

  const today = sbDay(Date.now());
  const result = await sendEdition(sb, today);
  return NextResponse.json(result);
}
