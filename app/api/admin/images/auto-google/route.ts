import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { createVenue } from "@/lib/venuesServer";
import { pickFromPool, isWeakPlaceMatch } from "@/lib/venuePool";
import { sbDay } from "@/lib/explore";
import { fetchGooglePhotoCandidates, searchPlaceByText, monthKey, loadSpend, saveSpend, CAP } from "@/ingest/images";
import type { PhotoOption } from "@/lib/review";

export const dynamic = "force-dynamic";

// POST { thing_ids: string[] } -> Images desk "Auto-Google": the paid, opt-in
// second pass for items the free auto-assign skipped. Per thing, cheapest first:
//   1. Resolve a venue the compliant way (already attached; exact place_id match
//      against an existing venue; else auto-create from the thing's own
//      place_id, the same "venue-backed, invisible" design the catalog picker
//      uses). No place_id anywhere -> skipped; a bulk pass never guesses.
//   2. If that venue already has approved pool photos, apply today's rotation
//      pick, free, no Google call at all.
//   3. Otherwise fetch ONLY the top Google photo (top-1, not the 10-candidate
//      review spread: 2 counted calls, 1 billable), auto-approve it into the
//      venue's pool (so it gets the nightly serving-URL refresh + dead-photo
//      fallback), and apply it. Stops hard at the shared monthly cap.
// Results carry each thing's previous photo so the desk's session strip can
// revert any of it with one click.
const MAX_IDS = 60;

interface GoogleResult {
  id: string;
  action: "google" | "venue_pool" | "skipped";
  reason?: string;
  url?: string;
  source?: string;
  attribution?: string | null;
  venue_id?: string;
  venue_name?: string;
  attached_now?: boolean;
  prev?: { url: string | null; source: string; attribution: string | null };
}

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as { thing_ids?: string[] };
  const ids = Array.isArray(body.thing_ids) ? body.thing_ids.filter((x) => typeof x === "string").slice(0, MAX_IDS) : [];
  if (!ids.length) return NextResponse.json({ error: "thing_ids required" }, { status: 400 });

  const [thingsRes, venuesRes] = await Promise.all([
    sb.from("things")
      .select("id, title, address, place_id, lat, lng, venue_id, photo_url, photo_source, photo_attribution, photo_options")
      .in("id", ids),
    sb.from("venues").select("id, display_name, place_id").eq("status", "active"),
  ]);
  if (thingsRes.error) return NextResponse.json({ error: thingsRes.error.message }, { status: 500 });

  type VenueLite = { id: string; display_name: string; place_id: string | null };
  const venueById = new Map<string, VenueLite>();
  const venueByPlaceId = new Map<string, VenueLite>();
  for (const v of venuesRes.data ?? []) {
    const lite: VenueLite = { id: v.id as string, display_name: v.display_name as string, place_id: (v.place_id as string) ?? null };
    venueById.set(lite.id, lite);
    if (lite.place_id) venueByPlaceId.set(lite.place_id, lite);
  }

  const month = monthKey();
  const spend = await loadSpend(sb, month);
  let calls = spend.google_calls;
  const hasBudget = () => calls < CAP;
  let capHit = !hasBudget();

  const today = sbDay(Date.now());
  const results: GoogleResult[] = [];
  let applied = 0;

  const applyPhoto = async (
    thingId: string,
    existing: PhotoOption[],
    pick: { url: string; source: string; attribution: string | null },
  ): Promise<boolean> => {
    const photo_options = existing.some((o) => o.url === pick.url)
      ? existing
      : [{ url: pick.url, source: pick.source, attribution: pick.attribution ?? undefined }, ...existing];
    const { error } = await sb.from("things").update({
      photo_url: pick.url, photo_source: pick.source, photo_attribution: pick.attribution, photo_options,
    }).eq("id", thingId);
    if (error) return false;
    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: thingId, action: "photo_set", actor: "founder",
      payload: { photo_url: pick.url, photo_source: pick.source, via: "images_auto_google" },
    });
    return true;
  };

  for (const t of thingsRes.data ?? []) {
    const id = t.id as string;
    const curSource = (t.photo_source as string) ?? "placeholder";
    const curUrl = (t.photo_url as string) ?? null;
    if (curUrl && curSource !== "placeholder" && curSource !== "motif") {
      results.push({ id, action: "skipped", reason: "already has a photo" });
      continue;
    }
    const prev = { url: curUrl, source: curSource, attribution: (t.photo_attribution as string) ?? null };
    const existingOptions = ((t.photo_options as PhotoOption[]) ?? []).filter((o) => o.url);

    // 1, resolve a venue (attached / exact place_id match / auto-create).
    let venue = t.venue_id ? venueById.get(t.venue_id as string) : undefined;
    let attachedNow = false;
    if (!venue && t.place_id) {
      venue = venueByPlaceId.get(t.place_id as string);
      if (venue) {
        const { error } = await sb.from("things").update({ venue_id: venue.id }).eq("id", id);
        if (error) venue = undefined;
        else {
          attachedNow = true;
          await sb.from("audit_log").insert({
            entity_type: "thing", entity_id: id, action: "venue_auto_attached", actor: "founder",
            payload: { venue_id: venue.id, reason: "exact place_id match", via: "images_auto_google" },
          });
        }
      } else {
        try {
          const created = await createVenue(sb, {
            display_name: (t.title as string) ?? "Untitled",
            place_id: (t.place_id as string) ?? null,
            lat: (t.lat as number) ?? null,
            lng: (t.lng as number) ?? null,
            dedupeSeed: id,
          });
          venue = { id: created.id, display_name: created.display_name, place_id: created.place_id };
          venueById.set(venue.id, venue);
          if (venue.place_id) venueByPlaceId.set(venue.place_id, venue);
          await sb.from("things").update({ venue_id: venue.id }).eq("id", id);
          attachedNow = true;
          await sb.from("audit_log").insert({
            entity_type: "thing", entity_id: id, action: "venue_auto_created", actor: "founder",
            payload: { venue_id: venue.id, key: created.key, via: "images_auto_google" },
          });
        } catch {
          results.push({ id, action: "skipped", reason: "venue creation failed" });
          continue;
        }
      }
    }
    // No place_id anywhere -> one free-tier Text Search lookup (the same engine
    // as the Venues tab's place-id lookup; NOT counted against the photo cap).
    // Only a STRONG hit, a real named business, not a bare geocoded address, // proceeds; a weak hit is skipped, never guessed.
    if (!venue && !t.venue_id && !t.place_id) {
      const address = (t.address as string) ?? null;
      const q = address ? `${t.title as string}, ${address}` : `${t.title as string}, Santa Barbara, CA`;
      const found = await searchPlaceByText(q);
      if (!found || isWeakPlaceMatch(found.name)) {
        results.push({ id, action: "skipped", reason: "no confident Google place match" });
        continue;
      }
      const existingVenue = venueByPlaceId.get(found.placeId);
      if (existingVenue) {
        const { error } = await sb.from("things").update({ venue_id: existingVenue.id }).eq("id", id);
        if (!error) {
          venue = existingVenue;
          attachedNow = true;
          await sb.from("audit_log").insert({
            entity_type: "thing", entity_id: id, action: "venue_auto_attached", actor: "founder",
            payload: { venue_id: venue.id, reason: "text-search place match", via: "images_auto_google" },
          });
        }
      } else {
        try {
          const created = await createVenue(sb, {
            display_name: found.name, place_id: found.placeId, lat: found.lat, lng: found.lng, dedupeSeed: id,
          });
          venue = { id: created.id, display_name: created.display_name, place_id: created.place_id };
          venueById.set(venue.id, venue);
          if (venue.place_id) venueByPlaceId.set(venue.place_id, venue);
          await sb.from("things").update({ venue_id: venue.id }).eq("id", id);
          attachedNow = true;
          await sb.from("audit_log").insert({
            entity_type: "thing", entity_id: id, action: "venue_auto_created", actor: "founder",
            payload: { venue_id: venue.id, key: created.key, reason: "text-search place match", via: "images_auto_google" },
          });
        } catch {
          results.push({ id, action: "skipped", reason: "venue creation failed" });
          continue;
        }
      }
    }
    if (!venue) {
      results.push({ id, action: "skipped", reason: t.venue_id ? "attached venue not active" : "no confident Google place match" });
      continue;
    }

    // 2, an approved pool already exists: free rotation pick, no Google call.
    const { data: pool } = await sb
      .from("venue_photos").select("source, serving_url, attribution")
      .eq("venue_id", venue.id).eq("approved", true)
      .order("sort_order", { ascending: true });
    const poolReal = (pool ?? []).filter((p) => p.serving_url);
    if (poolReal.length) {
      const picked = poolReal[pickFromPool(id, today, poolReal.length)];
      if (await applyPhoto(id, existingOptions, {
        url: picked.serving_url as string, source: picked.source as string, attribution: (picked.attribution as string) ?? null,
      })) {
        applied++;
        results.push({
          id, action: "venue_pool", url: picked.serving_url as string, source: picked.source as string,
          attribution: (picked.attribution as string) ?? null,
          venue_id: venue.id, venue_name: venue.display_name, attached_now: attachedNow, prev,
        });
        continue;
      }
    }

    // 3, top-1 paid Google fetch, auto-approved into the pool. A venue that
    // exists but never got a place_id (e.g. auto-created earlier from a
    // coordless thing) gets one shot at the same free-tier name lookup first.
    if (!venue.place_id) {
      const found = await searchPlaceByText(`${venue.display_name}, Santa Barbara, CA`);
      if (found && !isWeakPlaceMatch(found.name)) {
        const { error } = await sb.from("venues").update({ place_id: found.placeId, lat: found.lat, lng: found.lng }).eq("id", venue.id);
        if (!error) {
          venue.place_id = found.placeId;
          venueByPlaceId.set(found.placeId, venue);
          await sb.from("audit_log").insert({
            entity_type: "venue", entity_id: venue.id, action: "venue_auto_lookup", actor: "founder",
            payload: { place_id: found.placeId, matched_name: found.name, via: "images_auto_google" },
          });
        }
      }
    }
    if (!venue.place_id) {
      results.push({ id, action: "skipped", reason: "venue has no place_id (no confident match)", attached_now: attachedNow, venue_id: venue.id });
      continue;
    }
    if (!hasBudget()) {
      capHit = true;
      results.push({ id, action: "skipped", reason: "monthly photo budget reached", attached_now: attachedNow, venue_id: venue.id });
      continue;
    }
    const onCall = () => { calls++; };
    const photos = await fetchGooglePhotoCandidates(venue.place_id, onCall, hasBudget, 1);
    if (calls >= CAP) capHit = true;
    const g = photos[0];
    if (!g) {
      results.push({ id, action: "skipped", reason: "no Google photo found", attached_now: attachedNow, venue_id: venue.id });
      continue;
    }

    const { data: maxSort } = await sb
      .from("venue_photos").select("sort_order").eq("venue_id", venue.id).eq("approved", true)
      .order("sort_order", { ascending: false }).limit(1);
    const nextSort = ((maxSort?.[0]?.sort_order as number) ?? -1) + 1;
    const { data: vpRow } = await sb.from("venue_photos").upsert(
      {
        venue_id: venue.id, source: "google", stable_ref: g.stable_ref, serving_url: g.preview_url,
        attribution: g.attribution, approved: true, sort_order: nextSort,
      },
      { onConflict: "venue_id,stable_ref" },
    ).select("id").maybeSingle();
    if (vpRow?.id) {
      await sb.from("audit_log").insert({
        entity_type: "venue_photo", entity_id: vpRow.id as string, action: "photo_approved", actor: "founder",
        payload: { venue_id: venue.id, via: "images_auto_google" },
      });
    }

    if (await applyPhoto(id, existingOptions, { url: g.preview_url, source: "google", attribution: g.attribution })) {
      applied++;
      results.push({
        id, action: "google", url: g.preview_url, source: "google", attribution: g.attribution,
        venue_id: venue.id, venue_name: venue.display_name, attached_now: attachedNow, prev,
      });
    } else {
      results.push({ id, action: "skipped", reason: "photo write failed", attached_now: attachedNow, venue_id: venue.id });
    }
  }

  await saveSpend(sb, month, calls, spend.over_cap);
  if (applied) revalidatePublic();
  return NextResponse.json({ ok: true, results, applied, capHit, used: calls, cap: CAP });
}
