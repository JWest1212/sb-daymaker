// lib/sourcesServer.ts
//
// Data Arch Redesign 23, server-only DB access for the `sources` table.
// Phase 4 added the read-only health rollup for the Coverage health panel.
// Phase 5 adds the full management surface: list every field, add a
// candidate, edit authority/frequency/notes, pause/resume/retire.

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import { rankSourceHealth, sourceHealth, type SourceHealthRow, type SourceHealth } from "./review";

export type { SourceHealth };
export interface SourceHealthItem extends SourceHealthRow {
  health: SourceHealth;
}

export async function loadSourceHealth(): Promise<SourceHealthItem[]> {
  const sb = getAdminSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("sources")
    .select("key, label, status, expected_yield, last_yield, last_ok_at, consecutive_empty");
  if (error) { console.error("[sources] health read failed:", error.message); return []; }
  return rankSourceHealth((data ?? []) as SourceHealthRow[]);
}

export const SOURCE_LANES = ["structured", "generic", "render"] as const;
export const SOURCE_STATUSES = ["active", "paused", "retired", "candidate"] as const;
export const SOURCE_FREQUENCIES = ["nightly", "weekly", "reserve"] as const;

export interface SourceRow {
  key: string;
  label: string;
  url: string | null;
  lane: string;
  parse_method: string | null;
  authority: number;
  crawl_frequency: string;
  expected_yield: number;
  last_yield: number | null;
  last_ok_at: string | null;
  consecutive_empty: number;
  reliability: number;
  status: string;
  notes: string | null;
}

/** Full list for the Sources management page, every field, every status
 *  (unlike the health panel, which only shows active sources' problems).
 *  Sorted so an active source needing attention surfaces first, then healthy
 *  active ones, then paused, then candidates, then retired, alpha within
 *  each group. */
export async function loadSources(): Promise<SourceRow[]> {
  const sb = getAdminSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("sources")
    .select("key, label, url, lane, parse_method, authority, crawl_frequency, expected_yield, last_yield, last_ok_at, consecutive_empty, reliability, status, notes");
  if (error) { console.error("[sources] list read failed:", error.message); return []; }
  const rows = (data ?? []) as SourceRow[];

  const groupOrder: Record<string, number> = { active: 0, paused: 1, candidate: 2, retired: 3 };
  return rows.sort((a, b) => {
    const aFlagged = a.status === "active" && sourceHealth(a) === "below_baseline";
    const bFlagged = b.status === "active" && sourceHealth(b) === "below_baseline";
    if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
    const byGroup = (groupOrder[a.status] ?? 9) - (groupOrder[b.status] ?? 9);
    if (byGroup) return byGroup;
    return a.label.localeCompare(b.label);
  });
}

export interface MutateResult { ok: boolean; error?: string }

export interface SourceAddInput {
  key: string;
  label: string;
  url?: string;
  authority: number;
  lane: string;
}

/** Adds a `sources` row only, it does NOT wire up real fetching by itself.
 *  Actual ingestion for a brand-new key still needs either a code adapter
 *  (ingest/adapters/registry.ts) or the future generic lane (spec 25) to
 *  read it. Lands as status='candidate' precisely to signal that: "tracked,
 *  not yet crawled", never silently implied to start pulling events tonight. */
export async function addSource(input: SourceAddInput): Promise<MutateResult> {
  const sb = getAdminSupabase();
  if (!sb) return { ok: false, error: "no admin client" };

  const key = input.key.trim();
  const label = input.label.trim();
  if (!key || !label) return { ok: false, error: "key and label are required" };
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) return { ok: false, error: "key must be letters, numbers, - or _ only" };
  if (input.authority < 0 || input.authority > 1) return { ok: false, error: "authority must be between 0 and 1" };

  const { error } = await sb.from("sources").insert({
    key, label, url: input.url?.trim() || null, authority: input.authority, lane: input.lane, status: "candidate",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface SourceEdit {
  label?: string;
  url?: string | null;
  authority?: number;
  crawl_frequency?: string;
  status?: string;
  notes?: string | null;
}

export async function updateSource(key: string, edit: SourceEdit): Promise<MutateResult> {
  const sb = getAdminSupabase();
  if (!sb) return { ok: false, error: "no admin client" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (edit.label !== undefined) patch.label = edit.label.trim();
  if (edit.url !== undefined) patch.url = edit.url?.trim() || null;
  if (edit.authority !== undefined) {
    if (edit.authority < 0 || edit.authority > 1) return { ok: false, error: "authority must be between 0 and 1" };
    patch.authority = edit.authority;
  }
  if (edit.crawl_frequency !== undefined) patch.crawl_frequency = edit.crawl_frequency;
  if (edit.status !== undefined) patch.status = edit.status;
  if (edit.notes !== undefined) patch.notes = edit.notes?.trim() || null;

  const { error } = await sb.from("sources").update(patch).eq("key", key);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
