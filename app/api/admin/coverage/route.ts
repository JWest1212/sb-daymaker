import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadCoverage } from "@/lib/coverageServer";

export const dynamic = "force-dynamic";

// GET ?dim=vibe|zone -> { dim, rows:[{ key, label, evergreen, windows:{7,14,30,45} }], generatedAt }
export async function GET(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dim = new URL(req.url).searchParams.get("dim") === "zone" ? "zone" : "vibe";
  return NextResponse.json(await loadCoverage(dim));
}
