// ingest/adapters/botanicGarden.ts
//
// Santa Barbara Botanic Garden — WP Tribe REST → iCal → scrape (§7.2).
// Also emits a Tier-3 scenic_chill spot for the garden grounds (evergreen).
//
// sbbotanicgarden.org — Robots.txt checked at runtime. useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';
import { parseIcsFeed } from './_shared/ics';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

const BASE = 'https://www.sbbotanicgarden.org';
const SOURCE_KEY = 'botanicGarden';
const VENUE_NAME = 'Santa Barbara Botanic Garden';
const VENUE_ADDRESS = '1212 Mission Canyon Rd, Santa Barbara, CA 93105';

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/hike|walk|tour|trail|plant|nature|garden|wildflower/.test(t)) return 'sports_outdoors_event';
  if (/family|kids|children|youth/.test(t)) return 'community_gathering';
  if (/lecture|talk|class|workshop/.test(t)) return 'arts_theater';
  return 'community_gathering';
}

async function scrapeEvents(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);
  const out: RawCandidate[] = [];

  let listHtml = '';
  for (const path of ['/events/', '/calendar/', '/programs/']) {
    try {
      listHtml = await fetchHtmlPolite(`${BASE}${path}`, SOURCE_KEY);
      break;
    } catch { /* try next */ }
  }
  if (!listHtml) return [];

  const seen = new Set<string>();
  for (const m of listHtml.matchAll(/href="([^"]*\/(event|events|program)s?\/[^"#?]+)"/gi)) {
    const href = m[1];
    seen.add((href.startsWith('http') ? href : `${BASE}${href}`).replace(/\/$/, ''));
  }

  for (const url of seen) {
    let page: string;
    try { page = await fetchHtmlPolite(url, SOURCE_KEY); }
    catch { continue; }

    const [ldEv] = extractEvents(page);
    const startISO: string | undefined = ldEv?.startDate ?? undefined;
    if (!startISO) continue;

    const ts = Date.parse(startISO);
    if (ts < fromTs || ts > toTs) continue;

    const titleM = page.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      ?? page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
    const rawTitle = titleM?.[1] ?? ldEv?.name ?? '';
    const title = rawTitle.replace(/\s*[-|]\s*Santa Barbara Botanic Garden\s*$/i, '').trim();
    if (!title) continue;

    const category = classifyTitle(title);
    out.push({
      source: SOURCE_KEY,
      title,
      venueName: VENUE_NAME,
      address: VENUE_ADDRESS,
      neighborhood: 'mission_canyon',
      tier: 1,
      category,
      type: 'event',
      startISO,
      endISO: ldEv?.endDate ?? undefined,
      startStrategy: 'structured',
      priceLow: ldEv?.offersLow ?? null,
      explicitlyFree: ldEv?.isFree ?? false,
      sourceUrl: url,
      buyUrl: url,
      occasionTags: seedOccasionTags({ category, text: title }),
      raw: { url },
    });
  }
  return out;
}

const GARDEN_SPOT: RawCandidate = {
  source: SOURCE_KEY,
  title: VENUE_NAME,
  venueName: VENUE_NAME,
  address: VENUE_ADDRESS,
  neighborhood: 'mission_canyon',
  tier: 3,
  category: 'scenic_chill',
  type: 'place',
  startStrategy: 'none',
  priceLow: null,
  explicitlyFree: false,
  sourceUrl: BASE,
  buyUrl: BASE,
  reasonToGo: '78 acres of California native plant landscapes in Mission Canyon — a living museum with seasonal wildflowers, riparian creekside trails, and sweeping mountain views.',
  occasionTags: seedOccasionTags({ category: 'scenic_chill' }),
  raw: {},
};

export const botanicGarden: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'SB Botanic Garden',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    let events: RawCandidate[] = [];

    const route = await discoverWpEventsRoute(BASE).catch(() => 'scrape' as const);
    if (route === 'tribe') {
      try {
        events = await fetchTribeEvents(BASE, w, {
          sourceKey: SOURCE_KEY,
          label: 'SB Botanic Garden',
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'mission_canyon',
          tier: 1,
        });
      } catch { /* fall through */ }
    }

    if (!events.length) {
      for (const icalUrl of [`${BASE}/events/?ical=1`, `${BASE}/calendar/?ical=1`]) {
        try {
          events = await parseIcsFeed(icalUrl, w, {
            sourceKey: SOURCE_KEY,
            venueName: VENUE_NAME,
            address: VENUE_ADDRESS,
            neighborhood: 'mission_canyon',
            category: 'sports_outdoors_event',
            tier: 1,
          });
          if (events.length) break;
        } catch { /* try next */ }
      }
    }

    if (!events.length) {
      events = await scrapeEvents(w);
    }

    return [...events, GARDEN_SPOT];
  },
};
