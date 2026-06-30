// ingest/adapters/moxi.ts
//
// MOXI Museum of Exploration and Innovation — WP Tribe REST or iCal (§7.2).
// Build doc constraint: "MOXI via feed (no scrape)" → no HTML fallback. If both
// the Tribe REST endpoint and the iCal URL fail the adapter throws so run.ts marks
// the source_run ok=false, which surfaces in SourceHealth as a warning to the founder.
//
// moxi.org runs WordPress + The Events Calendar; Tribe REST is the primary route.
// Fallback: /events/?ical=1 (standard TEC iCal export).
// useManagedScrape: false — no Scrapfly.
//
// Robots.txt: checked at runtime via fetchHtmlPolite (not used here, but
// fetchTribeEvents/parseIcsFeed use plain fetch with UA header, which is sufficient).

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';
import { parseIcsFeed } from './_shared/ics';

const BASE = 'https://moxi.org';
const SOURCE_KEY = 'moxi';
const VENUE_NAME = 'MOXI, The Wolf Museum of Exploration + Innovation';
const VENUE_ADDRESS = '125 State St, Santa Barbara, CA 93101';

export const moxi: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'MOXI Museum',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    // 1. WP Tribe REST (primary — build doc: "MOXI via feed")
    const route = await discoverWpEventsRoute(BASE).catch(() => 'ical' as const);
    if (route === 'tribe') {
      try {
        return await fetchTribeEvents(BASE, w, {
          sourceKey: SOURCE_KEY,
          label: 'MOXI Museum',
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'waterfront',
          tier: 1,
        });
      } catch { /* fall through to iCal */ }
    }

    // 2. iCal (standard TEC export — "MOXI via feed" constraint: no scrape fallback)
    for (const icalUrl of [`${BASE}/events/?ical=1`, `${BASE}/calendar/?ical=1`]) {
      try {
        return await parseIcsFeed(icalUrl, w, {
          sourceKey: SOURCE_KEY,
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'waterfront',
          category: 'community_gathering',
          tier: 1,
        });
      } catch { /* try next URL */ }
    }

    // Per build doc, MOXI must run via feed — throw rather than silently return empty.
    throw new Error('moxi: both Tribe REST and iCal feeds unavailable');
  },
};
