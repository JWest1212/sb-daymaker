import { NextResponse } from "next/server";
import { getAdminUser, loadCockpitData } from "@/lib/reviewServer";

export const dynamic = "force-dynamic";

// GET /api/review/queue -> { queue, drops, sources } (today's run). Admin only.
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await loadCockpitData());
}
