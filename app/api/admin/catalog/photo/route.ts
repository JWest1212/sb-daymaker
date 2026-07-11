import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id, source, url?, attribution?, venue_photo_id? } -> instant photo
// apply, no re-review. Founder-picked from the thing's own photo_options
// (populated by the resolver) in the Live-catalog edit sheet. Metadata-immediate
// like /api/admin/weight — applies straight to the live row. `source:
// "placeholder"` (url omitted) explicitly clears the photo back to the branded
// gradient fallback.
//
// `venue_photo_id` (Card Imagery Phase 2, Live-catalog follow-up, 2026-07-10) is
// set ONLY when the picked option came from the venue-backed fetch
// (/api/admin/catalog/venue-photos/fetch) — approves that venue_photos row
// (approved=true + appended sort_order) in the SAME request, so the photo joins
// the venue's compliant, auto-refreshed pool instead of just sitting as a raw URL
// on this one thing. A plain "find more options" (Wikimedia) pick has no
// venue_photo_id and behaves exactly as before.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as {
    thing_id?: string;
    url?: string | null;
    source?: string;
    attribution?: string | null;
    venue_photo_id?: string;
  };
  if (!body.thing_id || !body.source) {
    return NextResponse.json({ error: "thing_id + source required" }, { status: 400 });
  }
  const isPlaceholder = body.source === "placeholder";
  if (!isPlaceholder && !body.url) {
    return NextResponse.json({ error: "url required unless source is placeholder" }, { status: 400 });
  }

  if (body.venue_photo_id && !isPlaceholder) {
    const { data: vp } = await sb.from("venue_photos").select("id, venue_id, approved").eq("id", body.venue_photo_id).maybeSingle();
    if (vp && !vp.approved) {
      const { data: maxSort } = await sb
        .from("venue_photos").select("sort_order").eq("venue_id", vp.venue_id as string).eq("approved", true)
        .order("sort_order", { ascending: false }).limit(1);
      const nextSort = ((maxSort?.[0]?.sort_order as number) ?? -1) + 1;
      await sb.from("venue_photos").update({ approved: true, sort_order: nextSort }).eq("id", body.venue_photo_id);
      await sb.from("audit_log").insert({
        entity_type: "venue_photo", entity_id: body.venue_photo_id, action: "photo_approved", actor: "founder",
        payload: { venue_id: vp.venue_id, via: "catalog" },
      });
    }
  }

  const photo_url = isPlaceholder ? null : body.url!;
  const photo_attribution = isPlaceholder ? null : (body.attribution ?? null);

  // Fold the applied pick into photo_options (dedup by url) so a "find more options"
  // discovery survives closing the sheet — otherwise re-opening edit later can't
  // recognize the live photo as one of its own alternates and mis-shows "Use this
  // photo" on an unrelated option. Read-modify-write is fine here: this route is a
  // single admin's deliberate click, not a concurrent hot path.
  let photo_options: unknown[] | undefined;
  if (!isPlaceholder) {
    const { data: current } = await sb.from("things").select("photo_options").eq("id", body.thing_id).maybeSingle();
    const existing = (current?.photo_options as { url: string }[] | null) ?? [];
    photo_options = existing.some((o) => o.url === photo_url)
      ? existing
      : [{ url: photo_url, source: body.source, attribution: photo_attribution }, ...existing];
  }

  const { error } = await sb
    .from("things")
    .update({
      photo_url,
      photo_source: body.source,
      photo_attribution,
      ...(photo_options ? { photo_options } : {}),
    })
    .eq("id", body.thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing",
    entity_id: body.thing_id,
    action: "photo_set",
    actor: "founder",
    payload: { photo_url, photo_source: body.source },
  });

  revalidatePublic(); // a photo change is visible on the live card immediately
  return NextResponse.json({ ok: true });
}
