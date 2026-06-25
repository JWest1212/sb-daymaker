import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";

export const dynamic = "force-dynamic";

// POST { id } -> single-card Google Places Photo fetch for the rare placeholder
// case (Doc 11 §9a). PHASE-13 STUB: the cap-checked Google fetch + image resolver
// land in Phase 13, so for now this reports that cleanly rather than 404ing.
export async function POST() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(
    { ok: false, reason: "phase13", message: "Image resolution arrives in Phase 13." },
    { status: 200 },
  );
}
