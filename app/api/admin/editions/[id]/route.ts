import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { loadEditionDraftDetail } from "@/lib/edition/cockpitServer";
import { scheduledSendPassed } from "@/lib/edition/window";
import { sendEdition } from "@/lib/edition/send";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getAdminUser();
  return user ? getAdminSupabase() : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const detail = await loadEditionDraftDetail(sb, id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ edition: detail });
}

interface PatchBody {
  subject?: string;
  preheader?: string;
  greeting?: string;
  status?: "approved" | "skipped" | "draft";
  skip_reason?: string;
}

// PATCH — edit chrome fields and/or move status (approve / hold / back to draft).
// Never touches a 'sent' or 'failed' edition (those are the send path's + drafter's
// own territory) — draft/approved/skipped (on hold) are all mutable here, including
// moving OUT of 'skipped' again — a hold is an editorial note, not a lock.
//
// Approving an edition whose normal send window (14:00 UTC on its own date) has
// already passed sends it immediately, right here — otherwise it would silently
// wait forever, since the send cron only ever sends "today's" edition and never
// revisits a past date. Typical case: an edition was held past its scheduled
// time, then later approved — that approval IS the send trigger.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: current, error: curErr } = await sb.from("editions").select("status, edition_date").eq("id", id).maybeSingle();
  if (curErr || !current) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!["draft", "approved", "skipped"].includes(current.status)) {
    return NextResponse.json({ error: `edition is ${current.status} — no longer editable` }, { status: 400 });
  }

  const body = (await req.json()) as PatchBody;
  const update: Record<string, unknown> = {};
  if (body.subject !== undefined) update.subject = body.subject;
  if (body.preheader !== undefined) update.preheader = body.preheader;
  if (body.greeting !== undefined) update.greeting = body.greeting;
  if (body.skip_reason !== undefined) update.skip_reason = body.skip_reason;
  if (body.status !== undefined) {
    if (!["draft", "approved", "skipped"].includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === "approved") update.approved_at = new Date().toISOString();
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no fields to update" }, { status: 400 });

  const { error } = await sb.from("editions").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "edition", entity_id: id, action: body.status ? `edition_${body.status}` : "edition_edit",
    actor: "founder", payload: update,
  });

  if (body.status === "approved" && scheduledSendPassed(current.edition_date)) {
    const sendResult = await sendEdition(sb, current.edition_date);
    return NextResponse.json({ ok: true, sent: sendResult });
  }

  return NextResponse.json({ ok: true });
}
