import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { OCCASION_TAGS, filterTags } from "@/lib/review";

export const dynamic = "force-dynamic";

type BulkOp = "hero_on" | "hero_off" | "add_tag" | "remove_tag" | "set_weight" | "archive" | "unarchive";

// POST { ids: string[], op, tag?, weight? } -> LC-3, the biggest cockpit time win:
// apply one safe, uniform operation across many published rows at once. Blurb and
// photo stay per-item by nature (not bulkable). Negative-tag rules (filterTags)
// are still enforced server-side for add_tag — a row an illegal tag doesn't apply
// to is silently skipped and counted, not force-applied or hard-failed. Archive
// is reversible (status='archived', same as the single-row delete route) so the
// client can offer an Undo via the 'unarchive' op.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as { ids?: string[]; op?: BulkOp; tag?: string; weight?: number };
  const ids = body.ids ?? [];
  if (!ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });
  const op = body.op;

  const audit = (action: string, extra?: Record<string, unknown>) =>
    sb.from("audit_log").insert(
      ids.map((id) => ({ entity_type: "thing", entity_id: id, action, actor: "founder", ...(extra ? { payload: extra } : {}) })),
    );

  if (op === "hero_on" || op === "hero_off") {
    const hero_eligible = op === "hero_on";
    const { error } = await sb.from("things").update({ hero_eligible }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("hero_toggle", { hero_eligible, via: "bulk" });
    return NextResponse.json({ ok: true, applied: ids.length });
  }

  if (op === "remove_tag") {
    const tag = body.tag;
    if (!tag) return NextResponse.json({ error: "tag required" }, { status: 400 });
    const { error } = await sb.from("thing_tags").delete().eq("tag", tag).in("thing_id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("bulk_tag_removed", { tag });
    revalidatePublic();
    return NextResponse.json({ ok: true, applied: ids.length });
  }

  if (op === "add_tag") {
    const tag = body.tag;
    if (!tag || !(OCCASION_TAGS as readonly string[]).includes(tag)) {
      return NextResponse.json({ error: "valid tag required" }, { status: 400 });
    }
    const { data: rows } = await sb.from("things").select("id, is_21_plus, price_band").in("id", ids);
    const eligible = (rows ?? []).filter(
      (r) => filterTags([tag], { is_21_plus: r.is_21_plus as boolean | null, price_band: r.price_band as string | null }).includes(tag),
    );
    const skipped = ids.length - eligible.length;
    if (eligible.length) {
      const eligibleIds = eligible.map((r) => r.id as string);
      const { data: existing } = await sb.from("thing_tags").select("thing_id").eq("tag", tag).in("thing_id", eligibleIds);
      const already = new Set((existing ?? []).map((r) => r.thing_id as string));
      const toInsert = eligibleIds.filter((id) => !already.has(id));
      if (toInsert.length) {
        const { error } = await sb.from("thing_tags")
          .insert(toInsert.map((thing_id) => ({ thing_id, tag, confidence: 1.0, tag_source: "founder" })));
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await audit("bulk_tag_added", { tag });
    }
    revalidatePublic();
    return NextResponse.json({ ok: true, applied: eligible.length, skipped });
  }

  if (op === "set_weight") {
    const weight = Math.max(-5, Math.min(5, Math.round(Number(body.weight ?? 0))));
    const { error } = await sb.from("things").update({ editorial_weight: weight }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("weight_set", { weight, via: "bulk" });
    return NextResponse.json({ ok: true, applied: ids.length });
  }

  if (op === "archive") {
    const { error } = await sb.from("things").update({ status: "archived" }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("archive", { via: "bulk" });
    revalidatePublic();
    return NextResponse.json({ ok: true, applied: ids.length });
  }

  if (op === "unarchive") {
    const { error } = await sb.from("things").update({ status: "published" }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("archive_undo", { via: "bulk" });
    revalidatePublic();
    return NextResponse.json({ ok: true, applied: ids.length });
  }

  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
