import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { renderTransactionalEmail } from "@/lib/email/transactional";

export async function POST(req: NextRequest) {
  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }

  const { data, error } = await sb.rpc("subscribe_email", { p_email: email });
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "subscribe failed" }, { status: 500 });
  }

  const { status, confirm_token, unsubscribe_token } = data as {
    status: string;
    confirm_token: string;
    unsubscribe_token: string;
  };

  const origin = req.nextUrl.origin;

  // R1 W7.6 (review fix). An address that is already confirmed gets a short
  // "you're already on the list" note, and the response is IDENTICAL to a
  // first-time signup. Before, the API answered {status:"already"} and sent
  // nothing, so anyone could POST an address and learn whether it was on the
  // list, and the page told a returning subscriber to check an inbox that
  // would stay empty. Now the page's "check your inbox" is true either way.
  if (status === "confirmed") {
    const note = renderTransactionalEmail({
      preheader: "Nothing to do: you're already subscribed.",
      heading: "You're already subscribed",
      paragraphs: [
        "Someone, probably you, just asked to subscribe this address. It's already confirmed, so there is nothing to do.",
      ],
      button: { label: "See the latest sample", url: `${origin}/digest/sample` },
      footNote: "Want out instead? You can {unsubscribe} anytime.",
      unsubscribeUrl: `${origin}/unsubscribe?token=${unsubscribe_token}`,
      cadence: true,
    });
    await sendEmail({ to: email, subject: "You're already subscribed to SB Daymaker", html: note.html, text: note.text });
    return NextResponse.json({ ok: true, status: "pending" });
  }

  // Send the double-opt-in confirmation (no-op if Resend isn't configured yet).
  const confirmUrl = `${origin}/confirm?token=${confirm_token}`;
  const unsubUrl = `${origin}/unsubscribe?token=${unsubscribe_token}`;
  // R1 W7.7 (EML-001). The digest's template, not three bare paragraphs.
  const mail = renderTransactionalEmail({
    preheader: "One tap and Santa Barbara lands in your inbox.",
    heading: "Confirm your subscription",
    paragraphs: [
      "Tap the button and you're in: the pick of what's on, a few more worth your time, and one evergreen spot.",
    ],
    button: { label: "Confirm my subscription", url: confirmUrl },
    footNote: "Didn't sign up? Ignore this email, or {unsubscribe}.",
    unsubscribeUrl: unsubUrl,
    cadence: true,
  });
  await sendEmail({
    to: email,
    subject: "Confirm your SB Daymaker digest",
    html: mail.html,
    text: mail.text,
  });

  return NextResponse.json({ ok: true, status: "pending" });
}
