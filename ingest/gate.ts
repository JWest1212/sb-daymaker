// ingest/gate.ts
//
// THE STRICT GATE — Doc 11 §4 / Doc 10 §7 as real code.
// Pure function, no I/O, no AI, so it is unit-testable against the 107 seed
// fixtures. Claude (enrich.ts) runs AFTER this, never before — so AI never gets
// the chance to "rescue" a row that failed the start-time test.
//
// Two reconciliations vs. the Doc 11 sample, forced by the seed (which Doc 11
// declares the oracle: "If a seed row fails the gate, the gate is wrong"):
//   1. requiresStart is TIER-1-ONLY. The seed has 6 Tier-2 rows with no start
//      (farmers' markets, Nite Moves, the two art walks) that carry a recurring
//      *schedule* instead of a clock time and must PASS. Doc 11's tier-1||tier-2
//      sample would wrongly drop them. (Matches Doc 10's category-aware intent:
//      only discrete dated T1 events require a deterministic start.)
//   2. idFor keys uniformly on `source|title`. The seed keys EVERY row that way
//      (events on their URL, Google places on the 'seed:google_places' sentinel,
//      URL-sourced places on their URL). Doc 11's type-branch would mis-ID the
//      URL-sourced places (e.g. SB Biergarten).

import { v5 as uuidv5 } from 'uuid';
import type { RawCandidate, Candidate, GateResult, Tod, PriceBand } from '../packages/shared/types';

const NS = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'; // same namespace as the seed

/** Only discrete, dated Tier-1 events require a deterministic start time.
 *  Tier-2 recurring rhythms carry a schedule (start may be null); Tier-3 is evergreen. */
function requiresStart(tier: number): boolean {
  return tier === 1;
}

/** The linchpin. A start is deterministic ONLY if it came from a structured field
 *  or an explicit server-rendered clock time, AND parses to a real instant. */
function hasDeterministicStart(c: RawCandidate): boolean {
  if (c.startStrategy === 'none') return false;
  if (!c.startISO) return false;
  const t = Date.parse(c.startISO);
  if (Number.isNaN(t)) return false;
  // Reject date-only values masquerading as datetimes (must carry a clock time).
  // ISO date-only is length 10 ('2026-07-04'); require a 'T' (or space) and a clock.
  if (!/\d[T ]\d{2}:\d{2}/.test(c.startISO)) return false;
  return true; // strategy is 'structured' | 'server_detail' AND value is a real instant
}

function bucketTod(startISO: string): Tod[] {
  const h = new Date(startISO).getHours();
  if (h >= 5 && h < 11) return ['morning'];
  if (h >= 11 && h < 17) return ['afternoon'];
  if (h >= 17 && h < 22) return ['evening'];
  return ['late'];
}

function mapPrice(c: RawCandidate): PriceBand | null {
  if (c.explicitlyFree) return 'free';
  if (c.priceLow == null) return null;          // never infer
  if (c.priceLow < 20) return '$';
  if (c.priceLow <= 50) return '$$';
  return '$$$';
}

function idFor(c: RawCandidate): string {
  // The seed's documented per-type key (proven against the 107 fixtures):
  //   • places  -> `seed:google_places|${title}`  (the source column is mere
  //     provenance; even URL-sourced places like SB Biergarten key this way)
  //   • everything else (events) -> `${source_url}|${title}`
  const title = c.title?.trim() ?? '';
  const key = c.type === 'place'
    ? `seed:google_places|${title}`
    : `${c.sourceUrl}|${title}`;
  return uuidv5(key, NS);
}

export function gate(c: RawCandidate): GateResult {
  // --- hard rejects ---
  if (!c.title?.trim()) return { ok: false, reason: 'no_title' };
  const address = c.address ?? (c.venueName ? resolveVenue(c.venueName) : undefined);
  if (!address) return { ok: false, reason: 'no_address', detail: c.venueName ?? '' };
  if (!c.sourceUrl) return { ok: false, reason: 'no_source' };

  // --- THE START-TIME GATE (dated Tier-1 only) ---
  if (requiresStart(c.tier)) {
    if (!hasDeterministicStart(c)) {
      return { ok: false, reason: 'no_start', detail: describeStart(c) };
    }
  }

  // --- REGISTRY-CANDIDATE GATE (§3.2): rhythm must carry a valid schedule ---
  if (c.registryCandidate) {
    const spec = c.recurring?.[0];
    const hasFreq = !!spec?.frequency;
    const hasDay = spec?.day_of_week != null;
    const hasTime = typeof spec?.start_time === 'string' && /^\d{2}:\d{2}$/.test(spec.start_time);
    if (!hasFreq || !hasDay || !hasTime) {
      return {
        ok: false,
        reason: 'registry_incomplete_time',
        detail: !spec ? 'no recurring spec' :
          !hasFreq ? 'missing frequency' :
          !hasDay  ? 'missing day_of_week' :
                     `start_time "${spec?.start_time ?? ''}" is not HH:MM`,
      };
    }
  }

  // --- Tier-3 rule: never a bare place ---
  if (c.tier === 3 && !c.reasonToGo?.trim()) {
    // Reuse the no_address bucket (no 'no_reason' value in DropReason); the detail
    // string disambiguates it in the drop log.
    return { ok: false, reason: 'no_address', detail: 'tier-3 missing reason_to_go' };
  }

  const startISO = hasDeterministicStart(c) ? c.startISO! : null;

  const candidate: Candidate = {
    id: idFor(c),
    type: c.type,
    status: 'needs_review',
    title: c.title.trim(),
    tier: c.tier,
    happening_category: c.category,
    neighborhood: c.neighborhood,
    address,
    lat: c.lat, lng: c.lng,
    price_band: mapPrice(c),
    time_of_day_fit: startISO ? bucketTod(startISO) : tod3Default(c),
    starts_at: startISO,
    ends_at: c.endISO ?? null,
    buy_url: c.buyUrl,
    source_url: c.sourceUrl,
    place_id: c.placeId,
    reason_to_go: c.reasonToGo,
    local_note: c.localNote,
    is_21_plus: c.is21Plus,
    recurring: c.recurring,
    last_confirmed: new Date().toISOString().slice(0, 10),
    start_strategy: c.startStrategy,
  };
  return { ok: true, candidate };
}

// --- helpers (Doc 11 §4 declares these; implemented here for Phase 9) ---------

/**
 * The ONE allowed "lookup": a sourced venue name -> its known street address
 * (deterministic, not invention). Seeded from the 107 rows + well-known venues;
 * returns undefined on miss. The seed rows all carry an address, so this is a
 * safety net for adapters (Phase 10+) that emit a venue name but no address.
 */
const VENUE_ADDRESSES: Record<string, string> = {
  'Santa Barbara Bowl': 'Santa Barbara Bowl, 1122 N. Milpas Street, Santa Barbara, CA 93103',
  'Lobero Theatre': 'Lobero Theatre, 33 E. Canon Perdido St, Santa Barbara, CA 93101',
  'SOhO Restaurant & Music Club': '1221 State St #205, Santa Barbara, CA 93101',
  'The Granada Theatre': '1214 State St, Santa Barbara, CA 93101',
  'Arlington Theatre': '1317 State St, Santa Barbara, CA 93101',
  // Wave 2 venues
  'MOXI, The Wolf Museum of Exploration + Innovation': '125 State St, Santa Barbara, CA 93101',
  'Santa Barbara Museum of Natural History': '2559 Puesta del Sol, Santa Barbara, CA 93105',
  'Santa Barbara Botanic Garden': '1212 Mission Canyon Rd, Santa Barbara, CA 93105',
  'Santa Barbara Museum of Art': '1130 State St, Santa Barbara, CA 93101',
  'Music Academy of the West': '1070 Fairway Rd, Santa Barbara, CA 93108',
  'The Alcazar Theater': '4916 Carpinteria Ave, Carpinteria, CA 93013',
};
export function resolveVenue(name: string): string | undefined {
  return VENUE_ADDRESSES[name.trim()];
}

/** Human string for the drop log, e.g. 'date-only, no clock time'. */
export function describeStart(c: RawCandidate): string {
  if (c.startStrategy === 'none') return 'no deterministic start (prose-only or none)';
  if (!c.startISO) return 'no start value provided';
  if (Number.isNaN(Date.parse(c.startISO))) return `unparseable start: ${c.startISO}`;
  if (!/\d[T ]\d{2}:\d{2}/.test(c.startISO)) return `date-only, no clock time: ${c.startISO}`;
  return `start present but rejected: ${c.startISO}`;
}

/** time_of_day_fit for evergreen places (no start to bucket from). */
export function tod3Default(_c: RawCandidate): Tod[] {
  return ['morning', 'afternoon', 'evening'];
}
