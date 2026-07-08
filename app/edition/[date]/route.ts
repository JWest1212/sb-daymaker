// The public "view in browser" permalink (edition_build_spec.md §9). Serves the
// exact renderer HTML — same function the email uses — for status='sent'
// editions only (loadRenderableEdition's default, matching the
// public_read_editions RLS policy). Uses the public anon client, not the
// service-role client: no elevated access needed for a public page. ISR at
// 600s, same cadence as the rest of the public catalog (Discover SB, /thing).

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { loadRenderableEdition } from "@/lib/edition/renderData";
import { renderEditionEmailHtml } from "@/lib/edition/render";

export const revalidate = 600;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) return new NextResponse("Not found", { status: 404 });

  const sb = getSupabase();
  if (!sb) return new NextResponse("Not configured", { status: 500 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sbdaymaker.com").replace(/\/+$/, "");
  const edition = await loadRenderableEdition(sb, date, { siteUrl });
  if (!edition) return new NextResponse("Not found", { status: 404 });

  const html = renderEditionEmailHtml(edition);
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
