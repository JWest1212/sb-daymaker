import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { applyResolvedNeighborhoods } from "@/lib/neighborhoodSweepServer";

export const dynamic = "force-dynamic";

// POST -> Doc 19 §6 Phase 4 "Apply resolved". Writes the >=0.75 matches to
// things.neighborhood + nearby_zone. Idempotent, re-running only touches rows
// whose resolved value actually changed since the last run.
export async function POST() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json(await applyResolvedNeighborhoods());
}
