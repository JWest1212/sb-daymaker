import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadCoverageCell } from "@/lib/coverageServer";
import { COVERAGE_WINDOWS, type CoverageWindow } from "@/lib/coverage";

export const dynamic = "force-dynamic";

// GET ?dim=vibe|zone&key=<tag|zone>&window=7|14|30|45 -> the cell's contributing things.
export async function GET(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const dim = sp.get("dim") === "zone" ? "zone" : "vibe";
  const key = sp.get("key") ?? "";
  const window = Number(sp.get("window")) as CoverageWindow;
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  if (!COVERAGE_WINDOWS.includes(window)) {
    return NextResponse.json({ error: "window must be 7|14|30|45" }, { status: 400 });
  }

  return NextResponse.json({ items: await loadCoverageCell(dim, key, window) });
}
