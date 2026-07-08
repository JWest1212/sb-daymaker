// Resend webhook receiver (spec §7.5). Handles bounces/complaints (suppress
// the address) and open/click tracking (bump the edition's counters for the
// cockpit archive). Signature-verified via svix — Resend signs webhooks the
// same way (see https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests);
// the raw request body must be used as-is, never re-parsed and re-stringified,
// or the signature check fails.

import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { getAdminSupabase } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    tags?: Record<string, string>;
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "missing signature headers" }, { status: 400 });
  }

  let event: ResendWebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const email = event.data.to?.[0];
  const editionId = event.data.tags?.edition_id;

  switch (event.type) {
    case "email.bounced":
      if (email) await sb.from("subscribers").update({ status: "bounced" }).eq("email", email);
      break;
    case "email.complained":
      if (email) await sb.from("subscribers").update({ status: "complained" }).eq("email", email);
      break;
    case "email.opened":
      if (editionId) await sb.rpc("increment_edition_open", { p_edition_id: editionId });
      break;
    case "email.clicked":
      if (editionId) await sb.rpc("increment_edition_click", { p_edition_id: editionId });
      break;
    default:
      break; // delivered/sent/scheduled/etc. — nothing to record for V1
  }

  return NextResponse.json({ ok: true });
}
