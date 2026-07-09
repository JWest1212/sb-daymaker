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
import { isAlreadyInRegistry } from './adapters/recurringRegistry';
import {
  startRun, finishRun, landCandidates, landTags, landRecurring, recordDrops, toThingRow, type RunRow,
} from './land';
import { enrich } from './enrich';
import { classifyWeight } from './weight';
import { resolveImages, type ResolveStats } from './images';
import { detectClosures } from './adapters/googlePlaces';
import { consumeDirectives } from './restock';
import { sendDigest } from './digest';
import { getDb } from './db';
import type { Candidate, RawCandidate, Tod, PhotoSource } from '../packages/shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const WINDOW_DAYS = 45;
const DRY = process.env.DRY_RUN === '1';
const BACKFILL = process.env.ENRICH_BACKFILL === '1';
const IMAGE_BACKFILL = process.env.IMAGE_BACKFILL === '1';
const WEIGHT_BACKFILL = process.env.WEIGHT_BACKFILL === '1';
const REPEAT_BACKFILL = process.env.REPEAT_BACKFILL === '1';
const VOICE_BACKFILL = process.env.VOICE_BACKFILL === '1';

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

/** One-time / on-demand: enrich existing published/needs_review rows that are MISSING
 *  something — no blurb OR zero occasion tags (W2.2: backfill the untagged ~179).
 *  starts_at is never written; and a blurb is written ONLY when the row had none, so
 *  founder-edited blurbs are never overwritten (tags-only enrich for already-blurbed
 *  rows). Idempotent: landTags ignores duplicates. */
async function backfillEnrich() {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select('id, type, title, blurb, happening_tier, happening_category, neighborhood, address, price_band, time_of_day_fit, is_21_plus, source, reason_to_go, local_note, last_confirmed, status, thing_tags ( tag )')
    .in('status', ['published', 'needs_review']);
  if (error) throw new Error(`backfill select: ${error.message}`);
  const all = data ?? [];

  // A row needs enrichment if it has no blurb OR no occasion tags yet.
  const tagCount = (r: Record<string, unknown>) => ((r.thing_tags as unknown[]) ?? []).length;
  const rows = all.filter((r) => r.blurb == null || tagCount(r) === 0);
  // Rows that already have a blurb: enrich for TAGS only — never overwrite their blurb.
  const hadBlurb = new Set(rows.filter((r) => r.blurb != null).map((r) => r.id as string));
  console.log(
    `\n[enrich-backfill] ${all.length} published/needs_review rows · ${rows.length} missing blurb or tags ` +
      `(${rows.length - hadBlurb.size} need a blurb, ${hadBlurb.size} tags-only)\n`,
  );
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
    if (!c.blurb || hadBlurb.has(c.id)) continue; // only fill a MISSING blurb
    const { error: upErr } = await sb
      .from('things')
      .update({ blurb: c.blurb, blurb_long: c.blurb_long ?? null }) // NOT starts_at
      .eq('id', c.id);
    if (upErr) throw new Error(`backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  const tagged = await landTags(sb, enriched);
  console.log(`\n[enrich-backfill] wrote ${updated} missing blurbs · inserted ${tagged} tags`);
}

/** Card Imagery Build Spec Phase 0 §3.1.6 — one-off, read-only coverage report from
 *  live data. No schema changes, no writes: things-per-category × photo_source, plus
 *  Tier-1 event address clusters (a simple normalized-address grouping — the real
 *  lat/lng-radius + fuzzy-name clustering is Phase 2 §5.2's dedicated seeding script;
 *  this just needs enough real concentration data for Jim to eyeball before then). */
async function emitCoverageReport(sb: SupabaseClient) {
  const { data, error } = await sb
    .from('things')
    .select('happening_category, photo_source, happening_tier, address, lat, lng')
    .in('status', ['published', 'needs_review']);
  if (error) throw new Error(`coverage-report select: ${error.message}`);
  const rows = data ?? [];

  const bySource = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const cat = (r.happening_category as string) ?? '(none)';
    const src = (r.photo_source as string) ?? '(none)';
    if (!bySource.has(cat)) bySource.set(cat, new Map());
    const m = bySource.get(cat)!;
    m.set(src, (m.get(src) ?? 0) + 1);
  }
  const sources = ['owned', 'wikimedia', 'google', 'pexels', 'placeholder'];
  console.log(`\n[coverage-report] ${rows.length} things · category × photo_source:`);
  console.log(`  ${'category'.padEnd(24)}${sources.map((s) => s.padEnd(12)).join('')}total`);
  const catRows = [...bySource].sort((a, b) => {
    const totalA = [...a[1].values()].reduce((x, y) => x + y, 0);
    const totalB = [...b[1].values()].reduce((x, y) => x + y, 0);
    return totalB - totalA;
  });
  for (const [cat, m] of catRows) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const cells = sources.map((s) => String(m.get(s) ?? 0).padEnd(12)).join('');
    console.log(`  ${cat.padEnd(24)}${cells}${total}`);
  }

  // Tier-1 event address clusters (normalized string grouping), sorted by event count.
  const t1 = rows.filter((r) => Number(r.happening_tier) === 1 && r.address);
  const clusters = new Map<string, { count: number; lat: unknown; lng: unknown }>();
  for (const r of t1) {
    const key = (r.address as string).trim().toLowerCase();
    const entry = clusters.get(key) ?? { count: 0, lat: r.lat, lng: r.lng };
    entry.count++;
    clusters.set(key, entry);
  }
  const sorted = [...clusters].filter(([, v]) => v.count >= 2).sort((a, b) => b[1].count - a[1].count);
  console.log(
    `\n[coverage-report] Tier-1 event address clusters (>=2 events): ${sorted.length} of ` +
      `${clusters.size} distinct addresses (seeds the Phase 2 venue registry)`,
  );
  for (const [addr, v] of sorted.slice(0, 60)) {
    const coords = v.lat != null && v.lng != null ? ` (${v.lat}, ${v.lng})` : '';
    console.log(`  ×${String(v.count).padStart(2)}  ${addr}${coords}`);
  }
  if (sorted.length > 60) console.log(`  … ${sorted.length - 60} more`);
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
    // Phase 0 §3.1.2: a Tier-1 event can land on 'placeholder' for display while
    // still carrying real photo_options (the cockpit picker's per-thing override) —
    // only skip the write when NOTHING was found at all (truly nothing changed).
    const hasAlternates = (c.photo_options ?? []).some((o) => o.url);
    if (!c.photo_url && c.photo_source === 'placeholder' && !hasAlternates) continue; // still nothing — leave it
    const { error: upErr } = await sb
      .from('things')
      .update({ photo_url: c.photo_url ?? null, photo_source: c.photo_source, photo_options: c.photo_options ?? [] })
      .eq('id', c.id);
    if (upErr) throw new Error(`image-backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  console.log(`\n[image-backfill] updated ${updated} images — free ${stats.free} · google ${stats.google} · placeholder ${stats.placeholder} · over-cap ${stats.overCap}`);

  // Card Imagery Build Spec Phase 0 §3.1.6 — one-off, read-only coverage report from
  // live data: seeds the Phase 2 venue registry with real concentration data.
  await emitCoverageReport(sb);
}

/** W2.3 one-time / on-demand: re-resolve the "repeat offenders" — a photo_url shared by
 *  MORE than 3 published things — through the resolver with force + the new variety logic
 *  (category-aware queries + per-batch dedupe), so an over-repeated stock photo gets spread
 *  across distinct images. Free-tier only in practice: the resolver's Google gate/cap code
 *  is untouched, and we print image_spend before/after so any (capped) Google use is visible. */
async function backfillRepeatImages() {
  const sb = getDb();
  // Share-count above which a photo is an "offender" (spec default 3 = shared by 4+).
  // REPEAT_THRESHOLD=1 spreads even pairs — used after the first run left adjacent
  // duplicates (two library events on one State St photo) on the Month view.
  const threshold = Math.max(1, Number(process.env.REPEAT_THRESHOLD ?? 3));
  const month = new Date().toISOString().slice(0, 7);
  const spendBefore = (await sb.from('image_spend').select('google_calls').eq('month', month).maybeSingle()).data?.google_calls ?? 0;

  const { data, error } = await sb
    .from('things')
    .select('id, type, title, happening_tier, happening_category, neighborhood, address, price_band, place_id, photo_url, photo_source')
    .eq('status', 'published')
    .not('photo_url', 'is', null);
  if (error) throw new Error(`repeat-backfill select: ${error.message}`);
  const rows = data ?? [];

  // Count photo_urls across published things; an "offender" is shared by > threshold.
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.photo_url as string, (counts.get(r.photo_url as string) ?? 0) + 1);
  const offenders = new Set([...counts].filter(([, n]) => n > threshold).map(([u]) => u));
  const victims = rows.filter((r) => offenders.has(r.photo_url as string));

  console.log(`\n[repeat-backfill] ${offenders.size} photo_url(s) shared by >${threshold} published things · ${victims.length} rows to re-resolve`);
  for (const [u, n] of [...counts].filter(([, n]) => n > threshold).sort((a, b) => b[1] - a[1])) {
    console.log(`  ×${n}  ${String(u).slice(0, 90)}`);
  }
  const distinctBefore = new Set(victims.map((r) => r.photo_url as string)).size;
  if (!victims.length) { console.log('[repeat-backfill] nothing to do'); return; }

  const cands: Candidate[] = victims.map((r) => ({
    id: r.id as string, type: r.type, status: 'needs_review', title: r.title as string,
    tier: Number(r.happening_tier) as Candidate['tier'], happening_category: r.happening_category,
    neighborhood: r.neighborhood ?? undefined, address: (r.address as string) ?? '',
    price_band: r.price_band ?? null, time_of_day_fit: [], starts_at: null, ends_at: null,
    source_url: '', place_id: (r.place_id as string) ?? undefined,
    last_confirmed: '', start_strategy: 'none',
  }));

  const { cands: resolved, stats } = await resolveImages(cands, sb, { force: true });
  let updated = 0;
  for (const c of resolved) {
    // Phase 0 §3.1.2: same as image-backfill — a Tier-1 event can land on
    // 'placeholder' for display while still carrying real photo_options.
    const hasAlternates = (c.photo_options ?? []).some((o) => o.url);
    if (!c.photo_url && c.photo_source === 'placeholder' && !hasAlternates) continue; // still nothing — leave it
    const { error: upErr } = await sb
      .from('things')
      .update({ photo_url: c.photo_url ?? null, photo_source: c.photo_source, photo_options: c.photo_options ?? [] })
      .eq('id', c.id);
    if (upErr) throw new Error(`repeat-backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  const distinctAfter = new Set(resolved.map((c) => c.photo_url ?? '(placeholder)')).size;
  const spendAfter = (await sb.from('image_spend').select('google_calls').eq('month', month).maybeSingle()).data?.google_calls ?? 0;
  console.log(
    `\n[repeat-backfill] re-resolved ${updated} rows · distinct photos ${distinctBefore} → ${distinctAfter} ` +
      `· free ${stats.free} · google ${stats.google} · placeholder ${stats.placeholder} · over-cap ${stats.overCap}`,
  );
  console.log(`[repeat-backfill] image_spend google_calls: ${spendBefore} → ${spendAfter} (${spendAfter === spendBefore ? 'unchanged — free tier only' : 'within-cap Google use'})`);
}

/** W2.1b one-time / on-demand: apply the civic-filler classifier to EXISTING rows.
 *  Scans published/needs_review things still at editorial_weight 0, downweights the
 *  civic-meeting matches to −3, and writes one audit_log row per change. Data update
 *  only (no DDL); rerunnable (already-nudged rows are excluded by the `eq 0` filter). */
async function backfillWeights() {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select('id, title')
    .in('status', ['published', 'needs_review'])
    .eq('editorial_weight', 0);
  if (error) throw new Error(`weight-backfill select: ${error.message}`);
  const rows = data ?? [];
  const matches = rows.filter((r) => classifyWeight({ title: (r.title as string) ?? '' }) < 0);
  console.log(`\n[weight-backfill] scanned ${rows.length} weight-0 rows · ${matches.length} civic matches\n`);

  let updated = 0;
  for (const r of matches) {
    const { error: upErr } = await sb
      .from('things')
      .update({ editorial_weight: -3 })
      .eq('id', r.id)
      .eq('editorial_weight', 0); // guard: never stomp a founder's manual weight
    if (upErr) throw new Error(`weight-backfill update ${r.id}: ${upErr.message}`);
    await sb.from('audit_log').insert({
      entity_type: 'thing',
      entity_id: r.id,
      action: 'weight_auto',
      actor: 'rule',
      payload: { editorial_weight: -3, title: r.title },
    });
    updated++;
  }
  console.log(`[weight-backfill] downweighted ${updated} civic item(s) to −3 (audit rows written)`);
}

/** Mobile/image addendum Part C, one-time / on-demand: re-draft EVERY published
 *  thing's blurb + blurb_long through the retuned voice prompt, so the live catalog
 *  matches the new knowing-local-friend voice (not just new drafts going forward).
 *  Skips any row a founder has explicitly rewritten the blurb on post-publish (a
 *  catalog_edit / edit_applied / approve audit_log row whose payload.edits has a
 *  `blurb` key) — a founder's own wording is never silently overwritten. This can't
 *  detect a blurb tweak made during PRE-publish review (review/update doesn't log the
 *  blurb text), so it's a conservative signal, not a guarantee; spot-check afterward.
 *  Only writes a row when the re-draft actually differs from the current text. */
async function backfillVoice() {
  const sb = getDb();

  const { data: editLog, error: logErr } = await sb
    .from('audit_log')
    .select('entity_id, payload')
    .eq('entity_type', 'thing')
    .eq('actor', 'founder')
    .in('action', ['catalog_edit', 'edit_applied', 'approve']);
  if (logErr) throw new Error(`voice-backfill audit_log select: ${logErr.message}`);
  const founderBlurbEdited = new Set(
    (editLog ?? [])
      .filter((r) => {
        const edits = (r.payload as { edits?: Record<string, unknown> } | null)?.edits;
        return edits != null && Object.prototype.hasOwnProperty.call(edits, 'blurb');
      })
      .map((r) => r.entity_id as string),
  );

  const { data, error } = await sb
    .from('things')
    .select('id, type, title, blurb, blurb_long, happening_tier, happening_category, neighborhood, address, price_band, time_of_day_fit, is_21_plus, source, reason_to_go, local_note, last_confirmed')
    .eq('status', 'published');
  if (error) throw new Error(`voice-backfill select: ${error.message}`);
  const all = data ?? [];
  const rows = all.filter((r) => !founderBlurbEdited.has(r.id as string));
  console.log(
    `\n[voice-backfill] ${all.length} published rows · ${all.length - rows.length} skipped ` +
      `(founder-edited blurb) · ${rows.length} to re-draft\n`,
  );
  if (!rows.length) return;

  const cands: Candidate[] = rows.map((r) => ({
    id: r.id as string, type: r.type, status: 'needs_review', title: r.title as string,
    tier: Number(r.happening_tier) as Candidate['tier'], happening_category: r.happening_category,
    neighborhood: r.neighborhood ?? undefined, address: (r.address as string) ?? '',
    price_band: r.price_band ?? null, time_of_day_fit: (r.time_of_day_fit as Tod[]) ?? [],
    starts_at: null, ends_at: null, // deliberately not loaded — enrich must never see it
    source_url: (r.source as string) ?? '', reason_to_go: r.reason_to_go ?? undefined,
    local_note: r.local_note ?? undefined, is_21_plus: (r.is_21_plus as boolean) ?? undefined,
    last_confirmed: (r.last_confirmed as string)?.slice(0, 10) ?? '', start_strategy: 'none',
    // Seeded with the CURRENT text so a chunk failure (mergeEnrichment's fallback)
    // preserves it rather than nulling it out.
    blurb: (r.blurb as string) ?? undefined, blurb_long: (r.blurb_long as string) ?? undefined,
  }));

  const enriched = await enrich(cands, { sb });
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  let updated = 0;
  for (const c of enriched) {
    const original = byId.get(c.id);
    if (!original) continue;
    const blurbChanged = c.blurb && c.blurb !== original.blurb;
    const longChanged = c.blurb_long && c.blurb_long !== original.blurb_long;
    if (!blurbChanged && !longChanged) continue;
    const { error: upErr } = await sb
      .from('things')
      .update({ blurb: c.blurb ?? original.blurb, blurb_long: c.blurb_long ?? original.blurb_long })
      .eq('id', c.id);
    if (upErr) throw new Error(`voice-backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  console.log(`\n[voice-backfill] re-drafted ${updated}/${rows.length} blurbs in the new voice`);
}

async function main() {
  if (BACKFILL) return backfillEnrich();
  if (IMAGE_BACKFILL) return backfillImages();
  if (WEIGHT_BACKFILL) return backfillWeights();
  if (REPEAT_BACKFILL) return backfillRepeatImages();
  if (VOICE_BACKFILL) return backfillVoice();

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
        if (!g.ok) {
          drops.push(gateDrop(adapter.key, r, g.reason!, g.detail));
          run.dropped++;
          continue;
        }
        // §3.3 — dedupe registry candidates against the live recurringRegistry.ts file
        if (r.registryCandidate && isAlreadyInRegistry(r)) {
          drops.push(gateDrop(adapter.key, r, 'registry_exists',
            `rhythm already in recurringRegistry.ts: ${r.title}`));
          run.dropped++;
          continue;
        }
        gated.push({ cand: g.candidate!, sourceKey: adapter.key });
        run.qualified++;
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
    console.log(
      `  images               free ${r.stats.free}  google ${r.stats.google}  placeholder ${r.stats.placeholder}` +
        `  over-cap ${r.stats.overCap}  rejected-quality ${r.stats.rejectedQuality}  rejected-relevance ${r.stats.rejectedRelevance}`,
    );
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
    // Consume any queued restock directives against tonight's pool (informational;
    // never touches source, lands nothing extra). Isolated so it can't sink the run.
    try {
      const handled = await consumeDirectives(sb, toLand);
      if (handled) console.log(`  restock              consumed ${handled} queued directive(s)`);
    } catch (err) {
      console.log(`  restock              skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

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
