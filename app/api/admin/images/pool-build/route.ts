import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { pickFromPool, isWeakPlaceMatch } from "@/lib/venuePool";
import { sbDay } from "@/lib/explore";
import {
  wikimediaGeosearch, rankWikimediaCandidates, fetchGooglePhotoCandidates, searchPlaceByText,
  monthKey, loadSpend, saveSpend, CAP,
} from "@/ingest/images";
import type { PhotoOption } from "@/lib/review";

export const dynamic = "force-dynamic";

// POST { venue_id, include_google?: boolean } -> Images desk "Build pool": the
// one-photo-covers-the-whole-cluster accelerator. For a venue with no approved
// photos: fill a missing place_id via one free-tier name lookup (strong match
// only), fetch candidates (Wikimedia geosearch top-5 free; + up to 3 Google on
// the paid switch), auto-approve the best one into the pool (Wikimedia
// preferred), then immediately apply the pool rotation to every attached thing
// still sitting on a motif/placeholder. Returns the applied list (with previous
// photos) so the desk's session strip can revert per item.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { venue_id, include_google } = (await req.json()) as { venue_id?: string; include_google?: boolean };
  if (!venue_id) return NextResponse.json({ error: "venue_id required" }, { status: 400 });

  const { data: venue, error: vErr } = await sb
    .from("venues").select("id, display_name, place_id, lat, lng, status").eq("id", venue_id).maybeSingle();
  if (vErr || !venue) return NextResponse.json({ error: vErr?.message ?? "venue not found" }, { status: 404 });
  if (venue.status !== "active") return NextResponse.json({ error: "venue is archived" }, { status: 400 });

  // Fill a missing place_id (and null coords) via one free-tier name lookup.
  if (!venue.place_id) {
    const found = await searchPlaceByText(`${venue.display_name as string}, Santa Barbara, CA`);
    if (found && !isWeakPlaceMatch(found.name)) {
      const lat = (venue.lat as number) ?? found.lat;
      const lng = (venue.lng as number) ?? found.lng;
      const { error } = await sb.from("venues").update({ place_id: found.placeId, lat, lng }).eq("id", venue.id);
      if (!error) {
        venue.place_id = found.placeId; venue.lat = lat; venue.lng = lng;
        await sb.from("audit_log").insert({
          entity_type: "venue", entity_id: venue.id as string, action: "venue_auto_lookup", actor: "founder",
          payload: { place_id: found.placeId, matched_name: found.name, via: "images_pool_build" },
        });
      }
    }
  }

  // Fetch candidates: Wikimedia geosearch (free) + optional top-3 Google.
  const candidateRows: { venue_id: string; source: string; stable_ref: string; serving_url: string; attribution: string | null; approved: boolean }[] = [];
  if (venue.lat != null && venue.lng != null) {
    const ranked = rankWikimediaCandidates(await wikimediaGeosearch(venue.lat as number, venue.lng as number), { title: venue.display_name as string }).slice(0, 5);
    for (const c of ranked) {
      candidateRows.push({
        venue_id: venue.id as string, source: "wikimedia", stable_ref: c.title, serving_url: c.url,
        attribution: `${c.artist} · ${c.license} · Wikimedia Commons`, approved: false,
      });
    }
  }
  let capHit = false;
  if (include_google && venue.place_id) {
    const month = monthKey();
    const spend = await loadSpend(sb, month);
    let calls = spend.google_calls;
    const hasBudget = () => calls < CAP;
    if (!hasBudget()) capHit = true;
    else {
      const onCall = () => { calls++; };
      const google = await fetchGooglePhotoCandidates(venue.place_id as string, onCall, hasBudget, 3);
      await saveSpend(sb, month, calls, spend.over_cap);
      if (calls >= CAP) capHit = true;
      for (const g of google) {
        candidateRows.push({
          venue_id: venue.id as string, source: "google", stable_ref: g.stable_ref, serving_url: g.preview_url,
          attribution: g.attribution, approved: false,
        });
      }
    }
  }
  if (candidateRows.length) {
    await sb.from("venue_photos").upsert(candidateRows, { onConflict: "venue_id,stable_ref", ignoreDuplicates: true });
  }

  // Approve the best candidate — Wikimedia preferred — unless a pool already exists.
  const { data: approvedExisting } = await sb
    .from("venue_photos").select("id").eq("venue_id", venue.id).eq("approved", true).limit(1);
  if (!approvedExisting?.length) {
    const { data: cands } = await sb
      .from("venue_photos").select("id, source, serving_url").eq("venue_id", venue.id).eq("approved", false)
      .not("serving_url", "is", null)
      .order("source", { ascending: false }) // 'wikimedia' sorts after 'google' -> descending puts wikimedia first
      .order("id", { ascending: true });
    const top = cands?.[0];
    if (!top) {
      return NextResponse.json({
        ok: true, approved: false, applied: [], capHit,
        reason: capHit
          ? "monthly photo budget reached"
          : venue.place_id || (venue.lat != null && venue.lng != null)
            ? "no candidates found — try again with Google"
            : "venue has no place_id or coordinates (no confident lookup match)",
      });
    }
    await sb.from("venue_photos").update({ approved: true, sort_order: 0 }).eq("id", top.id);
    await sb.from("audit_log").insert({
      entity_type: "venue_photo", entity_id: top.id as string, action: "photo_approved", actor: "founder",
      payload: { venue_id: venue.id, via: "images_pool_build" },
    });
  }

  // Apply the pool rotation to every attached thing still on a motif/placeholder.
  const { data: pool } = await sb
    .from("venue_photos").select("source, serving_url, attribution").eq("venue_id", venue.id).eq("approved", true)
    .order("sort_order", { ascending: true });
  const poolReal = (pool ?? []).filter((p) => p.serving_url);

  const { data: attached } = await sb
    .from("things").select("id, photo_url, photo_source, photo_attribution, photo_options")
    .eq("venue_id", venue.id).in("status", ["published", "needs_review"]);
  const today = sbDay(Date.now());
  const applied: { id: string; url: string; source: string; attribution: string | null; prev: { url: string | null; source: string; attribution: string | null } }[] = [];
  for (const t of attached ?? []) {
    const curSource = (t.photo_source as string) ?? "placeholder";
    const curUrl = (t.photo_url as string) ?? null;
    if (curUrl && curSource !== "placeholder" && curSource !== "motif") continue;
    if (!poolReal.length) break;
    const picked = poolReal[pickFromPool(t.id as string, today, poolReal.length)];
    const existing = ((t.photo_options as PhotoOption[]) ?? []).filter((o) => o.url);
    const photo_options = existing.some((o) => o.url === picked.serving_url)
      ? existing
      : [{ url: picked.serving_url as string, source: picked.source as string, attribution: (picked.attribution as string) ?? undefined }, ...existing];
    const { error } = await sb.from("things").update({
      photo_url: picked.serving_url, photo_source: picked.source, photo_attribution: picked.attribution ?? null, photo_options,
    }).eq("id", t.id as string);
    if (error) continue;
    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: t.id as string, action: "photo_set", actor: "founder",
      payload: { photo_url: picked.serving_url, photo_source: picked.source, via: "images_pool_build" },
    });
    applied.push({
      id: t.id as string, url: picked.serving_url as string, source: picked.source as string,
      attribution: (picked.attribution as string) ?? null,
      prev: { url: curUrl, source: curSource, attribution: (t.photo_attribution as string) ?? null },
    });
  }

  if (applied.length) revalidatePublic();
  return NextResponse.json({ ok: true, approved: true, applied, capHit });
}
