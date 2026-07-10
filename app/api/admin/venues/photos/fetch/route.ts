import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { fetchCandidatesForVenue } from "@/lib/venueFetch";

export const dynamic = "force-dynamic";

// POST { venue_id, include_google?: boolean } -> Card Imagery Build Spec Phase 2
// §5.3 "Fetch candidates". See lib/venueFetch.ts for the Wikimedia-first /
// Google-override logic (shared with the Live-catalog follow-up route).
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { venue_id, include_google } = (await req.json()) as { venue_id?: string; include_google?: boolean };
  if (!venue_id) return NextResponse.json({ error: "venue_id required" }, { status: 400 });

  const { data: venue, error: vErr } = await sb
    .from("venues").select("id, display_name, place_id, lat, lng").eq("id", venue_id).maybeSingle();
  if (vErr || !venue) return NextResponse.json({ error: vErr?.message ?? "venue not found" }, { status: 404 });

  const stats = await fetchCandidatesForVenue(sb, venue as { id: string; display_name: string; place_id: string | null; lat: number | null; lng: number | null }, !!include_google);
  return NextResponse.json({ ok: true, ...stats });
}
