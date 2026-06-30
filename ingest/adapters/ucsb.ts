// ingest/adapters/ucsb.ts
//
// UCSB campus events via WordPress + Calendarize it! plugin.
//
// DOC MISMATCH (§6.2 says "Localist API"): events.ucsb.edu is NOT a Localist
// instance. It runs WordPress + Calendarize it! v4. The correct endpoint is
// ?rhc_action=get_calendar_events&post_type[]=events. The fetchLocalist() helper
// is NOT used. Code wins over doc.
//
// Robots.txt (confirmed 2026-06-30): Disallow: /wp-admin/ — the API endpoint
// at /?rhc_action=... is the root path, which is not disallowed.
//
// NOTE: events.ucsb.edu currently has very few events (summer break, academic
// calendar). The adapter is correct; it will return non-empty results once UCSB
// posts their fall/winter academic-year events.

import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { sbISO } from '../tz';
import { seedOccasionTags } from './_shared/occasionTags';
import { isInScope } from './_shared/geoFilter';

const BASE = 'https://events.ucsb.edu';
const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';

// Academic/administrative noise — drop events matching these patterns.
const DENY: RegExp[] = [
  /\bexam\b/i,
  /dissertation defense/i,
  /faculty meeting/i,
  /\badvising\b/i,
  /commencement/i,
  /orientation/i,
  /\btown hall\b/i,
  /staff (meeting|training)/i,
];

/**
 * Parse Calendarize it! local datetime "YYYY-MM-DD HH:mm:ss" → SB-offset ISO.
 * Returns null if the string is missing or malformed.
 */
export function parseRhcDateTime(dt: string | undefined): string | null {
  if (!dt) return null;
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})/);
  if (!m) return null;
  return sbISO(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

function classifyUcsb(title: string, taxonomyNames: string[]): HappeningCategory {
  const hay = [title, ...taxonomyNames].join(' ').toLowerCase();
  if (/music|concert|recital|jazz|band|orchestra|choir|ensemble/.test(hay)) return 'live_music';
  if (/theat|dance|film|perform|lecture|talk|exhib|gallery|art|comedy/.test(hay)) return 'arts_theater';
  if (/food|culinary|wine|beer/.test(hay)) return 'food_drink_event';
  if (/sport|race|athlet|fitness|outdoor|hike/.test(hay)) return 'sports_outdoors_event';
  if (/festival|fair|market/.test(hay)) return 'festival_fair';
  return 'community_gathering';
}

export const ucsb: SourceAdapter = {
  key: 'ucsb',
  label: 'UCSB Campus Events',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    const from = w.fromISO.slice(0, 10);
    const to = w.toISO.slice(0, 10);
    const url = `${BASE}/?rhc_action=get_calendar_events&post_type[]=events&start=${from}&end=${to}`;

    let body: { R?: string; EVENTS?: unknown[] };
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, 'accept': 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`UCSB calendar API ${res.status}`);
      body = await res.json();
    } catch (err) {
      throw new Error(`ucsb: fetch failed — ${(err as Error).message}`);
    }

    const events: any[] = Array.isArray(body?.EVENTS) ? body.EVENTS : [];
    const out: RawCandidate[] = [];

    for (const ev of events) {
      const title: string = String(ev?.title ?? '').trim();
      if (!title) continue;

      // Deny-keyword filter (academic noise)
      if (DENY.some((rx) => rx.test(title))) continue;

      const startISO = parseRhcDateTime(ev?.start ?? undefined) ?? undefined;
      const endISO = parseRhcDateTime(ev?.end ?? undefined) ?? undefined;

      // Pull taxonomy names for category classification
      const taxEntries: any[] = Object.values(ev?.taxonomy ?? {}).flat();
      const taxonomyNames: string[] = taxEntries.map((t: any) => String(t?.name ?? ''));

      const category = classifyUcsb(title, taxonomyNames);

      // Geo-filter: if coordinates are present, confirm they're in the SB region.
      // UCSB campus is in Isla Vista (in-scope); off-campus extension venues may not be.
      const lat = ev?.lat ? Number(ev.lat) : undefined;
      const lng = ev?.lng ? Number(ev.lng) : undefined;
      if (lat && lng && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        if (!isInScope({ lat, lng })) continue;
      }

      const sourceUrl: string = ev?.url ?? `${BASE}/events/${ev?.ID ?? ''}`;
      const venueName: string = ev?.location ?? 'UCSB Campus';

      out.push({
        source: 'ucsb',
        title,
        venueName,
        address: venueName === 'UCSB Campus'
          ? 'University of California, Santa Barbara, CA 93106'
          : `${venueName}, UCSB, Santa Barbara, CA 93106`,
        neighborhood: 'goleta',
        tier: 1,
        category,
        type: 'event',
        startISO,
        endISO,
        startStrategy: startISO ? 'structured' : 'none',
        priceLow: null,
        explicitlyFree: false,
        sourceUrl,
        buyUrl: sourceUrl,
        occasionTags: seedOccasionTags({ category, text: title }),
        raw: { id: ev?.ID },
      });
    }

    return out;
  },
};
