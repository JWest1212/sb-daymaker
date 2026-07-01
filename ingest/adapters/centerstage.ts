// ingest/adapters/centerstage.ts
//
// Center Stage Theater (Paseo Nuevo, SB) — server-detail scrape (§8.5).
// ARTdynamix CMS by Dream Warrior Group. Not WordPress/Squarespace/Wix.
//
// Approach: GET /shows, parse hidden <input id="allShows"> JSON array.
// Fields per show: id, long_title, event_date, event_start_time, url.
// startStrategy: 'server_detail' (structured datetime from JSON baked into HTML).
//
// Ticketing: OvationTix (ci.ovationtix.com) — NOT AXS or Ticketmaster.
// The show detail pages at /show-details/{id} have OvationTix ticket links.
// buyUrl = sourceUrl (detail page) since OvationTix link requires detail page fetch.
//
// useManagedScrape: false. Robots.txt checked at runtime.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { seedOccasionTags } from './_shared/occasionTags';
import { sbISO } from '../tz';

const BASE = 'https://centerstagetheater.org';
const SOURCE_KEY = 'centerstage';
const VENUE_NAME = 'Center Stage Theater';
const VENUE_ADDRESS = '751 Paseo Nuevo, Santa Barbara, CA 93101';

// Month names for parsing "Month D, YYYY" date strings
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

interface ARTdynamixShow {
  id?: number | string;
  long_title?: string;
  title?: string;
  event_date?: string;   // "YYYY-MM-DD" | "M/D/YYYY" | "Month D, YYYY"
  event_start_time?: string; // "HH:MM:SS" | "H:MM AM/PM" | "HH:MM"
  url?: string;
  link?: string;
}

/** Parse event_date + event_start_time from ARTdynamix JSON into an SB-local ISO string. */
function parseShowDateTime(dateStr: string, timeStr: string): string | null {
  let year: number, month: number, day: number;

  // ISO date: "2026-08-15"
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else {
    // US slash: "8/15/2026"
    const us = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) {
      month = Number(us[1]); day = Number(us[2]); year = Number(us[3]);
    } else {
      // Text: "August 15, 2026"
      const txt = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
      if (!txt) return null;
      month = MONTHS[txt[1].toLowerCase()];
      if (!month) return null;
      day = Number(txt[2]); year = Number(txt[3]);
    }
  }

  // 24h: "19:30:00" or "19:30"
  const t24 = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (t24) return sbISO(year, month, day, Number(t24[1]), Number(t24[2]));

  // 12h: "7:30 PM" or "7:30pm"
  const t12 = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (t12) {
    let hour = Number(t12[1]) % 12;
    if (t12[3].toUpperCase() === 'PM') hour += 12;
    return sbISO(year, month, day, hour, Number(t12[2]));
  }

  return null;
}

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/concert|music|jazz|rock|pop|folk|band|symphony|orchestra/.test(t)) return 'live_music';
  if (/dance|ballet|flamenco|tango/.test(t)) return 'arts_theater';
  if (/comedy|stand.?up/.test(t)) return 'arts_theater';
  if (/kids|family|children|youth/.test(t)) return 'community_gathering';
  return 'arts_theater';
}

/** Parse the hidden #allShows JSON from the /shows listing page. */
async function fetchShowsJson(): Promise<ARTdynamixShow[]> {
  const html = await fetchHtmlPolite(`${BASE}/shows`, SOURCE_KEY);
  const $ = cheerio.load(html);

  const raw = ($('#allShows').attr('value') ?? '').trim();
  if (!raw) return [];

  try {
    // ARTdynamix may HTML-escape the JSON inside the value attribute
    const unescaped = raw
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    return JSON.parse(unescaped) as ARTdynamixShow[];
  } catch (err) {
    console.warn(`[centerstage] Failed to parse #allShows JSON: ${err}`);
    return [];
  }
}

export const centerstage: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Center Stage Theater',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    const fromTs = Date.parse(w.fromISO);
    const toTs = Date.parse(w.toISO);
    const out: RawCandidate[] = [];

    let shows: ARTdynamixShow[];
    try {
      shows = await fetchShowsJson();
    } catch (err) {
      console.warn(`[centerstage] /shows fetch failed: ${err}`);
      return [];
    }

    for (const show of shows) {
      const rawTitle = String(show.long_title ?? show.title ?? '').trim();
      const title = rawTitle.replace(/\s*[-|]\s*Center Stage Theatre?\s*$/i, '').trim();
      if (!title) continue;

      const dateStr = String(show.event_date ?? '').trim();
      const timeStr = String(show.event_start_time ?? '').trim();
      if (!dateStr || !timeStr) continue;

      const startISO = parseShowDateTime(dateStr, timeStr);
      if (!startISO) continue;

      const ts = Date.parse(startISO);
      if (ts < fromTs || ts > toTs) continue;

      const relUrl = String(show.url ?? show.link ?? `/show-details/${show.id ?? ''}`).trim();
      const sourceUrl = relUrl.startsWith('http') ? relUrl : `${BASE}${relUrl}`;

      const category = classifyTitle(title);
      out.push({
        source: SOURCE_KEY,
        title,
        venueName: VENUE_NAME,
        address: VENUE_ADDRESS,
        neighborhood: 'downtown',
        tier: 1,
        category,
        type: 'event',
        startISO,
        startStrategy: 'server_detail',
        priceLow: null,
        explicitlyFree: false,
        sourceUrl,
        buyUrl: sourceUrl,  // OvationTix link is on the detail page
        occasionTags: seedOccasionTags({ category, text: title }),
        raw: { id: show.id },
      });
    }

    return out;
  },
};
