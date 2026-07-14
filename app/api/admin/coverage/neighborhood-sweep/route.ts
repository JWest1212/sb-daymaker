import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { runNeighborhoodSweep } from "@/lib/neighborhoodSweepServer";

export const dynamic = "force-dynamic";

// GET -> the Doc 19 Phase 2 dry-run summary. Read-only — writes nothing
// (Phase 4 adds the apply path, a separate POST route).
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json(await runNeighborhoodSweep({ dry: true }));
}
