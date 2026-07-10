import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadVenuesData } from "@/lib/venuesServer";

export const dynamic = "force-dynamic";

// GET -> the Venues tab's full data set (venues + approved/candidate photos + the
// live-computed fuzzy match proposals). No POST here — every mutation is its own
// scoped route below (match, photos/fetch, photos/approve, photos/remove,
// photos/reorder, edit) so each action's audit_log entry stays specific.
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await loadVenuesData());
}
