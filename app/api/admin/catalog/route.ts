import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadCatalog } from "@/lib/catalogServer";

export const dynamic = "force-dynamic";

// GET ?tier=&vibe=&zone=&q=&page=&status=&civic= -> things (50/page) with pending_edit flags.
export async function GET(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const tierRaw = Number(sp.get("tier"));
  return NextResponse.json(
    await loadCatalog({
      tier: tierRaw === 1 || tierRaw === 2 || tierRaw === 3 ? tierRaw : undefined,
      vibe: sp.get("vibe") || undefined,
      zone: sp.get("zone") || undefined,
      q: sp.get("q") || undefined,
      page: Number(sp.get("page")) || 1,
      // R1 W2.7, read-only visibility into what the pipeline did. No new write route.
      status: sp.get("status") === "archived" ? "archived" : "published",
      civic: sp.get("civic") === "civic" ? "civic" : sp.get("civic") === "leisure" ? "leisure" : undefined,
    }),
  );
}
