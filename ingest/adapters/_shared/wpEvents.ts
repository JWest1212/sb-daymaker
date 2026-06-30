// ingest/adapters/_shared/wpEvents.ts
//
// WordPress / The Events Calendar (tribe) discovery + fetcher. Many SB venue
// sites run WordPress. Resolution order:
//   1. Check /wp-json/ for tribe/events/v1 namespace → structured REST (best)
//   2. Fall back to /wp-json/wp/v2/{type} custom post type
//   3. Fall back to /events/?ical=1 (see ics.ts)
//   4. Fall back to server-detail HTML scrape (per-adapter)
// Tribe REST returns ISO UTC times → startStrategy:'structured'. (§2.5)

import type { RawCandidate, HappeningCategory, Neighborhood } from '../../../packages/shared/types';
import type { DateWindow } from '../types';
import { seedOccasionTags } from './occasionTags';

export type WpRoute = 'tribe' | 'cpt' | 'ical' | 'scrape';

const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`fetchJson ${res.status}: ${url}`);
  return res.json();
}

/** Inspect /wp-json/ to determine the best events route for this host. */
export async function discoverWpEventsRoute(base: string): Promise<WpRoute> {
  const rootUrl = `${base.replace(/\/$/, '')}/wp-json/`;
  try {
    const root = await fetchJson(rootUrl) as any;
    const namespaces: string[] = root?.namespaces ?? [];
    if (namespaces.some((n) => n.startsWith('tribe/events'))) return 'tribe';
    // Look for a custom post type with 'events' or 'event' in the namespace
    if (namespaces.some((n) => /event/i.test(n))) return 'cpt';
    return 'ical';
  } catch {
    return 'scrape';
  }
}

function classifyTribeEvent(ev: any): HappeningCategory {
  const cats = ((ev?.categories ?? []) as any[]).map((c: any) =>
    String(c?.name ?? '').toLowerCase(),
  ).join(' ');
  const title = String(ev?.title?.rendered ?? '').toLowerCase();
  const hay = `${cats} ${title}`;
  if (/music|concert|band|jazz|symphony|recital/.test(hay)) return 'live_music';
  if (/theat|dance|film|gallery|art|comedy/.test(hay)) return 'arts_theater';
  if (/food|wine|beer|taste|culinary/.test(hay)) return 'food_drink_event';
  if (/sport|run|hike|race|fitness|yoga/.test(hay)) return 'sports_outdoors_event';
  if (/festival|fair|market/.test(hay)) return 'festival_fair';
  return 'community_gathering';
}

/**
 * Fetch events from a WordPress + The Events Calendar (tribe) REST endpoint.
 * Returns RawCandidates with structured ISO times (no inference).
 */
export async function fetchTribeEvents(
  base: string,
  w: DateWindow,
  opts: {
    sourceKey: string;
    label: string;
    venueName: string;
    address: string;
    neighborhood?: Neighborhood;
    tier?: 1 | 2;
  },
): Promise<RawCandidate[]> {
  const root = base.replace(/\/$/, '');
  const out: RawCandidate[] = [];
  const from = w.fromISO.slice(0, 10);
  const to = w.toISO.slice(0, 10);

  for (let page = 1; page <= 10; page++) {
    const url =
      `${root}/wp-json/tribe/events/v1/events` +
      `?start_date=${from}&end_date=${to}&per_page=50&page=${page}`;
    let body: any;
    try {
      body = await fetchJson(url);
    } catch {
      break;
    }
    const events: any[] = body?.events ?? [];
    if (!events.length) break;

    for (const ev of events) {
      const startISO: string | undefined = ev?.utc_start_date
        ? ev.utc_start_date.replace(' ', 'T') + 'Z'
        : undefined;
      const endISO: string | undefined = ev?.utc_end_date
        ? ev.utc_end_date.replace(' ', 'T') + 'Z'
        : undefined;
      const title: string = ev?.title?.rendered ?? ev?.title ?? '';
      const sourceUrl: string = ev?.url ?? `${root}/events/${ev?.slug ?? ''}`;
      const price = parseFloat(ev?.cost ?? '');
      const category = classifyTribeEvent(ev);
      out.push({
        source: opts.sourceKey,
        title,
        venueName: opts.venueName,
        address: opts.address,
        neighborhood: opts.neighborhood,
        tier: opts.tier ?? 1,
        category,
        type: 'event',
        startISO,
        endISO,
        startStrategy: startISO ? 'structured' : 'none',
        priceLow: Number.isFinite(price) ? price : null,
        explicitlyFree: Number.isFinite(price) && price === 0,
        sourceUrl,
        buyUrl: sourceUrl,
        occasionTags: seedOccasionTags({ category, text: title }),
        raw: { id: ev?.id, slug: ev?.slug },
      } as RawCandidate);
    }

    const totalPages = Math.ceil((body?.total ?? events.length) / 50);
    if (page >= totalPages) break;
  }
  return out;
}
