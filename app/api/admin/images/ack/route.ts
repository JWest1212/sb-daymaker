import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { thing_id } or { thing_ids: string[] } -> Images desk "Looks right
// as-is": persists the dismissal so these things stop reappearing in the
// imageless queue on future loads. Mirrors /api/admin/venues/ack (V-4) — a
// cockpit-side flag, nothing the public site renders, so no revalidatePublic().
// The bulk form backs the desk's "Keep motif (view)" tail-dismiss.
const MAX_IDS = 500;

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as { thing_id?: string; thing_ids?: string[] };
  const ids = Array.isArray(body.thing_ids)
    ? body.thing_ids.filter((x) => typeof x === "string").slice(0, MAX_IDS)
    : body.thing_id ? [body.thing_id] : [];
  if (!ids.length) return NextResponse.json({ error: "thing_id(s) required" }, { status: 400 });

  const { error } = await sb.from("things").update({ photo_ack: true }).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert(
    ids.map((id) => ({ entity_type: "thing", entity_id: id, action: "photo_ack", actor: "founder" })),
  );
  return NextResponse.json({ ok: true, acked: ids });
}
