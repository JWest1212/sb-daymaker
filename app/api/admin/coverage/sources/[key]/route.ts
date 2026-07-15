import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { updateSource, SOURCE_STATUSES, SOURCE_FREQUENCIES } from "@/lib/sourcesServer";

export const dynamic = "force-dynamic";

const STATUS_SET = new Set<string>(SOURCE_STATUSES);
const FREQUENCY_SET = new Set<string>(SOURCE_FREQUENCIES);

// PATCH -> edit any subset of fields, or just flip `status` (pause/resume/retire).
// Partial body: only the keys present are written. The next nightly run reads
// the new `status`/`authority` immediately — no deploy needed (Phase 2 already
// wires the orchestrator + dedupe to read this table live).
export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { key } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  if (body.status !== undefined && !STATUS_SET.has(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (body.crawl_frequency !== undefined && !FREQUENCY_SET.has(body.crawl_frequency)) {
    return NextResponse.json({ error: "invalid crawl_frequency" }, { status: 400 });
  }
  if (body.authority !== undefined && typeof body.authority !== "number") {
    return NextResponse.json({ error: "authority must be a number" }, { status: 400 });
  }

  const result = await updateSource(key, {
    label: body.label, url: body.url, authority: body.authority,
    crawl_frequency: body.crawl_frequency, status: body.status, notes: body.notes,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
