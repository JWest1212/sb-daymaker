import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Sliding-expiry cleanup: delete share/restore tokens idle > 90 days.
// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { error, count } = await sb
    .from("shared_states")
    .delete({ count: "exact" })
    .lt("last_accessed_at", cutoff);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
