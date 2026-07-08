import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getAdminUser();
  return user ? getAdminSupabase() : null;
}

interface PatchBody {
  override_title?: string | null;
  override_blurb?: string | null;
  override_when?: string | null;
  override_neighborhood?: string | null;
  override_local_note?: string | null;
  override_image_url?: string | null;
  position?: number;
}

// PATCH — edit a single pick's overrides and/or its render position. Writes
// overrides only (edition-scoped); the canonical `things` row is never
// touched (spec §4). Any edit here is editorial intent, so is_manual flips true.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pickId: string }> },
) {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, pickId } = await params;

  const { data: edition, error: edErr } = await sb.from("editions").select("status").eq("id", id).maybeSingle();
  if (edErr || !edition) return NextResponse.json({ error: "edition not found" }, { status: 404 });
  if (!["draft", "approved", "skipped"].includes(edition.status)) {
    return NextResponse.json({ error: `edition is ${edition.status} — no longer editable` }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;
  const update: Record<string, unknown> = { is_manual: true };
  for (const key of [
    "override_title", "override_blurb", "override_when",
    "override_neighborhood", "override_local_note", "override_image_url", "position",
  ] as const) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { error } = await sb.from("edition_picks").update(update).eq("id", pickId).eq("edition_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
