// Home Rework spec §9.3, public, deterministic, no admin gate, no AI. In-memory
// filter over the already-loaded published set (Phase 0 finding: this page has no
// ISR to piggyback on anyway, every request already reads fresh from Supabase).

import { NextResponse, type NextRequest } from "next/server";
import { getPublishedThings } from "@/lib/things";
import { getVenueNames } from "@/lib/venues";
import { searchThings } from "@/lib/search";

export const dynamic = "force-dynamic";

// Minimal in-memory rate limit. This app has no accounts/sessions (CLAUDE.md §2.4),
// so there's no session key to key off, this is a soft per-IP guard against a
// runaway client polling on every keystroke, not a security boundary. State is
// per-instance and resets on cold start/restart; that's fine for its purpose.
const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 40;
const MAX_TRACKED_IPS = 5_000; // cheap backstop against unbounded growth
const recentRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  if (recentRequests.size > MAX_TRACKED_IPS) recentRequests.clear();
  const now = Date.now();
  const recent = (recentRequests.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  recentRequests.set(ip, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function GET(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ events: [], eventsOverflow: 0, venues: [], venuesOverflow: 0, tags: [], tagsOverflow: 0 });
  }

  const [things, venueNames] = await Promise.all([getPublishedThings(), getVenueNames()]);
  return NextResponse.json(searchThings({ query: q, things, venueNames }));
}
