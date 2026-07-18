import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { findFreeCandidates, type ImageOption } from "@/ingest/images";

export const dynamic = "force-dynamic";

// POST { thing_ids: string[] } -> Images desk background prefetch: run the free
// Wikimedia search (findFreeCandidates, geosearch top-5 when the thing has
// coordinates, plus the best title-search hit; never Google, never the paid
// cap) for a small batch of things and PERSIST the merged result to each
// thing's photo_options, so the desk's candidate strips are pre-loaded and
// survive a reload (same folding principle as /api/admin/catalog/photo).
// Capped per call so a batch stays well inside a function timeout, the client
// sends pages of ids in successive calls.
const MAX_IDS = 8;

export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const body = (await req.json()) as { thing_ids?: string[] };
  const ids = Array.isArray(body.thing_ids) ? body.thing_ids.filter((x) => typeof x === "string").slice(0, MAX_IDS) : [];
  if (!ids.length) return NextResponse.json({ error: "thing_ids required" }, { status: 400 });

  const { data, error } = await sb
    .from("things")
    .select("id, title, neighborhood, happening_category, lat, lng, photo_options")
    .in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const options: Record<string, ImageOption[]> = {};
  for (const t of data ?? []) {
    const existing = (t.photo_options as ImageOption[]) ?? [];
    const merged = await findFreeCandidates({
      title: t.title as string,
      neighborhood: (t.neighborhood as string) ?? null,
      happening_category: (t.happening_category as string) ?? null,
      lat: (t.lat as number) ?? null,
      lng: (t.lng as number) ?? null,
    }, existing);
    options[t.id as string] = merged;
    // Persist only when the search actually widened the set, a no-hit search
    // shouldn't churn the row (or the audit-free photo_options write) at all.
    const before = new Set(existing.filter((o) => o.url).map((o) => o.url));
    if (merged.some((o) => o.url && !before.has(o.url))) {
      await sb.from("things").update({ photo_options: merged }).eq("id", t.id as string);
    }
  }

  return NextResponse.json({ ok: true, options });
}
