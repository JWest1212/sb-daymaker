// ingest/adapters/sbcountyArts.ts
//
// SB County Arts Commission (sbac.ca.gov) — §9.2. WordPress site with custom post
// types (CPTUI). No Tribe/MEC events API found (confirmed 2026-06-30). Events page
// at /events-calendar/ is server-rendered Gutenberg HTML.
//
// Resolution order:
//   1. Tribe REST (discoverWpEventsRoute) — expected to return 'scrape' or 'ical'
//      since research found no tribe/events namespace.
//   2. WP REST CPT: try /wp-json/wp/v2/event and /wp-json/wp/v2/events (common slugs).
//   3. HTML scrape of /events-calendar/ with JSON-LD extraction.
//
// isInScope() is mandatory — county arts events may include out-of-area venues.
// Tier 1 · arts_theater / community_gathering · Cockpit.
// useManagedScrape: false.

import * as cheerio from 'cheerio';
import type { SourceAdapter, DateWindow } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { isInScope } from './_shared/geoFilter';
import { seedOccasionTags } from './_shared/occasionTags';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';

const BASE = 'https://sbac.ca.gov';
const SOURCE_KEY = 'sbcountyArts';

const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';

async function fetchJsonSilent(url: string): Promise<any[] | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/** Try WP REST CPT endpoints for common 'event' post type slugs. */
async function tryWpCpt(w: DateWindow): Promise<RawCandidate[]> {
  const from = w.fromISO.slice(0, 10);
  const to = w.toISO.slice(0, 10);
  const slugs = ['event', 'events', 'mec_events'];
  for (const slug of slugs) {
    const url = `${BASE}/wp-json/wp/v2/${slug}?after=${from}T00:00:00&before=${to}T23:59:59&per_page=50&orderby=date`;
    const posts = await fetchJsonSilent(url);
    if (!posts?.length) continue;
    const out: RawCandidate[] = [];
    for (const p of posts) {
      // WP REST post: date (local), date_gmt (UTC), link
      const startISO: string | undefined = p?.date_gmt ? `${p.date_gmt}Z` : undefined;
      if (!startISO || !/T\d{2}:\d{2}/.test(startISO)) continue; // need clock time
      const title: string = p?.title?.rendered ?? '';
      if (!title) continue;
      const sourceUrl: string = p?.link ?? `${BASE}/events-calendar/`;
      const cand: RawCandidate = {
        source: SOURCE_KEY,
        title: title.replace(/&amp;/g, '&').replace(/&#8217;/g, "'").trim(),
        venueName: undefined,
        address: undefined,
        tier: 1,
        category: 'arts_theater',
        type: 'event',
        startISO,
        startStrategy: 'structured',
        priceLow: null,
        explicitlyFree: false,
        sourceUrl,
        buyUrl: sourceUrl,
        occasionTags: seedOccasionTags({ category: 'arts_theater', text: title }),
        raw: { id: p?.id, slug: p?.slug },
      };
      if (!isInScope(cand)) continue;
      out.push(cand);
    }
    if (out.length) return out;
  }
  return [];
}

/** HTML scrape of /events-calendar/: extract JSON-LD events embedded in the page. */
async function scrapeCalendarPage(w: DateWindow): Promise<RawCandidate[]> {
  let html: string;
  try {
    html = await fetchHtmlPolite(`${BASE}/events-calendar/`, SOURCE_KEY);
  } catch {
    return [];
  }

  // JSON-LD events on the page
  const ldEvents = extractEvents(html);
  const out: RawCandidate[] = [];
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);

  for (const ev of ldEvents) {
    if (!ev.startDate || !/T\d{2}:\d{2}/.test(ev.startDate)) continue;
    const ts = Date.parse(ev.startDate);
    if (ts < fromTs || ts > toTs) continue;
    if (!ev.name) continue;
    const cand: RawCandidate = {
      source: SOURCE_KEY,
      title: ev.name,
      venueName: ev.locationName,
      address: ev.address,
      tier: 1,
      category: 'community_gathering',
      type: 'event',
      startISO: ev.startDate,
      endISO: ev.endDate,
      startStrategy: 'structured',
      priceLow: ev.offersLow ?? null,
      explicitlyFree: ev.isFree,
      sourceUrl: ev.url ?? `${BASE}/events-calendar/`,
      buyUrl: ev.url ?? `${BASE}/events-calendar/`,
      occasionTags: seedOccasionTags({ category: 'arts_theater', text: ev.name }),
      raw: { name: ev.name },
    };
    if (!isInScope(cand)) continue;
    out.push(cand);
  }

  // If JSON-LD found nothing, try to parse article/entry elements with dates
  if (!out.length) {
    const $ = cheerio.load(html);
    // Look for event links with date context in the surrounding markup
    $('article, .event, .wp-block-group').each((_, el) => {
      const text = $(el).text();
      // Very rough date check — at minimum needs a year
      if (!/20\d{2}/.test(text)) return;
      const linkEl = $(el).find('a[href]').first();
      const href = linkEl.attr('href') ?? '';
      const title = linkEl.text().trim() || $(el).find('h2,h3,h4').first().text().trim();
      if (!title || !href.startsWith('http')) return;
      // Don't add without a clock time — gate will drop it, but let's not even generate
    });
  }

  return out;
}

export const sbcountyArts: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'SB County Arts Commission',
  useManagedScrape: false,
  async fetch(w: DateWindow): Promise<RawCandidate[]> {
    // 1. Check for Tribe REST (expected absent based on research)
    const route = await discoverWpEventsRoute(BASE);
    if (route === 'tribe') {
      return fetchTribeEvents(BASE, w, {
        sourceKey: SOURCE_KEY,
        label: 'SB County Arts Commission',
        venueName: 'SB County Arts Commission',
        address: 'Santa Barbara County, CA',
        tier: 1,
      });
    }

    // 2. Try WP REST CPT endpoints
    const cptResults = await tryWpCpt(w);
    if (cptResults.length) {
      console.log(`[sbcountyArts] WP CPT REST: ${cptResults.length} events`);
      return cptResults;
    }

    // 3. HTML scrape of /events-calendar/ with JSON-LD extraction
    const scraped = await scrapeCalendarPage(w);
    console.log(`[sbcountyArts] HTML scrape: ${scraped.length} events`);
    return scraped;
  },
};
