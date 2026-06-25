import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// POST { ids: string[], photo?: { url, source } } -> publish + audit each.
// Handles a single approve and the bulk-approve-green batch in one call.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { ids, photo } = (await req.json()) as {
    ids?: string[];
    photo?: { url: string; source: string };
  };
  if (!ids?.length) return NextResponse.json({ error: "no ids" }, { status: 400 });

  const patch: Record<string, unknown> = { status: "published" };
  if (photo?.url) {
    patch.photo_url = photo.url;
    patch.photo_source = photo.source;
  }

  const { error } = await sb.from("things").update(patch).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert(
    ids.map((id) => ({
      entity_type: "thing",
      entity_id: id,
      action: "approve",
      actor: "founder",
    })),
  );
  return NextResponse.json({ ok: true, published: ids.length });
}
