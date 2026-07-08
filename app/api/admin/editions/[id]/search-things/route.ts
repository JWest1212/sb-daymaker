import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// GET ?q=... -> published things matching title (search-all fallback for the
// swap picker, spec §5.1). Edition-scoped only in that it requires admin auth;
// results aren't filtered against this edition's existing picks (an operator
// may legitimately want to see what's already in, and cross-slot duplicate
// prevention isn't a hard rule the cockpit needs to enforce silently).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await params; // present for route-shape consistency; not needed for the query itself

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ things: [] });

  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { data, error } = await sb
    .from("things")
    .select("id, title, blurb, blurb_long, neighborhood, photo_url, happening_tier")
    .eq("status", "published")
    .ilike("title", `%${q}%`)
    .limit(15);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ things: data ?? [] });
}
