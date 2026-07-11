import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { photo_id, direction: "up"|"down" } -> swap sort_order with the adjacent
// approved photo in the same venue's pool (Card Imagery Build Spec Phase 2 §5.3
// "Reorder via sort controls").
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { photo_id, direction } = (await req.json()) as { photo_id?: string; direction?: "up" | "down" };
  if (!photo_id || (direction !== "up" && direction !== "down")) {
    return NextResponse.json({ error: "photo_id + direction ('up'|'down') required" }, { status: 400 });
  }

  const { data: photo, error: pErr } = await sb
    .from("venue_photos").select("venue_id, sort_order").eq("id", photo_id).eq("approved", true).maybeSingle();
  if (pErr || !photo) return NextResponse.json({ error: pErr?.message ?? "not found" }, { status: 404 });

  const { data: pool, error: poolErr } = await sb
    .from("venue_photos").select("id, sort_order").eq("venue_id", photo.venue_id as string).eq("approved", true)
    .order("sort_order", { ascending: true });
  if (poolErr || !pool) return NextResponse.json({ error: poolErr?.message ?? "pool read failed" }, { status: 500 });

  const idx = pool.findIndex((p) => p.id === photo_id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= pool.length) return NextResponse.json({ ok: true }); // no-op at either end

  const a = pool[idx], b = pool[swapIdx];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    sb.from("venue_photos").update({ sort_order: b.sort_order }).eq("id", a.id),
    sb.from("venue_photos").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });

  // V-15 — consistent audit trail across all six venue mutations.
  await sb.from("audit_log").insert({
    entity_type: "venue_photo", entity_id: photo_id, action: "photo_reordered", actor: "founder",
    payload: { venue_id: photo.venue_id, direction },
  });
  return NextResponse.json({ ok: true });
}
