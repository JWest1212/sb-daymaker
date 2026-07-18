// ingest/dedupe.ts
//
// Two-layer dedupe (Doc 11 §6):
//   1. EXACT: same uuid5 id => same row. Drop the dupe (reason 'duplicate').
//   2. NEAR:  title trigram (Dice) similarity > 0.55 AND same SB calendar day =>
//             the same event from two sources. Keep the venue-owned/canonical
//             source, drop the other.
// Runs in-batch AND against the rows already in the DB for the window.

import type { Candidate, DropReason } from '../packages/shared/types';
import { sbDateKey } from './tz';
import { canonicalVenue, cadenceKey, computeEventKey, type VenueDictEntry, type CadenceInput } from './eventKey';

export interface DropRecord {
  source: string;
  title?: string;
  reason: DropReason;
  detail?: string;
  source_url?: string;
  raw?: unknown;
  /** Data Arch Redesign 26 Phase 4 — set only for a venue-aware near-dupe drop
   *  (never for an exact-id repeat): the canonical event_key of the row this
   *  one was merged into, so the caller can record the dropped source's
   *  corroboration in event_sources even though its own row never lands. */
  event_key?: string | null;
  /** Data Arch Redesign 26 Phase 5 — the dropped candidate's own uuid5 id
   *  (set only for a venue-aware near-dupe drop), so the caller can look up
   *  its full Candidate and persist it as a reversible merge — see
   *  `merged_into` and `evidence` below. */
  id?: string;
  /** The surviving row's id (the kept candidate's id for an in-batch merge,
   *  or the existing DB row's id for a vs-existing merge) — same value that
   *  lands as `things.id` for the survivor, so it's directly usable as the
   *  dropped row's `merged_into` foreign key. */
  merged_into?: string | null;
  /** The matcher's own verdict for this merge — the "which signals fired"
   *  evidence spec 26 §4 asks every merge to log. */
  evidence?: { titleSim: number; venue: VenueVerdict; signal: MatchVerdict['signal'] };
}

/** Minimal shape of a DB row we dedupe against. `address`/`place_id`/`recurring`
 *  are optional (Data Arch Redesign 26 Phase 2) — `dedupe()`'s own tests and
 *  call sites that don't care about the venue signal can omit them, and the
 *  venue-aware matcher correctly treats that as "unknown venue". `event_key`
 *  (Phase 4) is the row's own already-persisted canonical identity, read
 *  straight from the DB rather than recomputed. The live production query
 *  (ingest/run.ts main()) populates all of these for real. */
export interface ExistingRow {
  id: string;
  title: string;
  starts_at: string | null;
  source: string | null;
  address?: string | null;
  place_id?: string | null;
  recurring?: CadenceInput[];
  event_key?: string | null;
}

export const NEAR_THRESHOLD = 0.55;

/** Short source key for the drop log, derived from the candidate's URL. Exported
 *  for reuse by ingest/adapters/_shared/resolveNeighborhood.ts (Doc 19 §4.1 step 3
 *  — source-implied venue), so the two never drift apart.
 *  Data Arch Redesign 23 Phase 2: this MAP used to cover only 13 of the 33
 *  sources (canonical-source preference fell back to a raw hostname string for
 *  the rest, which could never match a `sources.key`). Extended here to cover
 *  every adapter so authorityOf() below resolves correctly for all of them.
 *  The first 13 entries are UNCHANGED from before this migration — resolveNeighborhood.ts's
 *  SOURCE_KEY_NEIGHBORHOOD dict depends on their exact output strings. */
export function sourceKeyOf(url: string | undefined): string {
  if (!url) return 'unknown';
  const MAP: Array<[RegExp, string]> = [
    [/sohosb\.com/i, 'soho'],
    [/sbbowl\.com/i, 'sbbowl'],
    [/lobero\.org/i, 'lobero'],
    [/granada/i, 'granada'],
    [/arlington/i, 'arlington'],
    [/ticketmaster\.com/i, 'ticketmaster'],
    [/events\.ucsb\.edu/i, 'ucsb'],
    [/sbplibrary\.org/i, 'libraries'],
    [/independent\.com/i, 'independent'],
    [/santabarbaraca\.gov|santabarbaraca\.com/i, 'citysb'],
    [/downtownsb\.org/i, 'downtownSB'],
    [/eventbrite\.com/i, 'eventbrite'],
    [/sbfarmersmarket\.org/i, 'farmersMarkets'],
    // added Phase 2 — previously unmapped, fell back to a raw hostname string
    [/musicacademy\.org/i, 'musicacademy'],
    [/alcazartheater\.com|thealcazar\.org/i, 'alcazar'],
    [/centerstagetheater\.org/i, 'centerstage'],
    [/carpinteriaartscenter\.org/i, 'carpinteriaArts'],
    [/etcsb\.org/i, 'newVic'],
    [/figmtnbrew\.com/i, 'nightlifeRhythms'],
    [/darganssb\.com/i, 'nightlifeRhythms'],
    [/condorexpress\.com/i, 'outdoorsOperators'],
    [/iceinparadise\.org/i, 'outdoorsOperators'],
    [/sblandtrust\.org/i, 'natureProgramsFree'],
    [/moxi\.org/i, 'moxi'],
    [/sbnature\.org|nhmlac\.org/i, 'naturalHistory'],
    [/sbbotanicgarden\.org/i, 'botanicGarden'],
    [/sbma\.net/i, 'sbma'],
    [/cityofgoleta\.org/i, 'goletaCivic'],
    [/carpinteriaca\.gov|carpinteria\.ca\.us/i, 'carpinteriaCivic'],
    [/coastalview\.com/i, 'coastalView'],
    [/sbac\.ca\.gov/i, 'sbcountyArts'],
    [/allevents\.in/i, 'allevents'],
    [/seatgeek\.com/i, 'seatgeek'],
  ];
  for (const [re, key] of MAP) if (re.test(url)) return key;
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return 'unknown'; }
}

/** Data Arch Redesign 23 Phase 2: canonical-source preference now reads
 *  `sources.authority` (higher wins) instead of the retired hardcoded
 *  SOURCE_RANK regex table (lower-wins rank numbers). `byKey` is loaded once
 *  per run from the `sources` table by the caller (ingest/run.ts) and passed
 *  in — dedupe.ts stays DB-free. A source missing from `byKey` (shouldn't
 *  happen once `sources` is fully seeded) sorts last, same as the old
 *  table's rank-99 fallback for an unrecognized URL. */
export function sourceAuthority(url: string | undefined, byKey: Map<string, number>): number {
  return byKey.get(sourceKeyOf(url)) ?? 0;
}

export function trigrams(s: string): Set<string> {
  const t = ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const set = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

/** Dice coefficient over character trigrams (approximates pg_trgm similarity). */
export function titleSimilarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

export function sameDay(a: string | null, b: string | null): boolean {
  return !!a && !!b && sbDateKey(a) === sbDateKey(b);
}

export function dedupe(
  cands: Candidate[],
  existing: ExistingRow[] = [],
  authorityByKey: Map<string, number> = new Map(),
): { keep: Candidate[]; drops: DropRecord[] } {
  const drops: DropRecord[] = [];
  const keep: Candidate[] = [];
  const existingIds = new Set(existing.map((e) => e.id));

  // Process canonical sources first so a near-dupe from a weaker source is the
  // one that gets dropped. Higher authority = more canonical = processed first
  // (replaces the retired SOURCE_RANK table, where a lower rank number won).
  const ordered = [...cands].sort(
    (a, b) => sourceAuthority(b.source_url, authorityByKey) - sourceAuthority(a.source_url, authorityByKey),
  );
  const keptIds = new Set<string>();

  for (const c of ordered) {
    const drop = (detail: string): void => {
      drops.push({
        source: sourceKeyOf(c.source_url),
        title: c.title,
        reason: 'duplicate',
        detail,
        source_url: c.source_url,
      });
    };

    // 1) exact id — already in DB, or a re-emit within this batch
    if (existingIds.has(c.id)) { drop('exact id already in DB'); continue; }
    if (keptIds.has(c.id)) { drop('exact id repeated in batch'); continue; }

    // 2) near-match against what we've already kept this run
    const nearKept = keep.find(
      (k) => sameDay(k.starts_at, c.starts_at) && titleSimilarity(k.title, c.title) > NEAR_THRESHOLD,
    );
    if (nearKept) { drop(`near-dupe of "${nearKept.title}" (kept canonical source)`); continue; }

    // 3) near-match against existing DB rows on the same day
    const nearDb = existing.find(
      (e) => sameDay(e.starts_at, c.starts_at) && titleSimilarity(e.title, c.title) > NEAR_THRESHOLD,
    );
    if (nearDb) { drop(`near-dupe of existing "${nearDb.title}"`); continue; }

    keptIds.add(c.id);
    keep.push(c);
  }

  return { keep, drops };
}

// ============================================================================
// Data Arch Redesign 26 Phase 2 — venue-aware matching (LIVE as of Phase 2's
// go-live; ingest/run.ts's main() calls dedupeVenueAware(), not dedupe()).
// `dedupe()` above is kept byte-for-byte unchanged as the plain deterministic
// core — still exported and unit-tested on its own, and reused as the "OLD"
// baseline by the DEDUPE_VENUE_SHADOW audit report in run.ts. `evaluateMatch()`
// and `dedupeVenueAware()` below are the improved matcher from Doc 16 §3.6:
// the venue signal, the recurring/time-TBD path, and the ambiguous band that
// Phase 3 will hand to AI. Shadow-tested against the live catalog (0 new
// merges/splits vs `dedupe()`, 71 pairs correctly held as ambiguous) before
// going live.
// ============================================================================

/** Below this, a pair is never even ambiguous — matches spec 26 §3.3's
 *  ambiguous-band floor (~0.35-0.55). */
const AMBIGUOUS_FLOOR = 0.35;

export interface VenueAwareItem {
  title: string;
  starts_at: string | null;
  address?: string | null;
  place_id?: string | null;
  recurring?: CadenceInput[];
}

export type VenueVerdict = 'agree' | 'disagree' | 'unknown';

/** 'merge': deterministic, clear — Phase 2 acts on this directly.
 *  'split': deterministic, clearly distinct (or vetoed by disagreeing venues).
 *  'ambiguous': spec 3.3's band (~0.35-0.55 title sim, same day/cadence,
 *  same-or-unknown venue) — Phase 2 has no AI yet, so this is held apart
 *  (same visible effect as 'split' today) but reported separately as a
 *  preview of Phase 3's adjudication volume. NEVER auto-merged: an earlier
 *  version of this matcher let venue agreement auto-merge this band, and the
 *  live shadow report caught it producing real false merges (e.g. two
 *  different Music Academy masterclasses on the same day, two different
 *  civic meetings sharing a generic placeholder address) — a title match
 *  this weak needs a real adjudicator, not a lowered threshold. */
export type MatchOutcome = 'merge' | 'split' | 'ambiguous';

export interface MatchVerdict {
  outcome: MatchOutcome;
  titleSim: number;
  venue: VenueVerdict;
  /** Which axis produced a 'merge'/'ambiguous' outcome: same calendar day
   *  (dated events) or the same recurring cadence (time-TBD / Tier-2, where
   *  no day exists to compare). 'none' for 'split'. */
  signal: 'day' | 'cadence' | 'none';
}

function venueVerdict(a: VenueAwareItem, b: VenueAwareItem, dictionary: VenueDictEntry[]): VenueVerdict {
  const va = canonicalVenue({ title: a.title, address: a.address ?? null, place_id: a.place_id ?? null }, dictionary);
  const vb = canonicalVenue({ title: b.title, address: b.address ?? null, place_id: b.place_id ?? null }, dictionary);
  if (va == null || vb == null) return 'unknown';
  return va === vb ? 'agree' : 'disagree';
}

/** The Phase 2 matcher: same deterministic core as `dedupe()` for the clear
 *  cases (never touches AI) plus the venue signal from spec 26 §3.2/§3.3:
 *   - Different KNOWN venues never match, regardless of title similarity —
 *     bias toward split (a false-split just looks like a duplicate; a
 *     false-merge hides a real event).
 *   - A clear title match (>0.55) still merges deterministically, same as
 *     today, on same day (or, new: same recurring cadence when neither side
 *     has a start time — closing the gap where time-TBD/recurring rows never
 *     got compared at all).
 *   - A mid-band title match (~0.35-0.55) is 'ambiguous', not merged — that's
 *     spec 3.3's band for Phase 3's AI adjudication, whether the venue agrees
 *     or is simply unknown (only a KNOWN, DISAGREEING venue forces 'split'). */
export function evaluateMatch(a: VenueAwareItem, b: VenueAwareItem, dictionary: VenueDictEntry[]): MatchVerdict {
  const venue = venueVerdict(a, b, dictionary);
  const titleSim = titleSimilarity(a.title, b.title);
  const result = (outcome: MatchOutcome, signal: MatchVerdict['signal'] = 'none'): MatchVerdict => ({ outcome, titleSim, venue, signal });

  if (venue === 'disagree') return result('split');

  if (a.starts_at && b.starts_at) {
    if (!sameDay(a.starts_at, b.starts_at)) return result('split');
    if (titleSim > NEAR_THRESHOLD) return result('merge', 'day');
    if (titleSim > AMBIGUOUS_FLOOR) return result('ambiguous', 'day');
    return result('split');
  }

  // Recurring / time-TBD path — no start time on at least one side.
  const cadenceA = cadenceKey(a.recurring ?? []);
  const cadenceB = cadenceKey(b.recurring ?? []);
  if (cadenceA && cadenceA === cadenceB) {
    if (titleSim > NEAR_THRESHOLD) return result('merge', 'cadence');
    if (titleSim > AMBIGUOUS_FLOOR) return result('ambiguous', 'cadence');
  }
  return result('split');
}

/** Structurally identical to `dedupe()` (same authority ordering, same
 *  exact-id layer, same in-batch + against-existing passes) but the near-match
 *  test is `evaluateMatch()` instead of the plain title+day check. This is the
 *  function ingest/run.ts's main() actually calls. */
export function dedupeVenueAware(
  cands: Candidate[],
  existing: ExistingRow[] = [],
  authorityByKey: Map<string, number> = new Map(),
  dictionary: VenueDictEntry[] = [],
): { keep: Candidate[]; drops: DropRecord[] } {
  const drops: DropRecord[] = [];
  const keep: Candidate[] = [];
  const existingIds = new Set(existing.map((e) => e.id));

  const ordered = [...cands].sort(
    (a, b) => sourceAuthority(b.source_url, authorityByKey) - sourceAuthority(a.source_url, authorityByKey),
  );
  const keptIds = new Set<string>();

  const asItem = (c: Candidate): VenueAwareItem => ({
    title: c.title,
    starts_at: c.starts_at,
    address: c.address,
    place_id: c.place_id,
    recurring: (c.recurring ?? [])
      .filter((r): r is typeof r & { day_of_week: number } => r.day_of_week != null)
      .map((r) => ({ day_of_week: r.day_of_week, frequency: r.frequency })),
  });
  const asExistingItem = (e: ExistingRow): VenueAwareItem => ({
    title: e.title, starts_at: e.starts_at, address: e.address, place_id: e.place_id, recurring: e.recurring,
  });
  const eventKeyOf = (c: Candidate): string | null => computeEventKey(
    {
      title: c.title, address: c.address ?? null, place_id: c.place_id ?? null,
      happening_tier: c.tier, starts_at: c.starts_at,
      recurring: (c.recurring ?? [])
        .filter((r): r is typeof r & { day_of_week: number } => r.day_of_week != null)
        .map((r) => ({ day_of_week: r.day_of_week, frequency: r.frequency })),
    },
    dictionary,
  );

  for (const c of ordered) {
    const drop = (
      detail: string,
      merge?: { eventKey: string | null; mergedInto: string; evidence: MatchVerdict },
    ): void => {
      drops.push({
        source: sourceKeyOf(c.source_url),
        title: c.title,
        reason: 'duplicate',
        detail,
        source_url: c.source_url,
        ...(merge ? { event_key: merge.eventKey, id: c.id, merged_into: merge.mergedInto, evidence: { titleSim: merge.evidence.titleSim, venue: merge.evidence.venue, signal: merge.evidence.signal } } : {}),
      });
    };

    if (existingIds.has(c.id)) { drop('exact id already in DB'); continue; }
    if (keptIds.has(c.id)) { drop('exact id repeated in batch'); continue; }

    const cItem = asItem(c);

    // Data Arch Redesign 26 Phase 4/5 — a near-dupe drop carries the
    // SURVIVOR's event_key (not a fresh computation from the dropped row's
    // own title) plus the match evidence, so the caller can (a) record the
    // dropped source's corroboration even though its row never lands, and
    // (b) log an auditable, reversible merge (spec 26 §4). The survivor's
    // event_key is authoritative: for the exact-title-match case they'd agree
    // anyway, but for the fuzzy (>0.55, differently-worded) case they can
    // differ, and the survivor's identity is the one that actually lands.
    const nearKept = keep.find((k) => evaluateMatch(asItem(k), cItem, dictionary).outcome === 'merge');
    if (nearKept) {
      const verdict = evaluateMatch(asItem(nearKept), cItem, dictionary);
      drop(`near-dupe of "${nearKept.title}" (venue-aware, kept canonical source)`, { eventKey: eventKeyOf(nearKept), mergedInto: nearKept.id, evidence: verdict });
      continue;
    }

    const nearDb = existing.find((e) => evaluateMatch(asExistingItem(e), cItem, dictionary).outcome === 'merge');
    if (nearDb) {
      const verdict = evaluateMatch(asExistingItem(nearDb), cItem, dictionary);
      drop(`near-dupe of existing "${nearDb.title}" (venue-aware)`, { eventKey: nearDb.event_key ?? null, mergedInto: nearDb.id, evidence: verdict });
      continue;
    }

    keptIds.add(c.id);
    keep.push(c);
  }

  return { keep, drops };
}
