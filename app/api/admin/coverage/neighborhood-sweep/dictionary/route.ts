import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadVenueDictionary, addDictionaryVenue } from "@/lib/neighborhoodSweepServer";
import { DOOR_ZONES, type DoorZoneKey } from "@/lib/doorZones";

export const dynamic = "force-dynamic";

const VALID_ZONE_KEYS = new Set<string>(DOOR_ZONES.map((z) => z.key));

// GET -> the venue_neighborhoods dictionary (Doc 19 §5).
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ venues: await loadVenueDictionary() });
}

// POST { name, zoneKey } -> Doc 19 §5.3 direct "Add a venue" row.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : null;
  const zoneKey = typeof body?.zoneKey === "string" ? body.zoneKey : null;
  if (!name || !zoneKey || !VALID_ZONE_KEYS.has(zoneKey)) {
    return NextResponse.json({ error: "invalid name or zoneKey" }, { status: 400 });
  }

  const result = await addDictionaryVenue(name, zoneKey as DoorZoneKey);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
