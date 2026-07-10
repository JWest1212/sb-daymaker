// lib/catalogServer.ts
//
// Server-only Live-catalog reads (service role). Lists published things with a
// `pending_edit` flag (an edit awaiting review in the queue). One page = 50 rows.

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import { whenString } from "./review";
import { sbDay } from "./explore";
import type { CatalogRow } from "./review";

const DAY_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" });

/** Sort bucket + day-group for a catalog row. Order: today+future dated (chrono),
 *  then recurring, then evergreen, then past dated (bottom). */
function bucketAndGroup(tier: number, starts_at: string | null, title: string, today: string) {
  if (tier === 1 && starts_at) {
    const day = sbDay(new Date(starts_at).getTime());
    const label = DAY_FMT.format(new Date(starts_at));
    if (day === today) return { bucket: 0, sortVal: starts_at, groupKey: day, groupLabel: `Today · ${label}` };
    if (day > today) return { bucket: 0, sortVal: starts_at, groupKey: day, groupLabel: label };
    return { bucket: 3, sortVal: starts_at, groupKey: `past_${day}`, groupLabel: `${label} · past` };
  }
  if (tier === 2) return { bucket: 1, sortVal: title.toLowerCase(), groupKey: "recurring", groupLabel: "Recurring — every week" };
  return { bucket: 2, sortVal: title.toLowerCase(), groupKey: "evergreen", groupLabel: "Anytime in SB" };
}

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
   hero_eligible, editorial_weight, photo_url, photo_source, photo_attribution, photo_options,
   place_id, lat, lng, venue_id,
   starts_at, thing_tags ( tag ),
   recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`;

export async function loadCatalog(f: CatalogFilters = {}): Promise<CatalogResult> {
  const sb = getAdminSupabase();
  const page = Math.max(1, f.page ?? 1);
  if (!sb) return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
  const today = sbDay(Date.now());

  // Vibe filter is a tag join — resolve matching ids first.
  let vibeIds: string[] | null = null;
  if (f.vibe) {
    const { data } = await sb.from("thing_tags").select("thing_id").eq("tag", f.vibe);
    vibeIds = [...new Set((data ?? []).map((r) => r.thing_id as string))];
    if (!vibeIds.length) return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
  }

  // Fetch the full matching set (admin scale, ~hundreds) so the chronological
  // day-bucketed ordering is global, then paginate in-process.
  let q = sb.from("things").select(SELECT).eq("status", "published");
  if (f.tier) q = q.eq("happening_tier", f.tier);
  if (f.zone) q = q.eq("nearby_zone", f.zone);
  if (f.q) q = q.ilike("title", `%${f.q}%`);
  if (vibeIds) q = q.in("id", vibeIds);
  q = q.range(0, 1999);

  const { data, error } = await q;
  if (error) { console.error("[catalog] read failed:", error.message); return { rows: [], total: 0, page, pageSize: PAGE_SIZE }; }
  const raw = (data ?? []) as Record<string, unknown>[];

  // Attach the sort bucket + group, then order: bucket asc; within a bucket by
  // start time (past bucket newest-first), recurring/evergreen alphabetical.
  const enriched = raw.map((t) => {
    const tier = Number(t.happening_tier);
    const starts_at = (t.starts_at as string) ?? null;
    const bg = bucketAndGroup(tier, starts_at, (t.title as string) ?? "", today);
    return { t, tier, starts_at, ...bg };
  });
  enriched.sort((a, b) =>
    a.bucket - b.bucket || (a.bucket === 3 ? b.sortVal.localeCompare(a.sortVal) : a.sortVal.localeCompare(b.sortVal)),
  );

  const total = enriched.length;
  const pageSlice = enriched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // pending-edit flags for just this page's ids
  const ids = pageSlice.map((e) => e.t.id as string);
  const pending = new Set<string>();
  if (ids.length) {
    const { data: edits } = await sb.from("thing_edits").select("thing_id").eq("status", "pending").in("thing_id", ids);
    for (const e of edits ?? []) pending.add(e.thing_id as string);
  }

  const rows: CatalogRow[] = pageSlice.map(({ t, tier, starts_at, groupKey, groupLabel }) => ({
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
    editorial_weight: (t.editorial_weight as number) ?? 0,
    photo_url: (t.photo_url as string) ?? null,
    photo_source: (t.photo_source as string) ?? "placeholder",
    photo_attribution: (t.photo_attribution as string) ?? null,
    photo_options: (t.photo_options as CatalogRow["photo_options"]) ?? [],
    tags: ((t.thing_tags as { tag: string }[]) ?? []).map((x) => x.tag),
    when: whenString(tier, starts_at, (t.recurring_schedules as []) ?? []),
    pending_edit: pending.has(t.id as string),
    groupKey,
    groupLabel,
    place_id: (t.place_id as string) ?? null,
    lat: (t.lat as number) ?? null,
    lng: (t.lng as number) ?? null,
    venue_id: (t.venue_id as string) ?? null,
  }));

  return { rows, total, page, pageSize: PAGE_SIZE };
}
