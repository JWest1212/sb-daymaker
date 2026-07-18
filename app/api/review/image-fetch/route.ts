import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { findFreeCandidates, type ImageOption } from "@/ingest/images";

export const dynamic = "force-dynamic";

// POST { id } -> single-card free image fetch for a queue card with no options.
// Was a Phase-13 stub; wired 2026-07-11 to the Images desk's findFreeCandidates
// (Wikimedia geosearch top-5 when the thing has coordinates + best title-search
// hit, free, never Google, never the paid cap). Persists the merged result to
// photo_options so the fetched candidates survive approve/reload, and returns
// them so the queue card can show the picker immediately.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await sb
    .from("things")
    .select("id, title, neighborhood, happening_category, lat, lng, photo_options")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "not found" }, { status: 404 });

  const existing = (data.photo_options as ImageOption[]) ?? [];
  const options = await findFreeCandidates({
    title: data.title as string,
    neighborhood: (data.neighborhood as string) ?? null,
    happening_category: (data.happening_category as string) ?? null,
    lat: (data.lat as number) ?? null,
    lng: (data.lng as number) ?? null,
  }, existing);

  const before = new Set(existing.filter((o) => o.url).map((o) => o.url));
  const found = options.filter((o) => o.url).length;
  if (options.some((o) => o.url && !before.has(o.url))) {
    await sb.from("things").update({ photo_options: options }).eq("id", id);
  }

  return NextResponse.json({
    ok: true,
    options,
    count: found,
    message: found
      ? `Found ${found} free photo option(s), arrow through and approve.`
      : "No free photo found for this one, it will land with a motif, or set one from the Images tab after publishing.",
  });
}
