// ingest/adapters/newVic.ts
//
// Ensemble Theatre Company at The New Vic (etcsb.org) — §9.4.
// Server-rendered WordPress + MEC (Modern Events Calendar) plugin.
// No AXS links found (confirmed 2026-06-30) — ticket links are venue-direct.
//
// Resolution order:
//   1. MEC REST API: GET /wp-json/mec/v1/events (MEC plugin installed; may be empty)
//   2. Server-detail scrape: fetch season/shows listing → collect show URLs →
//      fetch each detail page for JSON-LD or og:meta date/time.
//
// Tier 1 · arts_theater · seed catch_a_show, arts_culture, date_night.
// useManagedScrape: false.

import * as cheerio from 'cheerio';
import type { SourceAdapter, DateWindow } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { sbISO } from '../tz';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

const BASE = 'https://www.etcsb.org';
const SOURCE_KEY = 'newVic';
const VENUE_NAME = 'The New Vic Theatre';
const VENUE_ADDRESS = 'New Vic Theatre, 33 W Victoria St, Santa Barbara, CA 93101';
const NEIGHBORHOOD = 'downtown' as const;

const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';

/** Try MEC REST endpoint — returns [] if not populated or endpoint absent. */
async function tryMecApi(w: DateWindow): Promise<RawCandidate[]> {
  const from = w.fromISO.slice(0, 10);
  const to = w.toISO.slice(0, 10);
  const url = `${BASE}/wp-json/mec/v1/events?from_date=${from}&to_date=${to}`;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const body: any = await res.json();
    const events: any[] = Array.isArray(body) ? body : (body?.data ?? body?.events ?? []);
    if (!events.length) return [];
    const out: RawCandidate[] = [];
    for (const ev of events) {
      // MEC date fields: date (YYYY-MM-DD), time (HH:MM:SS or HH:MM)
      const dateStr: string = ev?.date ?? ev?.start_date ?? '';
      const timeStr: string = ev?.time ?? ev?.start_time ?? '';
      if (!dateStr || !timeStr || !/^\d{2}:\d{2}/.test(timeStr)) continue; // no clock time
      const [y, mo, d] = dateStr.split('-').map(Number);
      const [h, mi] = timeStr.split(':').map(Number);
      const startISO = sbISO(y, mo, d, h, mi);
      const title: string = ev?.title ?? ev?.name ?? '';
      if (!title) continue;
      out.push({
        source: SOURCE_KEY,
        title,
        venueName: VENUE_NAME,
        address: VENUE_ADDRESS,
        neighborhood: NEIGHBORHOOD,
        tier: 1,
        category: 'arts_theater',
        type: 'event',
        startISO,
        startStrategy: 'structured',
        priceLow: typeof ev?.price === 'number' ? ev.price : null,
        explicitlyFree: false,
        sourceUrl: ev?.url ?? `${BASE}/events/`,
        buyUrl: ev?.url ?? `${BASE}/events/`,
        occasionTags: seedOccasionTags({ category: 'arts_theater', text: title }),
        raw: { id: ev?.id },
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Collect show/event detail URLs from a listing page. */
function collectShowUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    // Match /shows/{slug}, /season/{slug}, /events/{slug}, /production/{slug}
    if (/\/(show|shows|season|events?|production)s?\/[^/#?]+\/?$/.test(href)) {
      const abs = href.startsWith('http') ? href : `${BASE}${href}`;
      seen.add(abs.replace(/\/$/, ''));
    }
  });
  return [...seen];
}

/** Extract start date/time from a show detail page via JSON-LD, then og:meta fallback. */
function parseShowStart(html: string): string | undefined {
  // 1. JSON-LD (schema.org Event)
  const ldEvents = extractEvents(html);
  if (ldEvents.length && ldEvents[0].startDate) return ldEvents[0].startDate;

  // 2. og:description — ETC pages may carry "Opens Month DD, YYYY" or date text
  const descM =
    html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
  if (descM) {
    const desc = descM[1];
    // "Month D(D), YYYY at H:MM PM" or similar
    const m = desc.match(
      /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})(?:[,\s]+at\s+(\d{1,2}):(\d{2})\s*([AP]M))?/i,
    );
    if (m) {
      const MONTHS: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      };
      const mo = MONTHS[m[1].toLowerCase()];
      const d = Number(m[2]);
      const y = Number(m[3]);
      if (mo && d && y && m[4]) {
        let h = Number(m[4]) % 12;
        if (m[6].toUpperCase() === 'PM') h += 12;
        return sbISO(y, mo, d, h, Number(m[5]));
      }
    }
  }
  return undefined;
}

/** Server-detail scrape: listing → detail pages. */
async function scrapeShowDetail(w: DateWindow): Promise<RawCandidate[]> {
  // Try common ETC show listing paths
  const listPaths = ['/shows/', '/season/', '/current-season/', '/whats-on/', '/events/'];
  let listHtml = '';
  for (const path of listPaths) {
    try {
      listHtml = await fetchHtmlPolite(`${BASE}${path}`, SOURCE_KEY);
      if (listHtml.length > 500) break;
    } catch { /* try next */ }
  }
  if (!listHtml) return [];

  const urls = collectShowUrls(listHtml);
  const out: RawCandidate[] = [];
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);

  for (const url of urls) {
    let page: string;
    try { page = await fetchHtmlPolite(url, SOURCE_KEY); }
    catch { continue; }

    const startISO = parseShowStart(page);
    if (startISO) {
      const ts = Date.parse(startISO);
      if (ts < fromTs || ts > toTs) continue;
    }

    const $ = cheerio.load(page);
    const ogTitleM =
      page.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ??
      page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
    const rawTitle = $('h1').first().text().trim() || (ogTitleM?.[1] ?? '');
    const title = rawTitle.replace(/\s*[-|]\s*(ETC|etcsb|New Vic|Ensemble Theatre)\s*$/i, '').trim();
    if (!title) continue;

    // Buy link: look for a "get tickets" link on the page
    const ticketM = page.match(/href="(https?:\/\/[^"]+)"[^>]*>[^<]*(?:ticket|buy|purchase|reserve)/i);
    const buyUrl = ticketM?.[1] ?? url;

    out.push({
      source: SOURCE_KEY,
      title,
      venueName: VENUE_NAME,
      address: VENUE_ADDRESS,
      neighborhood: NEIGHBORHOOD,
      tier: 1,
      category: 'arts_theater',
      type: 'event',
      startISO,
      startStrategy: startISO ? 'server_detail' : 'none',
      priceLow: null,
      explicitlyFree: false,
      sourceUrl: url,
      buyUrl,
      occasionTags: seedOccasionTags({ category: 'arts_theater', text: title }),
      raw: { url },
    });
  }
  return out;
}

export const newVic: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'New Vic Theatre (ETC)',
  useManagedScrape: false,
  async fetch(w: DateWindow): Promise<RawCandidate[]> {
    // 1. Try MEC REST (plugin installed; may be empty)
    const mecResults = await tryMecApi(w);
    if (mecResults.length) {
      console.log(`[newVic] MEC REST: ${mecResults.length} events`);
      return mecResults;
    }
    // 2. Fall back to server-detail scrape
    return scrapeShowDetail(w);
  },
};
