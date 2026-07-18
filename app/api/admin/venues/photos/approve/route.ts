import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { photo_id } -> Card Imagery Build Spec Phase 2 §5.3: move a candidate into
// the approved pool (approved=true, sort_order appended to the end). No network
// call, the row already exists from the fetch step.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { photo_id } = (await req.json()) as { photo_id?: string };
  if (!photo_id) return NextResponse.json({ error: "photo_id required" }, { status: 400 });

  const { data: photo, error: pErr } = await sb.from("venue_photos").select("venue_id").eq("id", photo_id).maybeSingle();
  if (pErr || !photo) return NextResponse.json({ error: pErr?.message ?? "not found" }, { status: 404 });

  const { data: existing } = await sb
    .from("venue_photos").select("sort_order").eq("venue_id", photo.venue_id as string).eq("approved", true)
    .order("sort_order", { ascending: false }).limit(1);
  const nextSort = ((existing?.[0]?.sort_order as number) ?? -1) + 1;

  const { error } = await sb.from("venue_photos").update({ approved: true, sort_order: nextSort }).eq("id", photo_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "venue_photo", entity_id: photo_id, action: "photo_approved", actor: "founder",
    payload: { venue_id: photo.venue_id },
  });
  return NextResponse.json({ ok: true });
}
