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

/** Canonical-source preference (Doc 11 §6): lower rank wins. Venue-owned ticketing
 *  (SOhO, Polo) > Ticketmaster > Visit SB > Independent > LiveNotes > aggregators. */
const SOURCE_RANK: Array<[RegExp, number]> = [
  [/sohosb\.com/i, 0],
  [/ticketmaster\.com|livenation\.com|axs\.com/i, 2],
  [/santabarbaraca\.com|santabarbaraca\.gov/i, 3],
  [/independent\.com/i, 4],
];
function sourceRank(url: string | undefined): number {
  for (const [re, rank] of SOURCE_RANK) if (url && re.test(url)) return rank;
  return 9;
}

/** Short source key for the drop log, derived from the candidate's URL. */
function sourceKeyOf(url: string | undefined): string {
  if (!url) return 'unknown';
  if (/sohosb\.com/i.test(url)) return 'soho';
  if (/ticketmaster\.com/i.test(url)) return 'ticketmaster';
  try { return new URL(url).host; } catch { return 'unknown'; }
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
): { keep: Candidate[]; drops: DropRecord[] } {
  const drops: DropRecord[] = [];
  const keep: Candidate[] = [];
  const existingIds = new Set(existing.map((e) => e.id));

  // Process canonical sources first so a near-dupe from a weaker source is the
  // one that gets dropped.
  const ordered = [...cands].sort((a, b) => sourceRank(a.source_url) - sourceRank(b.source_url));
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
