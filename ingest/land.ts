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
import { deriveNearbyZone } from '../lib/geo';
import { categoryToActivities } from './activityBackfill';
import { resolveNeighborhood, autoWrites, type VenueDictEntry, type ResolvableThing } from './adapters/_shared/resolveNeighborhood';
import { cleanText } from '../lib/text/stripEmDash';

/** Map a gated Candidate to a `things` row. `source` stores the URL, the seed
 *  convention, and the same string the uuid5 id is keyed on. `dictionary`
 *  defaults to empty for callers that don't need neighborhood accuracy (the
 *  DRY_RUN title/date preview in run.ts), landCandidates always passes the
 *  real venue_neighborhoods dictionary. */
function toThingRow(c: Candidate, dictionary: VenueDictEntry[] = []): Record<string, unknown> {
  // Doc 19 §6 Phase 5, self-heal. Runs the same waterfall the sweep and apply
  // use; a confident match (>=0.75) overrides whatever the gate/adapter already
  // set (a stronger signal is allowed to correct a weaker one, same as Apply),
  // otherwise falls back to the candidate's own neighborhood unchanged.
  const resolved = resolveNeighborhood(
    {
      title: c.title, address: c.address ?? null, place_id: c.place_id ?? null,
      source_url: c.source_url, lat: c.lat ?? null, lng: c.lng ?? null,
      neighborhood: (c.neighborhood ?? null) as ResolvableThing['neighborhood'],
    },
    dictionary,
  );
  const neighborhood = autoWrites(resolved) && resolved.neighborhood ? resolved.neighborhood : (c.neighborhood ?? null);
  const nearby_zone = deriveNearbyZone(neighborhood, c.lat, c.lng);
  return {
    id: c.id,
    type: c.type,
    status: 'needs_review',
    // G0.9 write-time sanitizer: strip any em dash from scraped/AI copy before it
    // is written (the Golden Rule's belt; the render guard in mapThing is the
    // suspenders).
    title: cleanText(c.title),
    blurb: cleanText(c.blurb ?? null),
    blurb_long: cleanText(c.blurb_long ?? null),
    happening_tier: c.tier,
    editorial_weight: c.editorial_weight ?? 0, // W2.1b civic-filler nudge (0 unless matched)
    happening_category: c.happening_category,
    reason_to_go: cleanText(c.reason_to_go ?? null),
    neighborhood,
    nearby_zone,
    address: c.address,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    price_band: c.price_band,
    time_of_day_fit: c.time_of_day_fit,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    buy_url: c.buy_url ?? null,
    place_id: c.place_id ?? null,
    photo_url: c.photo_url ?? null,
    photo_source: c.photo_source ?? 'placeholder',
    photo_options: c.photo_options ?? [],
    photo_attribution: c.photo_attribution ?? null,
    // Card Imagery Build Spec Phase 3 §6.2, set by resolveImages() alongside
    // photo_source: 'motif'; null for anything else (a real photo, or a row that
    // predates Phase 3 and hasn't been re-resolved yet).
    visual_kind: c.visual_kind ?? null,
    visual_key: c.visual_key ?? null,
    visual_seed: c.visual_seed ?? null,
    // Card Imagery Build Spec Phase 2 §5.2, only ever set here on an exact
    // place_id match against the venue registry (resolveImages()'s
    // matchVenueForCandidate); a fuzzy match is never auto-written, even at land
    // time, it queues for founder review in the cockpit's Venues tab instead.
    venue_id: c.venue_id ?? null,
    // Home Rework spec §6.2, Activity taxonomy. AI-proposed tags (proposed_activities)
    // union with the deterministic happening_category map (Doc 21 §4/§6 Phase 4
    // self-heal), so every new thing carries activities[] even before/without the
    // AI pass. Requires supabase/migrations/20260711_activities.sql applied first.
    activities: [...new Set([...(c.proposed_activities ?? []), ...categoryToActivities(c.happening_category)])],
    local_note: cleanText(c.local_note ?? null),
    last_confirmed: c.last_confirmed,
    source: c.source_url,
    // Data Arch Redesign 26 Phase 4, canonical event identity, computed
    // post-dedupe in run.ts's main() (undefined for Tier-3 evergreen places).
    event_key: c.event_key ?? null,
  };
}

export interface RunRow {
  id: number;
  source: string;
  fetched: number;
  qualified: number;
  dropped: number;
  landed: number;
  /** Data Arch Redesign 25 Phase 3, AI spend this run (USD). Only the
   *  generic-lane adapter sets this; every other adapter leaves it at 0. */
  ai_cost_usd?: number;
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
      ai_cost_usd: run.ai_cost_usd ?? 0,
      ok,
      error: errorMsg ?? null,
    })
    .eq('id', run.id);
}

/** Insert needs_review rows, ignoring id conflicts. Returns the count NEWLY landed. */
export async function landCandidates(sb: SupabaseClient, cands: Candidate[]): Promise<number> {
  if (!cands.length) return 0;
  const { data: dictRows, error: dictErr } = await sb
    .from('venue_neighborhoods')
    .select('name, name_norm, neighborhood, place_id, aliases');
  if (dictErr) throw new Error(`landCandidates dictionary read: ${dictErr.message}`);
  const dictionary = (dictRows ?? []) as unknown as VenueDictEntry[];

  const { data, error } = await sb
    .from('things')
    .upsert(cands.map((c) => toThingRow(c, dictionary)), { onConflict: 'id', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(`landCandidates: ${error.message}`);
  return data?.length ?? 0;
}

/** Insert AI-proposed occasion tags for kept candidates (tag_source='ai'),
 *  idempotently. The negative rules were already applied in enrich.ts. */
export async function landTags(sb: SupabaseClient, cands: Candidate[]): Promise<number> {
  const rows = cands.flatMap((c) =>
    (c.proposed_tags ?? []).map((t) => ({
      thing_id: c.id,
      tag: t.tag,
      confidence: t.confidence,
      tag_source: 'ai',
    })),
  );
  if (!rows.length) return 0;
  const { data, error } = await sb
    .from('thing_tags')
    .upsert(rows, { onConflict: 'thing_id,tag', ignoreDuplicates: true })
    .select('thing_id');
  if (error) throw new Error(`landTags: ${error.message}`);
  return data?.length ?? 0;
}

/** Insert/refresh recurring_schedules for kept Tier-2 candidates (Doc 11 §8).
 *  start_time is null when the day is known but the time isn't (never guessed). */
export async function landRecurring(sb: SupabaseClient, cands: Candidate[]): Promise<number> {
  const rows = cands.flatMap((c) =>
    (c.recurring ?? []).map((r) => ({
      thing_id: c.id,
      category: c.happening_category,
      day_of_week: r.day_of_week,
      start_time: r.start_time,   // null => time unknown / flagged
      end_time: r.end_time,
      label: r.label ?? null,
      frequency: r.frequency,
      last_confirmed: c.last_confirmed,
    })),
  );
  if (!rows.length) return 0;
  const { data, error } = await sb
    .from('recurring_schedules')
    .upsert(rows, { onConflict: 'thing_id,day_of_week,category' })
    .select('id');
  if (error) throw new Error(`landRecurring: ${error.message}`);
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
