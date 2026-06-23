import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

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

  if (status === "confirmed") {
    return NextResponse.json({ ok: true, status: "already" });
  }

  // Send the double-opt-in confirmation (no-op if Resend isn't configured yet).
  const origin = req.nextUrl.origin;
  const confirmUrl = `${origin}/confirm?token=${confirm_token}`;
  const unsubUrl = `${origin}/unsubscribe?token=${unsubscribe_token}`;
  await sendEmail({
    to: email,
    subject: "Confirm your SB Daymaker digest",
    html: `<p>Tap to confirm your SB Daymaker weekend digest:</p>
<p><a href="${confirmUrl}">Confirm my subscription</a></p>
<p style="color:#888;font-size:12px">Didn't sign up? Ignore this email, or <a href="${unsubUrl}">unsubscribe</a>.</p>`,
  });

  return NextResponse.json({ ok: true, status: "pending" });
}
