// lib/flagsServer.ts  (Elevation v1 · Gate 3 · G3.6, cockpit Flags view data)
//
// Service-role reads for the /admin/flags cockpit view. Server-only. Resolves each
// content_flags row to its target's title + link so the founder can jump straight
// to the thing/guide that needs a look.

import { getAdminSupabase } from "./supabaseAdmin";
import { cleanText } from "./text/stripEmDash";
import { FLAG_REASON_LABEL, type FlagReason } from "./flags";

export interface FlagRow {
  id: string;
  reason: string;
  reasonLabel: string;
  detail: string | null;
  status: string;
  created_at: string;
  targetKind: "thing" | "guide" | null;
  targetLabel: string;
  targetHref: string | null;
}

interface Target {
  id: string;
  title: string;
  slug: string | null;
}

/** Open (new + reviewing) flags, newest first, each resolved to its target. */
export async function loadFlags(): Promise<FlagRow[]> {
  const sb = getAdminSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("content_flags")
    .select("id, thing_id, guide_id, reason, detail, status, created_at")
    .in("status", ["new", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  const rows = data as {
    id: string;
    thing_id: string | null;
    guide_id: string | null;
    reason: string;
    detail: string | null;
    status: string;
    created_at: string;
  }[];

  const thingIds = [...new Set(rows.map((r) => r.thing_id).filter(Boolean))] as string[];
  const guideIds = [...new Set(rows.map((r) => r.guide_id).filter(Boolean))] as string[];
  const [things, guides] = await Promise.all([
    thingIds.length ? sb.from("things").select("id, title, slug").in("id", thingIds) : Promise.resolve({ data: [] }),
    guideIds.length ? sb.from("guides").select("id, title, slug").in("id", guideIds) : Promise.resolve({ data: [] }),
  ]);
  const tMap = new Map(((things.data ?? []) as Target[]).map((t) => [t.id, t]));
  const gMap = new Map(((guides.data ?? []) as Target[]).map((g) => [g.id, g]));

  return rows.map((r) => {
    const t = r.thing_id ? tMap.get(r.thing_id) : undefined;
    const g = r.guide_id ? gMap.get(r.guide_id) : undefined;
    const target = t ?? g;
    return {
      id: r.id,
      reason: r.reason,
      reasonLabel: FLAG_REASON_LABEL[r.reason as FlagReason] ?? r.reason,
      detail: cleanText(r.detail),
      status: r.status,
      created_at: r.created_at,
      targetKind: t ? "thing" : g ? "guide" : null,
      targetLabel: target ? cleanText(target.title) : "(removed)",
      targetHref: t ? `/thing/${t.slug ?? t.id}` : g ? `/discover/${g.slug ?? g.id}` : null,
    };
  });
}
