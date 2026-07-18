import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { loadRenderableEdition } from "@/lib/edition/renderData";
import { renderEditionEmailHtml } from "@/lib/edition/render";

export const dynamic = "force-dynamic";

// GET -> the live-preview HTML for the cockpit's iframe (spec §5.1: "Renders a
// live preview of the edition, reuse the renderer"). Same renderer the public
// permalink and the send path use, never forked. Admin-gated so draft/approved
// (not-yet-sent) editions can be previewed, unlike the public route.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return new NextResponse("not configured", { status: 500 });

  const { id } = await params;
  const { data: ed } = await sb.from("editions").select("edition_date").eq("id", id).maybeSingle();
  if (!ed) return new NextResponse("not found", { status: 404 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sbdaymaker.com").replace(/\/+$/, "");
  const edition = await loadRenderableEdition(sb, ed.edition_date, { siteUrl }, true);
  if (!edition) return new NextResponse("not found", { status: 404 });

  const html = renderEditionEmailHtml(edition);
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
