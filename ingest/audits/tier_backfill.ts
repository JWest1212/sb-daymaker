// ingest/audits/tier_backfill.ts  (Elevation v1 · Gate 1 · G1.1)
//
// Scores every published/needs_review thing with the pure Entry Quality Gate
// (lib/quality/tierScore.ts) and writes things.quality_tier. This is a DATA
// operation (not DDL): the quality_tier column was added by hand; this fills it.
//
// `recomputeQualityTiers()` is the shared engine, called BOTH here (the one-off /
// on-demand backfill) and by the nightly worker (ingest/run.ts) so tier is kept
// current after every enrich, and the two can never drift.
//
// Run convention (mirrors the other audits):
//   node --env-file=.env.local --import tsx ingest/audits/tier_backfill.ts
//   DRY_RUN=1 node --env-file=.env.local --import tsx ingest/audits/tier_backfill.ts   (preview, writes nothing)

import type { SupabaseClient } from '@supabase/supabase-js';
import { getDb } from '../db';
import { tierScore, type TierInput, type QualityTier } from '../../lib/quality/tierScore';
import { isMain } from './_util';

// The exact fields tierScore reads. Kept narrow so the select stays cheap.
const TIER_COLS =
  'id, type, title, blurb, blurb_long, reason_to_go, address, lat, lng, nearby_zone, ' +
  'neighborhood, local_note, practical_note, starts_at, photo_url, photo_source, ' +
  'visual_kind, price_band, free, buy_url, quality_tier, status';

function rowToInput(r: Record<string, unknown>): TierInput {
  return {
    type: r.type as string | null,
    title: r.title as string | null,
    blurb: r.blurb as string | null,
    blurb_long: r.blurb_long as string | null,
    reason_to_go: r.reason_to_go as string | null,
    address: r.address as string | null,
    lat: r.lat as number | null,
    lng: r.lng as number | null,
    nearby_zone: r.nearby_zone as string | null,
    neighborhood: r.neighborhood as string | null,
    local_note: r.local_note as string | null,
    practical_note: r.practical_note as string | null,
    starts_at: r.starts_at as string | null,
    photo_url: r.photo_url as string | null,
    photo_source: r.photo_source as string | null,
    visual_kind: r.visual_kind as string | null,
    price_band: r.price_band as string | null,
    free: r.free as boolean | null,
    buy_url: r.buy_url as string | null,
  };
}

export interface TierRecomputeResult {
  scored: number;
  changed: number;
  counts: Record<QualityTier, number>;
  /** Ids that changed, grouped by their NEW tier (handy for a spot-check). */
  movedTo: Record<QualityTier, string[]>;
}

/** Score every published/needs_review thing and (unless dry) write quality_tier
 *  where it changed. Idempotent: a second run with unchanged data writes nothing. */
export async function recomputeQualityTiers(
  sb: SupabaseClient,
  opts: { dry?: boolean } = {},
): Promise<TierRecomputeResult> {
  const { data, error } = await sb
    .from('things')
    .select(TIER_COLS)
    .in('status', ['published', 'needs_review']);
  if (error) throw new Error(`tier-backfill select: ${error.message}`);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  const counts: Record<QualityTier, number> = { 1: 0, 2: 0, 3: 0 };
  const movedTo: Record<QualityTier, string[]> = { 1: [], 2: [], 3: [] };
  let changed = 0;

  for (const r of rows) {
    const id = r.id as string;
    const current = r.quality_tier as number | null;
    const next = tierScore(rowToInput(r));
    counts[next]++;
    if (next !== current) {
      movedTo[next].push(id);
      changed++;
      if (!opts.dry) {
        const { error: upErr } = await sb.from('things').update({ quality_tier: next }).eq('id', id);
        if (upErr) throw new Error(`tier-backfill update ${id}: ${upErr.message}`);
      }
    }
  }

  return { scored: rows.length, changed, counts, movedTo };
}

async function main() {
  const dry = process.env.DRY_RUN === '1';
  const sb = getDb();
  const r = await recomputeQualityTiers(sb, { dry });
  console.log(`\n[tier-backfill] ${dry ? 'DRY RUN (no writes) · ' : ''}scored ${r.scored} published/needs_review rows`);
  console.log(`  Tier 1 (full):    ${r.counts[1]}`);
  console.log(`  Tier 2 (compact): ${r.counts[2]}`);
  console.log(`  Tier 3 (hidden):  ${r.counts[3]}`);
  console.log(`  changed this run: ${r.changed}`);
  if (r.movedTo[3].length) {
    console.log(`\n  newly hidden (Tier 3) ids, these leave the public feed until fixed:`);
    for (const id of r.movedTo[3].slice(0, 40)) console.log(`    ${id}`);
    if (r.movedTo[3].length > 40) console.log(`    … ${r.movedTo[3].length - 40} more`);
  }
  console.log('');
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
