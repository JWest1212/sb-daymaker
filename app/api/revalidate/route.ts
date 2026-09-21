import { NextResponse, type NextRequest } from "next/server";
import { revalidatePublic } from "@/lib/reviewServer";

export const dynamic = "force-dynamic";

/**
 * R1 Wave 1 (W1.6). Purge the ISR-cached public surfaces on demand.
 *
 * Nothing in `ingest/` used to revalidate anything (TP-A3-04), so after a
 * publish wave `/saved`, `/plan` and `/discover` kept serving their pre-update
 * pool until their own window lapsed. That window is exactly when a save can be
 * made against a page that does not know the thing exists.
 *
 * Gated by the same `CRON_SECRET` the reaper uses, sent as a bearer token. The
 * nightly ingest calls this at the end of a successful run.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true, revalidated: true, at: new Date().toISOString() });
}
