// ingest/adapters/newVic.ts
//
// Ensemble Theatre Company at The New Vic (etcsb.org), §9.4.
// Server-rendered WordPress + MEC plugin (currently empty).
//
// Confirmed structure (2026-07-01):
//   Season listing: /whats-on/season-2026-2027/
//   Production detail: /production/{slug}/
//   Each detail page carries multiple JSON-LD Event blocks, one per performance
//   with a full ISO startDate (e.g. "2026-07-31T13:00:00-07:00") and an
//   offers.url pointing to store.ensembletheatre.com (AXS-powered venue store).
//
// Resolution order:
//   1. MEC REST (kept in case it becomes populated, currently returns [])
//   2. Season listing → /production/{slug}/ detail pages → JSON-LD per performance
//
// Tier 1 · arts_theater · seed catch_a_show, arts_culture, date_night.
// useManagedScrape: false.

import type { SourceAdapter, DateWindow } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

const BASE = 'https://etcsb.org';
const SEASON_LISTING = `${BASE}/whats-on/season-2026-2027/`;
const SOURCE_KEY = 'newVic';
const VENUE_NAME = 'New Vic Theatre';
const VENUE_ADDRESS = '33 W Victoria St, Santa Barbara, CA 93101';
const NEIGHBORHOOD = 'downtown' as const;

const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';

/** Try MEC REST, returns [] if empty or absent (currently always []). */
async function tryMecApi(w: DateWindow): Promise<RawCandidate[]> {
  const from = w.fromISO.slice(0, 10);
  const to = w.toISO.slice(0, 10);
  try {
    const res = await fetch(
      `${BASE}/wp-json/mec/v1/events?from_date=${from}&to_date=${to}`,
      { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return [];
    const body: any = await res.json();
    const events: any[] = Array.isArray(body) ? body : (body?.data ?? body?.events ?? []);
    if (!events.length) return [];
    // MEC populated: build candidates (same structure as JSON-LD path below)
    const out: RawCandidate[] = [];
    for (const ev of events) {
      const dateStr: string = ev?.date ?? ev?.start_date ?? '';
      const timeStr: string = ev?.time ?? ev?.start_time ?? '';
      if (!dateStr || !/^\d{2}:\d{2}/.test(timeStr)) continue;
      const startISO = `${dateStr}T${timeStr}`;
      const title: string = ev?.title ?? ev?.name ?? '';
      if (!title) continue;
      out.push({
        source: SOURCE_KEY, title,
        venueName: VENUE_NAME, address: VENUE_ADDRESS, neighborhood: NEIGHBORHOOD,
        tier: 1, category: 'arts_theater', type: 'event',
        startISO, startStrategy: 'structured',
        priceLow: typeof ev?.price === 'number' ? ev.price : null, explicitlyFree: false,
        sourceUrl: ev?.url ?? SEASON_LISTING, buyUrl: ev?.url ?? SEASON_LISTING,
        occasionTags: seedOccasionTags({ category: 'arts_theater', text: title }),
        raw: { id: ev?.id },
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Collect /production/{slug} URLs from the season listing page. */
function collectProductionUrls(html: string): string[] {
  const seen = new Set<string>();
  // Absolute URLs on the same domain
  const absRx = /href="(https?:\/\/(?:www\.)?etcsb\.org\/production\/[^"#?]+)/g;
  // Relative URLs
  const relRx = /href="(\/production\/[^"#?]+)/g;
  let m: RegExpExecArray | null;
  while ((m = absRx.exec(html)) !== null) seen.add(m[1].replace(/\/$/, ''));
  while ((m = relRx.exec(html)) !== null) seen.add(`${BASE}${m[1]}`.replace(/\/$/, ''));
  return [...seen];
}

/** Extract show title from og:title or h1. */
function parseTitle(html: string): string {
  const ogM =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
  const raw = ogM?.[1] ?? '';
  return raw.replace(/\s*[-|]\s*(ETC|etcsb|New Vic|Ensemble Theatre.*?)$/i, '').trim();
}

/** Season listing → production detail pages → one candidate per JSON-LD Event block. */
async function scrapeByProduction(w: DateWindow): Promise<RawCandidate[]> {
  let listHtml: string;
  try {
    listHtml = await fetchHtmlPolite(SEASON_LISTING, SOURCE_KEY);
  } catch {
    return [];
  }

  const productionUrls = collectProductionUrls(listHtml);
  if (!productionUrls.length) return [];

  const out: RawCandidate[] = [];
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);

  for (const url of productionUrls) {
    let html: string;
    try { html = await fetchHtmlPolite(url, SOURCE_KEY); }
    catch { continue; }

    const pageTitle = parseTitle(html);
    const ldEvents = extractEvents(html);

    for (const ev of ldEvents) {
      if (!ev.startDate) continue;
      const ts = Date.parse(ev.startDate);
      if (ts < fromTs || ts > toTs) continue;

      // JSON-LD name is the show title; fall back to og:title
      const title = ev.name?.trim() || pageTitle;
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
        startISO: ev.startDate,
        endISO: ev.endDate ?? undefined,
        startStrategy: 'structured',
        priceLow: ev.offersLow ?? null,
        explicitlyFree: ev.isFree ?? false,
        sourceUrl: url,
        buyUrl: ev.url ?? url, // store.ensembletheatre.com per-performance link
        occasionTags: seedOccasionTags({ category: 'arts_theater', text: title }),
        raw: { productionUrl: url, startDate: ev.startDate },
      });
    }
  }

  return out;
}

export const newVic: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'New Vic Theatre (ETC)',
  useManagedScrape: false,
  async fetch(w: DateWindow): Promise<RawCandidate[]> {
    const mecResults = await tryMecApi(w);
    if (mecResults.length) {
      console.log(`[newVic] MEC REST: ${mecResults.length} events`);
      return mecResults;
    }
    return scrapeByProduction(w);
  },
};
