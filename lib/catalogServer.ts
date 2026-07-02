// lib/catalogServer.ts
//
// Server-only Live-catalog reads (service role). Lists published things with a
// `pending_edit` flag (an edit awaiting review in the queue). One page = 50 rows.

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import { whenString } from "./review";
import type { CatalogRow } from "./review";

export interface CatalogFilters {
  tier?: number;   // 1|2|3
  vibe?: string;   // occasion_tag
  zone?: string;   // nearby_zone
  q?: string;      // title search
  page?: number;
}

export interface CatalogResult {
  rows: CatalogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;
const SELECT =
  `id, title, blurb, blurb_long, neighborhood, is_21_plus, happening_tier, nearby_zone, price_band,
   hero_eligible, photo_url, photo_source, starts_at, thing_tags ( tag ),
   recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`;

export async function loadCatalog(f: CatalogFilters = {}): Promise<CatalogResult> {
  const sb = getAdminSupabase();
  const page = Math.max(1, f.page ?? 1);
  if (!sb) return { rows: [], total: 0, page, pageSize: PAGE_SIZE };

  // Vibe filter is a tag join — resolve matching ids first so paging/counts stay exact.
  let vibeIds: string[] | null = null;
  if (f.vibe) {
    const { data } = await sb.from("thing_tags").select("thing_id").eq("tag", f.vibe);
    vibeIds = [...new Set((data ?? []).map((r) => r.thing_id as string))];
    if (!vibeIds.length) return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
  }

  let q = sb.from("things").select(SELECT, { count: "exact" }).eq("status", "published");
  if (f.tier) q = q.eq("happening_tier", f.tier);
  if (f.zone) q = q.eq("nearby_zone", f.zone);
  if (f.q) q = q.ilike("title", `%${f.q}%`);
  if (vibeIds) q = q.in("id", vibeIds);
  q = q.order("title", { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count, error } = await q;
  if (error) { console.error("[catalog] read failed:", error.message); return { rows: [], total: 0, page, pageSize: PAGE_SIZE }; }
  const rows = (data ?? []) as Record<string, unknown>[];

  // Which of these have a pending edit awaiting review?
  const ids = rows.map((r) => r.id as string);
  const pending = new Set<string>();
  if (ids.length) {
    const { data: edits } = await sb.from("thing_edits").select("thing_id").eq("status", "pending").in("thing_id", ids);
    for (const e of edits ?? []) pending.add(e.thing_id as string);
  }

  const mapped: CatalogRow[] = rows.map((t) => {
    const tier = Number(t.happening_tier);
    const scheds = (t.recurring_schedules as []) ?? [];
    return {
      id: t.id as string,
      title: t.title as string,
      blurb: (t.blurb as string) ?? null,
      blurb_long: (t.blurb_long as string) ?? null,
      neighborhood: (t.neighborhood as string) ?? null,
      is_21_plus: (t.is_21_plus as boolean) ?? null,
      happening_tier: tier,
      nearby_zone: (t.nearby_zone as string) ?? null,
      price_band: (t.price_band as string) ?? null,
      hero_eligible: (t.hero_eligible as boolean) ?? false,
      photo_url: (t.photo_url as string) ?? null,
      photo_source: (t.photo_source as string) ?? "placeholder",
      tags: ((t.thing_tags as { tag: string }[]) ?? []).map((x) => x.tag),
      when: whenString(tier, (t.starts_at as string) ?? null, scheds),
      pending_edit: pending.has(t.id as string),
    };
  });

  return { rows: mapped, total: count ?? mapped.length, page, pageSize: PAGE_SIZE };
}
