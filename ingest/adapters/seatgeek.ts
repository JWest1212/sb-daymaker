// ingest/adapters/seatgeek.ts
//
// SeatGeek Platform API — Wave 4 backstop (§9.1). Geo-scoped to 15 mi around SB;
// structured UTC datetimes, no scraping. Lowest-priority aggregator — venue-direct
// and Ticketmaster records win in dedupe; SeatGeek fills net-new sports + music gaps.
//
// Requires env var SEATGEEK_CLIENT_ID (free: seatgeek.com/developer).
// Add SEATGEEK_CLIENT_ID as a GitHub Actions repository secret before enabling.
//
// useManagedScrape: false.

import type { SourceAdapter, DateWindow } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { isInScope } from './_shared/geoFilter';
import { seedOccasionTags } from './_shared/occasionTags';

const BASE = 'https://api.seatgeek.com/2/events';
const SB_LAT = 34.4208;
const SB_LON = -119.6982;
const RANGE_MI = 15;

function classifySG(taxonomies: { name: string }[]): HappeningCategory {
  const names = taxonomies.map((t) => t.name.toLowerCase()).join(' ');
  if (names.includes('concert') || names.includes('music')) return 'live_music';
  if (names.includes('sport') || names.includes('mlb') || names.includes('nba') || names.includes('nfl')) return 'sports_outdoors_event';
  if (names.includes('theater') || names.includes('comedy')) return 'arts_theater';
  if (names.includes('film') || names.includes('movie')) return 'arts_theater';
  if (names.includes('family') || names.includes('kids')) return 'community_gathering';
  return 'community_gathering';
}

function venueAddress(v: any): string | undefined {
  const parts = [v?.address, v?.city, v?.state, v?.postal_code].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

export const seatgeek: SourceAdapter = {
  key: 'seatgeek',
  label: 'SeatGeek (SB)',
  useManagedScrape: false,
  async fetch({ fromISO, toISO }: DateWindow): Promise<RawCandidate[]> {
    const clientId = process.env.SEATGEEK_CLIENT_ID;
    if (!clientId) {
      console.log('[seatgeek] SEATGEEK_CLIENT_ID not set — skipping');
      return [];
    }

    // SeatGeek uses datetime_utc (ISO 8601, no TZ suffix) — convert to date-only for the param
    const fromDate = fromISO.slice(0, 10);
    const toDate = toISO.slice(0, 10);

    const out: RawCandidate[] = [];
    const perPage = 100;

    for (let page = 1; page <= 5; page++) {
      const url =
        `${BASE}?client_id=${encodeURIComponent(clientId)}` +
        `&lat=${SB_LAT}&lon=${SB_LON}&range=${RANGE_MI}mi` +
        `&datetime_utc.gte=${fromDate}&datetime_utc.lte=${toDate}` +
        `&per_page=${perPage}&page=${page}`;

      const res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`SeatGeek ${res.status}: ${await res.text().catch(() => '')}`);

      const json: any = await res.json();
      const events: any[] = json?.events ?? [];

      for (const e of events) {
        const venue = e?.venue;
        const startISO = e?.datetime_utc ? `${e.datetime_utc}Z` : undefined; // append Z for UTC
        if (!startISO) continue; // no clock time → drop

        const candidate: RawCandidate = {
          source: 'seatgeek',
          title: e?.title ?? e?.short_title,
          venueName: venue?.name,
          address: venueAddress(venue),
          lat: typeof venue?.lat === 'number' ? venue.lat : undefined,
          lng: typeof venue?.lon === 'number' ? venue.lon : undefined,
          tier: 1,
          category: classifySG(e?.taxonomies ?? []),
          type: 'event',
          startISO,
          startStrategy: 'structured',
          priceLow: typeof e?.stats?.lowest_price === 'number' ? e.stats.lowest_price : null,
          explicitlyFree: false,
          sourceUrl: e?.url,
          buyUrl: e?.url,
          occasionTags: seedOccasionTags({ category: classifySG(e?.taxonomies ?? []), text: e?.title }),
          raw: { id: e?.id },
        };

        if (!isInScope(candidate)) continue; // mandatory geo/online filter

        out.push(candidate);
      }

      const total = json?.meta?.total ?? 0;
      if (page * perPage >= total) break;
    }

    return out;
  },
};
