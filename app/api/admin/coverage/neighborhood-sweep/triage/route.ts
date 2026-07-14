import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { assignTriageZone } from "@/lib/neighborhoodSweepServer";
import { DOOR_ZONES, type DoorZoneKey } from "@/lib/doorZones";

export const dynamic = "force-dynamic";

const VALID_ZONE_KEYS = new Set<string>(DOOR_ZONES.map((z) => z.key));

// POST { id, zoneKey, venueName? } -> Doc 19 §6 Phase 4 one-tap triage assign.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const zoneKey = typeof body?.zoneKey === "string" ? body.zoneKey : null;
  const venueName = typeof body?.venueName === "string" ? body.venueName : null;

  if (!id || !zoneKey || (zoneKey !== "other" && !VALID_ZONE_KEYS.has(zoneKey))) {
    return NextResponse.json({ error: "invalid id or zoneKey" }, { status: 400 });
  }

  const result = await assignTriageZone({ id, zoneKey: zoneKey as DoorZoneKey | "other", venueName });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
