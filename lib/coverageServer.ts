// lib/coverageServer.ts
//
// Server-only coverage aggregation (service-role reads). One query per call over
// published things, aggregated in-process, never N×M queries. Occurrence counts
// come from the shared exact helper (lib/occurrences) so cockpit math and the
// public feed can never disagree.

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import { occurrencesByWindow, occurrencesInWindow, COVERAGE_WINDOWS, type CoverageWindow } from "./occurrences";
import { whenString } from "./review";
import { OCCASIONS, OCCASION_BY_KEY } from "./occasions";
import { ZONES, ZONE_LABEL } from "./zones";
import type { CoverageDim, CoverageResult, CoverageRow, CoverageCellItem } from "./coverage";

interface ThingRow {
  id: string;
  title: string;
  happening_tier: number;
  starts_at: string | null;
  nearby_zone: string | null;
  thing_tags: { tag: string }[] | null;
  recurring_schedules: {
    day_of_week: number | null;
    start_time: string | null;
    end_time: string | null;
    frequency: string | null;
    label: string | null;
  }[] | null;
}

const SELECT =
  `id, title, happening_tier, starts_at, nearby_zone,
   thing_tags ( tag ),
   recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`;

const dimKeys = (dim: CoverageDim) => (dim === "vibe" ? OCCASIONS.map((o) => o.key) : ZONES.map((z) => z.zone));
const dimLabel = (dim: CoverageDim, key: string) =>
  dim === "vibe" ? (OCCASION_BY_KEY[key as keyof typeof OCCASION_BY_KEY]?.label ?? key) : (ZONE_LABEL[key as keyof typeof ZONE_LABEL] ?? key);

/** The keys a thing belongs to for the given dimension. */
function thingKeys(dim: CoverageDim, t: ThingRow): string[] {
  if (dim === "vibe") return (t.thing_tags ?? []).map((x) => x.tag);
  return t.nearby_zone ? [t.nearby_zone] : [];
}

/** Full heatmap: each row's Tier-1+Tier-2 occurrences per window + evergreen count. */
export async function loadCoverage(dim: CoverageDim, now: number = Date.now()): Promise<CoverageResult> {
  const generatedAt = new Date(now).toISOString();
  const sb = getAdminSupabase();
  if (!sb) return { dim, rows: [], generatedAt };

  const { data, error } = await sb.from("things").select(SELECT).eq("status", "published");
  if (error) { console.error("[coverage] read failed:", error.message); return { dim, rows: [], generatedAt }; }
  const things = (data ?? []) as unknown as ThingRow[];

  const rows: Record<string, CoverageRow> = {};
  for (const key of dimKeys(dim)) {
    rows[key] = { key, label: dimLabel(dim, key), evergreen: 0, windows: { 7: 0, 14: 0, 30: 0, 45: 0 } };
  }

  for (const t of things) {
    const tier = Number(t.happening_tier);
    const occ = occurrencesByWindow(
      { happening_tier: tier, starts_at: t.starts_at, recurring: t.recurring_schedules ?? [] },
      now,
    );
    for (const key of thingKeys(dim, t)) {
      const row = rows[key];
      if (!row) continue; // a tag/zone outside the fixed vocabulary, skip
      if (tier === 3) { row.evergreen += 1; continue; }
      for (const w of COVERAGE_WINDOWS) row.windows[w] += occ[w];
    }
  }

  return { dim, rows: dimKeys(dim).map((k) => rows[k]), generatedAt };
}

/** Drilldown: the things contributing occurrences to one cell (dim × key × window). */
export async function loadCoverageCell(
  dim: CoverageDim,
  key: string,
  window: CoverageWindow,
  now: number = Date.now(),
): Promise<CoverageCellItem[]> {
  const sb = getAdminSupabase();
  if (!sb) return [];

  // Filter to the key at the DB where possible; tags need a join filter.
  let query = sb.from("things").select(SELECT).eq("status", "published").neq("happening_tier", 3);
  if (dim === "zone") query = query.eq("nearby_zone", key);
  const { data, error } = await query;
  if (error) { console.error("[coverage/cell] read failed:", error.message); return []; }
  let things = (data ?? []) as unknown as ThingRow[];
  if (dim === "vibe") things = things.filter((t) => (t.thing_tags ?? []).some((x) => x.tag === key));

  const items: CoverageCellItem[] = [];
  for (const t of things) {
    const tier = Number(t.happening_tier);
    const occurrences = occurrencesInWindow(
      { happening_tier: tier, starts_at: t.starts_at, recurring: t.recurring_schedules ?? [] },
      window, now,
    );
    if (occurrences <= 0) continue;
    items.push({
      id: t.id, title: t.title, tier,
      when: whenString(tier, t.starts_at, t.recurring_schedules ?? []),
      occurrences,
    });
  }
  // Tier 1 (soonest) first, then Tier 2 by descending frequency in the window.
  items.sort((a, b) => a.tier - b.tier || b.occurrences - a.occurrences || a.title.localeCompare(b.title));
  return items;
}
