// ingest/clean.ts
//
// R1 Wave 5 (W5.1). Make a scraped title read like something a person wrote.
//
// What the audit found on the live site: 78 published rows titled "LOTG |
// <somewhere>", which is the library bookmobile written in an internal
// abbreviation nobody outside the library would recognise (TP-A8-04); 98 titles
// carrying a pipe and a venue that belongs in the card's meta line, not in the
// name of the thing; and all-caps shouting in the middle of otherwise ordinary
// sentences.
//
// Pure and deterministic. No AI: these are mechanical corrections, and running
// them through a model would make them slower, dearer and less predictable.
// Runs in `land` before enrich, so the model writing the blurb sees the cleaned
// title rather than the raw one.

import acronymData from './data/acronyms.json';

interface AcronymRule {
  token: string;
  action: 'expand' | 'drop' | 'keep';
  to?: string;
  note?: string;
}

const ACRONYMS = acronymData.acronyms as AcronymRule[];
const BY_TOKEN = new Map(ACRONYMS.map((a) => [a.token.toUpperCase(), a]));

export interface CleanedTitle {
  title: string;
  /** The venue lifted out of a "Title | Venue" pattern, if there was one. */
  venueName: string | null;
}

/** Words that stay lowercase inside a title, unless they lead it. */
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of',
  'on', 'or', 'the', 'to', 'up', 'via', 'with',
]);

/** True when a token is a genuine initialism we should leave alone. */
function isKnownInitialism(token: string): boolean {
  return BY_TOKEN.get(token.toUpperCase())?.action === 'keep';
}

/**
 * Expand or drop the acronyms in a string, per ingest/data/acronyms.json.
 * Word-boundary matched, so "LOTGx" is untouched.
 */
export function expandAcronyms(text: string): string {
  let out = text;
  for (const rule of ACRONYMS) {
    if (rule.action === 'keep') continue;
    const re = new RegExp(`\\b${rule.token}\\b`, 'g');
    out = out.replace(re, rule.action === 'expand' ? (rule.to ?? rule.token) : '');
  }
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([,:;])/g, '$1').trim();
}

/**
 * Title-case a string that is shouting, and fix a lowercase proper noun at the
 * start. A title that is ALREADY mixed case is left alone: the writer's casing
 * is more trustworthy than any rule here.
 */
export function normalizeCasing(title: string): string {
  const letters = title.replace(/[^A-Za-z]/g, '');
  if (!letters) return title;
  const upperRatio = (letters.match(/[A-Z]/g) ?? []).length / letters.length;

  // Only intervene when the string is overwhelmingly capitals (shouting).
  if (upperRatio > 0.8 && letters.length > 3) {
    return title
      .split(/(\s+)/)
      .map((word, i) => {
        if (/^\s+$/.test(word)) return word;
        const bare = word.replace(/[^A-Za-z]/g, '');
        if (bare && isKnownInitialism(bare)) return word;
        const lower = word.toLowerCase();
        if (i > 0 && MINOR_WORDS.has(lower.replace(/[^a-z]/g, ''))) return lower;
        return lower.replace(/[a-z]/, (c) => c.toUpperCase());
      })
      .join('');
  }

  // A title that opens lowercase gets one capital, nothing more.
  return title.replace(/^([a-z])/, (c) => c.toUpperCase());
}

/**
 * Split "Title | Venue" and clean both halves.
 *
 * The venue goes to `venue_name` and is rendered in the card's meta line. The
 * title becomes the name of the thing, which is what a person would call it.
 * A pipe with nothing useful on one side is simply removed.
 */
export function cleanTitle(raw: string): CleanedTitle {
  const expanded = expandAcronyms(raw);
  const parts = expanded.split('|').map((p) => p.trim()).filter(Boolean);

  if (parts.length < 2) {
    return { title: normalizeCasing(parts[0] ?? expanded.trim()), venueName: null };
  }
  // More than one pipe: the first segment is the name, the last is the venue.
  const title = normalizeCasing(parts[0]);
  const venueName = normalizeCasing(parts[parts.length - 1]);
  // A "venue" identical to the title is not a venue, it is a duplicate.
  if (venueName.toLowerCase() === title.toLowerCase()) return { title, venueName: null };
  return { title, venueName };
}

/** A street address sitting at the start or end of a blurb, e.g.
 *  "123 State St. Live music every Friday." */
const ADDRESS_IN_BLURB =
  /(?:^|(?<=[.!?]\s))(\d{2,5}\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pl|Place|Ct|Court)\.?)(?:,\s*(?:Santa Barbara|Goleta|Carpinteria|Montecito)[^.]*)?\.?\s*/g;

export interface CleanedBlurb {
  blurb: string;
  /** An address lifted out of the blurb, for a row that has none. */
  address: string | null;
}

/**
 * Pull a street address out of a blurb. The blurb is for saying what the thing
 * is and why to go; the address belongs in the address field, where the detail
 * page and the directions link can use it.
 */
export function cleanBlurb(raw: string | null | undefined): CleanedBlurb {
  if (!raw) return { blurb: '', address: null };
  let found: string | null = null;
  const stripped = raw.replace(ADDRESS_IN_BLURB, (_m, addr: string) => {
    if (!found) found = addr.replace(/\.$/, '').trim();
    return '';
  });
  const blurb = stripped.replace(/\s{2,}/g, ' ').trim();
  // Never hand back an empty blurb: if the address WAS the blurb, keep the original.
  return blurb ? { blurb, address: found } : { blurb: raw.trim(), address: found };
}
