// ingest/adapters/lobero.ts
//
// Lobero Theatre, server-detail scrape (§6.1). Collects event URLs from the
// monthly calendar listing, then fetches each detail page. The og:description
// meta tag carries "Weekday, Month D, YYYY at H:MM AM/PM", a deterministic,
// year-bearing start → startStrategy:'server_detail'. No JSON-LD Event type on
// detail pages (confirmed 2026-06-30). buyUrl → AXS (venue-direct scrape rule).
//
// Robots.txt (confirmed 2026-06-30): Disallow: (empty = allow all). Crawl-delay: 10.
// We honor the crawl-delay via fetchHtmlPolite's per-source rate limiter.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { sbISO } from '../tz';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { seedOccasionTags } from './_shared/occasionTags';

const ORIGIN = 'https://www.lobero.org';
const LISTING = `${ORIGIN}/whats-on/monthly-calendar/`;
const VENUE_ADDRESS = 'Lobero Theatre, 33 E Canon Perdido St, Santa Barbara, CA 93101';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Parse the og:description time string: "Monday, October 12, 2026 at 7:30 PM"
 * Returns ISO with SB local offset, or null.
 */
export function parseLoberoDesc(desc: string): string | null {
  // Accepts "Weekday, Month D, YYYY at H:MM AM/PM" (spaces around "at" are flexible)
  const m = desc.match(
    /\w+,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M)/i,
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  let hour = Number(m[4]) % 12;
  if (m[6].toUpperCase() === 'PM') hour += 12;
  return sbISO(Number(m[3]), month, Number(m[2]), hour, Number(m[5]));
}

/** Collect all /events/{slug} URLs from the listing page, de-duplicated. */
export function extractLoberoEventUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/\/events\/[^/]+\/?$/.test(href)) seen.add(href.replace(/\/$/, '/'));
  });
  // Normalize to absolute URLs
  return [...seen].map((h) => (h.startsWith('http') ? h : `${ORIGIN}${h}`));
}

export const lobero: SourceAdapter = {
  key: 'lobero',
  label: 'Lobero Theatre',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    const listHtml = await fetchHtmlPolite(LISTING, 'lobero');
    const urls = extractLoberoEventUrls(listHtml);
    const out: RawCandidate[] = [];

    const fromTs = Date.parse(w.fromISO);
    const toTs = Date.parse(w.toISO);

    for (const url of urls) {
      let page: string;
      try { page = await fetchHtmlPolite(url, 'lobero'); }
      catch { continue; }

      // og:description carries "Weekday, Month D, YYYY at H:MM AM/PM"
      const descM = page.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
        ?? page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
      const startISO = descM ? parseLoberoDesc(descM[1]) ?? undefined : undefined;

      // Skip events outside our window
      if (startISO) {
        const ts = Date.parse(startISO);
        if (ts < fromTs || ts > toTs) continue;
      }

      // Title from og:title (strip " - Lobero Theatre" suffix if present)
      const titleM = page.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
        ?? page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
      const rawTitle = titleM?.[1] ?? '';
      const title = rawTitle.replace(/\s*[-|]\s*Lobero Theatre\s*$/i, '').trim();
      if (!title) continue;

      // Buy URL: first AXS link on the page
      const axsM = page.match(/href="(https:\/\/www\.axs\.com\/[^"]+)"/i);
      const buyUrl = axsM?.[1] ?? url;

      out.push({
        source: 'lobero',
        title,
        venueName: 'Lobero Theatre',
        address: VENUE_ADDRESS,
        neighborhood: 'downtown',
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
  },
};
