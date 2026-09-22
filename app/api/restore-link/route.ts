import { NextResponse, type NextRequest } from "next/server";
import { createSaveRestore } from "@/lib/shares";
import { sendEmail } from "@/lib/email";
import { renderTransactionalEmail } from "@/lib/email/transactional";

export const dynamic = "force-dynamic";

// Save-restore snapshot + magic-link email. Uses the anon client's SECURITY
// DEFINER RPC (an end-user action, never the service-role key). Like
// /api/subscribe, this public route can be made to email an arbitrary address;
// content is fixed and non-sensitive, so rate limiting is deferred to Wave 4.

type SaveState = "want" | "been";

function isValidSaves(v: unknown): v is Record<string, SaveState> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const entries = Object.entries(v);
  if (entries.length > 500) return false; // bound payload abuse
  return entries.every(([, val]) => val === "want" || val === "been");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  const { email, saves } = (body ?? {}) as { email?: unknown; saves?: unknown };
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }
  if (!isValidSaves(saves)) {
    return NextResponse.json({ ok: false, error: "invalid saves" }, { status: 400 });
  }

  const token = await createSaveRestore(email, saves);
  if (!token) {
    return NextResponse.json({ ok: false, error: "restore failed" }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const link = `${origin}/r/${token}`;

  // R1 W7.7 (EML-001). The digest's template, shared with the confirm email.
  const mail = renderTransactionalEmail({
    preheader: "Your saves, safe and sound.",
    heading: "Your saved list",
    paragraphs: ["Open this link on any device to bring your saves back."],
    button: { label: "Restore my saved list", url: link },
    footNote: "Didn't ask for this? Ignore this email; the link only restores a list, it never removes one.",
  });
  const sent = await sendEmail({
    to: email,
    subject: "Your SB Daymaker saved list",
    html: mail.html,
    text: mail.text,
  });

  // Never log the email or the token.
  return NextResponse.json({ ok: true, token, sent });
}
