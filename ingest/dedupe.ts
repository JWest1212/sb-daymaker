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

// Canonical-source preference (§4 / Doc 16): lower rank wins.
// Existing pairwise order is preserved (soho beats TM, etc.); new venue-direct
// adapters slot in between soho (0) and ticketmaster (10). Aggregators are losers.
// NOTE: doc 16 proposes SOURCE_PRIORITY as a string-key array (as const) but the
// code uses URL-pattern matching — keeping the code structure (flag: §0 mismatch).
const SOURCE_RANK: Array<[RegExp, number]> = [
  // venue-direct ticketing (authoritative for their own events)
  [/sohosb\.com/i,                                    0],
  [/sbbowl\.com/i,                                    1],
  [/lobero\.org/i,                                    2],
  [/granadasb\.com|granada-sb\.com|thegranada\.com/i, 3],
  [/thearlington\.com|arlingtonsb\.com/i,             4],
  [/musicacademy\.org/i,                              5],
  [/alcazartheater\.com|thealcazar\.org/i,            6],
  [/centerstagetheater\.org/i,                        7],
  [/carpinteriaartscenter\.org/i,                     8],
  // structured ticketing APIs
  [/ticketmaster\.com|livenation\.com|axs\.com/i,     10],
  // institution-direct
  [/moxi\.org/i,                                      15],
  [/sbnature\.org|nhmlac\.org/i,                      16], // natural history
  [/sbbotanicgarden\.org/i,                           17],
  [/sbma\.net/i,                                      18],
  [/events\.ucsb\.edu/i,                              20],
  [/sbplibrary\.org|goletavalleylibrary/i,            21],
  // curated local listings / civic
  [/independent\.com/i,                               30],
  [/santabarbaraca\.com|santabarbaraca\.gov/i,        31],
  [/cityofgoleta\.org/i,                              32],
  [/carpinteria\.ca\.us/i,                            33],
  [/downtownsb\.org/i,                                34],
  [/santabarbaraca\.com\/visit/i,                     35], // visit SB
  [/coastalview\.com/i,                               36],
  [/sbac\.ca\.gov/i,                                  37], // sbcountyArts
  // broad aggregators (dedupe losers; backstop fill)
  [/eventbrite\.com/i,                                50],
  [/allevents\.in/i,                                  51],
  [/seatgeek\.com/i,                                  52],
];

function sourceRank(url: string | undefined): number {
  for (const [re, rank] of SOURCE_RANK) if (url && re.test(url)) return rank;
  return 99;
}

/** Short source key for the drop log, derived from the candidate's URL. */
function sourceKeyOf(url: string | undefined): string {
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
  ];
  for (const [re, key] of MAP) if (re.test(url)) return key;
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return 'unknown'; }
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
