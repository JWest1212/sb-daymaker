import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { NEIGHBORHOODS, OCCASION_TAGS, filterTags, type EditPayload } from "@/lib/review";
import { ensureSlugsForThings } from "@/lib/slug/ensureSlug";

export const dynamic = "force-dynamic";

// POST { ids: string[], photo?, edits?, hero_eligible? }
// The single write path to status='published'. With `edits` (one card only) it
// applies the founder's pending changes AND publishes in one press (§A5). Bulk
// approve passes just { ids }. AI never sets a start time, edits carry no time.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { ids, photo, edits, hero_eligible, overlay_id } = (await req.json()) as {
    ids?: string[];
    photo?: { url: string; source: string };
    edits?: EditPayload;
    hero_eligible?: boolean;
    overlay_id?: string;
  };

  // ---- overlay approval: apply a pending thing_edits to its LIVE row (§3) ----
  // "Approve & replace live": the live row stays published; we overwrite its fields
  // with the edit (payload, plus any further in-queue edits), mark the overlay applied.
  if (overlay_id) {
    const { data: overlay } = await sb
      .from("thing_edits").select("thing_id, payload, status").eq("id", overlay_id).single();
    if (!overlay || overlay.status !== "pending") {
      return NextResponse.json({ error: "overlay not pending" }, { status: 400 });
    }
    const thingId = overlay.thing_id as string;
    const p = (edits ?? (overlay.payload as EditPayload) ?? {}) as EditPayload;
    const { data: live } = await sb.from("things").select("is_21_plus, price_band").eq("id", thingId).single();

    const today = new Date().toISOString().slice(0, 10);
    const patch: Record<string, unknown> = { status: "published", last_confirmed: today };
    const changed: Record<string, unknown> = {};
    if (typeof p.title === "string" && p.title.trim()) { patch.title = p.title.trim(); changed.title = patch.title; }
    if (p.blurb !== undefined) { patch.blurb = (p.blurb ?? "").toString().trim() || null; changed.blurb = patch.blurb; }
    if (p.blurb_long !== undefined) { patch.blurb_long = (p.blurb_long ?? "").toString().trim() || null; changed.blurb_long = patch.blurb_long; }
    if (p.neighborhood !== undefined) {
      patch.neighborhood = p.neighborhood && (NEIGHBORHOODS as readonly string[]).includes(p.neighborhood) ? p.neighborhood : null;
      changed.neighborhood = patch.neighborhood;
    }
    if (photo?.url) { patch.photo_url = photo.url; patch.photo_source = photo.source; }
    if (typeof hero_eligible === "boolean") patch.hero_eligible = hero_eligible;

    let tags: string[] | undefined;
    if (p.tags !== undefined) {
      tags = filterTags(p.tags, { is_21_plus: live?.is_21_plus ?? null, price_band: live?.price_band ?? null });
      const illegal = p.tags.filter((t) => (OCCASION_TAGS as readonly string[]).includes(t) && !tags!.includes(t));
      if (illegal.length) return NextResponse.json({ error: `Tag not allowed for this item: ${illegal.join(", ")}` }, { status: 400 });
      changed.tags = tags;
    }

    const { error } = await sb.from("things").update(patch).eq("id", thingId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (tags !== undefined) {
      await sb.from("thing_tags").delete().eq("thing_id", thingId);
      if (tags.length) {
        await sb.from("thing_tags").insert(tags.map((tag) => ({ thing_id: thingId, tag, confidence: 1.0, tag_source: "founder" })));
      }
    }
    await sb.from("thing_edits").update({ status: "applied", resolved_at: new Date().toISOString() }).eq("id", overlay_id);
    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: thingId, action: "edit_applied", actor: "founder",
      payload: { overlay_id, edits: changed },
    });
    revalidatePublic();
    return NextResponse.json({ ok: true, applied: overlay_id });
  }

  if (!ids?.length) return NextResponse.json({ error: "no ids" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = { status: "published", last_confirmed: today };
  if (photo?.url) { patch.photo_url = photo.url; patch.photo_source = photo.source; }
  if (typeof hero_eligible === "boolean") patch.hero_eligible = hero_eligible;

  // ---- single card with pending edits: apply + publish in one press (§A5) ----
  if (edits && ids.length === 1) {
    const id = ids[0];
    // The row's own facts gate the negative tag rules server-side.
    const { data: row } = await sb
      .from("things").select("is_21_plus, price_band").eq("id", id).single();

    const changed: Record<string, unknown> = {};
    if (typeof edits.title === "string" && edits.title.trim()) {
      patch.title = edits.title.trim(); changed.title = patch.title;
    }
    if (edits.blurb !== undefined) {
      patch.blurb = (edits.blurb ?? "").toString().trim() || null; changed.blurb = patch.blurb;
    }
    if (edits.blurb_long !== undefined) {
      patch.blurb_long = (edits.blurb_long ?? "").toString().trim() || null; changed.blurb_long = patch.blurb_long;
    }
    if (edits.neighborhood !== undefined) {
      patch.neighborhood =
        edits.neighborhood && (NEIGHBORHOODS as readonly string[]).includes(edits.neighborhood)
          ? edits.neighborhood : null;
      changed.neighborhood = patch.neighborhood;
    }

    let tags: string[] | undefined;
    if (edits.tags !== undefined) {
      tags = filterTags(edits.tags, { is_21_plus: row?.is_21_plus ?? null, price_band: row?.price_band ?? null });
      // Enforce the negative rules at write time: refuse an explicitly illegal tag
      // (21+ never gets family_day; non-free never gets free_sb) rather than silently drop.
      const illegal = edits.tags.filter(
        (t) => (OCCASION_TAGS as readonly string[]).includes(t) && !tags!.includes(t),
      );
      if (illegal.length) {
        return NextResponse.json(
          { error: `Tag not allowed for this item: ${illegal.join(", ")}` }, { status: 400 },
        );
      }
      changed.tags = tags;
    }

    const { error } = await sb.from("things").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (tags !== undefined) {
      await sb.from("thing_tags").delete().eq("thing_id", id);
      if (tags.length) {
        await sb.from("thing_tags").insert(
          tags.map((tag) => ({ thing_id: id, tag, confidence: 1.0, tag_source: "founder" })),
        );
      }
    }

    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: id, action: "approve", actor: "founder",
      payload: { edits: changed, ...(typeof hero_eligible === "boolean" ? { hero_eligible } : {}) },
    });
    // G2.1, assign the slug + redirect at publish time (not just the nightly).
    await ensureSlugsForThings(sb, [id]);
    revalidatePublic();
    return NextResponse.json({ ok: true, published: 1 });
  }

  // ---- bulk / no-edits publish ----
  const { error } = await sb.from("things").update(patch).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert(
    ids.map((id) => ({
      entity_type: "thing", entity_id: id, action: "approve", actor: "founder",
      ...(typeof hero_eligible === "boolean" ? { payload: { hero_eligible } } : {}),
    })),
  );
  // G2.1, assign slugs + redirects at publish time (not just the nightly).
  await ensureSlugsForThings(sb, ids);
  revalidatePublic();
  return NextResponse.json({ ok: true, published: ids.length });
}
