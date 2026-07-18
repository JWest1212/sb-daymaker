import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DEPRECATED (Phase 13). The nightly pipeline moved to the GitHub Action worker
// (ingest/run.ts); public submissions now flow through it via the `submissions`
// adapter, gate → dedupe → enrich → images → land, replacing the old
// lib/pipeline.runNightly. The Vercel cron entry was removed; this endpoint stays
// as a no-op so a stray call can't re-run the retired duplicate pipeline.
export async function GET() {
  return NextResponse.json({
    ok: false,
    deprecated: true,
    moved_to: "GitHub Action worker (ingest/run.ts) via the submissions adapter",
  });
}
