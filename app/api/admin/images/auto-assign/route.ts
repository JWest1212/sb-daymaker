import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { bestVenueMatch, pickFromPool, type MatchableThing, type MatchableVenue } from "@/lib/venuePool";
import { STRONG_MATCH_SCORE } from "@/lib/imagesServer";
import { sbDay } from "@/lib/explore";
import type { PhotoOption } from "@/lib/review";

export const dynamic = "force-dynamic";

// POST { thing_ids: string[] } -> Images desk bulk "auto-assign best free image".
// Deterministic and $0 — no AI, no Google. Per thing, in the waterfall's own
// priority order:
//   1. Venue pool: an already-attached venue with approved photos, or a NEW
//      attach when the fuzzy match clears STRONG_MATCH_SCORE (place_id hit or
//      2+ name-pattern hits — deliberately stricter than the human-review pane)
//      AND that venue has approved photos. Applies today's rotation pick, same
//      as /api/admin/venues/match.
//   2. Top pre-fetched free option (wikimedia/owned) from photo_options — these
//      already passed the Wikimedia gate + score floor when fetched.
//   3. Otherwise skipped — left in the queue for the founder.
// Everything applied is reported back with its previous photo so the desk's
// session strip can offer a one-click revert.
const MAX_IDS = 60;

interface AssignResult {
  id: string;
  action: "venue_pool" | "wikimedia" | "skipped";
  reason?: string;
  url?: string;
  source?: string;
  attribution?: string | null;
  venue_id?: string;
  venue_name?: string;
  /** True when this call attached the venue (revert must also detach). */
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

  const [thingsRes, venuesRes, poolsRes] = await Promise.all([
    sb.from("things")
      .select("id, title, address, lat, lng, place_id, venue_id, photo_url, photo_source, photo_attribution, photo_options")
      .in("id", ids),
    sb.from("venues")
      .select("id, display_name, place_id, lat, lng, radius_m, name_patterns")
      .eq("status", "active"),
    sb.from("venue_photos")
      .select("venue_id, source, serving_url, attribution")
      .eq("approved", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (thingsRes.error) return NextResponse.json({ error: thingsRes.error.message }, { status: 500 });

  const venueRows = venuesRes.data ?? [];
  const matchableVenues: MatchableVenue[] = venueRows.map((v) => ({
    id: v.id as string, place_id: (v.place_id as string) ?? null,
    lat: (v.lat as number) ?? null, lng: (v.lng as number) ?? null,
    radius_m: (v.radius_m as number) ?? 150, name_patterns: (v.name_patterns as string[]) ?? [],
  }));
  const venueNameById = new Map(venueRows.map((v) => [v.id as string, v.display_name as string]));

  const pools = new Map<string, { source: string; serving_url: string | null; attribution: string | null }[]>();
  for (const p of poolsRes.data ?? []) {
    const vid = p.venue_id as string;
    if (!pools.has(vid)) pools.set(vid, []);
    pools.get(vid)!.push({
      source: p.source as string, serving_url: (p.serving_url as string) ?? null,
      attribution: (p.attribution as string) ?? null,
    });
  }

  const today = sbDay(Date.now());
  const results: AssignResult[] = [];
  let applied = 0;

  for (const t of thingsRes.data ?? []) {
    const id = t.id as string;
    const curSource = (t.photo_source as string) ?? "placeholder";
    const curUrl = (t.photo_url as string) ?? null;
    // Raced with a manual apply between load and click — leave it alone.
    if (curUrl && curSource !== "placeholder" && curSource !== "motif") {
      results.push({ id, action: "skipped", reason: "already has a photo" });
      continue;
    }
    const prev = { url: curUrl, source: curSource, attribution: (t.photo_attribution as string) ?? null };

    // 1 — venue pool (existing attach, or a new strong-match attach).
    let venueId = (t.venue_id as string) ?? null;
    let attachedNow = false;
    if (!venueId) {
      const thing: MatchableThing = {
        title: t.title as string, address: (t.address as string) ?? null,
        lat: (t.lat as number) ?? null, lng: (t.lng as number) ?? null,
        place_id: (t.place_id as string) ?? null,
      };
      const best = bestVenueMatch(thing, matchableVenues);
      if (best && best.score >= STRONG_MATCH_SCORE && (pools.get(best.venue.id)?.some((p) => p.serving_url) ?? false)) {
        const { error } = await sb.from("things").update({ venue_id: best.venue.id }).eq("id", id);
        if (!error) {
          venueId = best.venue.id;
          attachedNow = true;
          await sb.from("audit_log").insert({
            entity_type: "thing", entity_id: id, action: "venue_match_approved", actor: "founder",
            payload: { venue_id: venueId, via: "images_auto_assign", score: best.score },
          });
        }
      }
    }
    const pool = venueId ? (pools.get(venueId) ?? []).filter((p) => p.serving_url) : [];
    if (venueId && pool.length) {
      const picked = pool[pickFromPool(id, today, pool.length)];
      const { error } = await sb.from("things").update({
        photo_url: picked.serving_url, photo_source: picked.source, photo_attribution: picked.attribution,
      }).eq("id", id);
      if (!error) {
        applied++;
        await sb.from("audit_log").insert({
          entity_type: "thing", entity_id: id, action: "photo_set", actor: "founder",
          payload: { photo_url: picked.serving_url, photo_source: picked.source, via: "images_auto_assign" },
        });
        results.push({
          id, action: "venue_pool", url: picked.serving_url!, source: picked.source, attribution: picked.attribution,
          venue_id: venueId, venue_name: venueNameById.get(venueId), attached_now: attachedNow, prev,
        });
        continue;
      }
    }

    // 2 — top pre-fetched free option (already gated + score-floored at fetch time).
    const options = ((t.photo_options as PhotoOption[]) ?? []).filter(
      (o) => o.url && (o.source === "wikimedia" || o.source === "owned"),
    );
    const top = options[0];
    if (top) {
      const { error } = await sb.from("things").update({
        photo_url: top.url, photo_source: top.source, photo_attribution: top.attribution ?? null,
      }).eq("id", id);
      if (!error) {
        applied++;
        await sb.from("audit_log").insert({
          entity_type: "thing", entity_id: id, action: "photo_set", actor: "founder",
          payload: { photo_url: top.url, photo_source: top.source, via: "images_auto_assign" },
        });
        results.push({
          id, action: "wikimedia", url: top.url, source: top.source, attribution: top.attribution ?? null,
          attached_now: attachedNow, prev,
        });
        continue;
      }
    }

    results.push({ id, action: "skipped", reason: "no confident free image", attached_now: attachedNow });
  }

  if (applied) revalidatePublic();
  return NextResponse.json({ ok: true, results, applied });
}
