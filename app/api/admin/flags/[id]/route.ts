// app/api/admin/flags/[id]/route.ts  (Elevation v1 · Gate 3 · G3.6)
//
// Admin-gated resolve/dismiss for a content_flags row. Sets status + resolved_at.

import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const status =
    action === "resolve" ? "resolved" : action === "dismiss" ? "dismissed" : action === "reviewing" ? "reviewing" : null;
  if (!status) return NextResponse.json({ error: "bad_action" }, { status: 400 });

  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const patch: Record<string, unknown> = {
    status,
    resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
  };
  const { error } = await sb.from("content_flags").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
