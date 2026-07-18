import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { whenString } from "@/lib/review";

export const dynamic = "force-dynamic";

export interface AttachedThing {
  id: string;
  title: string;
  happening_tier: number;
  when: string;
  status: string;
}

// GET -> Phase 7 (V-7): the venue detail sheet's attached-events list, fetched
// lazily when the sheet opens (not baked into the main loader's payload, which
// already carries every venue up front). Includes archived-status things too, // their venue attachment is still real even if they're not published right now.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const { id } = await params;
  const { data, error } = await sb
    .from("things")
    .select("id, title, happening_tier, starts_at, status, recurring_schedules ( day_of_week, start_time, end_time, frequency, label )")
    .eq("venue_id", id)
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const things: AttachedThing[] = (data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    happening_tier: Number(t.happening_tier),
    when: whenString(Number(t.happening_tier), (t.starts_at as string) ?? null, (t.recurring_schedules as []) ?? []),
    status: t.status as string,
  }));

  return NextResponse.json({ ok: true, things });
}
