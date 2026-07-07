import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { loadPendingEditions } from "@/lib/edition/cockpitServer";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getAdminUser();
  return user ? getAdminSupabase() : null;
}

// GET -> editions currently awaiting operator action (status draft|approved).
export async function GET() {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const editions = await loadPendingEditions(sb);
  return NextResponse.json({ editions });
}
