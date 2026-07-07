// RFC 8058 one-click unsubscribe target — the URL referenced by the
// List-Unsubscribe / List-Unsubscribe-Post email headers (lib/edition/send.ts).
// Distinct from app/unsubscribe/page.tsx (the human-facing link INSIDE the
// email body, which a person clicks and expects to land on a confirmation
// page). This route is never meant to be opened in a browser — mail clients
// (Gmail, Yahoo, etc.) POST to it directly, in the background, with no
// visible navigation, when a recipient uses the client's native "Unsubscribe"
// button next to the message.
//
// GET is a deliberate no-op: automated link-safety scanners (corporate mail
// gateways, some spam filters) GET-fetch every URL in an email to check it,
// and per RFC 8058 the actual unsubscribe action must only happen on POST —
// otherwise a scanner could accidentally unsubscribe a real recipient.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function unsubscribe(token: string | null): Promise<void> {
  if (!token) return;
  const sb = getSupabase();
  if (!sb) return;
  await sb.rpc("unsubscribe", { p_token: token });
}

export async function POST(req: NextRequest) {
  await unsubscribe(req.nextUrl.searchParams.get("token"));
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return new NextResponse(null, { status: 200 });
}
