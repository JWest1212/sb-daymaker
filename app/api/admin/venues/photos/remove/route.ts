import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { pickFromPool } from "@/lib/venuePool";
import { assignVisual } from "@/lib/visualAssignment";
import { matchMarqueeVenue } from "@/ingest/marqueeVenues";
import { sbDay } from "@/lib/explore";
import type { HappeningCategory } from "@/packages/shared/types";

export const dynamic = "force-dynamic";

// POST { photo_id } -> Card Imagery Build Spec Phase 2 §5.3: "Reject hides it"
// (an unapproved candidate) or removes an already-approved photo from the pool —
// same action either way (delete the row; there's no `rejected` state in the
// additive-only Phase 2 DDL, and an unapproved row is invisible to the public
// regardless of RLS, so deleting is equivalent to hiding).
//
// Phase 7 (V-9) — a removed APPROVED photo no longer just leaves things stranded
// on a dead URL: every thing at this venue currently serving that exact photo is
// re-picked from whatever pool remains (same deterministic rotation the resolver
// uses), or falls to its own deterministic motif/big-type if the pool is now
// empty. An unapproved candidate's removal never touches any thing (nothing was
// ever serving a candidate).
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { photo_id } = (await req.json()) as { photo_id?: string };
  if (!photo_id) return NextResponse.json({ error: "photo_id required" }, { status: 400 });

  const { data: row } = await sb
    .from("venue_photos").select("id, venue_id, serving_url, approved").eq("id", photo_id).maybeSingle();
  if (!row) return NextResponse.json({ error: "photo not found" }, { status: 404 });

  const { error } = await sb.from("venue_photos").delete().eq("id", photo_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // V-15 — consistent audit trail across all six venue mutations.
  await sb.from("audit_log").insert({
    entity_type: "venue_photo", entity_id: photo_id, action: "photo_removed", actor: "founder",
    payload: { venue_id: row.venue_id, approved: row.approved },
  });

  let reassigned = 0;
  if (row.approved && row.serving_url) {
    const { data: affected } = await sb
      .from("things")
      .select("id, title, happening_category, lat, lng")
      .eq("venue_id", row.venue_id as string).eq("photo_url", row.serving_url as string);

    if (affected?.length) {
      const { data: pool } = await sb
        .from("venue_photos").select("source, serving_url, attribution")
        .eq("venue_id", row.venue_id as string).eq("approved", true)
        .order("sort_order", { ascending: true });
      const remaining = (pool ?? []).filter((p) => p.serving_url);
      const today = sbDay(Date.now());

      for (const t of affected) {
        if (remaining.length) {
          const idx = pickFromPool(t.id as string, today, remaining.length);
          const picked = remaining[idx];
          await sb.from("things").update({
            photo_url: picked.serving_url, photo_source: picked.source, photo_attribution: picked.attribution ?? null,
          }).eq("id", t.id);
        } else {
          const marquee = matchMarqueeVenue({ title: t.title as string, lat: (t.lat as number) ?? undefined, lng: (t.lng as number) ?? undefined });
          const visual = assignVisual({ id: t.id as string, happening_category: t.happening_category as HappeningCategory | null }, marquee?.key);
          await sb.from("things").update({
            photo_url: null, photo_source: "motif", photo_attribution: null,
            visual_kind: visual.visual_kind, visual_key: visual.visual_key, visual_seed: visual.visual_seed,
          }).eq("id", t.id);
        }
      }

      await sb.from("audit_log").insert(
        affected.map((t) => ({
          entity_type: "thing", entity_id: t.id, action: "venue_photo_cleanup_reassigned", actor: "founder",
          payload: { venue_id: row.venue_id, removed_photo_url: row.serving_url, remaining_pool: remaining.length },
        })),
      );
      reassigned = affected.length;
      revalidatePublic();
    }
  }

  return NextResponse.json({ ok: true, reassigned });
}
