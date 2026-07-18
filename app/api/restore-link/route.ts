import { NextResponse, type NextRequest } from "next/server";
import { createSaveRestore } from "@/lib/shares";
import { sendEmail } from "@/lib/email";

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

  // Inline hex is required in email HTML (email clients can't read CSS vars);
  // #16586A is the Pacific token, mirroring how /api/subscribe builds its email.
  const html = `<p>Your saves, safe and sound. Open this link on any device to bring them back:</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#16586A;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">Restore my saved list</a></p>
<p style="color:#888;font-size:12px">Or paste this link into any browser:<br>${link}</p>`;

  const sent = await sendEmail({
    to: email,
    subject: "Your SB Daymaker saved list",
    html,
  });

  // Never log the email or the token.
  return NextResponse.json({ ok: true, token, sent });
}
