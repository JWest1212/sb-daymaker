// ingest/run.ts
//
// The nightly worker entrypoint (Doc 11 §10). Per-source isolation: one bad
// adapter can't sink the run (its source_runs row is marked ok=false and surfaces
// in the digest/source-health later). Flow for Phase 10:
//     fetch -> gate -> dedupe -> land   (no AI, no images yet)
//
// DRY_RUN=1 prints the per-source tallies and what it WOULD land, writing nothing.

import { registry } from './adapters/registry';
import { getLastGenericRunStats } from './adapters/generic';
import { gate } from './gate';
import { dedupeVenueAware, evaluateMatch, sameDay, titleSimilarity, NEAR_THRESHOLD, type DropRecord, type ExistingRow } from './dedupe';
import { isAlreadyInRegistry, loadRegistryCache } from './adapters/recurringRegistry';
import {
  startRun, finishRun, landCandidates, landTags, landRecurring, recordDrops, toThingRow, type RunRow,
} from './land';
import { enrich } from './enrich';
import { classifyWeight } from './weight';
import {
  resolveImages, isDirectGoogleFoodCandidate, refreshGoogleMediaUri,
  wikimediaGeosearch, rankWikimediaCandidates, loadVenuePools, matchVenueForCandidate,
  monthKey, loadSpend, saveSpend, CAP, findFreeCandidates,
  type ResolveStats, type ImageOption,
} from './images';
import { detectClosures } from './adapters/googlePlaces';
import { consumeDirectives, finalizeRunNowDirective } from './restock';
import { consumeEnrichDirectives } from './enrichDirectives';
import { sendDigest, type VenueFallbackEvent } from './digest';
import { getDb } from './db';
import { MARQUEE_VENUES, matchMarqueeVenue } from './marqueeVenues';
import { bestVenueMatch, extractVenueNameFromAddress, slugifyVenueKey, pickFromPool, type MatchableVenue } from '../lib/venuePool';
import { assignVisual } from '../lib/visualAssignment';
import { haversineMeters } from '../lib/geo';
import { sbDay } from '../lib/explore';
import { sourceKeyOf } from './dedupe';
import { computeDataConfidence, type SourceMeta, type ThingForConfidence } from './confidence';
import { classifyBand, AUTO_PUBLISH_GATE, HOLD_FLOOR, type PublishBand } from './publishGate';
import { computeEventKey, canonicalVenue, type VenueDictEntry as EventKeyVenueDictEntry } from './eventKey';
import { adjudicatePairs, applyAmbiguousAdjudication, type AdjudicationPair } from './dedupeAdjudicate';
import type { Candidate, RawCandidate, Tod, PhotoSource } from '../packages/shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const WINDOW_DAYS = 45;
const DRY = process.env.DRY_RUN === '1';
const DIRECTIVE_ID = process.env.DIRECTIVE_ID || null; // C2b restock Run-now: finalize only this directive
const BACKFILL = process.env.ENRICH_BACKFILL === '1';
const IMAGE_BACKFILL = process.env.IMAGE_BACKFILL === '1';
const IMAGE_BACKFILL_PUBLISHED = process.env.IMAGE_BACKFILL_PUBLISHED === '1';
const IMAGE_BACKFILL_FOOD = process.env.IMAGE_BACKFILL_FOOD === '1';
const WEIGHT_BACKFILL = process.env.WEIGHT_BACKFILL === '1';
const REPEAT_BACKFILL = process.env.REPEAT_BACKFILL === '1';
const VOICE_BACKFILL = process.env.VOICE_BACKFILL === '1';
// Card Imagery Build Spec Phase 2 §5.2, one-off venue registry seed.
const VENUE_SEED = process.env.VENUE_SEED === '1';
// Data Arch Redesign 24 Phase 1, compute-only preview of data_confidence
// across the current catalog. Writes nothing.
const CONFIDENCE_DRYRUN = process.env.CONFIDENCE_DRYRUN === '1';
// One-off: actually persist data_confidence for the whole existing catalog
// (the columns now exist). After this, the nightly run keeps it current on
// its own, see recomputeConfidenceScores() near the digest step below.
const CONFIDENCE_BACKFILL = process.env.CONFIDENCE_BACKFILL === '1';
// Data Arch Redesign 24 Phase 2, SHADOW MODE: label what the gate would do
// to today's needs_review queue. Read-only; publishes/holds nothing.
const CONFIDENCE_GATE_SHADOW = process.env.CONFIDENCE_GATE_SHADOW === '1';
// Data Arch Redesign 24 Phase 3, run the real gate once, on demand (the
// nightly run also does this automatically every night; see main()).
const CONFIDENCE_GATE_APPLY = process.env.CONFIDENCE_GATE_APPLY === '1';
// Data Arch Redesign 24 Phase 5, run the rescue pass once, on demand (the
// nightly run also does this automatically every night; see main()).
const CONFIDENCE_RESCUE = process.env.CONFIDENCE_RESCUE === '1';
// Data Arch Redesign 26 Phase 1, compute-only preview of event_key across the
// current catalog. Writes nothing; dedupe.ts's actual matching is untouched
// until Phase 2. Safe to run before the event_key DDL exists.
const EVENT_KEY_DRYRUN = process.env.EVENT_KEY_DRYRUN === '1';
// Data Arch Redesign 26 Phase 1, one-off: actually persist event_key for the
// whole existing catalog (the column now exists). Still doesn't change dedupe
// behavior, see EVENT_KEY_DRYRUN comment above.
const EVENT_KEY_BACKFILL = process.env.EVENT_KEY_BACKFILL === '1';
// Data Arch Redesign 26 Phase 2, read-only pairwise audit of dedupe.ts's live
// venue-aware matcher (evaluateMatch/dedupeVenueAware) vs the plain
// deterministic baseline (dedupe()), run over the existing catalog. Writes
// nothing. Used to validate the matcher before go-live; kept afterward as a
// standing audit tool (e.g. to watch the ambiguous-band count Phase 3 will consume).
const DEDUPE_VENUE_SHADOW = process.env.DEDUPE_VENUE_SHADOW === '1';
// Data Arch Redesign 26 Phase 3, Sonnet batch adjudication on the ambiguous
// band, run against the live catalog. SHADOW: reports verdicts + cost, writes
// nothing, and does not change what dedupeVenueAware() actually merges.
const DEDUPE_ADJUDICATE_SHADOW = process.env.DEDUPE_ADJUDICATE_SHADOW === '1';
// Data Arch Redesign 26 Phase 4, one-off: populate event_sources +
// things.source_count for the whole existing catalog (event_key column
// already backfilled in Phase 1). After this, the live nightly run keeps it
// current on its own, see recordCorroboration() near the LAND step below.
const EVENT_SOURCES_BACKFILL = process.env.EVENT_SOURCES_BACKFILL === '1';

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
 *  something, no blurb, zero occasion tags (W2.2: backfill the untagged ~179), or zero
 *  Activity tags (Home Rework spec §6.2: pre-Activity-taxonomy rows).
 *  starts_at is never written; and a blurb is written ONLY when the row had none, so
 *  founder-edited blurbs are never overwritten (tags/activities-only enrich for
 *  already-blurbed rows). Idempotent: landTags ignores duplicates; the activities
 *  update only ever fires on a row whose activities was empty going in.
 *  REQUIRES supabase/migrations/20260711_activities.sql applied first, the select
 *  below will fail on a DB that doesn't have the `activities` column yet. */
async function backfillEnrich() {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select('id, type, title, blurb, happening_tier, happening_category, neighborhood, address, price_band, time_of_day_fit, is_21_plus, source, reason_to_go, local_note, last_confirmed, status, activities, data_confidence, thing_tags ( tag )')
    .in('status', ['published', 'needs_review'])
    // Data Arch Redesign 24 Phase 5, "low-confidence and stale re-checked
    // first" (§5): worst rows attempted first, so a truncated batch (an AI
    // timeout, a future row cap) upgrades the neediest records, not whichever
    // happened to sort first in the DB.
    .order('data_confidence', { ascending: true, nullsFirst: true });
  if (error) throw new Error(`backfill select: ${error.message}`);
  const all = data ?? [];

  // A row needs enrichment if it has no blurb, no occasion tags, or no activities yet.
  const tagCount = (r: Record<string, unknown>) => ((r.thing_tags as unknown[]) ?? []).length;
  const activityCount = (r: Record<string, unknown>) => ((r.activities as unknown[]) ?? []).length;
  const rows = all.filter((r) => r.blurb == null || tagCount(r) === 0 || activityCount(r) === 0);
  // Rows that already have a blurb: enrich for TAGS/ACTIVITIES only, never overwrite their blurb.
  const hadBlurb = new Set(rows.filter((r) => r.blurb != null).map((r) => r.id as string));
  const hadActivities = new Set(rows.filter((r) => activityCount(r) > 0).map((r) => r.id as string));
  console.log(
    `\n[enrich-backfill] ${all.length} published/needs_review rows · ${rows.length} missing blurb/tags/activities ` +
      `(${rows.length - hadBlurb.size} need a blurb, ${rows.length - hadActivities.size} need activities)\n`,
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
    starts_at: null, // deliberately not loaded, enrich must never see it
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
  let activitiesWritten = 0;
  for (const c of enriched) {
    const fillBlurb = c.blurb && !hadBlurb.has(c.id);
    const fillActivities = !hadActivities.has(c.id) && (c.proposed_activities?.length ?? 0) > 0;
    if (!fillBlurb && !fillActivities) continue;
    const payload: Record<string, unknown> = {};
    if (fillBlurb) {
      payload.blurb = c.blurb;
      payload.blurb_long = c.blurb_long ?? null;
    }
    if (fillActivities) payload.activities = c.proposed_activities; // NOT starts_at, ever
    const { error: upErr } = await sb.from('things').update(payload).eq('id', c.id);
    if (upErr) throw new Error(`backfill update ${c.id}: ${upErr.message}`);
    if (fillBlurb) updated++;
    if (fillActivities) activitiesWritten++;
  }
  const tagged = await landTags(sb, enriched);
  console.log(`\n[enrich-backfill] wrote ${updated} missing blurbs · ${activitiesWritten} activities backfills · inserted ${tagged} tags`);
}

/** Card Imagery Build Spec Phase 0 §3.1.6, one-off, read-only coverage report from
 *  live data. No schema changes, no writes: things-per-category × photo_source, plus
 *  Tier-1 event address clusters (a simple normalized-address grouping, the real
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
  // 'pexels'/'placeholder' stay in this list post-Phase-3 specifically so this
  // report can show they're at zero, not because either is still assignable.
  const sources = ['owned', 'wikimedia', 'google', 'motif', 'pexels', 'placeholder'];
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
    .select('id, type, title, happening_tier, happening_category, neighborhood, address, price_band, place_id, photo_source, venue_id, data_confidence')
    .eq('status', 'needs_review')
    // Data Arch Redesign 24 Phase 5, low-confidence/stale rows first (§5), same
    // rationale as backfillEnrich's ordering above.
    .order('data_confidence', { ascending: true, nullsFirst: true });
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
    venue_id: (r.venue_id as string) ?? undefined,
    last_confirmed: '', start_strategy: 'none',
  }));

  const { cands: resolved, stats } = await resolveImages(cands, sb, { force });
  let updated = 0;
  for (const c of resolved) {
    // Phase 3 §6.2: every candidate now resolves to EITHER a real photo OR a
    // motif/big-type assignment (`visual_kind`), `photo_source` is never the bare
    // 'placeholder' out of resolveImages() anymore. Only skip the write when
    // truly nothing was found/assigned at all AND no alternates exist either
    // (shouldn't happen post-Phase-3, kept as a defensive no-op guard).
    const hasAlternates = (c.photo_options ?? []).some((o) => o.url);
    if (!c.photo_url && !c.visual_kind && !hasAlternates) continue; // still nothing, leave it
    const { error: upErr } = await sb
      .from('things')
      .update({
        photo_url: c.photo_url ?? null, photo_source: c.photo_source,
        photo_options: c.photo_options ?? [], photo_attribution: c.photo_attribution ?? null,
        visual_kind: c.visual_kind ?? null, visual_key: c.visual_key ?? null, visual_seed: c.visual_seed ?? null,
        ...(c.venue_id ? { venue_id: c.venue_id } : {}),
      })
      .eq('id', c.id);
    if (upErr) throw new Error(`image-backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  console.log(`\n[image-backfill] updated ${updated} images, free ${stats.free} · google ${stats.google} · motif ${stats.motif} · over-cap ${stats.overCap}`);

  // Card Imagery Build Spec Phase 0 §3.1.6, one-off, read-only coverage report from
  // live data: seeds the Phase 2 venue registry with real concentration data.
  await emitCoverageReport(sb);
}

/** Card Imagery Build Spec Phase 0, one-time / on-demand, explicitly authorized by
 *  Jim (2026-07-09): a broader pass over PUBLISHED rows. `IMAGE_BACKFILL` above never
 *  reaches these, Explore's RLS policy only ever serves `status='published'`, so
 *  without this the public feed doesn't visibly change (see the 2026-07-09 ledger
 *  entry, finding 8). No column or audit-log entry distinguishes a founder's manual
 *  cockpit pick from an auto-pick, so this CAN silently overwrite a hand-picked
 *  photo, a risk Jim accepted explicitly rather than have this function guess at a
 *  workaround.
 *
 *  v2 (2026-07-09, same day), reordered after the first run showed the bug this
 *  comment now documents: `cacheKey()` is TITLE-based, not address-based, so most of
 *  ~505 Tier-1 events (mostly unique titles even at a shared venue) turned out to be
 *  cache MISSES, not hits, the original "events are basically free" assumption was
 *  wrong. Gathering fresh Pexels/Wikimedia for all of them first exhausted Pexels'
 *  ~200/hr free-tier quota before the 54 Tier-2/3 places got a turn, and the
 *  resolver's own "don't spend Google while Pexels is rate-limited" guard then also
 *  blocked their Google fallback, 52/54 places landed on placeholder, a real
 *  regression for rows that likely had a decent (if generic) photo before this ran.
 *  Fixed by flipping the order and how Tier-1 is handled:
 *   - Tier-2/3 places run FIRST, forced, the only branch worth spending Pexels/
 *     Google budget on. Bounded (~80 rows), safe under both the rate limit and the
 *     Google monthly cap (only place_id food_drink_spot rows with no free hit can
 *     reach Google at all).
 *   - Tier-1 events are a direct, no-network UPDATE, not a resolveImages() call.
 *     `eventDefaultsToNoPhoto` forces their display to placeholder unconditionally
 *     regardless of what a search would find, so gathering anything for them first
 *     was always pure waste against the shared quota, this version spends nothing
 *     on them and only touches rows not already on placeholder (idempotent, safe to
 *     re-run any time). Their photo_options (cockpit alternates) aren't refreshed by
 *     this pass; use the picker's "find more options" on a given event if needed.
 *
 *  v3 (2026-07-09, same day), a v2 re-run still hit a fresh Pexels 429 on only 54
 *  candidates, leaving 22 places on placeholder (down from 52, but not zero), *  apparently the free-tier quota hadn't fully replenished within the assumed
 *  ~1hr window. Tier-2/3 now also skips any row already on 'wikimedia'/'google'/
 *  'owned', so a re-run only spends quota on rows still stuck at 'pexels' or
 *  'placeholder' instead of re-confirming ones already fixed, cheaper each time
 *  and naturally converges to zero-remaining over a few re-runs regardless of
 *  exactly how long Pexels' quota window turns out to be. */
async function backfillPublishedImages() {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select('id, type, title, happening_tier, happening_category, neighborhood, address, lat, lng, price_band, place_id, photo_source, visual_kind, venue_id')
    .eq('status', 'published');
  if (error) throw new Error(`published-image-backfill select: ${error.message}`);
  const rows = data ?? [];
  console.log(`\n[published-image-backfill] ${rows.length} published rows`);
  if (!rows.length) return;

  const toCand = (r: (typeof rows)[number]): Candidate => ({
    id: r.id as string, type: r.type, status: 'needs_review', title: r.title as string,
    tier: Number(r.happening_tier) as Candidate['tier'], happening_category: r.happening_category,
    neighborhood: r.neighborhood ?? undefined, address: (r.address as string) ?? '',
    price_band: r.price_band ?? null, time_of_day_fit: [], starts_at: null, ends_at: null,
    source_url: '', place_id: (r.place_id as string) ?? undefined,
    venue_id: (r.venue_id as string) ?? undefined,
    last_confirmed: '', start_strategy: 'none',
  });

  // 2026-07-10, loaded once so the Tier-1 fast path below can check for a
  // venue-pool match (Build Spec §2 priority table: pool beats the Tier-1
  // default) without a per-row network call, venue_photos is a local DB read.
  const { byId: venuesById, byPlaceId: venuesByPlaceId, poolsByVenueId } = await loadVenuePools(sb);
  const today = sbDay(Date.now());

  const tier1Rows = rows.filter((r) => Number(r.happening_tier) === 1);
  // Card Imagery Build Spec Phase 0, only re-force rows not already on a
  // relevance-first source: a re-run (e.g. after a Pexels 429) shouldn't re-spend
  // quota re-confirming the ones that already got wikimedia/google/owned. Makes
  // repeated runs cheaper and self-converging instead of re-attempting all ~80
  // Tier-2/3 rows every time, observed necessary 2026-07-09 when a second run
  // still hit a fresh 429 on only 54 candidates (Pexels' quota apparently hadn't
  // fully replenished from the first run within the assumed ~1hr window).
  // Phase 3 §6.2: 'motif' joins the good-sources set, a deterministic motif/
  // big-type assignment is as settled as a real photo pick; a founder who wants a
  // different pick overrides it via the cockpit's picker, not a blanket re-force.
  const GOOD_SOURCES = new Set(['wikimedia', 'google', 'owned', 'motif']);
  const otherRows = rows.filter(
    (r) => Number(r.happening_tier) !== 1 && !GOOD_SOURCES.has(r.photo_source as string),
  );
  console.log(
    `[published-image-backfill] ${otherRows.length} Tier-2/3 (forced refresh, runs first) · ` +
      `${tier1Rows.length} Tier-1 (direct update, no network)`,
  );

  // Tier-2/3 first, see the function comment for why order matters here.
  const others = otherRows.length
    ? await resolveImages(otherRows.map(toCand), sb, { force: true })
    : { cands: [] as Candidate[], stats: null as ResolveStats | null };

  let updated = 0;
  for (const c of others.cands) {
    // Same guard as image-backfill: don't drop real photo_options just because the
    // display auto-pick landed on a motif/big-type assignment instead of a photo.
    const hasAlternates = (c.photo_options ?? []).some((o) => o.url);
    if (!c.photo_url && !c.visual_kind && !hasAlternates) continue;
    const { error: upErr } = await sb
      .from('things')
      .update({
        photo_url: c.photo_url ?? null, photo_source: c.photo_source,
        photo_options: c.photo_options ?? [], photo_attribution: c.photo_attribution ?? null,
        visual_kind: c.visual_kind ?? null, visual_key: c.visual_key ?? null, visual_seed: c.visual_seed ?? null,
        ...(c.venue_id ? { venue_id: c.venue_id } : {}),
      })
      .eq('id', c.id);
    if (upErr) throw new Error(`published-image-backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }

  // Tier-1: deterministic, no resolveImages() call, see the function comment.
  // `assignVisual` is pure (no network) so this stays the cheap, no-network
  // direct-update path the function comment promises; venue-pool/marquee lookups
  // are local map reads, not API calls.
  // 2026-07-10 exception (Jim's ask): a venue-POOL match wins over the Tier-1
  // default (Build Spec §2 priority table, "Venue pool... any card (place or
  // dated event)", ranked above "Motif... all remaining dated events"). Checked
  // BEFORE the "already assigned, skip" guard on every row (not just unresolved
  // ones), pools grow as Jim curates more venues, so a row already sitting on
  // 'motif' from a prior run still needs re-checking against the CURRENT pool
  // state, not skipped forever.
  let tier1Updated = 0;
  for (const r of tier1Rows) {
    const matchedVenue = matchVenueForCandidate(
      { venue_id: (r.venue_id as string) ?? undefined, place_id: (r.place_id as string) ?? undefined },
      venuesById, venuesByPlaceId,
    );
    const pool = matchedVenue ? poolsByVenueId.get(matchedVenue.id) : undefined;

    if (pool && pool.length) {
      const picked = pool[pickFromPool(r.id as string, today, pool.length)];
      if (r.photo_source === picked.source && r.venue_id === matchedVenue!.id) continue; // already correct
      const { error: upErr } = await sb
        .from('things')
        .update({
          photo_url: picked.url, photo_source: picked.source,
          photo_attribution: picked.attribution ?? null,
          visual_kind: null, visual_key: null, visual_seed: null,
          venue_id: matchedVenue!.id,
        })
        .eq('id', r.id);
      if (upErr) throw new Error(`published-image-backfill tier-1 pool update ${r.id}: ${upErr.message}`);
      tier1Updated++;
      continue;
    }

    if (r.photo_source === 'motif' && r.visual_kind) continue; // already correctly assigned, no pool match
    const marquee = matchMarqueeVenue({ title: r.title as string, lat: (r.lat as number) ?? undefined, lng: (r.lng as number) ?? undefined });
    const visual = assignVisual({ id: r.id as string, happening_category: r.happening_category }, marquee?.key);
    const { error: upErr } = await sb
      .from('things')
      .update({
        photo_url: null, photo_source: 'motif',
        visual_kind: visual.visual_kind, visual_key: visual.visual_key, visual_seed: visual.visual_seed,
      })
      .eq('id', r.id);
    if (upErr) throw new Error(`published-image-backfill tier-1 update ${r.id}: ${upErr.message}`);
    tier1Updated++;
  }
  updated += tier1Updated;

  console.log(
    `\n[published-image-backfill] updated ${updated}/${rows.length} things ` +
      `(${tier1Updated} Tier-1 direct, ${updated - tier1Updated} Tier-2/3 via resolver)`,
  );
  if (others.stats) {
    console.log(
      `  tier-2/3 (forced)     free ${others.stats.free} · google ${others.stats.google} · ` +
        `motif ${others.stats.motif} · over-cap ${others.stats.overCap}`,
    );
  }

  await emitCoverageReport(sb);
}

/** Card Imagery Build Spec Phase 1 §4.5, scoped backfill for the new direct-Google
 *  food/drink routing: re-resolves ONLY published food_drink_spot / weekly_special /
 *  happyhour-type rows carrying a place_id, forced (so an already-cached Wikimedia/
 *  Pexels pick gets re-ranked through the food-first Google routing). Deliberately
 *  scoped instead of a blanket forced pass, the spec's own "run a scoped backfill for
 *  the food set only," and the same reasoning as the Phase 0 published-images split:
 *  small and bounded keeps it inside the free-tier rate limit and the Google cap. */
async function backfillFoodImages() {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select('id, type, title, happening_tier, happening_category, neighborhood, address, price_band, place_id, photo_source, venue_id')
    .eq('status', 'published')
    .not('place_id', 'is', null);
  if (error) throw new Error(`food-image-backfill select: ${error.message}`);
  const rows = (data ?? []).filter((r) =>
    isDirectGoogleFoodCandidate({ happening_category: r.happening_category, type: r.type }));
  console.log(`\n[food-image-backfill] ${rows.length} published food/drink rows with a place_id (forced re-resolve)`);
  if (!rows.length) return;

  const cands: Candidate[] = rows.map((r) => ({
    id: r.id as string, type: r.type, status: 'needs_review', title: r.title as string,
    tier: Number(r.happening_tier) as Candidate['tier'], happening_category: r.happening_category,
    neighborhood: r.neighborhood ?? undefined, address: (r.address as string) ?? '',
    price_band: r.price_band ?? null, time_of_day_fit: [], starts_at: null, ends_at: null,
    source_url: '', place_id: (r.place_id as string) ?? undefined,
    venue_id: (r.venue_id as string) ?? undefined,
    last_confirmed: '', start_strategy: 'none',
  }));

  const { cands: resolved, stats } = await resolveImages(cands, sb, { force: true });
  let updated = 0;
  for (const c of resolved) {
    // Same guard as the other image backfills: don't drop real photo_options just
    // because the display auto-pick landed on a motif/big-type assignment.
    const hasAlternates = (c.photo_options ?? []).some((o) => o.url);
    if (!c.photo_url && !c.visual_kind && !hasAlternates) continue;
    const { error: upErr } = await sb
      .from('things')
      .update({
        photo_url: c.photo_url ?? null, photo_source: c.photo_source,
        photo_options: c.photo_options ?? [], photo_attribution: c.photo_attribution ?? null,
        visual_kind: c.visual_kind ?? null, visual_key: c.visual_key ?? null, visual_seed: c.visual_seed ?? null,
        ...(c.venue_id ? { venue_id: c.venue_id } : {}),
      })
      .eq('id', c.id);
    if (upErr) throw new Error(`food-image-backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  console.log(
    `\n[food-image-backfill] updated ${updated}/${rows.length}, free ${stats.free} · google ${stats.google} · ` +
      `motif ${stats.motif} · over-cap ${stats.overCap}`,
  );
}

/** W2.3 one-time / on-demand: re-resolve the "repeat offenders", a photo_url shared by
 *  MORE than 3 published things, through the resolver with force + the new variety logic
 *  (category-aware queries + per-batch dedupe), so an over-repeated stock photo gets spread
 *  across distinct images. Free-tier only in practice: the resolver's Google gate/cap code
 *  is untouched, and we print image_spend before/after so any (capped) Google use is visible. */
async function backfillRepeatImages() {
  const sb = getDb();
  // Share-count above which a photo is an "offender" (spec default 3 = shared by 4+).
  // REPEAT_THRESHOLD=1 spreads even pairs, used after the first run left adjacent
  // duplicates (two library events on one State St photo) on the Month view.
  const threshold = Math.max(1, Number(process.env.REPEAT_THRESHOLD ?? 3));
  const month = new Date().toISOString().slice(0, 7);
  const spendBefore = (await sb.from('image_spend').select('google_calls').eq('month', month).maybeSingle()).data?.google_calls ?? 0;

  const { data, error } = await sb
    .from('things')
    .select('id, type, title, happening_tier, happening_category, neighborhood, address, price_band, place_id, photo_url, photo_source, venue_id')
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
    venue_id: (r.venue_id as string) ?? undefined,
    last_confirmed: '', start_strategy: 'none',
  }));

  const { cands: resolved, stats } = await resolveImages(cands, sb, { force: true });
  let updated = 0;
  for (const c of resolved) {
    // Phase 3 §6.2: same as image-backfill, a re-resolved victim can legitimately
    // lose its real photo (e.g. the shared one no longer scores) and fall to a
    // motif/big-type assignment instead of a bare placeholder.
    const hasAlternates = (c.photo_options ?? []).some((o) => o.url);
    if (!c.photo_url && !c.visual_kind && !hasAlternates) continue; // still nothing, leave it
    const { error: upErr } = await sb
      .from('things')
      .update({
        photo_url: c.photo_url ?? null, photo_source: c.photo_source,
        photo_options: c.photo_options ?? [], photo_attribution: c.photo_attribution ?? null,
        visual_kind: c.visual_kind ?? null, visual_key: c.visual_key ?? null, visual_seed: c.visual_seed ?? null,
        ...(c.venue_id ? { venue_id: c.venue_id } : {}),
      })
      .eq('id', c.id);
    if (upErr) throw new Error(`repeat-backfill update ${c.id}: ${upErr.message}`);
    updated++;
  }
  const distinctAfter = new Set(resolved.map((c) => c.photo_url ?? '(placeholder)')).size;
  const spendAfter = (await sb.from('image_spend').select('google_calls').eq('month', month).maybeSingle()).data?.google_calls ?? 0;
  console.log(
    `\n[repeat-backfill] re-resolved ${updated} rows · distinct photos ${distinctBefore} → ${distinctAfter} ` +
      `· free ${stats.free} · google ${stats.google} · motif ${stats.motif} · over-cap ${stats.overCap}`,
  );
  console.log(`[repeat-backfill] image_spend google_calls: ${spendBefore} → ${spendAfter} (${spendAfter === spendBefore ? 'unchanged, free tier only' : 'within-cap Google use'})`);
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

/** Data Arch Redesign 24, sources.authority/reliability/lane keyed by
 *  sources.key, for the confidence scorer. Kept separate from
 *  loadSourceConfig() (dedupe's authority-only map) so a read failure here
 *  can't affect dedupe's canonical-source ordering. */
async function loadSourceMetaByKey(sb: SupabaseClient): Promise<Map<string, SourceMeta>> {
  const { data, error } = await sb.from('sources').select('key, authority, reliability, lane');
  if (error) throw new Error(`confidence sources read: ${error.message}`);
  const byKey = new Map<string, SourceMeta>();
  for (const r of data ?? []) {
    byKey.set(r.key as string, {
      authority: Number(r.authority), reliability: Number(r.reliability), lane: r.lane as string,
    });
  }
  return byKey;
}

interface ScoredThing {
  id: string; title: string; status: string; sourceKey: string;
  score: number; breakdown: import('./confidence').ConfidenceBreakdown;
}

/** Scores every published/needs_review thing against the current catalog data.
 *  Pure computation, the caller decides whether to print it (dry run) or
 *  write it (recomputeConfidenceScores). */
async function scoreCatalog(sb: SupabaseClient): Promise<ScoredThing[]> {
  const sourceByKey = await loadSourceMetaByKey(sb);
  const { data: rows, error } = await sb
    .from('things')
    .select(`id, title, status, happening_tier, starts_at, address, blurb, photo_url, photo_source,
      nearby_zone, activities, last_confirmed, source, source_count,
      recurring_schedules ( day_of_week, start_time )`)
    // Data Arch Redesign 24 Phase 5, 'draft' here means ONLY applyPublishGate's
    // held band (the only writer of things.status='draft' in the live pipeline;
    // confirmed via grep before relying on this). Held things must keep scoring
    // every night, not freeze at their hold-time score, or a later run filling in
    // a missing field/fresher confirmation could never rescue them (spec 24 §5).
    .in('status', ['published', 'needs_review', 'draft']);
  if (error) throw new Error(`confidence things read: ${error.message}`);

  return (rows ?? []).map((r) => {
    const scheds = (r.recurring_schedules as { day_of_week: number | null; start_time: string | null }[]) ?? [];
    const scheduleConfirmed = scheds.some((s) => s.day_of_week != null && !!s.start_time);
    const sourceKey = sourceKeyOf((r.source as string) ?? undefined);
    const t: ThingForConfidence = {
      happening_tier: Number(r.happening_tier),
      starts_at: (r.starts_at as string) ?? null,
      address: (r.address as string) ?? null,
      blurb: (r.blurb as string) ?? null,
      photo_url: (r.photo_url as string) ?? null,
      photo_source: (r.photo_source as string) ?? null,
      nearby_zone: (r.nearby_zone as string) ?? null,
      activities: (r.activities as string[]) ?? null,
      last_confirmed: (r.last_confirmed as string) ?? null,
      source_count: (r.source_count as number) ?? 1,
      scheduleConfirmed,
    };
    const { score, breakdown } = computeDataConfidence(t, sourceByKey.get(sourceKey));
    return { id: r.id as string, title: r.title as string, status: r.status as string, sourceKey, score, breakdown };
  });
}

function printConfidenceHistogram(scored: ScoredThing[], label: string): void {
  const buckets = new Array(10).fill(0);
  for (const s of scored) buckets[Math.min(9, Math.floor(s.score * 10))]++;
  console.log(`\n[${label}] ${scored.length} rows scored (published + needs_review)\n`);
  console.log('score band     count   bar');
  buckets.forEach((n, i) => {
    const lo = (i / 10).toFixed(1);
    const hi = ((i + 1) / 10).toFixed(1);
    console.log(`${lo}–${hi}          ${String(n).padStart(4)}   ${'#'.repeat(n)}`);
  });
}

/** Data Arch Redesign 24 Phase 1, compute data_confidence for every published/
 *  needs_review thing using the current catalog's real data, WITHOUT writing
 *  anything. Prints a histogram + a handful of worked examples so the
 *  weighting can be eyeballed before it's turned on for real. */
async function backfillConfidenceDryRun() {
  const sb = getDb();
  const scored = await scoreCatalog(sb);
  printConfidenceHistogram(scored, 'confidence-dryrun');

  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const examples = [
    byScore[0],
    byScore[Math.floor(byScore.length * 0.25)],
    byScore[Math.floor(byScore.length * 0.5)],
    byScore[Math.floor(byScore.length * 0.75)],
    byScore[byScore.length - 1],
  ].filter(Boolean);

  console.log('\n[confidence-dryrun] worked examples (best, ~p25, ~p50, ~p75, worst):\n');
  for (const e of examples) {
    console.log(`  ${e.score.toFixed(2)}  "${e.title}"  [${e.status}, source=${e.sourceKey}]`);
    console.log(`         source_trust=${e.breakdown.sourceTrust.toFixed(2)} extraction=${e.breakdown.extractionMethod.toFixed(2)} completeness=${e.breakdown.fieldCompleteness.toFixed(2)} cross_source=${e.breakdown.crossSourceAgreement.toFixed(2)} recency=${e.breakdown.recency.toFixed(2)} findability=${e.breakdown.findability.toFixed(2)}`);
  }
  console.log('');
}

interface EventKeyRow {
  id: string; title: string; address: string | null; place_id: string | null;
  happening_tier: number; starts_at: string | null; type: string; status: string;
  recurring_schedules: { day_of_week: number | null; frequency: string | null }[] | null;
}

/** Reads every T1/T2 thing + the venue_neighborhoods dictionary and computes
 *  event_key for each row, purely in memory. Shared by the dry-run report and
 *  the persisting backfill so the two can never drift apart. */
async function computeCatalogEventKeys(sb: SupabaseClient): Promise<{ typed: EventKeyRow[]; keyed: Map<string, string>; groups: Map<string, EventKeyRow[]> }> {
  const { data: dictRows, error: dictErr } = await sb
    .from('venue_neighborhoods')
    .select('name_norm, place_id, aliases');
  if (dictErr) throw new Error(`event-key dictionary read: ${dictErr.message}`);
  const dictionary = (dictRows ?? []) as unknown as EventKeyVenueDictEntry[];

  const { data: rows, error } = await sb
    .from('things')
    .select(`id, title, address, place_id, happening_tier, starts_at, type, status,
      recurring_schedules ( day_of_week, frequency )`)
    .in('happening_tier', [1, 2]);
  if (error) throw new Error(`event-key things read: ${error.message}`);
  const typed = (rows ?? []) as unknown as EventKeyRow[];

  const keyed = new Map<string, string>();
  const groups = new Map<string, EventKeyRow[]>();
  for (const r of typed) {
    const recurring = (r.recurring_schedules ?? [])
      .filter((s): s is { day_of_week: number; frequency: string } => s.day_of_week != null && !!s.frequency);
    const key = computeEventKey(
      { title: r.title, address: r.address, place_id: r.place_id, happening_tier: r.happening_tier, starts_at: r.starts_at, recurring },
      dictionary,
    );
    if (!key) continue;
    keyed.set(r.id, key);
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return { typed, keyed, groups };
}

function printEventKeyReport(label: string, typed: EventKeyRow[], keyed: Map<string, string>, groups: Map<string, EventKeyRow[]>): void {
  const collapsing = [...groups.values()].filter((g) => g.length > 1);
  const collapsingRows = collapsing.reduce((n, g) => n + g.length, 0);
  const unkeyed = typed.length - keyed.size;

  console.log(`\n[${label}] ${typed.length} T1/T2 thing(s) read (of which ${unkeyed} produced no key -- missing venue+title+date/cadence signal)`);
  console.log(`[${label}] ${groups.size} distinct event_key(s); ${collapsing.length} group(s) share a key across ${collapsingRows} thing(s) (net reduction of ${collapsingRows - collapsing.length} row(s) if merged)\n`);

  const bySize = [...collapsing].sort((a, b) => b.length - a.length);
  console.log(`[${label}] sample collapse groups (largest first, up to 15):\n`);
  for (const g of bySize.slice(0, 15)) {
    console.log(`  group of ${g.length}:`);
    for (const r of g) {
      console.log(`    "${r.title}"  [${r.type}/${r.status}, tier ${r.happening_tier}]  starts_at=${r.starts_at ?? 'null'}  address=${r.address ?? 'null'}`);
    }
  }
  console.log('');
}

/** Data Arch Redesign 26 Phase 1, compute event_key for the whole existing
 *  catalog's dated (T1) + recurring (T2) rows, WITHOUT writing anything (the
 *  event_key column doesn't need to exist yet for this to run). Groups by key
 *  and reports how many things would collapse, plus sample groups, so the
 *  normalization + venue-canonicalization rules can be eyeballed before the
 *  column is added and before dedupe.ts's actual matching changes (Phase 2). */
async function eventKeyDryRun() {
  const sb = getDb();
  const { typed, keyed, groups } = await computeCatalogEventKeys(sb);
  printEventKeyReport('event-key-dryrun', typed, keyed, groups);
}

/** Data Arch Redesign 26 Phase 1, actually persist event_key for the whole
 *  existing catalog (the column now exists, applied by Jim). Does NOT change
 *  dedup behavior, dedupe.ts still ignores event_key until Phase 2. */
async function eventKeyBackfill() {
  const sb = getDb();
  const { typed, keyed, groups } = await computeCatalogEventKeys(sb);

  let updated = 0;
  for (const [id, key] of keyed) {
    const { error } = await sb.from('things').update({ event_key: key }).eq('id', id);
    if (error) { console.log(`  [event-key-backfill] update failed for ${id}: ${error.message}`); continue; }
    updated++;
  }
  console.log(`\n[event-key-backfill] wrote event_key for ${updated} of ${typed.length} T1/T2 thing(s)`);
  printEventKeyReport('event-key-backfill', typed, keyed, groups);
}

/** Data Arch Redesign 26 Phase 4, one-off: populate event_sources and
 *  things.source_count for the whole existing catalog (event_key already
 *  backfilled in Phase 1). Reuses recordCorroboration(), the same function
 *  the live nightly run calls, over the existing rows cast to the minimal
 *  shape it needs, so backfill and live bookkeeping can never drift apart. */
async function eventSourcesBackfill() {
  const sb = getDb();
  const { data: rows, error } = await sb.from('things').select('id, event_key, source, title').not('event_key', 'is', null);
  if (error) throw new Error(`event-sources-backfill things read: ${error.message}`);
  const typed = (rows ?? []) as { id: string; event_key: string; source: string | null; title: string }[];

  const fakeCands = typed.map((r) => ({ event_key: r.event_key, source_url: r.source ?? undefined }) as unknown as Candidate);
  await recordCorroboration(sb, fakeCands, []);

  const { data: after, error: afterErr } = await sb
    .from('things').select('id, title, event_key, source_count').not('event_key', 'is', null);
  if (afterErr) throw new Error(`event-sources-backfill verify read: ${afterErr.message}`);
  const byKey = new Map<string, { id: string; title: string; source_count: number }[]>();
  for (const r of after ?? []) {
    const ek = r.event_key as string;
    const list = byKey.get(ek) ?? [];
    list.push({ id: r.id as string, title: r.title as string, source_count: Number(r.source_count) });
    byKey.set(ek, list);
  }
  const multi = [...byKey.entries()].filter(([, rs]) => (rs[0]?.source_count ?? 1) > 1);

  console.log(`\n[event-sources-backfill] ${typed.length} thing(s) with an event_key; ${byKey.size} distinct event_key(s)`);
  console.log(`[event-sources-backfill] ${multi.length} event_key(s) corroborated by more than one source\n`);

  for (const [ek, rs] of multi.slice(0, 10)) {
    const { data: sources } = await sb.from('event_sources').select('source_key').eq('event_key', ek);
    console.log(`  event_key ${ek}  source_count=${rs[0].source_count}  sources=[${(sources ?? []).map((s) => s.source_key).join(', ')}]`);
    for (const r of rs) console.log(`    "${r.title}"`);
  }
  console.log('');
}

interface ShadowRow {
  id: string; title: string; address: string | null; place_id: string | null;
  happening_tier: number; starts_at: string | null; source: string | null; status: string;
  recurring_schedules: { day_of_week: number | null; frequency: string | null }[] | null;
}

/** Shared by dedupeVenueShadowReport and dedupeAdjudicateShadowReport, the
 *  T1/T2 catalog plus the venue_neighborhoods dictionary, fetched once. */
async function fetchShadowCatalog(sb: SupabaseClient): Promise<{ typed: ShadowRow[]; dictionary: EventKeyVenueDictEntry[] }> {
  const { data: dictRows, error: dictErr } = await sb
    .from('venue_neighborhoods')
    .select('name_norm, place_id, aliases');
  if (dictErr) throw new Error(`dedupe-shadow dictionary read: ${dictErr.message}`);
  const dictionary = (dictRows ?? []) as unknown as EventKeyVenueDictEntry[];

  const { data: rows, error } = await sb
    .from('things')
    .select(`id, title, address, place_id, happening_tier, starts_at, source, status,
      recurring_schedules ( day_of_week, frequency )`)
    .in('happening_tier', [1, 2]);
  if (error) throw new Error(`dedupe-shadow things read: ${error.message}`);
  const typed = (rows ?? []) as unknown as ShadowRow[];
  return { typed, dictionary };
}

type ShadowItem = { title: string; starts_at: string | null; address: string | null; place_id: string | null; recurring: { day_of_week: number; frequency: string }[] };
function asShadowItem(r: ShadowRow): ShadowItem {
  return {
    title: r.title, starts_at: r.starts_at, address: r.address, place_id: r.place_id,
    recurring: (r.recurring_schedules ?? []).filter((s): s is { day_of_week: number; frequency: string } => s.day_of_week != null && !!s.frequency),
  };
}

interface ShadowScan {
  oldPairs: number;
  newPairs: number;
  newMerges: { a: ShadowRow; b: ShadowRow; sim: number; signal: string; venue: string }[];
  newSplits: { a: ShadowRow; b: ShadowRow; sim: number }[];
  ambiguous: { a: ShadowRow; b: ShadowRow; sim: number; venue: string }[];
}

/** Pairwise scan of every same-tier T1/T2 pair, classifying each under both
 *  the OLD matcher (title + same day only) and the NEW venue-aware matcher
 *  (evaluateMatch). Pure, no I/O. Shared by both Phase 2's diff report and
 *  Phase 3's adjudication input (the `ambiguous` bucket). */
function scanShadowPairs(typed: ShadowRow[], dictionary: EventKeyVenueDictEntry[]): ShadowScan {
  const oldMatch = (a: ShadowItem, b: ShadowItem): boolean => sameDay(a.starts_at, b.starts_at) && titleSimilarity(a.title, b.title) > NEAR_THRESHOLD;

  let oldPairs = 0, newPairs = 0;
  const newMerges: ShadowScan['newMerges'] = [];
  const newSplits: ShadowScan['newSplits'] = [];
  const ambiguous: ShadowScan['ambiguous'] = [];

  for (let i = 0; i < typed.length; i++) {
    for (let j = i + 1; j < typed.length; j++) {
      const a = typed[i], b = typed[j];
      if (a.happening_tier !== b.happening_tier) continue; // dated vs recurring never compared, either way
      const ai = asShadowItem(a), bi = asShadowItem(b);
      const wasOld = oldMatch(ai, bi);
      const verdict = evaluateMatch(ai, bi, dictionary);
      if (wasOld) oldPairs++;
      if (verdict.outcome === 'merge') newPairs++;
      if (verdict.outcome === 'merge' && !wasOld) newMerges.push({ a, b, sim: verdict.titleSim, signal: verdict.signal, venue: verdict.venue });
      if (verdict.outcome !== 'merge' && wasOld) newSplits.push({ a, b, sim: titleSimilarity(a.title, b.title) });
      if (verdict.outcome === 'ambiguous') ambiguous.push({ a, b, sim: verdict.titleSim, venue: verdict.venue });
    }
  }
  return { oldPairs, newPairs, newMerges, newSplits, ambiguous };
}

/** Data Arch Redesign 26 Phase 2, pairwise diff of the OLD matcher (title +
 *  same day only, sourceAuthority-blind to venue) vs the NEW venue-aware
 *  matcher (evaluateMatch), run over every T1/T2 pair in the existing catalog.
 *  Purely diagnostic: classifies each same-tier pair under both rules and
 *  reports where they disagree. Nothing is written; dedupe() (the live
 *  function) is never called here or anywhere in the real pipeline for this
 *  input, this is a controlled A/B on real data, not a production run. */
async function dedupeVenueShadowReport() {
  const sb = getDb();
  const { typed, dictionary } = await fetchShadowCatalog(sb);
  const { oldPairs, newPairs, newMerges, newSplits, ambiguous } = scanShadowPairs(typed, dictionary);

  console.log(`\n[dedupe-venue-shadow] ${typed.length} T1/T2 thing(s), ${(typed.length * (typed.length - 1)) / 2} pair(s) checked`);
  console.log(`[dedupe-venue-shadow] OLD matcher flags ${oldPairs} pair(s) as duplicates; NEW (venue-aware) matcher flags ${newPairs} pair(s) as clear merges`);
  console.log(`[dedupe-venue-shadow] NEW MERGES (old kept both separate, new clearly collapses them): ${newMerges.length}`);
  console.log(`[dedupe-venue-shadow] NEW SPLITS (old would have merged, new keeps separate, false-merge kill): ${newSplits.length}`);
  console.log(`[dedupe-venue-shadow] AMBIGUOUS (held apart for now, Phase 3's future AI-adjudication volume preview): ${ambiguous.length}\n`);

  if (newMerges.length) {
    console.log('[dedupe-venue-shadow] new-merge examples (up to 15):\n');
    for (const m of newMerges.slice(0, 15)) {
      console.log(`  [${m.signal}, venue=${m.venue}, titleSim=${m.sim.toFixed(2)}]`);
      console.log(`    "${m.a.title}"  [${m.a.status}, tier ${m.a.happening_tier}, ${m.a.source ?? 'no source'}]  address=${m.a.address ?? 'null'}`);
      console.log(`    "${m.b.title}"  [${m.b.status}, tier ${m.b.happening_tier}, ${m.b.source ?? 'no source'}]  address=${m.b.address ?? 'null'}`);
    }
    console.log('');
  }
  if (newSplits.length) {
    console.log('[dedupe-venue-shadow] new-split examples (up to 15):\n');
    for (const s of newSplits.slice(0, 15)) {
      console.log(`  [titleSim=${s.sim.toFixed(2)}]`);
      console.log(`    "${s.a.title}"  address=${s.a.address ?? 'null'}`);
      console.log(`    "${s.b.title}"  address=${s.b.address ?? 'null'}`);
    }
    console.log('');
  }
  if (ambiguous.length) {
    console.log('[dedupe-venue-shadow] ambiguous examples (up to 15, held apart, not merged, not confidently split):\n');
    for (const am of ambiguous.slice(0, 15)) {
      console.log(`  [venue=${am.venue}, titleSim=${am.sim.toFixed(2)}]`);
      console.log(`    "${am.a.title}"  address=${am.a.address ?? 'null'}`);
      console.log(`    "${am.b.title}"  address=${am.b.address ?? 'null'}`);
    }
    console.log('');
  }
}

/** Human-readable, no-invention description of when a T1/T2 row occurs, the
 *  only facts sent to the Phase 3 adjudicator, matching enrich.ts's trust
 *  posture of never inventing/guessing what isn't in the record. */
function describeShadowWhen(r: ShadowRow): string {
  if (r.starts_at) return `dated: ${r.starts_at}`;
  const sched = (r.recurring_schedules ?? []).filter((s) => s.day_of_week != null && s.frequency);
  if (sched.length) {
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `recurring: ${sched.map((s) => `${DOW[s.day_of_week!]} (${s.frequency})`).join(', ')}`;
  }
  return 'unknown';
}

/** Data Arch Redesign 26 Phase 3, Sonnet batch adjudication on the ambiguous
 *  band only (Doc 16 §3.3), run against the live catalog. SHADOW: reports the
 *  pairs, the model's verdicts, and the cost. Does not merge or write
 *  anything, dedupeVenueAware() (the live matcher) still treats every
 *  ambiguous pair as held-apart until this is wired in as a later, explicit
 *  step. Requires ANTHROPIC_API_KEY; with no key set, prints the pair count
 *  and stops (adjudicatePairs() fails soft). */
async function dedupeAdjudicateShadowReport() {
  const sb = getDb();
  const { typed, dictionary } = await fetchShadowCatalog(sb);
  const { ambiguous } = scanShadowPairs(typed, dictionary);

  console.log(`\n[dedupe-adjudicate-shadow] ${ambiguous.length} ambiguous pair(s) to adjudicate\n`);
  if (!ambiguous.length) return;

  const canonicalOf = (r: ShadowRow) => canonicalVenue({ title: r.title, address: r.address, place_id: r.place_id }, dictionary);
  const pairs: AdjudicationPair[] = ambiguous.map(({ a, b }) => ({
    pairId: `${a.id}|${b.id}`,
    titleA: a.title, titleB: b.title,
    venueA: canonicalOf(a), venueB: canonicalOf(b),
    whenA: describeShadowWhen(a), whenB: describeShadowWhen(b),
    addressA: a.address, addressB: b.address,
  }));

  const { verdicts, costUsd } = await adjudicatePairs(pairs);
  const byPairId = new Map(ambiguous.map(({ a, b }) => [`${a.id}|${b.id}`, { a, b }]));

  const sameEvent = verdicts.filter((v) => v.sameEvent);
  const different = verdicts.filter((v) => !v.sameEvent);
  const noVerdict = ambiguous.length - verdicts.length;

  console.log(`[dedupe-adjudicate-shadow] ${sameEvent.length} pair(s) judged SAME event (would merge if wired in)`);
  console.log(`[dedupe-adjudicate-shadow] ${different.length} pair(s) judged DIFFERENT events (stays split)`);
  if (noVerdict) console.log(`[dedupe-adjudicate-shadow] ${noVerdict} pair(s) got no verdict (chunk failure, stays split by default)`);
  console.log(`[dedupe-adjudicate-shadow] total cost: $${costUsd.toFixed(4)} (Sonnet 5 intro rate)\n`);

  console.log('[dedupe-adjudicate-shadow] verdicts (up to 25):\n');
  for (const v of verdicts.slice(0, 25)) {
    const pair = byPairId.get(v.pairId);
    console.log(`  [${v.sameEvent ? 'SAME' : 'DIFFERENT'}, confidence=${v.confidence.toFixed(2)}] ${v.reasoning}`);
    if (pair) {
      console.log(`    "${pair.a.title}"  address=${pair.a.address ?? 'null'}`);
      console.log(`    "${pair.b.title}"  address=${pair.b.address ?? 'null'}`);
    }
  }
  console.log('');
}

/** Data Arch Redesign 24 Phase 1, actually persist data_confidence for every
 *  published/needs_review thing. Called both by the one-off CONFIDENCE_BACKFILL
 *  flag (rescoring the whole existing catalog once) and automatically at the
 *  end of every regular nightly run (see the "confidence" step near the
 *  digest call below), so scores stay current as fields change. source_count
 *  is read but never written here, spec 26's dedupe owns that column. */
async function recomputeConfidenceScores(sb: SupabaseClient): Promise<number> {
  const scored = await scoreCatalog(sb);
  let updated = 0;
  for (const s of scored) {
    const { error } = await sb.from('things').update({ data_confidence: s.score }).eq('id', s.id);
    if (error) { console.log(`  [confidence] update failed for ${s.id}: ${error.message}`); continue; }
    updated++;
  }
  return updated;
}

/** One-off CLI entry point (CONFIDENCE_BACKFILL=1): write scores for the whole
 *  existing catalog once, then print the resulting (now-persisted) histogram. */
async function backfillConfidenceScores() {
  const sb = getDb();
  const updated = await recomputeConfidenceScores(sb);
  console.log(`\n[confidence-backfill] wrote data_confidence for ${updated} thing(s)`);
  const scored = await scoreCatalog(sb);
  printConfidenceHistogram(scored, 'confidence-backfill (persisted)');
}

/** Data Arch Redesign 24 Phase 2, SHADOW MODE (CONFIDENCE_GATE_SHADOW=1).
 *  Labels every needs_review thing with the band the gate WOULD assign it
 *  (auto_publish / review / hold), using the already-persisted
 *  things.data_confidence (Phase 1). Read-only: no status is ever written
 *  here. Scoped to needs_review only, published things are already live and
 *  human-approved; this gate only ever decides the fate of new arrivals, so
 *  re-labeling already-published rows would be noise, not signal. */
async function confidenceGateShadowReport() {
  const sb = getDb();
  const sourceByKey = await loadSourceMetaByKey(sb);

  const { data: rows, error } = await sb
    .from('things')
    .select('id, title, data_confidence, source')
    .eq('status', 'needs_review');
  if (error) throw new Error(`confidence-gate-shadow things read: ${error.message}`);

  type Labeled = { id: string; title: string; confidence: number; sourceKey: string; band: PublishBand };
  const labeled: Labeled[] = (rows ?? []).map((r) => {
    const sourceKey = sourceKeyOf((r.source as string) ?? undefined);
    const meta = sourceByKey.get(sourceKey);
    const confidence = r.data_confidence == null ? 0 : Number(r.data_confidence);
    const band = classifyBand({ confidence, sourceAuthority: meta?.authority, lane: meta?.lane });
    return { id: r.id as string, title: r.title as string, confidence, sourceKey, band };
  });

  const counts: Record<PublishBand, number> = { auto_publish: 0, review: 0, hold: 0 };
  for (const l of labeled) counts[l.band]++;

  console.log(`\n[confidence-gate-shadow] ${labeled.length} needs_review thing(s) labeled, nothing published, nothing held\n`);
  console.log(`  auto_publish (would skip your queue) : ${counts.auto_publish}`);
  console.log(`  review       (stays in your queue)    : ${counts.review}`);
  console.log(`  hold         (would not show at all)  : ${counts.hold}`);
  console.log(`\n  auto-publish requires: confidence >= ${AUTO_PUBLISH_GATE.minConfidence}, source authority >= ${AUTO_PUBLISH_GATE.minSourceAuthority}, structured lane`);
  console.log(`  hold requires: confidence < ${HOLD_FLOOR}\n`);

  const autoPublishSample = labeled.filter((l) => l.band === 'auto_publish').sort((a, b) => b.confidence - a.confidence);
  console.log(`[confidence-gate-shadow] auto_publish candidates (${autoPublishSample.length} total), every one, for you to eyeball:\n`);
  for (const l of autoPublishSample) {
    console.log(`  ${l.confidence.toFixed(2)}  "${l.title}"  [source=${l.sourceKey}]`);
  }

  const holdSample = labeled.filter((l) => l.band === 'hold').slice(0, 10);
  if (holdSample.length) {
    console.log(`\n[confidence-gate-shadow] hold sample (first ${holdSample.length} of ${counts.hold}):\n`);
    for (const l of holdSample) {
      console.log(`  ${l.confidence.toFixed(2)}  "${l.title}"  [source=${l.sourceKey || '(unmatched)'}]`);
    }
  }
  console.log('');
}

interface GateApplyResult { published: number; held: number; reviewed: number }

/** Data Arch Redesign 24 Phase 3, the ONLY place the gate drives a real
 *  status write. Reads today's needs_review queue, classifies each with the
 *  same classifyBand() Phase 2 previewed, and:
 *   - auto_publish -> status='published' (skips the queue for real)
 *   - hold         -> status='draft' (not shown anywhere, not deleted, a
 *     later run with a better score, e.g. a second corroborating source or a
 *     fresher confirmation, can still rescue it; spec 24 §5)
 *   - review       -> left untouched in needs_review, same as today
 *  Every automatic transition writes an audit_log row so it's traceable back
 *  to a rule, not a founder click. The `.eq('status', 'needs_review')` guard
 *  on each write means this can only ever move a still-pending row, it never
 *  touches an already-published, already-draft, or archived thing. */
async function applyPublishGate(sb: SupabaseClient): Promise<GateApplyResult> {
  const sourceByKey = await loadSourceMetaByKey(sb);
  const { data: rows, error } = await sb
    .from('things')
    .select('id, data_confidence, source')
    .eq('status', 'needs_review');
  if (error) throw new Error(`publish-gate read: ${error.message}`);

  const today = new Date().toISOString().slice(0, 10);
  let published = 0, held = 0, reviewed = 0;

  for (const r of rows ?? []) {
    const sourceKey = sourceKeyOf((r.source as string) ?? undefined);
    const meta = sourceByKey.get(sourceKey);
    const confidence = r.data_confidence == null ? 0 : Number(r.data_confidence);
    const band = classifyBand({ confidence, sourceAuthority: meta?.authority, lane: meta?.lane });

    if (band === 'review') { reviewed++; continue; }

    const patch = band === 'auto_publish'
      ? { status: 'published', last_confirmed: today }
      : { status: 'draft' };
    const { error: upErr } = await sb.from('things').update(patch).eq('id', r.id).eq('status', 'needs_review');
    if (upErr) { console.log(`  [publish-gate] ${band} failed for ${r.id}: ${upErr.message}`); reviewed++; continue; }

    await sb.from('audit_log').insert({
      entity_type: 'thing', entity_id: r.id,
      action: band === 'auto_publish' ? 'auto_publish' : 'auto_hold',
      actor: 'rule',
      payload: { data_confidence: confidence, source: sourceKey },
    });
    if (band === 'auto_publish') published++; else held++;
  }
  return { published, held, reviewed };
}

/** One-off CLI entry point (CONFIDENCE_GATE_APPLY=1): run the real gate once,
 *  on demand, outside the nightly schedule, same function the nightly run
 *  calls automatically (see main()). */
async function runPublishGateOnce() {
  const sb = getDb();
  const result = await applyPublishGate(sb);
  console.log(`\n[publish-gate] published ${result.published} · held ${result.held} · left in review ${result.reviewed}\n`);
}

/** Data Arch Redesign 24 Phase 5, rescue: a held thing whose RESCORED
 *  confidence has climbed back above the hold floor (a later run filled in a
 *  missing field, refreshed last_confirmed, or, once spec 26 lands, a
 *  second source corroborated it) returns to needs_review. Deliberately never
 *  jumps straight to published, even if it would now also clear the
 *  auto-publish bar, anything that was ever below the safety floor gets a
 *  human's first look at least once. Run this AFTER applyPublishGate in the
 *  same night's sequence: a rescued item sits in needs_review for the rest of
 *  tonight and only becomes auto-publish-eligible starting tomorrow's gate
 *  pass, never the same night it's rescued. */
async function rescueHeldThings(sb: SupabaseClient): Promise<number> {
  const sourceByKey = await loadSourceMetaByKey(sb);
  const { data: rows, error } = await sb
    .from('things')
    .select('id, data_confidence, source')
    .eq('status', 'draft');
  if (error) throw new Error(`rescue read: ${error.message}`);

  let rescued = 0;
  for (const r of rows ?? []) {
    const sourceKey = sourceKeyOf((r.source as string) ?? undefined);
    const meta = sourceByKey.get(sourceKey);
    const confidence = r.data_confidence == null ? 0 : Number(r.data_confidence);
    const band = classifyBand({ confidence, sourceAuthority: meta?.authority, lane: meta?.lane });
    if (band === 'hold') continue; // still below floor, stays held, not deleted (spec 24 §5)

    const { error: upErr } = await sb.from('things').update({ status: 'needs_review' }).eq('id', r.id).eq('status', 'draft');
    if (upErr) { console.log(`  [rescue] failed for ${r.id}: ${upErr.message}`); continue; }
    await sb.from('audit_log').insert({
      entity_type: 'thing', entity_id: r.id, action: 'auto_rescue', actor: 'rule',
      payload: { data_confidence: confidence, source: sourceKey },
    });
    rescued++;
  }
  return rescued;
}

/** One-off CLI entry point (CONFIDENCE_RESCUE=1): run the rescue pass once,
 *  on demand, same function the nightly run calls automatically (see main()). */
async function runRescueOnce() {
  const sb = getDb();
  const rescued = await rescueHeldThings(sb);
  console.log(`\n[rescue] ${rescued} held thing(s) upgraded back to needs_review\n`);
}

/** Mobile/image addendum Part C, one-time / on-demand: re-draft EVERY published
 *  thing's blurb + blurb_long through the retuned voice prompt, so the live catalog
 *  matches the new knowing-local-friend voice (not just new drafts going forward).
 *  Skips any row a founder has explicitly rewritten the blurb on post-publish (a
 *  catalog_edit / edit_applied / approve audit_log row whose payload.edits has a
 *  `blurb` key), a founder's own wording is never silently overwritten. This can't
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
    starts_at: null, ends_at: null, // deliberately not loaded, enrich must never see it
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

// ---- Card Imagery Build Spec Phase 2 §5.2, venue registry -----------------

function titleCaseAddress(address: string): string {
  const first = address.split(',')[0]?.trim() || address;
  return first.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** One-off, idempotent (upsert on `key`, `ignoreDuplicates`) venue registry seed.
 *  Two sources, both additive to `venues`, never touches `things`:
 *   1. The 12 curated ingest/marqueeVenues.ts entries, imported verbatim (spec §5.2:
 *      "Marquee registry entries import as venues automatically... DB becomes
 *      runtime truth").
 *   2. Address clusters of >=3 Tier-1 (dated) events: spatial (haversine <=75m)
 *      when lat/lng exist, else a normalized-exact-address-string fallback group
 *      (can't be spatially deduped without coordinates). A cluster that already
 *      scores a match (bestVenueMatch) against a venue inserted earlier THIS PASS
 *      (marquee or a prior cluster) is skipped, the one real dedupe pass this
 *      simple single-pass clustering gets; it will not catch every real-world
 *      duplicate (e.g. two address variants of the same venue with no lat/lng on
 *      either), which is why the cockpit's venue editor (§5.3) supports rename/
 *      archive, this is a rough first draft for the founder to correct, not a
 *      finished registry. */
async function seedVenueRegistry() {
  const sb = getDb();

  const marqueeInserts = MARQUEE_VENUES.map((v) => ({
    key: v.key,
    display_name: titleCaseAddress(v.names[0]),
    lat: v.lat,
    lng: v.lng,
    radius_m: v.radiusM,
    name_patterns: v.names,
  }));
  const { error: mErr } = await sb.from('venues').upsert(marqueeInserts, { onConflict: 'key', ignoreDuplicates: true });
  if (mErr) throw new Error(`venue-seed marquee upsert: ${mErr.message}`);
  console.log(`[venue-seed] upserted ${marqueeInserts.length} marquee venues (idempotent)`);

  const { data: existingVenueRows, error: vErr } = await sb
    .from('venues')
    .select('id, place_id, lat, lng, radius_m, name_patterns')
    .eq('status', 'active');
  if (vErr) throw new Error(`venue-seed existing-venues select: ${vErr.message}`);
  const knownVenues: MatchableVenue[] = (existingVenueRows ?? []).map((v) => ({
    id: v.id as string, place_id: (v.place_id as string) ?? null, lat: (v.lat as number) ?? null,
    lng: (v.lng as number) ?? null, radius_m: (v.radius_m as number) ?? 150,
    name_patterns: (v.name_patterns as string[]) ?? [],
  }));

  const { data: rows, error } = await sb
    .from('things')
    .select('title, address, lat, lng')
    .eq('happening_tier', 1)
    .in('status', ['published', 'needs_review'])
    .not('address', 'is', null);
  if (error) throw new Error(`venue-seed things select: ${error.message}`);
  const all = rows ?? [];
  const withCoords = all.filter((r) => r.lat != null && r.lng != null);
  const withoutCoords = all.filter((r) => r.lat == null || r.lng == null);

  const SPATIAL_RADIUS_M = 75; // spec §5.2's exact clustering radius
  interface Cluster { lat: number; lng: number; count: number; addresses: Map<string, number>; }
  const clusters: Cluster[] = [];
  for (const r of withCoords) {
    const lat = r.lat as number, lng = r.lng as number;
    let c = clusters.find((c) => haversineMeters(c.lat, c.lng, lat, lng) <= SPATIAL_RADIUS_M);
    if (!c) { c = { lat, lng, count: 0, addresses: new Map() }; clusters.push(c); }
    c.count++;
    const addr = (r.address as string).trim();
    c.addresses.set(addr, (c.addresses.get(addr) ?? 0) + 1);
    c.lat += (lat - c.lat) / c.count; // running centroid average
    c.lng += (lng - c.lng) / c.count;
  }

  const noCoordGroups = new Map<string, { count: number; sample: string }>();
  for (const r of withoutCoords) {
    const key = (r.address as string).trim().toLowerCase();
    const g = noCoordGroups.get(key) ?? { count: 0, sample: (r.address as string).trim() };
    g.count++;
    noCoordGroups.set(key, g);
  }

  const proposals: { key: string; display_name: string; lat: number | null; lng: number | null; name_patterns: string[] }[] = [];
  const proposeIfNew = (address: string, lat: number | null, lng: number | null, count: number) => {
    if (count < 3) return;
    const extracted = extractVenueNameFromAddress(address);
    const displayName = extracted ?? titleCaseAddress(address);
    const already = bestVenueMatch({ title: displayName, address, lat, lng, place_id: null }, knownVenues);
    if (already) return; // covered by an already-inserted venue (marquee or earlier this pass)
    const key = slugifyVenueKey(displayName);
    if (proposals.some((p) => p.key === key)) return;
    const namePatterns = extracted ? [extracted.toLowerCase()] : [];
    proposals.push({ key, display_name: displayName, lat, lng, name_patterns: namePatterns });
    knownVenues.push({ id: key, place_id: null, lat, lng, radius_m: 150, name_patterns: namePatterns });
  };
  for (const c of clusters) {
    const topAddress = [...c.addresses.entries()].sort((a, b) => b[1] - a[1])[0][0];
    proposeIfNew(topAddress, c.lat, c.lng, c.count);
  }
  for (const g of noCoordGroups.values()) proposeIfNew(g.sample, null, null, g.count);

  console.log(`[venue-seed] proposing ${proposals.length} address-cluster venues (>=3 Tier-1 events each):`);
  for (const p of proposals) console.log(`  ${p.key.padEnd(40)} "${p.display_name}"`);

  if (proposals.length) {
    const { error: pErr } = await sb.from('venues').upsert(
      proposals.map((p) => ({
        key: p.key, display_name: p.display_name, lat: p.lat, lng: p.lng,
        radius_m: 150, name_patterns: p.name_patterns,
      })),
      { onConflict: 'key', ignoreDuplicates: true },
    );
    if (pErr) throw new Error(`venue-seed proposals upsert: ${pErr.message}`);
  }
  console.log(
    `\n[venue-seed] done, ${marqueeInserts.length} marquee + ${proposals.length} address-cluster venues ` +
      `seeded (or already present). No photos attached yet, curate each venue's pool via the cockpit's Venues tab.`,
  );
}

/** Card Imagery Build Spec Phase 2 §5.2, "The matcher runs nightly for new things:
 *  exact place_id match auto-attaches; fuzzy matches queue for review." Runs every
 *  regular ingest (isolated, never sinks the run); fuzzy candidates are computed
 *  live by the cockpit's Venues tab query instead of a separate persisted queue. */
async function matchVenuesByPlaceId(sb: SupabaseClient): Promise<number> {
  const { data: venues, error: vErr } = await sb
    .from('venues').select('id, place_id').eq('status', 'active').not('place_id', 'is', null);
  if (vErr || !venues?.length) return 0;
  const byPlaceId = new Map(venues.map((v) => [v.place_id as string, v.id as string]));

  const { data: things, error: tErr } = await sb
    .from('things').select('id, place_id')
    .is('venue_id', null).not('place_id', 'is', null)
    .in('status', ['published', 'needs_review']);
  if (tErr || !things?.length) return 0;

  let attached = 0;
  for (const t of things) {
    const venueId = byPlaceId.get(t.place_id as string);
    if (!venueId) continue;
    const { error } = await sb.from('things').update({ venue_id: venueId }).eq('id', t.id as string);
    if (!error) attached++;
  }
  return attached;
}

// Card Imagery Build Spec Phase 2 §5.5, cadence follow-up (Jim's call, 2026-07-10,
// recorded in the ledger): stretched from the spec's original 20h to 7 days, the
// existing client-side onError->gradient fallback already covers the interim, so a
// longer window trades a bounded, low-stakes staleness risk for a large volume cut
// (worst case ~2,700/mo at 20h -> ~386/mo at 7 days, comfortably under the 500/mo
// cap even if every venue went all-Google at max pool size).
const REFRESH_STALE_HOURS = 24 * 7;
// Same-day follow-up #2 (Jim asked "why wait at all, can't we tell a dead photo
// apart from a blip?"): yes, for the common case. Google's media endpoint returns
// a real HTTP 404 when a photo resource is genuinely gone (business removed it,
// Google's moderation pulled it, the place closed), refreshGoogleMediaUri()
// surfaces that distinctly now, and the loop below reacts to a 404 IMMEDIATELY,
// no waiting. This backstop constant only covers the AMBIGUOUS failure modes
// (rate limits, 5xx, network errors, or a 403 that could just as easily mean an
// API-key/billing problem as a dead photo), reacting to those instantly risks a
// false-positive mass-reassignment (a billing hiccup would make many unrelated
// photos fail at once; that's a config problem to go fix, not a sign hundreds of
// venues suddenly need new photos). A row stuck on ambiguous failures for TWICE
// the normal refresh interval with no successful refresh finally falls back too,
// so nothing stays stuck forever even in the unclear case.
const CONFIRMED_DEAD_HOURS = REFRESH_STALE_HOURS * 2;

/** Card Imagery Build Spec Phase 2 §5.5, nightly compliant Google URI refresh.
 *  Spec's own sizing note ruled out refreshing whole pools (~200-350 calls/night,
 *  "TOO MANY") and mandated this narrower scope instead: only `venue_photos` rows
 *  (source='google', approved) that are the CURRENT pick for at least one visible
 *  (published/needs_review) thing right now, "assigned serving photos, not whole
 *  pools." Every refresh ALSO propagates the new URL to every `things.photo_url`
 *  currently pointing at the old one, updating venue_photos alone would leave
 *  already-landed things silently serving the stale, soon-to-expire URI (they
 *  don't live-join the pool table; photo_url is a snapshot written at resolve
 *  time). Shares the exact image_spend cap counter the resolver uses
 *  (loadSpend/saveSpend/CAP), on cap-exceeded, keeps yesterday's URI and logs
 *  `over_cap`, per spec's own words, rather than either silently overspending or
 *  silently dropping the row.
 *
 *  2026-07-10 addendum (Jim's ask), automated dead-photo fallback + notification:
 *  a row confirmed gone (a real 404 from Google, checked on EVERY attempt, no
 *  waiting) OR stuck on ambiguous failures for CONFIRMED_DEAD_HOURS is handled by
 *  `handleDeadVenuePhoto`: the dead row is deleted, a fresh Wikimedia candidate is
 *  searched for and auto-approved into the freed pool slot if one clears the same
 *  quality/relevance gate the resolver itself uses, and every thing currently
 *  showing the dead photo is updated to the replacement (or reset to the gradient
 *  placeholder if no replacement was found, "motif" isn't buildable yet, Phase 3
 *  hasn't started). Every fallback is collected and surfaced in the nightly digest
 *  email (`sendDigest`'s new `venueFallbacks` field) so Jim can go re-review the
 *  auto-assigned stand-in and hunt for a better photo himself if he wants one, *  this NEVER happens silently.
 *
 *  Explicitly OUT OF SCOPE: the ~14 legacy direct-Google food/drink `things` rows
 *  from Phase 1 §4.5, those store only a raw photoUri, no stable photo-resource-
 *  name column (the Phase 2 §5.1 DDL Jim ran doesn't add one to `things`, only to
 *  `venue_photos`), so there's nothing to refresh OR fall back on for them without
 *  a fresh Place Details call each time, flagged in the ledger as a known,
 *  already-accepted gap, not silently patched by inventing a new column outside
 *  the founder-approved DDL. */
async function refreshVenuePhotoServingUrls(sb: SupabaseClient): Promise<{
  refreshed: number; skipped: number; overCap: number; failed: number; fallbacks: VenueFallbackEvent[];
}> {
  const stats = { refreshed: 0, skipped: 0, overCap: 0, failed: 0, fallbacks: [] as VenueFallbackEvent[] };

  const { data: googlePool, error: gpErr } = await sb
    .from('venue_photos')
    .select('id, venue_id, stable_ref, serving_url, refreshed_at, created_at')
    .eq('approved', true)
    .eq('source', 'google');
  if (gpErr || !googlePool?.length) return stats;

  const { data: assignedThings, error: atErr } = await sb
    .from('things').select('photo_url')
    .eq('photo_source', 'google').not('venue_id', 'is', null)
    .in('status', ['published', 'needs_review']);
  if (atErr) return stats;
  const assignedUrls = new Set((assignedThings ?? []).map((t) => t.photo_url as string).filter(Boolean));

  const now = Date.now();
  const ageHours = (p: { refreshed_at: unknown; created_at: unknown }) => {
    const since = (p.refreshed_at as string) ?? (p.created_at as string);
    return (now - new Date(since).getTime()) / 3_600_000;
  };
  const due = googlePool.filter((p) => {
    if (!p.serving_url || !assignedUrls.has(p.serving_url as string)) return false; // not rendering anywhere right now
    return ageHours(p) >= REFRESH_STALE_HOURS;
  });
  stats.skipped = googlePool.length - due.length;
  if (!due.length) return stats;

  const month = monthKey();
  const spend = await loadSpend(sb, month);
  let calls = spend.google_calls;
  let overCap = spend.over_cap;

  for (const row of due) {
    if (calls >= CAP) { overCap++; stats.overCap++; continue; }
    calls++;
    const result = await refreshGoogleMediaUri(row.stable_ref as string);

    if (result.status === 'not_found') {
      // Google itself confirms this exact photo is gone, react immediately, no
      // waiting period. This is the common real-death case (removed/moderated
      // photo, closed business).
      const event = await handleDeadVenuePhoto(sb, row as { id: string; venue_id: string; stable_ref: string; serving_url: string });
      if (event) stats.fallbacks.push(event);
      continue;
    }

    if (result.status === 'error') {
      stats.failed++;
      // Ambiguous failure (not a confirmed 404), only escalate to the fallback
      // once it's been stuck this way for a full CONFIRMED_DEAD_HOURS backstop
      // (see the constant's comment for why this case specifically still waits).
      if (ageHours(row) >= CONFIRMED_DEAD_HOURS) {
        const event = await handleDeadVenuePhoto(sb, row as { id: string; venue_id: string; stable_ref: string; serving_url: string });
        if (event) stats.fallbacks.push(event);
      }
      continue;
    }

    // result.status === 'ok'
    const oldUrl = row.serving_url as string;
    const { error: vpErr } = await sb
      .from('venue_photos')
      .update({ serving_url: result.url, refreshed_at: new Date().toISOString() })
      .eq('id', row.id as string);
    if (vpErr) { stats.failed++; continue; }
    // Propagate to every thing currently displaying the old URL (see function comment).
    await sb.from('things').update({ photo_url: result.url }).eq('photo_url', oldUrl).eq('photo_source', 'google');
    stats.refreshed++;
  }

  await saveSpend(sb, month, calls, overCap);

  const failureRate = due.length ? stats.failed / due.length : 0;
  if (failureRate > 0.2) {
    console.log(
      `  [venue-refresh] ALERT: ${(failureRate * 100).toFixed(0)}% failure rate ` +
        `(${stats.failed}/${due.length}), check GOOGLE_PLACES_KEY / Places API status`,
    );
  }
  return stats;
}

/** 2026-07-10 addendum, a Google venue photo confirmed dead (see
 *  CONFIRMED_DEAD_HOURS above): delete the dead pool row, search Wikimedia for a
 *  replacement using the SAME gate/scorer the resolver and cockpit fetch already
 *  share (never a separate, weaker check), and auto-approve the best survivor into
 *  the freed pool slot if one exists. Every thing currently displaying the dead
 *  photo is updated to the replacement, or, Card Imagery Build Spec Phase 3 §6.2, *  its own deterministic motif/big-type assignment if no replacement was found
 *  (the same `assignVisual()` every other no-photo path uses, not a special case).
 *  Free (Wikimedia costs no cap budget) and always reported back to the caller for
 *  the nightly digest, never applied silently. */
async function handleDeadVenuePhoto(
  sb: SupabaseClient,
  row: { id: string; venue_id: string; stable_ref: string; serving_url: string },
): Promise<VenueFallbackEvent | null> {
  const { data: venue } = await sb.from('venues').select('id, display_name, lat, lng').eq('id', row.venue_id).maybeSingle();
  if (!venue) return null;
  const venueName = venue.display_name as string;

  await sb.from('venue_photos').delete().eq('id', row.id);

  let replacementUrl: string | null = null;
  let replacementAttribution: string | null = null;

  if (venue.lat != null && venue.lng != null) {
    const { data: existingRefs } = await sb.from('venue_photos').select('stable_ref').eq('venue_id', row.venue_id);
    const seen = new Set((existingRefs ?? []).map((r) => r.stable_ref as string));
    const wm = await wikimediaGeosearch(venue.lat as number, venue.lng as number);
    const best = rankWikimediaCandidates(wm, { title: venueName }).find((c) => !seen.has(c.title));
    if (best) {
      const attribution = `${best.artist} · ${best.license} · Wikimedia Commons`;
      const { data: maxSort } = await sb
        .from('venue_photos').select('sort_order').eq('venue_id', row.venue_id).eq('approved', true)
        .order('sort_order', { ascending: false }).limit(1);
      const nextSort = ((maxSort?.[0]?.sort_order as number) ?? -1) + 1;
      const { error: insErr } = await sb.from('venue_photos').insert({
        venue_id: row.venue_id, source: 'wikimedia', stable_ref: best.title, serving_url: best.url,
        attribution, approved: true, sort_order: nextSort, refreshed_at: new Date().toISOString(),
      });
      if (!insErr) { replacementUrl = best.url; replacementAttribution = attribution; }
    }
  }

  if (replacementUrl) {
    await sb.from('things')
      .update({ photo_url: replacementUrl, photo_source: 'wikimedia', photo_attribution: replacementAttribution })
      .eq('photo_url', row.serving_url).eq('photo_source', 'google');
  } else {
    // Phase 3 §6.2: each affected thing gets its own deterministic motif/big-type
    // assignment (category + marquee-venue match), not a blanket bare placeholder.
    const { data: affected } = await sb
      .from('things')
      .select('id, title, happening_category, lat, lng')
      .eq('photo_url', row.serving_url).eq('photo_source', 'google');
    for (const t of affected ?? []) {
      const marquee = matchMarqueeVenue({ title: t.title as string, lat: (t.lat as number) ?? undefined, lng: (t.lng as number) ?? undefined });
      const visual = assignVisual({ id: t.id as string, happening_category: t.happening_category }, marquee?.key);
      await sb.from('things')
        .update({
          photo_url: null, photo_source: 'motif', photo_attribution: null,
          visual_kind: visual.visual_kind, visual_key: visual.visual_key, visual_seed: visual.visual_seed,
        })
        .eq('id', t.id);
    }
  }

  return { venueName, replacement: replacementUrl ? 'wikimedia' : 'none' };
}

// Images desk (cockpit Images tab, 2026-07-11), Part C, nightly free candidate
// prefetch. Runs the Wikimedia title-search (findMoreOptions, never Google,
// never the paid cap) for published things still sitting on a motif/placeholder
// with no real photo_options yet, persisting whatever it finds, so the desk
// opens with its candidate strips pre-loaded instead of fetching while Jim
// pages. Bounded per night so the run stays inside its window; re-searching
// last night's empties is deliberate (new Commons uploads land constantly) and
// the cap keeps that cheap.
const DESK_PREFETCH_CAP = 150;

async function prefetchDeskCandidates(sb: SupabaseClient): Promise<{ searched: number; widened: number }> {
  const base = () =>
    sb.from('things')
      .select('id, title, neighborhood, happening_category, lat, lng, photo_options')
      .eq('status', 'published')
      .or('photo_url.is.null,photo_source.in.(placeholder,motif)')
      .limit(1000);
  // photo_ack is the desk's "looks right as-is" dismissal, excluded when the
  // column exists; before that migration lands, fall back to the plain scan
  // (prefetching for a dismissed item is wasted-but-harmless, not wrong).
  let res = await base().eq('photo_ack', false);
  if (res.error) res = await base();
  if (res.error) throw new Error(res.error.message);

  const pending = (res.data ?? [])
    .filter((t) => !(((t.photo_options as ImageOption[] | null) ?? []).some((o) => o.url)))
    .slice(0, DESK_PREFETCH_CAP);

  let widened = 0;
  for (const t of pending) {
    const existing = ((t.photo_options as ImageOption[] | null) ?? []);
    const merged = await findFreeCandidates({
      title: t.title as string,
      neighborhood: (t.neighborhood as string) ?? null,
      happening_category: (t.happening_category as string) ?? null,
      lat: (t.lat as number) ?? null,
      lng: (t.lng as number) ?? null,
    }, existing);
    // Persist only when the search actually widened the set, a no-hit search
    // shouldn't churn the row at all (same rule as the desk's on-demand route).
    const before = new Set(existing.filter((o) => o.url).map((o) => o.url));
    if (merged.some((o) => o.url && !before.has(o.url))) {
      await sb.from('things').update({ photo_options: merged }).eq('id', t.id as string);
      widened++;
    }
  }
  return { searched: pending.length, widened };
}

/** Data Arch Redesign 23 Phase 2, the `sources` table now drives dedupe
 *  authority (replaces the retired SOURCE_RANK regex table in dedupe.ts) and
 *  which adapters actually run (status='active'; a 'paused'/'retired' source
 *  is skipped for the night, no code change needed). Falls back to an empty
 *  config (every adapter runs; all tie at authority 0, same as an unranked
 *  source under the old table) if the table can't be read, keeps DRY_RUN
 *  usable even without DB reachability, same spirit as the rest of this file's
 *  isolated-failure pattern. */
async function loadSourceConfig(
  sb: SupabaseClient,
): Promise<{ authorityByKey: Map<string, number>; inactiveKeys: Set<string> }> {
  const { data, error } = await sb.from('sources').select('key, authority, status');
  if (error) {
    console.log(`  [sources] read failed, falling back to no per-source config: ${error.message}`);
    return { authorityByKey: new Map(), inactiveKeys: new Set() };
  }
  const authorityByKey = new Map<string, number>();
  const inactiveKeys = new Set<string>();
  for (const r of data ?? []) {
    authorityByKey.set(r.key as string, Number(r.authority));
    if (r.status !== 'active') inactiveKeys.add(r.key as string);
  }
  return { authorityByKey, inactiveKeys };
}

function median(sorted: number[]): number {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// Data Arch Redesign 23 Phase 4 §5.4, default N consecutive empties before a
// source auto-pauses; tunable via env without a code change.
const AUTO_PAUSE_THRESHOLD = Number(process.env.SOURCE_AUTO_PAUSE_THRESHOLD ?? 5);

export interface AutoPausedSource { key: string; label: string; consecutiveEmpty: number }

/** Data Arch Redesign 23 Phase 3 (baselines) + Phase 4 (auto-pause), after
 *  every run, refresh each source's health on its `sources` row:
 *   - last_yield / last_ok_at always move (this run succeeded, no error, *     or it wouldn't still be in `runs` by this point; see the catch block
 *     in the fetch loop above that deletes an errored adapter's run).
 *   - expected_yield is the median `landed` count over that source's last
 *     BASELINE_WINDOW non-zero runs (from source_runs), a zero-yield night
 *     is deliberately excluded from its own baseline, so one bad night can't
 *     drag down the very number it's later measured against.
 *   - consecutive_empty resets to 0 on any landed>0 run, else increments.
 *   - auto-pause: once consecutive_empty reaches AUTO_PAUSE_THRESHOLD on a
 *     still-active source, flip status to 'paused' so the run budget stops
 *     being spent on it, surfaced back to the caller for tonight's digest.
 *  Isolated per-source (one failed update can't take down the others) and the
 *  whole step is wrapped by the caller so it can't sink the run. */
async function updateSourceBaselines(sb: SupabaseClient, runs: Map<string, RunRow>): Promise<AutoPausedSource[]> {
  const BASELINE_WINDOW = 14;
  const autoPaused: AutoPausedSource[] = [];
  for (const run of runs.values()) {
    const { data: history, error } = await sb
      .from('source_runs')
      .select('landed')
      .eq('source', run.source)
      .eq('ok', true)
      .gt('landed', 0)
      .order('started_at', { ascending: false })
      .limit(BASELINE_WINDOW);
    if (error) { console.log(`  [sources] baseline read failed for ${run.source}: ${error.message}`); continue; }

    const expectedYield = median((history ?? []).map((r) => r.landed as number).sort((a, b) => a - b));
    const { data: cur, error: curErr } = await sb
      .from('sources').select('label, status, consecutive_empty').eq('key', run.source).maybeSingle();
    if (curErr) { console.log(`  [sources] baseline read failed for ${run.source}: ${curErr.message}`); continue; }
    const consecutiveEmpty = run.landed > 0 ? 0 : ((cur?.consecutive_empty as number) ?? 0) + 1;
    const shouldAutoPause = consecutiveEmpty >= AUTO_PAUSE_THRESHOLD && cur?.status === 'active';
    if (shouldAutoPause) {
      autoPaused.push({ key: run.source, label: (cur?.label as string) ?? run.source, consecutiveEmpty });
    }

    const { error: upErr } = await sb
      .from('sources')
      .update({
        last_yield: run.landed,
        last_ok_at: new Date().toISOString(),
        ...(shouldAutoPause ? { status: 'paused' } : {}),
        expected_yield: expectedYield,
        consecutive_empty: consecutiveEmpty,
        updated_at: new Date().toISOString(),
      })
      .eq('key', run.source);
    if (upErr) { console.log(`  [sources] baseline write failed for ${run.source}: ${upErr.message}`); continue; }
    if (shouldAutoPause) {
      console.log(`  [sources] AUTO-PAUSED ${run.source}, ${consecutiveEmpty} consecutive empty runs`);
    }
  }
  return autoPaused;
}

/** Data Arch Redesign 26 Phase 4, corroboration bookkeeping (Doc 16 §2.4,
 *  §3.6). Writes one event_sources row per (event_key, source_key) confirmed
 *  this run, both from candidates that actually landed and from near-dupes
 *  that got dropped but still corroborate the surviving event (their
 *  event_key was carried on the DropRecord by dedupeVenueAware()), then
 *  recomputes things.source_count = count(distinct source_key) for every
 *  event_key touched. Idempotent (upsert, ignoreDuplicates on the composite
 *  key) so re-running a night is safe. */
export async function recordCorroboration(sb: SupabaseClient, landedCands: Candidate[], drops: DropRecord[]): Promise<void> {
  const bySources = new Map<string, Set<string>>(); // event_key -> distinct source_key(s)
  const add = (eventKey: string | null | undefined, sourceKey: string): void => {
    if (!eventKey) return;
    (bySources.get(eventKey) ?? bySources.set(eventKey, new Set()).get(eventKey)!).add(sourceKey);
  };
  for (const c of landedCands) add(c.event_key, sourceKeyOf(c.source_url));
  for (const d of drops) add(d.event_key, d.source);
  if (!bySources.size) return;

  const insertRows = [...bySources.entries()].flatMap(([event_key, sources]) =>
    [...sources].map((source_key) => ({ event_key, source_key })),
  );
  const { error: insErr } = await sb
    .from('event_sources')
    .upsert(insertRows, { onConflict: 'event_key,source_key', ignoreDuplicates: true });
  if (insErr) { console.log(`  [corroboration] event_sources write failed: ${insErr.message}`); return; }

  let updated = 0;
  for (const event_key of bySources.keys()) {
    const { count, error: cntErr } = await sb
      .from('event_sources').select('source_key', { count: 'exact', head: true }).eq('event_key', event_key);
    if (cntErr) { console.log(`  [corroboration] count failed for ${event_key}: ${cntErr.message}`); continue; }
    const { error: updErr } = await sb.from('things').update({ source_count: count ?? 1 }).eq('event_key', event_key);
    if (updErr) { console.log(`  [corroboration] source_count update failed for ${event_key}: ${updErr.message}`); continue; }
    updated++;
  }
  console.log(`  [corroboration] ${bySources.size} event_key(s) touched, ${insertRows.length} source-contribution row(s), ${updated} source_count update(s)`);
}

/** Data Arch Redesign 26 Phase 5, auditable, reversible merges (Doc 16 §4).
 *  A venue-aware near-dupe drop (DropRecord.merged_into set) doesn't just get
 *  discarded: its full candidate lands too, as status='archived' pointing at
 *  its survivor via merged_into, so a founder can undo a wrong merge in the
 *  cockpit (/admin/review's Merged panel -> /api/admin/dedupe/unmerge) and
 *  get the row back exactly as it would have landed. Every merge also gets an
 *  audit_log row with its evidence (which signal fired, title similarity,
 *  venue verdict), the durable record even if merged_into is later cleared.
 *  Idempotent (upsert ignoreDuplicates on id) and isolated: a failure here
 *  never blocks landing. */
export async function recordMerges(sb: SupabaseClient, gated: { cand: Candidate; sourceKey: string }[], drops: DropRecord[]): Promise<void> {
  const byId = new Map(gated.map((g) => [g.cand.id, g.cand]));
  const merges = drops.filter((d): d is DropRecord & { id: string; merged_into: string } => !!d.id && !!d.merged_into);
  if (!merges.length) return;

  const rows: Record<string, unknown>[] = [];
  const auditRows: Record<string, unknown>[] = [];
  for (const d of merges) {
    const cand = byId.get(d.id);
    if (!cand) continue; // shouldn't happen, every merge drop comes from `gated`
    // event_key set to the SURVIVOR's (not recomputed from this row's own
    // title) so it lines up with the event_sources row recordCorroboration()
    // writes for this same drop.
    rows.push({ ...toThingRow(cand), status: 'archived', merged_into: d.merged_into, event_key: d.event_key ?? null });
    // Data Arch Redesign 26 Phase 3, an AI-adjudicated merge (evidence.signal
    // === 'ai_adjudicated') is attributed to actor 'ai' with the model's own
    // confidence on the standard ai_confidence column, matching enrich.ts's
    // convention; a deterministic merge stays actor 'rule'. Either way the
    // full evidence (which signal fired, title similarity, venue verdict,
    // and the AI's reasoning if used) lands in the payload for the audit trail.
    auditRows.push({
      entity_type: 'thing',
      entity_id: cand.id,
      action: 'dedupe_merge',
      actor: d.aiVerdict ? 'ai' : 'rule',
      ai_confidence: d.aiVerdict?.confidence ?? null,
      payload: { merged_into: d.merged_into, event_key: d.event_key ?? null, detail: d.detail, evidence: d.evidence ?? null, ai_verdict: d.aiVerdict ?? null },
    });
  }
  if (!rows.length) return;

  const { error: landErr } = await sb.from('things').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (landErr) { console.log(`  [merge-log] archived-row write failed: ${landErr.message}`); return; }
  const { error: auditErr } = await sb.from('audit_log').insert(auditRows);
  if (auditErr) console.log(`  [merge-log] audit_log write failed: ${auditErr.message}`);
  console.log(`  [merge-log] ${rows.length} merge(s) archived + logged (reversible via cockpit un-merge)`);
}

async function main() {
  if (BACKFILL) return backfillEnrich();
  if (IMAGE_BACKFILL) return backfillImages();
  if (IMAGE_BACKFILL_PUBLISHED) return backfillPublishedImages();
  if (IMAGE_BACKFILL_FOOD) return backfillFoodImages();
  if (WEIGHT_BACKFILL) return backfillWeights();
  if (REPEAT_BACKFILL) return backfillRepeatImages();
  if (VOICE_BACKFILL) return backfillVoice();
  if (VENUE_SEED) return seedVenueRegistry();
  if (CONFIDENCE_DRYRUN) return backfillConfidenceDryRun();
  if (CONFIDENCE_BACKFILL) return backfillConfidenceScores();
  if (CONFIDENCE_GATE_SHADOW) return confidenceGateShadowReport();
  if (CONFIDENCE_GATE_APPLY) return runPublishGateOnce();
  if (CONFIDENCE_RESCUE) return runRescueOnce();
  if (EVENT_KEY_DRYRUN) return eventKeyDryRun();
  if (EVENT_KEY_BACKFILL) return eventKeyBackfill();
  if (DEDUPE_VENUE_SHADOW) return dedupeVenueShadowReport();
  if (DEDUPE_ADJUDICATE_SHADOW) return dedupeAdjudicateShadowReport();
  if (EVENT_SOURCES_BACKFILL) return eventSourcesBackfill();

  const win = window();
  const sb = DRY ? null : getDb();

  // Data Arch Redesign 23 Phase 2, sources-as-data. See loadSourceConfig() comment.
  const { authorityByKey, inactiveKeys } = sb
    ? await loadSourceConfig(sb)
    : { authorityByKey: new Map<string, number>(), inactiveKeys: new Set<string>() };

  type Tagged = { cand: Candidate; sourceKey: string };
  const gated: Tagged[] = [];
  const runs = new Map<string, RunRow>();
  let totalFetched = 0, totalGateDropped = 0;

  console.log(`\n[ingest] window ${win.fromISO.slice(0, 10)} .. ${win.toISO.slice(0, 10)}${DRY ? '  (DRY RUN, no writes)' : ''}\n`);

  // Load the curated recurring-rhythm registry (recurring_rhythms table) once,
  // ahead of the adapter loop, both the recurringRegistry adapter itself and
  // the registryCandidate dedupe check below (farmersMarkets et al.) read it.
  await loadRegistryCache();

  // ---- FETCH + GATE, per source, isolated ----
  for (const adapter of registry) {
    if (inactiveKeys.has(adapter.key)) {
      console.log(`  ${adapter.label.padEnd(20)} SKIPPED (source paused/retired in the sources table)`);
      continue;
    }
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
        // §3.3, dedupe registry candidates against the live recurringRegistry.ts file
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
  // Data Arch Redesign 26 Phase 2, venue-aware matching is now the live
  // matcher (dedupeVenueAware, formerly the shadow candidate; see Doc 16
  // §3.6). `existing` now also carries address/place_id (the venue signal)
  // and, for Tier-2 rows, their recurring cadence, both needed by
  // evaluateMatch(). Tier-1 stays windowed by starts_at as before; Tier-2 has
  // no starts_at to window by, so it's a separate, small, unbounded read (the
  // recurring catalog is on the order of dozens of rows, not thousands).
  let existing: ExistingRow[] = [];
  let venueDictionary: EventKeyVenueDictEntry[] = [];
  if (sb) {
    const [{ data: dated }, { data: recurring }, { data: dictRows }] = await Promise.all([
      sb.from('things')
        .select('id, title, starts_at, source, address, place_id, event_key')
        .not('starts_at', 'is', null)
        .gte('starts_at', win.fromISO)
        .lte('starts_at', win.toISO),
      sb.from('things')
        .select('id, title, starts_at, source, address, place_id, event_key, recurring_schedules ( day_of_week, frequency )')
        .eq('happening_tier', 2),
      sb.from('venue_neighborhoods').select('name_norm, place_id, aliases'),
    ]);
    const datedRows = (dated ?? []) as ExistingRow[];
    const recurringRows = ((recurring ?? []) as unknown as {
      id: string; title: string; starts_at: string | null; source: string | null; address: string | null; place_id: string | null; event_key: string | null;
      recurring_schedules: { day_of_week: number | null; frequency: string | null }[] | null;
    }[]).map((r): ExistingRow => ({
      id: r.id, title: r.title, starts_at: r.starts_at, source: r.source, address: r.address, place_id: r.place_id, event_key: r.event_key,
      recurring: (r.recurring_schedules ?? []).filter((s): s is { day_of_week: number; frequency: string } => s.day_of_week != null && !!s.frequency),
    }));
    existing = [...datedRows, ...recurringRows];
    venueDictionary = (dictRows ?? []) as unknown as EventKeyVenueDictEntry[];
  }
  const { keep: deduped, drops: dedupeDrops } = dedupeVenueAware(gated.map((g) => g.cand), existing, authorityByKey, venueDictionary);

  // Data Arch Redesign 26 Phase 4, canonical event identity, computed once
  // post-dedupe (the venue dictionary is already loaded above) and carried on
  // every kept candidate through enrich/images/land. Tier-3 evergreen places
  // get no event identity (computeEventKey returns null for them).
  const dedupedWithEventKeys: Candidate[] = deduped.map((c) => ({
    ...c,
    event_key: computeEventKey(
      {
        title: c.title, address: c.address ?? null, place_id: c.place_id ?? null,
        happening_tier: c.tier, starts_at: c.starts_at,
        recurring: (c.recurring ?? [])
          .filter((r): r is typeof r & { day_of_week: number } => r.day_of_week != null)
          .map((r) => ({ day_of_week: r.day_of_week, frequency: r.frequency })),
      },
      venueDictionary,
    ) ?? undefined,
  }));

  // Data Arch Redesign 26 Phase 3, AI adjudication on the ambiguous band, // now LIVE. dedupeVenueAware() already dropped every clear merge; whatever
  // is pairwise 'ambiguous' among what's left goes to a Sonnet batch call
  // (skipped in DRY_RUN, same posture as enrich below, to avoid AI spend on a
  // preview run). A merge here gets identical reversible-merge treatment
  // (event_key/merged_into/evidence + aiVerdict) to a deterministic one, // recordMerges()/recordCorroboration() don't care which produced it.
  let dedupedFinal = dedupedWithEventKeys;
  let adjudicationDrops: DropRecord[] = [];
  if (!DRY) {
    const adjudication = await applyAmbiguousAdjudication(dedupedWithEventKeys, existing, authorityByKey, venueDictionary);
    dedupedFinal = adjudication.keep;
    adjudicationDrops = adjudication.drops;
  }
  const allDedupeDrops = [...dedupeDrops, ...adjudicationDrops];

  // ---- ENRICH (one batched Claude call: voice + tags; never touches starts_at) ----
  const keep = DRY ? dedupedFinal : await enrich(dedupedFinal, { sb: sb! });
  if (DRY) console.log('  enrich skipped, dry run (no Claude call)');

  // ---- IMAGES (free -> paid waterfall; every card lands with a real image, capped) ----
  let imageStats: ResolveStats | null = null;
  let toLand = keep;
  if (sb) {
    const r = await resolveImages(keep, sb);
    toLand = r.cands;
    imageStats = r.stats;
    console.log(
      `  images               free ${r.stats.free}  google ${r.stats.google}  motif ${r.stats.motif}` +
        `  over-cap ${r.stats.overCap}  rejected-quality ${r.stats.rejectedQuality}  rejected-relevance ${r.stats.rejectedRelevance}`,
    );
  }

  // attribute dedupe drops + landed counts back to each source run
  for (const d of allDedupeDrops) {
    const run = runs.get(d.source);
    if (run) run.dropped++;
  }
  const keptIds = new Set(keep.map((c) => c.id));
  for (const g of gated) if (keptIds.has(g.cand.id)) (runs.get(g.sourceKey)!).landed++;

  // ---- LAND ----
  let landed = 0;
  let autoPausedSources: AutoPausedSource[] = [];
  if (sb) {
    if (allDedupeDrops.length) {
      // record each dedupe drop under its source's run (run_id may be null if its run errored)
      const byRun = new Map<number, DropRecord[]>();
      for (const d of allDedupeDrops) {
        const id = runs.get(d.source)?.id ?? 0;
        (byRun.get(id) ?? byRun.set(id, []).get(id)!).push(d);
      }
      for (const [id, ds] of byRun) if (id) await recordDrops(sb, id, ds);
    }
    landed = await landCandidates(sb, toLand);
    await landTags(sb, toLand);
    await landRecurring(sb, toLand);

    // Data Arch Redesign 26 Phase 4, corroboration bookkeeping. Isolated so a
    // failure here can't sink the run (same posture as updateSourceBaselines
    // below), this is provenance/audit data, not something landing depends on.
    try {
      await recordCorroboration(sb, toLand, allDedupeDrops);
    } catch (err) {
      console.log(`  [corroboration] skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Data Arch Redesign 26 Phase 5, auditable, reversible merges. Isolated
    // for the same reason: a bookkeeping failure must never block landing.
    try {
      await recordMerges(sb, gated, allDedupeDrops);
    } catch (err) {
      console.log(`  [merge-log] skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Data Arch Redesign 25 Phase 3, fold the generic lane's AI spend into
    // its source_runs row (runtime is already free via that row's own
    // started_at/finished_at).
    const genericRun = runs.get('generic');
    if (genericRun) {
      const stats = getLastGenericRunStats();
      genericRun.ai_cost_usd = stats.aiCostUsd;
      console.log(
        `[generic] cost/runtime this run: $${stats.aiCostUsd.toFixed(4)} AI spend `
        + `(${stats.sourcesExtracted} extracted, ${stats.sourcesSkippedUnchanged} unchanged-skipped, ${stats.sourcesDeferred} deferred)`,
      );
    }

    for (const run of runs.values()) await finishRun(sb, run, true);

    // Data Arch Redesign 23 Phase 3, isolated so a baseline hiccup can't sink
    // the run (same pattern as restock/closures/venue-match below).
    try {
      autoPausedSources = await updateSourceBaselines(sb, runs);
    } catch (err) {
      console.log(`  [sources] baseline update skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- SUMMARY ----
  console.log(
    `\n[ingest] ${totalFetched} fetched · ${keep.length} kept · ` +
      `${totalGateDropped} gate-dropped · ${allDedupeDrops.length} dedupe-dropped` +
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

  // ---- RUN-NOW (C2b): dispatched for a single restock directive ----
  // The full fresh pass above already landed everything; finalize just this
  // directive and skip the nightly digest/closures/venue passes (those belong to
  // the scheduled run). Isolated so a finalize hiccup can't fail the whole run.
  if (sb && DIRECTIVE_ID) {
    try {
      const n = await finalizeRunNowDirective(sb, DIRECTIVE_ID, toLand);
      console.log(`  restock run-now      directive ${DIRECTIVE_ID} → ${n} matching candidate(s); ${landed} landed total`);
    } catch (err) {
      console.log(`  restock run-now      failed: ${err instanceof Error ? err.message : String(err)}`);
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

    // Cockpit Enhancements Phase 4 (LC-10), queued re-enrich directives. Isolated
    // so a bad redraft can't sink the run (same pattern as restock above).
    try {
      const redrafted = await consumeEnrichDirectives(sb);
      if (redrafted) console.log(`  enrich-directives    landed ${redrafted} redraft(s) as pending edits`);
    } catch (err) {
      console.log(`  enrich-directives    skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    const closed = await detectClosures(sb);
    if (closed) console.log(`  closures             archived ${closed} permanently-closed place(s)`);

    // Card Imagery Build Spec Phase 2 §5.2, nightly exact place_id auto-attach.
    // Isolated so a matcher failure can't sink the run (same pattern as restock above).
    try {
      const venueMatched = await matchVenuesByPlaceId(sb);
      if (venueMatched) console.log(`  venue-match          auto-attached ${venueMatched} thing(s) by exact place_id`);
    } catch (err) {
      console.log(`  venue-match          skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Card Imagery Build Spec Phase 2 §5.5, nightly compliant Google URI refresh.
    // Isolated so a refresh failure can't sink the run (same pattern as above).
    let venueFallbacks: VenueFallbackEvent[] = [];
    try {
      const r = await refreshVenuePhotoServingUrls(sb);
      venueFallbacks = r.fallbacks;
      if (r.refreshed || r.overCap || r.failed || r.fallbacks.length) {
        console.log(
          `  venue-refresh        refreshed ${r.refreshed} · skipped ${r.skipped} (fresh/unassigned) · ` +
            `over-cap ${r.overCap} · failed ${r.failed} · dead-photo fallbacks ${r.fallbacks.length}`,
        );
      }
    } catch (err) {
      console.log(`  venue-refresh        skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Images desk Part C, nightly free Wikimedia candidate prefetch so the
    // cockpit Images tab opens pre-loaded. Isolated so it can't sink the run.
    try {
      const p = await prefetchDeskCandidates(sb);
      if (p.searched) console.log(`  desk-prefetch        searched ${p.searched} imageless thing(s) · widened ${p.widened}`);
    } catch (err) {
      console.log(`  desk-prefetch        skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Data Arch Redesign 24 Phase 1, keep data_confidence current every night.
    // Isolated so a scoring hiccup can't sink the run (same pattern as above).
    try {
      const scoredCount = await recomputeConfidenceScores(sb);
      console.log(`  confidence           scored ${scoredCount} thing(s)`);
    } catch (err) {
      console.log(`  confidence           skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Data Arch Redesign 24 Phase 3, the conservative auto-publish gate, real
    // this time (not shadow). MUST run after the confidence step above so it
    // reads tonight's fresh scores. Isolated so a gate hiccup can't sink the
    // run, worst case, things stay in needs_review exactly as before.
    let gateResult: GateApplyResult = { published: 0, held: 0, reviewed: 0 };
    try {
      gateResult = await applyPublishGate(sb);
      console.log(`  publish-gate         published ${gateResult.published} · held ${gateResult.held} · left in review ${gateResult.reviewed}`);
    } catch (err) {
      console.log(`  publish-gate         skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Data Arch Redesign 24 Phase 5, rescue held things whose rescored
    // confidence has climbed back above the hold floor. Runs AFTER the gate
    // above, on purpose: a rescued item waits in needs_review for the rest of
    // tonight and only becomes auto-publish-eligible on tomorrow's gate pass.
    try {
      const rescuedCount = await rescueHeldThings(sb);
      console.log(`  rescue               ${rescuedCount} held thing(s) upgraded back to needs_review`);
    } catch (err) {
      console.log(`  rescue               skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Elevation v1 · Gate 1 · G1.1, recompute quality_tier for every published/
    // needs_review row from tonight's fresh data. MUST run AFTER the publish-gate
    // + rescue above so newly-published rows are scored the same night. Idempotent
    // (writes only where the tier changed); isolated so a hiccup can't sink the run.
    try {
      const { recomputeQualityTiers } = await import('./audits/tier_backfill');
      const tierResult = await recomputeQualityTiers(sb);
      console.log(
        `  quality-tier         scored ${tierResult.scored} · full ${tierResult.counts[1]} · ` +
          `compact ${tierResult.counts[2]} · hidden ${tierResult.counts[3]} · changed ${tierResult.changed}`,
      );
    } catch (err) {
      console.log(`  quality-tier         skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Elevation v1 · Gate 2 · G2.1, ensure every newly-published thing/guide has
    // a slug + a UUID->slug redirect row (so old links never break). Idempotent;
    // isolated so a hiccup can't sink the run.
    try {
      const { ensureSlugs } = await import('./slugs/backfill');
      const s = await ensureSlugs(sb);
      console.log(`  slugs                things +${s.things} · guides +${s.guides} · redirects ${s.redirects}`);
    } catch (err) {
      console.log(`  slugs                skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Elevation v1 · Gate 3 · G3.4, keep recurring_schedules.next_occurrence
    // current so recurring cards show a real next date, never "every week".
    try {
      const { recomputeNextOccurrences } = await import('./audits/recurring_next');
      const n = await recomputeNextOccurrences(sb);
      console.log(`  recurring-next       computed ${n.computed}/${n.scanned} · changed ${n.changed}`);
    } catch (err) {
      console.log(`  recurring-next       skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Gate 0 G0.1, non-blocking QA-note warning: catch any operator note that
    // leaked into published copy before a human sees it on the site. Never blocks
    // the run.
    try {
      const { runQaNoteScan } = await import('./audits/qa_note_scan');
      const qaFlags = await runQaNoteScan();
      if (qaFlags.length) {
        console.warn(`  qa-note-scan         WARNING: ${qaFlags.length} published row(s) look like leaked operator notes`);
        for (const f of qaFlags.slice(0, 10)) console.warn(`                         ${f.table}.${f.column} · ${f.title} · ${f.note ?? ''}`);
      } else {
        console.log('  qa-note-scan         clean (0 leaked notes)');
      }
    } catch (err) {
      console.log(`  qa-note-scan         skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    await sendDigest(sb, {
      landed,
      gateDropped: totalGateDropped,
      dedupeDropped: allDedupeDrops.length,
      images: imageStats,
      runs: [...runs.values()],
      closed,
      venueFallbacks,
      autoPausedSources,
    });
  }
}

// Guarded so importing this module for its exported helpers (recordMerges,
// recordCorroboration, reused by e.g. one-off scripts) never re-triggers the
// full nightly pipeline as a side effect. Only runs when this file is the
// actual CLI entrypoint (`tsx ingest/run.ts` / `npm run ingest`).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[ingest] fatal:', err);
    process.exit(1);
  });
}
