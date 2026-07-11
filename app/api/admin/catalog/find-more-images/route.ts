import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { findMoreOptions, imageQuery, type ImageOption } from "@/ingest/images";
import type { Neighborhood } from "@/packages/shared/types";

export const dynamic = "force-dynamic";

// POST { thing_id } -> widen this thing's photo_options with a fresh free-source
// search (Wikimedia only since Phase 3 retired Pexels — see findMoreOptions()'s
// own doc comment; never Google). Read-only: nothing is persisted here. The
// founder still picks and applies via /api/admin/catalog/photo — LC-13 wired
// this in as the catalog picker's "Search wider (free)" button.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { thing_id } = (await req.json()) as { thing_id?: string };
  if (!thing_id) return NextResponse.json({ error: "thing_id required" }, { status: 400 });

  const { data, error } = await sb
    .from("things")
    .select("title, neighborhood, happening_category, photo_options")
    .eq("id", thing_id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "not found" }, { status: 404 });

  const query = imageQuery({
    title: data.title as string,
    neighborhood: (data.neighborhood as Neighborhood) ?? undefined,
    happening_category: (data.happening_category as string) ?? undefined,
  });
  const options = await findMoreOptions(query, (data.photo_options as ImageOption[]) ?? []);
  return NextResponse.json({ ok: true, options });
}
