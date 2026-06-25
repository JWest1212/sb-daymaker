// ingest/land.ts
//
// Land gated+deduped candidates as status='needs_review' (Doc 11 §8), idempotently
// (upsert on id, ignore duplicates = the seed's "on conflict do nothing"), and write
// the per-run bookkeeping (source_runs) + the drop log (ingest_drops) so the digest
// and cockpit can show what landed and what was held back.
//
// Phase 10 scope: these two adapters emit only dated Tier-1 events, so there are no
// thing_tags (no AI yet) and no recurring_schedules to write.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Candidate } from '../packages/shared/types';
import type { DropRecord } from './dedupe';

/** Map a gated Candidate to a `things` row. `source` stores the URL — the seed
 *  convention, and the same string the uuid5 id is keyed on. */
function toThingRow(c: Candidate): Record<string, unknown> {
  return {
    id: c.id,
    type: c.type,
    status: 'needs_review',
    title: c.title,
    happening_tier: c.tier,
    happening_category: c.happening_category,
    reason_to_go: c.reason_to_go ?? null,
    neighborhood: c.neighborhood ?? null,
    address: c.address,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    price_band: c.price_band,
    time_of_day_fit: c.time_of_day_fit,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    buy_url: c.buy_url ?? null,
    place_id: c.place_id ?? null,
    photo_source: 'placeholder', // image resolution is Phase 13
    local_note: c.local_note ?? null,
    last_confirmed: c.last_confirmed,
    source: c.source_url,
  };
}

export interface RunRow {
  id: number;
  source: string;
  fetched: number;
  qualified: number;
  dropped: number;
  landed: number;
}

/** Open a source_runs row; returns its id for finishRun/recordDrops. */
export async function startRun(sb: SupabaseClient, source: string): Promise<RunRow> {
  const { data, error } = await sb
    .from('source_runs')
    .insert({ source })
    .select('id')
    .single();
  if (error) throw new Error(`startRun(${source}): ${error.message}`);
  return { id: data!.id as number, source, fetched: 0, qualified: 0, dropped: 0, landed: 0 };
}

export async function finishRun(
  sb: SupabaseClient,
  run: RunRow,
  ok: boolean,
  errorMsg?: string,
): Promise<void> {
  await sb
    .from('source_runs')
    .update({
      finished_at: new Date().toISOString(),
      fetched: run.fetched,
      qualified: run.qualified,
      dropped: run.dropped,
      landed: run.landed,
      ok,
      error: errorMsg ?? null,
    })
    .eq('id', run.id);
}

/** Insert needs_review rows, ignoring id conflicts. Returns the count NEWLY landed. */
export async function landCandidates(sb: SupabaseClient, cands: Candidate[]): Promise<number> {
  if (!cands.length) return 0;
  const { data, error } = await sb
    .from('things')
    .upsert(cands.map(toThingRow), { onConflict: 'id', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(`landCandidates: ${error.message}`);
  return data?.length ?? 0;
}

export async function recordDrops(
  sb: SupabaseClient,
  runId: number,
  drops: DropRecord[],
): Promise<void> {
  if (!drops.length) return;
  const rows = drops.map((d) => ({
    run_id: runId,
    source: d.source,
    title: d.title ?? null,
    reason: d.reason,
    detail: d.detail ?? null,
    source_url: d.source_url ?? null,
    raw: (d.raw ?? null) as object | null,
  }));
  const { error } = await sb.from('ingest_drops').insert(rows);
  if (error) throw new Error(`recordDrops: ${error.message}`);
}

export { toThingRow };
