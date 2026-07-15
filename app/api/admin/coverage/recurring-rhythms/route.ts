import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadRecurringRhythms, addRecurringRhythm } from "@/lib/recurringRhythmsServer";
import { NEIGHBORHOODS, OCCASION_TAGS } from "@/lib/review";
import { RECURRING_CATEGORIES, RECUR_FREQUENCIES } from "@/lib/recurringRhythms";

export const dynamic = "force-dynamic";

const NEIGHBORHOOD_SET = new Set<string>(NEIGHBORHOODS);
const CATEGORY_SET = new Set<string>(RECURRING_CATEGORIES);
const FREQUENCY_SET = new Set<string>(RECUR_FREQUENCIES);
const TAG_SET = new Set<string>(OCCASION_TAGS);

// GET -> every recurring_rhythms row (active + inactive), for the cockpit list.
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ rhythms: await loadRecurringRhythms() });
}

// POST -> add a new rhythm (§5, "add"). Lands active immediately; the next
// nightly run picks it up, no deploy.
export async function POST(req: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  const { title, venue, address, neighborhood, category, reasonToGo, frequency, sourceUrl, day, occasionTags } = body;
  if (typeof title !== "string" || typeof venue !== "string" || typeof address !== "string" || typeof reasonToGo !== "string" || typeof sourceUrl !== "string") {
    return NextResponse.json({ error: "title, venue, address, reasonToGo, and sourceUrl must be strings" }, { status: 400 });
  }
  if (!NEIGHBORHOOD_SET.has(neighborhood)) return NextResponse.json({ error: "invalid neighborhood" }, { status: 400 });
  if (!CATEGORY_SET.has(category)) return NextResponse.json({ error: "invalid category" }, { status: 400 });
  if (!FREQUENCY_SET.has(frequency)) return NextResponse.json({ error: "invalid frequency" }, { status: 400 });
  if (typeof day?.dow !== "number" || day.dow < 0 || day.dow > 6) return NextResponse.json({ error: "invalid day of week" }, { status: 400 });
  if (day.start != null && typeof day.start !== "string") return NextResponse.json({ error: "invalid start time" }, { status: 400 });
  if (day.end != null && typeof day.end !== "string") return NextResponse.json({ error: "invalid end time" }, { status: 400 });
  const tags = Array.isArray(occasionTags) ? occasionTags.filter((t) => TAG_SET.has(t)) : null;

  const result = await addRecurringRhythm({
    title, venue, address, neighborhood, category, reasonToGo, frequency, sourceUrl,
    day: { dow: day.dow, start: day.start ?? null, end: day.end ?? null },
    occasionTags: tags,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
