import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { photo_id } -> Card Imagery Build Spec Phase 2 §5.3: "Reject hides it"
// (an unapproved candidate) or removes an already-approved photo from the pool —
// same action either way (delete the row; there's no `rejected` state in the
// additive-only Phase 2 DDL, and an unapproved row is invisible to the public
// regardless of RLS, so deleting is equivalent to hiding). Does NOT touch any
// thing currently displaying this photo — its photo_url stays as-is until the next
// resolve/backfill pass or a founder's own per-thing picker override.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { photo_id } = (await req.json()) as { photo_id?: string };
  if (!photo_id) return NextResponse.json({ error: "photo_id required" }, { status: 400 });

  const { error } = await sb.from("venue_photos").delete().eq("id", photo_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
