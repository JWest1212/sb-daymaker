// ingest/adapters/ticketmaster.ts
//
// The free, structured backbone (Doc 11 §5a). Ticketmaster Discovery API exposes
// an exact `dates.start.dateTime` per event -> startStrategy:'structured'. Scoped
// tightly to Santa Barbara by geo + date window; paginated.

import type { SourceAdapter, DateWindow } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';

const BASE = 'https://app.ticketmaster.com/discovery/v2/events.json';
const SB_LATLONG = '34.4208,-119.6982';

/** TM `classifications[0].segment.name` -> our happening_category (Tier-1 values). */
export function classifyTM(e: any): HappeningCategory {
  const seg = (e?.classifications?.[0]?.segment?.name ?? '').toLowerCase();
  const genre = (e?.classifications?.[0]?.genre?.name ?? '').toLowerCase();
  if (seg.includes('music')) return 'live_music';
  if (seg.includes('sports')) return 'sports_outdoors_event';
  if (seg.includes('arts') || seg.includes('theat')) return 'arts_theater';
  if (seg.includes('film')) return 'arts_theater';
  if (genre.includes('food') || genre.includes('wine')) return 'food_drink_event';
  return 'community_gathering';
}

/** TM date is either a precise dateTime (UTC 'Z') or date-only when TBA. We only
 *  trust the precise instant; date-only -> startStrategy:'none' so the gate drops it. */
function tmStart(e: any): { startISO?: string; strategy: 'structured' | 'none' } {
  const dt = e?.dates?.start?.dateTime;            // e.g. '2026-07-09T02:00:00Z'
  const timeTba = e?.dates?.start?.dateTBA || e?.dates?.start?.timeTBA || e?.dates?.start?.noSpecificTime;
  if (dt && !timeTba) return { startISO: dt, strategy: 'structured' };
  return { strategy: 'none' };
}

function venueAddress(venue: any): string | undefined {
  if (!venue) return undefined;
  const parts = [
    venue?.address?.line1,
    venue?.city?.name,
    venue?.state?.stateCode,
    venue?.postalCode,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

export const ticketmaster: SourceAdapter = {
  key: 'ticketmaster',
  label: 'Ticketmaster API',
  async fetch({ fromISO, toISO }: DateWindow): Promise<RawCandidate[]> {
    const key = process.env.TICKETMASTER_API_KEY;
    if (!key) throw new Error('TICKETMASTER_API_KEY not set');

    // TM Discovery requires exactly YYYY-MM-DDTHH:mm:ssZ, no milliseconds.
    const tmDate = (iso: string) => iso.replace(/\.\d{3}Z$/, 'Z');
    const start = tmDate(fromISO);
    const end = tmDate(toISO);

    const out: RawCandidate[] = [];
    const size = 100;
    // Discovery API caps at page*size <= 1000; a 45-day SB window is well under that.
    for (let page = 0; page < 5; page++) {
      const url =
        `${BASE}?apikey=${encodeURIComponent(key)}&latlong=${SB_LATLONG}` +
        `&radius=15&unit=miles&startDateTime=${start}&endDateTime=${end}` +
        `&size=${size}&page=${page}&sort=date,asc`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Ticketmaster ${res.status}: ${await res.text().catch(() => '')}`);
      const json: any = await res.json();
      const events: any[] = json?._embedded?.events ?? [];
      for (const e of events) {
        const venue = e?._embedded?.venues?.[0];
        const { startISO, strategy } = tmStart(e);
        const price = e?.priceRanges?.[0]?.min;
        out.push({
          source: 'ticketmaster',
          title: e?.name,
          venueName: venue?.name,
          address: venueAddress(venue),
          lat: venue?.location ? Number(venue.location.latitude) : undefined,
          lng: venue?.location ? Number(venue.location.longitude) : undefined,
          tier: 1,
          category: classifyTM(e),
          type: 'event',
          startISO,
          startStrategy: strategy,
          priceLow: typeof price === 'number' ? price : null,
          explicitlyFree: false,
          sourceUrl: e?.url,
          buyUrl: e?.url,
          raw: e,
        });
      }
      const totalPages = json?.page?.totalPages ?? 1;
      if (page + 1 >= totalPages) break;
    }
    return out;
  },
};
