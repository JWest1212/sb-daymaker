// ingest/run.ts
//
// The nightly worker entrypoint (Doc 11 §10). Per-source isolation: one bad
// adapter can't sink the run (its source_runs row is marked ok=false and surfaces
// in the digest/source-health later). Flow for Phase 10:
//     fetch -> gate -> dedupe -> land   (no AI, no images yet)
//
// DRY_RUN=1 prints the per-source tallies and what it WOULD land, writing nothing.

import { registry } from './adapters/registry';
import { gate } from './gate';
import { dedupe, type DropRecord, type ExistingRow } from './dedupe';
import {
  startRun, finishRun, landCandidates, landTags, landRecurring, recordDrops, toThingRow, type RunRow,
} from './land';
import { enrich } from './enrich';
import { resolveImages, type ResolveStats } from './images';
import { detectClosures } from './adapters/googlePlaces';
import { sendDigest } from './digest';
import { getDb } from './db';
import type { Candidate, RawCandidate, Tod, PhotoSource } from '../packages/shared/types';

const WINDOW_DAYS = 45;
const DRY = process.env.DRY_RUN === '1';
const BACKFILL = process.env.ENRICH_BACKFILL === '1';
const IMAGE_BACKFILL = process.env.IMAGE_BACKFILL === '1';

function window() {
  const from = new Date();
  const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000);
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

function gateDrop(sourceKey: string, r: RawCandidate, reason: DropRecord['reason'], detail?: string): DropRecord {
  return {
    source: sourceKey,
    title: r.title,
    reason,
    detail,
    source_url: r.sourceUrl,
    raw: { ...r, raw: undefined }, // normalized candidate, minus the bulky original payload
  };
}

/** One-time / on-demand: enrich existing needs_review rows that have no blurb yet
 *  (e.g. the rows landed before Phase 11 existed). Updates blurb/blurb_long + tags;
 *  starts_at is never written. */
async function backfillEnrich() {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select('id, type, title, happening_tier, happening_category, neighborhood, address, price_band, time_of_day_fit, is_21_plus, source, reason_to_go, local_note, last_confirmed')
    .eq('status', 'needs_review')
    .is('blurb', null);
  if (error) throw new Error(`backfill select: ${error.message}`);
  const rows = data ?? [];
  console.log(`\n[enrich-backfill] ${rows.length} needs_review rows with no blurb\n`);
  if (!rows.length) return;

  const cands: Candidate[] = rows.map((r) => ({
    id: r.id as string,
    type: r.type,
    status: 'needs_review',
    title: r.title as string,
    tier: Number(r.happening_tier) as Candidate['tier'],
    happening_category: r.happening_category,
    neighborhood: r.neighborhood ?? undefined,
    address: (r.address as string) ?? '',
    price_band: r.price_band ?? null,
    time_of_day_fit: (r.time_of_day_fit as Tod[]) ?? [],
    starts_at: null, // deliberately not loaded — enrich must never see it
    ends_at: null,
    source_url: (r.source as string) ?? '',
    reason_to_go: r.reason_to_go ?? undefined,
    local_note: r.local_note ?? undefined,
    is_21_plus: (r.is_21_plus as boolean) ?? undefined,
    last_confirmed: (r.last_confirmed as string)?.slice(0, 10) ?? '',
    start_strategy: 'none',
  }));

  const enriched = await enrich(cands, { sb });
  let updated = 0;
  for (const c of enriched) {
    if (!c.blurb) continue;
    const { error: upErr } = await sb
      .from('things')
      .update({ blurb: c.blurb, blurb_long: c.blurb_long ?? null }) // NOT starts_at
      .eq('id', c.id);
    if (upErr) throw new Error(`backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  const tagged = await landTags(sb, enriched);
  console.log(`\n[enrich-backfill] updated ${updated} blurbs · inserted ${tagged} tags`);
}

/** One-time / on-demand: resolve images for existing needs_review rows still on the
 *  placeholder (rows landed before Phase 13). Updates photo_url/source/options. */
async function backfillImages() {
  const sb = getDb();
  const force = process.env.IMAGE_FORCE === '1'; // re-resolve every row (skip cache), refresh alternates
  let q = sb
    .from('things')
    .select('id, type, title, happening_tier, happening_category, neighborhood, address, price_band, place_id, photo_source')
    .eq('status', 'needs_review');
  if (!force) q = q.or('photo_source.is.null,photo_source.eq.placeholder');
  const { data, error } = await q;
  if (error) throw new Error(`image-backfill select: ${error.message}`);
  const rows = data ?? [];
  console.log(`\n[image-backfill] ${rows.length} needs_review rows${force ? ' (force refresh)' : ' without a real image'}\n`);
  if (!rows.length) return;

  const cands: Candidate[] = rows.map((r) => ({
    id: r.id as string, type: r.type, status: 'needs_review', title: r.title as string,
    tier: Number(r.happening_tier) as Candidate['tier'], happening_category: r.happening_category,
    neighborhood: r.neighborhood ?? undefined, address: (r.address as string) ?? '',
    price_band: r.price_band ?? null, time_of_day_fit: [], starts_at: null, ends_at: null,
    source_url: '', place_id: (r.place_id as string) ?? undefined,
    last_confirmed: '', start_strategy: 'none',
  }));

  const { cands: resolved, stats } = await resolveImages(cands, sb, { force });
  let updated = 0;
  for (const c of resolved) {
    if (!c.photo_url && c.photo_source === 'placeholder') continue; // still nothing — leave it
    const { error: upErr } = await sb
      .from('things')
      .update({ photo_url: c.photo_url ?? null, photo_source: c.photo_source, photo_options: c.photo_options ?? [] })
      .eq('id', c.id);
    if (upErr) throw new Error(`image-backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  console.log(`\n[image-backfill] updated ${updated} images — free ${stats.free} · google ${stats.google} · placeholder ${stats.placeholder} · over-cap ${stats.overCap}`);
}

async function main() {
  if (BACKFILL) return backfillEnrich();
  if (IMAGE_BACKFILL) return backfillImages();

  const win = window();
  const sb = DRY ? null : getDb();

  type Tagged = { cand: Candidate; sourceKey: string };
  const gated: Tagged[] = [];
  const runs = new Map<string, RunRow>();
  let totalFetched = 0, totalGateDropped = 0;

  console.log(`\n[ingest] window ${win.fromISO.slice(0, 10)} .. ${win.toISO.slice(0, 10)}${DRY ? '  (DRY RUN — no writes)' : ''}\n`);

  // ---- FETCH + GATE, per source, isolated ----
  for (const adapter of registry) {
    const run: RunRow = sb ? await startRun(sb, adapter.key) : { id: 0, source: adapter.key, fetched: 0, qualified: 0, dropped: 0, landed: 0 };
    runs.set(adapter.key, run);
    try {
      const raw = await adapter.fetch(win);
      run.fetched = raw.length;
      const drops: DropRecord[] = [];
      for (const r of raw) {
        const g = gate(r);
        if (g.ok) { gated.push({ cand: g.candidate!, sourceKey: adapter.key }); run.qualified++; }
        else { drops.push(gateDrop(adapter.key, r, g.reason!, g.detail)); run.dropped++; }
      }
      if (sb && drops.length) await recordDrops(sb, run.id, drops);
      totalFetched += run.fetched;
      totalGateDropped += run.dropped;
      console.log(`  ${adapter.label.padEnd(20)} fetched ${run.fetched}  qualified ${run.qualified}  dropped ${run.dropped}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${adapter.label.padEnd(20)} ERROR: ${msg}`);
      if (sb) await finishRun(sb, run, false, msg);
      runs.delete(adapter.key); // don't finish twice below
    }
  }

  // ---- DEDUPE (cross-source + against existing rows in the window) ----
  let existing: ExistingRow[] = [];
  if (sb) {
    const { data } = await sb
      .from('things')
      .select('id, title, starts_at, source')
      .not('starts_at', 'is', null)
      .gte('starts_at', win.fromISO)
      .lte('starts_at', win.toISO);
    existing = (data ?? []) as ExistingRow[];
  }
  const { keep: deduped, drops: dedupeDrops } = dedupe(gated.map((g) => g.cand), existing);

  // ---- ENRICH (one batched Claude call: voice + tags; never touches starts_at) ----
  const keep = DRY ? deduped : await enrich(deduped, { sb: sb! });
  if (DRY) console.log('  enrich skipped — dry run (no Claude call)');

  // ---- IMAGES (free -> paid waterfall; every card lands with a real image, capped) ----
  let imageStats: ResolveStats | null = null;
  let toLand = keep;
  if (sb) {
    const r = await resolveImages(keep, sb);
    toLand = r.cands;
    imageStats = r.stats;
    console.log(`  images               free ${r.stats.free}  google ${r.stats.google}  placeholder ${r.stats.placeholder}  over-cap ${r.stats.overCap}`);
  }

  // attribute dedupe drops + landed counts back to each source run
  for (const d of dedupeDrops) {
    const run = runs.get(d.source);
    if (run) run.dropped++;
  }
  const keptIds = new Set(keep.map((c) => c.id));
  for (const g of gated) if (keptIds.has(g.cand.id)) (runs.get(g.sourceKey)!).landed++;

  // ---- LAND ----
  let landed = 0;
  if (sb) {
    if (dedupeDrops.length) {
      // record each dedupe drop under its source's run (run_id may be null if its run errored)
      const byRun = new Map<number, DropRecord[]>();
      for (const d of dedupeDrops) {
        const id = runs.get(d.source)?.id ?? 0;
        (byRun.get(id) ?? byRun.set(id, []).get(id)!).push(d);
      }
      for (const [id, ds] of byRun) if (id) await recordDrops(sb, id, ds);
    }
    landed = await landCandidates(sb, toLand);
    await landTags(sb, toLand);
    await landRecurring(sb, toLand);
    for (const run of runs.values()) await finishRun(sb, run, true);
  }

  // ---- SUMMARY ----
  console.log(
    `\n[ingest] ${totalFetched} fetched · ${keep.length} kept · ` +
      `${totalGateDropped} gate-dropped · ${dedupeDrops.length} dedupe-dropped` +
      (sb ? ` · ${landed} newly landed (needs_review)` : ''),
  );

  if (DRY) {
    console.log('\n[dry-run] would land:');
    for (const c of keep.slice(0, 200)) {
      const row = toThingRow(c) as { title: string; starts_at: string | null; source: unknown };
      console.log(`  • ${String(row.title).slice(0, 60).padEnd(60)} ${row.starts_at}  ${row.source}`);
    }
    return;
  }

  // ---- CLOSURES + DIGEST (live runs only) ----
  if (sb) {
    const closed = await detectClosures(sb);
    if (closed) console.log(`  closures             archived ${closed} permanently-closed place(s)`);
    await sendDigest(sb, {
      landed,
      gateDropped: totalGateDropped,
      dedupeDropped: dedupeDrops.length,
      images: imageStats,
      runs: [...runs.values()],
      closed,
    });
  }
}

main().catch((err) => {
  console.error('[ingest] fatal:', err);
  process.exit(1);
});
