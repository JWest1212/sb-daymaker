// app/api/flags/route.ts  (Elevation v1 · Gate 3 · G3.6)
//
// Public "Something off?" correction submit. Writes a content_flags row
// (status='new'). Controlled reason set only; detail is optional + capped; NO
// contact/PII fields are accepted or stored (§8 PII boundary). Soft per-IP rate
// limit (a server-side backstop; the client also throttles via localStorage).

import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { isFlagReason, FLAG_DETAIL_MAX } from "@/lib/flags";
import { cleanText } from "@/lib/text/stripEmDash";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8; // a person fixing a few listings, not a bot
const MAX_TRACKED_IPS = 5_000;
const recent = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  if (recent.size > MAX_TRACKED_IPS) recent.clear();
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as
    | { thing_id?: unknown; guide_id?: unknown; reason?: unknown; detail?: unknown }
    | null;

  const thing_id = typeof body?.thing_id === "string" ? body.thing_id : null;
  const guide_id = typeof body?.guide_id === "string" ? body.guide_id : null;
  const reason = body?.reason;

  if (!isFlagReason(reason)) return NextResponse.json({ error: "bad_reason" }, { status: 400 });
  // Exactly one target (matches the content_flags CHECK constraint).
  if ((thing_id ? 1 : 0) + (guide_id ? 1 : 0) !== 1) {
    return NextResponse.json({ error: "bad_target" }, { status: 400 });
  }
  const detailRaw = typeof body?.detail === "string" ? body.detail : "";
  const detail = cleanText(detailRaw.slice(0, FLAG_DETAIL_MAX).trim()) || null;

  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const { error } = await sb
    .from("content_flags")
    .insert({ thing_id, guide_id, reason, detail, status: "new" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
