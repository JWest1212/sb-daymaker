import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { isWeakPlaceMatch } from "@/lib/venuePool";
import { searchPlaceByText } from "@/ingest/images";

export const dynamic = "force-dynamic";

// POST { thing_ids: string[] } -> Images desk "locate" stage: stamp a Google
// place_id (+ coordinates where missing) onto things that don't have one, via
// Text Search (free tier 5k/mo — NOT counted against the photo cap). This is
// the root-cause unlock for the free path: coordinates enable Wikimedia
// geosearch, and place_ids enable exact venue matching + Google photos.
// STRONG matches only (a real named business — isWeakPlaceMatch guards against
// bare geocoded addresses); a weak/no hit changes nothing. Existing non-null
// coordinates are never overwritten (adapter data stays authoritative).
const MAX_IDS = 25;

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as { thing_ids?: string[] };
  const ids = Array.isArray(body.thing_ids) ? body.thing_ids.filter((x) => typeof x === "string").slice(0, MAX_IDS) : [];
  if (!ids.length) return NextResponse.json({ error: "thing_ids required" }, { status: 400 });

  const { data, error } = await sb
    .from("things")
    .select("id, title, address, place_id, lat, lng")
    .in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { id: string; located: boolean; place_id?: string; lat?: number; lng?: number }[] = [];
  for (const t of data ?? []) {
    const id = t.id as string;
    if (t.place_id) { results.push({ id, located: false }); continue; }
    const address = (t.address as string) ?? null;
    const q = address ? `${t.title as string}, ${address}` : `${t.title as string}, Santa Barbara, CA`;
    const found = await searchPlaceByText(q);
    if (!found || isWeakPlaceMatch(found.name)) { results.push({ id, located: false }); continue; }

    const lat = (t.lat as number) ?? found.lat;
    const lng = (t.lng as number) ?? found.lng;
    const { error: upErr } = await sb.from("things").update({ place_id: found.placeId, lat, lng }).eq("id", id);
    if (upErr) { results.push({ id, located: false }); continue; }
    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: id, action: "place_lookup", actor: "founder",
      payload: { place_id: found.placeId, matched_name: found.name, via: "images_locate" },
    });
    results.push({ id, located: true, place_id: found.placeId, lat, lng });
  }

  return NextResponse.json({ ok: true, results, located: results.filter((r) => r.located).length });
}
