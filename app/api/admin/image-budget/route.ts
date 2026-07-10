import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { monthKey, loadSpend, CAP } from "@/ingest/images";

export const dynamic = "force-dynamic";

// GET -> { used, cap, month } from the shared image_spend counter (LC-8/V-10
// cost visibility). Read-only; the counter itself is only ever written by an
// actual Google Places call (lib/venueFetch.ts, ingest/images.ts).
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const month = monthKey();
  const spend = await loadSpend(sb, month);
  return NextResponse.json({ used: spend.google_calls, cap: CAP, month });
}
