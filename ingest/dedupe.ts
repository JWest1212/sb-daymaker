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

export interface DropRecord {
  source: string;
  title?: string;
  reason: DropReason;
  detail?: string;
  source_url?: string;
  raw?: unknown;
}

/** Minimal shape of a DB row we dedupe against. */
export interface ExistingRow {
  id: string;
  title: string;
  starts_at: string | null;
  source: string | null;
}

const NEAR_THRESHOLD = 0.55;

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

function sameDay(a: string | null, b: string | null): boolean {
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
