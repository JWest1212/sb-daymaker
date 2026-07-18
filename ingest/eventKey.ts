// ingest/eventKey.ts
//
// Data Arch Redesign 26, canonical event identity (Doc 16 §3.6, §3.11, §2.4).
// Pure, no I/O, unit-testable: given a thing-shaped input and the
// venue_neighborhoods dictionary (Doc 19's venue dictionary, NOT the
// image-pool `venues` table; see Phase 0 findings), returns a stable
// `event_key` so the same real-world event converges to one identity
// regardless of which source reported it.
//
// Dated (Tier 1):     hash(canonicalVenue + normalizeTitle(title) + sbDateKey(starts_at))
// Recurring (Tier 2): hash(canonicalVenue + normalizeTitle(title) + cadence)
// Evergreen (Tier 3):  no event_key, these are places, not events; nothing here
//                      to corroborate across sources the way a dated/recurring
//                      event is (spec 26 is explicitly about event identity).

import { createHash } from 'node:crypto';
import { sbDateKey } from './tz';

const NOISE_WORDS = new Set(['live', 'presents', 'present', 'the', 'w', 'feat', 'ft']);

/** lowercase -> strip punctuation -> drop noise words -> collapse whitespace. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !NOISE_WORDS.has(w))
    .join(' ')
    .trim();
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Doc 19's venue dictionary shape (venue_neighborhoods), reused verbatim from
 *  resolveNeighborhood.ts so the two never drift apart. */
export interface VenueDictEntry {
  name_norm: string;
  place_id: string | null;
  aliases: string[];
}

export interface VenueSignalInput {
  title: string;
  address: string | null;
  place_id?: string | null;
}

/** Same waterfall trust order as resolveNeighborhood.ts's place_id -> name/alias
 *  match, minus the neighborhood-only steps (source-implied, point-in-polygon)
 *  that don't identify a VENUE, only an area. Returns null ("unknown venue")
 *  rather than guessing, an unknown venue is a real signal downstream (the
 *  ambiguous band in Phase 3), not an error. */
export function canonicalVenue(input: VenueSignalInput, dictionary: VenueDictEntry[]): string | null {
  if (input.place_id) {
    const hit = dictionary.find((v) => v.place_id === input.place_id);
    if (hit) return hit.name_norm;
  }
  const titleNorm = normalizeText(input.title);
  const addrNorm = input.address ? normalizeText(input.address) : '';
  for (const v of dictionary) {
    const candidates = [v.name_norm, ...v.aliases.map(normalizeText)];
    for (const c of candidates) {
      if (!c) continue;
      if (titleNorm.includes(c) || (addrNorm && addrNorm.includes(c))) return v.name_norm;
    }
  }
  // The raw-address fallback only counts as a venue identity when the address
  // carries a street number, a generic city-level placeholder ("Santa
  // Barbara, Santa Barbara, CA", seen on several civic-source rows with no
  // real venue captured) has zero distinguishing power and must NOT be
  // treated as "known" venue: it was empirically causing both false
  // agreements (two unrelated civic meetings "sharing" the same city-level
  // placeholder) and false disagreements (a real venue's address vs. the same
  // event's other listing carrying only the placeholder), found via the
  // Phase 2 shadow report against the live catalog.
  if (input.address && /\d/.test(input.address)) return addrNorm || null;
  return null;
}

export interface CadenceInput {
  day_of_week: number;
  frequency: string;
}

/** Sorted + joined so the same rhythm produces the same cadence string
 *  regardless of the order recurring rows were read/inserted in. */
export function cadenceKey(recurring: CadenceInput[]): string | null {
  if (!recurring.length) return null;
  return [...recurring]
    .sort((a, b) => a.day_of_week - b.day_of_week || a.frequency.localeCompare(b.frequency))
    .map((r) => `${r.day_of_week}:${r.frequency}`)
    .join(',');
}

function hash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

export interface EventKeyInput {
  title: string;
  address: string | null;
  place_id?: string | null;
  happening_tier: number;          // 1 dated | 2 recurring | 3 evergreen
  starts_at: string | null;
  recurring?: CadenceInput[];
}

/** Returns null when there's no natural event identity to key on (Tier 3
 *  evergreen, or a Tier 1/2 row missing the field its tier requires, should
 *  not happen post-gate, but this stays defensive since it may run over
 *  historical rows landed under older gate rules). */
export function computeEventKey(input: EventKeyInput, dictionary: VenueDictEntry[]): string | null {
  const venue = canonicalVenue({ title: input.title, address: input.address, place_id: input.place_id }, dictionary);
  const venuePart = venue ?? '';
  const titlePart = normalizeTitle(input.title);
  if (!titlePart) return null;

  if (input.happening_tier === 1) {
    if (!input.starts_at) return null;
    return hash([venuePart, titlePart, sbDateKey(input.starts_at)]);
  }
  if (input.happening_tier === 2) {
    const cadence = cadenceKey(input.recurring ?? []);
    if (!cadence) return null;
    return hash([venuePart, titlePart, cadence]);
  }
  return null;
}
