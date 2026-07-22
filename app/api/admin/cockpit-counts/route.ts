import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadShellCounts } from "@/lib/todayServer";

export const dynamic = "force-dynamic";

// QW9, backs the topbar's focus-refresh (CockpitTabs re-pulls this on window
// focus/visibilitychange, not on a poll interval). S1 2.3 widened the payload
// from the topbar-only counts to every tab badge (same loadShellCounts the
// layout uses on first render).
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const counts = await loadShellCounts();
  return NextResponse.json({ counts });
}
