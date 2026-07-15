import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { updateRecurringRhythm } from "@/lib/recurringRhythmsServer";
import { NEIGHBORHOODS, OCCASION_TAGS } from "@/lib/review";
import { RECURRING_CATEGORIES, RECUR_FREQUENCIES } from "@/lib/recurringRhythms";

export const dynamic = "force-dynamic";

const NEIGHBORHOOD_SET = new Set<string>(NEIGHBORHOODS);
const CATEGORY_SET = new Set<string>(RECURRING_CATEGORIES);
const FREQUENCY_SET = new Set<string>(RECUR_FREQUENCIES);
const TAG_SET = new Set<string>(OCCASION_TAGS);

// PATCH -> edit any subset of fields, or just flip `active` (§5, "edit" / "toggle
// active"). Partial body: only the keys present are written.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  if (body.neighborhood !== undefined && !NEIGHBORHOOD_SET.has(body.neighborhood)) {
    return NextResponse.json({ error: "invalid neighborhood" }, { status: 400 });
  }
  if (body.category !== undefined && !CATEGORY_SET.has(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  if (body.frequency !== undefined && !FREQUENCY_SET.has(body.frequency)) {
    return NextResponse.json({ error: "invalid frequency" }, { status: 400 });
  }
  if (body.day !== undefined) {
    if (typeof body.day?.dow !== "number" || body.day.dow < 0 || body.day.dow > 6) {
      return NextResponse.json({ error: "invalid day of week" }, { status: 400 });
    }
  }
  if (body.active !== undefined && typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }

  const result = await updateRecurringRhythm(id, {
    title: body.title, venue: body.venue, address: body.address,
    neighborhood: body.neighborhood, category: body.category, reasonToGo: body.reasonToGo,
    frequency: body.frequency, sourceUrl: body.sourceUrl,
    day: body.day ? { dow: body.day.dow, start: body.day.start ?? null, end: body.day.end ?? null } : undefined,
    occasionTags: body.occasionTags !== undefined
      ? (Array.isArray(body.occasionTags) ? body.occasionTags.filter((t: string) => TAG_SET.has(t)) : null)
      : undefined,
    active: body.active,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
