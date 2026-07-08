import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { loadPendingEditions, loadEditionDraftDetail } from "@/lib/edition/cockpitServer";
import { EditionDraftView } from "./EditionDraftView";

export const metadata: Metadata = { title: "Edition draft — SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditionDraftPage() {
  const sb = getAdminSupabase();
  const pending = sb ? await loadPendingEditions(sb) : [];
  const initialDetail = sb && pending[0] ? await loadEditionDraftDetail(sb, pending[0].id) : null;
  return <EditionDraftView pending={pending} initialDetail={initialDetail} />;
}
