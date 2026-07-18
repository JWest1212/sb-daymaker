import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadSources, addSource, SOURCE_LANES } from "@/lib/sourcesServer";

export const dynamic = "force-dynamic";

const LANE_SET = new Set<string>(SOURCE_LANES);

// GET -> every sources row (all statuses), for the Sources management page.
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ sources: await loadSources() });
}

// POST -> register a candidate source (§6, "add a candidate"). Lands as
// status='candidate', tracked, but does not itself start fetching; that
// still needs a code adapter or (later) the generic lane to read this key.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  const { key, label, url, authority, lane } = body;
  if (typeof key !== "string" || typeof label !== "string") {
    return NextResponse.json({ error: "key and label must be strings" }, { status: 400 });
  }
  if (typeof authority !== "number") return NextResponse.json({ error: "authority must be a number" }, { status: 400 });
  if (!LANE_SET.has(lane)) return NextResponse.json({ error: "invalid lane" }, { status: 400 });
  if (url !== undefined && url !== "" && typeof url !== "string") {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const result = await addSource({ key, label, url, authority, lane });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
