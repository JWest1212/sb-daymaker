# 16 — SB Daymaker · Data-Source Build Runbook

**For:** Claude Code (autonomous execution in VS Code)
**Paired with:** `15_SBDaymaker_Data_Source_Expansion_v3.html` (the catalogue) · `17_SBDaymaker_Data_Source_ClickGuide.html` (the founder's non-code steps)
**Date:** 2026-06-30
**Status:** Approved to build. Comprehensive scope, executed **wave by wave with a hard stop at each checkpoint.**

---

## 0. How to drive this document

1. **Code is truth; `CLAUDE.md` is the contract.** Before writing anything, read the actual repo: the `SourceAdapter` interface, the existing adapters (`ticketmaster`, `soho`, `independent`, `citysb`, `registry`, `submission`), `gate.ts`, `dedupe.ts`, `enrich.ts`, `land.ts`, the things schema, and `recurringRegistry.ts`. **If any path, type, or enum in this document disagrees with the code, the code wins — flag the mismatch in your summary and do not silently "fix" the code to match this doc.** Paths below (`worker/sources/…`) are the expected convention; map them to the real tree.
2. **Build one wave, then stop.** Each wave ends with a **Checkpoint** (§11). Run the nightly worker, read `source_runs` and `ingest_drops`, confirm the acceptance criteria, and report before starting the next wave. Do not batch all four waves in one pass.
3. **Reuse, don't reinvent.** Every new scrape adapter follows the existing `soho` server-detail pattern. Every new API/feed adapter follows the existing `ticketmaster`/`citysb` pattern. Shared logic goes in `worker/sources/_shared/` (§2) so adapters stay thin.
4. **Net-new only.** The eight previously-planned adapters are assumed handled. This document adds the sources in the v3 catalogue and nothing else.

---

## 1. Non-negotiable founder direction (do not re-open)

These were decided across prior sessions and the v3 cost verification. Treat them as fixed inputs, not design space.

- **Free routes only. Scrapfly is break-glass, off by default.** Every source here resolves to an official API, a published iCal/RSS feed, or a server-rendered page a plain `fetch` can read. Each scrape adapter sets `useManagedScrape: false`. The managed-scrape path stays wired but is invoked **only** as a per-source fallback if a direct fetch starts returning blocks/empties (see `fetchHtml`, §2.9). Do not route any new source through Scrapfly preemptively.
- **Venue-direct, never AXS-direct.** SB Bowl, Lobero, Granada, Arlington (and the other theaters) are scraped from **their own websites**; the ticket link becomes `buyUrl` (which may point to AXS). Do not attempt to query AXS as an API or scrape `axs.com` — it has no public API and active anti-bot.
- **Facts only; the model writes prose, never copies it.** Adapters carry structured fields (title, time, venue, price, URL). The nightly `enrich` step writes the blurb and confirms tags. **No adapter may copy a source's description text into `reasonToGo`/`localNote`, and no step may invent or guess a date/time.** If a time isn't deterministically available, drop the candidate (next bullet).
- **Gate strictness is absolute.** Tier-1 and Tier-2 candidates require a **deterministic clock time**. Date-only, "TBD," or prose-time candidates are dropped and logged to `ingest_drops`. This applies equally to the new recurring-rhythm path: a registry candidate must carry a deterministic day-of-week **and** clock time or it drops.
- **Trust rule.** None of this touches ranking. The ranker never reads sponsor status; nothing in this build changes that.
- **No end-user accounts. Batch AI only.** Nothing here creates per-request model calls or user auth. Enrichment runs in the existing nightly batch.
- **`recurringRegistry.ts` stays a founder-maintained hardcoded file.** Registry-bound rhythms are **not** written to a database and **not** auto-published. They land in the cockpit for review; on approval the cockpit emits a **ready-to-paste TypeScript snippet** the founder adds to `recurringRegistry.ts` (§3). No schema migration.

---

## 2. Shared helpers (build these first, in `worker/sources/_shared/`)

Build and unit-test these before any Wave 1 adapter. Every adapter imports from here.

### 2.1 `geoFilter.ts` — in-scope relevance
Single source of truth for "is this in our four cities?" Used by every aggregator and any broad source.

```ts
// Returns true if the candidate is an in-person event at a venue within
// Santa Barbara, Goleta, Montecito, or Carpinteria.
export const IN_SCOPE_CITIES = ['santa barbara','goleta','montecito','carpinteria','summerland','isla vista'];
export const IN_SCOPE_ZIPS = ['93101','93103','93105','93108','93109','93110','93111','93117','93013','93014','93067'];
// Rough bounding box (fallback when only lat/lng is known): Carpinteria ↔ Goleta coast.
const BBOX = { latMin: 34.36, latMax: 34.52, lngMin: -120.20, lngMax: -119.45 };

const DENY = [/\bonline\b/i, /\bvirtual\b/i, /\bwebinar\b/i, /\bzoom\b/i,
              /\bojai\b/i, /\bventura\b/i, /\bsanta ynez\b/i, /\bsolvang\b/i,
              /\blompoc\b/i, /\bbuellton\b/i, /\byucaipa\b/i, /\bsanta rosa\b/i];

export function isInScope(c: { venueName?: string; address?: string; lat?: number; lng?: number; title?: string }): boolean {
  const hay = `${c.venueName ?? ''} ${c.address ?? ''} ${c.title ?? ''}`.toLowerCase();
  if (DENY.some(rx => rx.test(hay))) return false;
  if (IN_SCOPE_CITIES.some(city => hay.includes(city))) return true;
  if (IN_SCOPE_ZIPS.some(z => hay.includes(z))) return true;
  if (c.lat != null && c.lng != null)
    return c.lat >= BBOX.latMin && c.lat <= BBOX.latMax && c.lng >= BBOX.lngMin && c.lng <= BBOX.lngMax;
  return false; // unknown location → drop (log reason 'geo_unknown')
}
```

### 2.2 `jsonLd.ts` — schema.org Event extraction
Pull `<script type="application/ld+json">` blocks from server-rendered HTML; return normalized Event objects. Primary time source for Eventbrite detail pages, AllEvents, and any venue page that ships JSON-LD.

```ts
export interface LdEvent { name?: string; startDate?: string; endDate?: string;
  locationName?: string; address?: string; offersLow?: number | null; isFree?: boolean; url?: string; }
export function extractEvents(html: string): LdEvent[] { /* parse all ld+json,
  flatten @graph, keep @type Event/MusicEvent/TheaterEvent/etc., normalize to LdEvent.
  startDate/endDate are ISO-8601 with offset → use directly (no inference). */ }
```

### 2.3 `inferYear.ts` — deterministic year inference (the LiveNotes parser core)
For sources that print a weekday + month + day with **no year**. The weekday is the checksum: choose the year (within a forward window from `runDate`) for which that weekday matches that month/day. **Ambiguous or non-matching → return null (drop).**

```ts
// "Sat, May 23" + weekday → the next year where May 23 is a Saturday, within [runDate, runDate+400d].
export function resolveYearlessDate(input: { month: number; day: number; weekday?: number; timeHHmm?: string }, runDateISO: string): string | null {
  // 1. For y in [runYear, runYear+1]: build Date(y, month-1, day).
  // 2. If weekday provided and Date.getDay() !== weekday → reject that y.
  // 3. Pick the earliest candidate >= runDate and <= runDate+400d. Else null.
  // 4. If timeHHmm missing → null (gate requires clock time). Else attach and return ISO with local TZ (America/Los_Angeles).
}
```

### 2.4 `relativeDate.ts` — "Today / Tomorrow / weekday" → absolute
For list pages that print relative dates (Eventbrite, Downtown SB). Resolves against `runDate` in `America/Los_Angeles`. Pairs with `inferYear` for the year-less absolute cases. Returns ISO or null.

### 2.5 `wpEvents.ts` — WordPress / The Events Calendar fetcher
Many SB sites are WordPress. Resolution order per host:
1. `GET {base}/wp-json/` → inspect namespaces.
2. If `tribe/events/v1` present → `GET {base}/wp-json/tribe/events/v1/events?start_date={from}&end_date={to}&per_page=50&page=N` (paginate). Each event: `utc_start_date`/`utc_end_date` (ISO), `venue`, `cost`, `url`, `categories`. **Time is structured → `startStrategy: 'structured'`.**
3. Else if a custom events post type exists → `GET {base}/wp-json/wp/v2/{type}?per_page=50` and read the date meta.
4. Else fall back to `{base}/events/?ical=1` (iCal) via `parseIcs` (§2.6), or to the server-detail scrape pattern (§ per-adapter).

```ts
export async function fetchTribeEvents(base: string, w: DateWindow): Promise<RawCandidate[]> { /* … */ }
export async function discoverWpEventsRoute(base: string): Promise<'tribe' | 'cpt' | 'ical' | 'scrape'> { /* … */ }
```

### 2.6 `ics.ts` — iCal feed parser
Fetch an `.ics` URL and parse `VEVENT`s: `DTSTART`/`DTEND` (respect `TZID` / `Z`), `SUMMARY`, `LOCATION`, `URL`, `DESCRIPTION`, `RRULE`. For one-off events → discrete candidate (`structured`). For `RRULE` events from rhythm sources → registry candidate (§3). Used by LibCal libraries, MOXI iCal fallback, any CivicPlus iCal.

### 2.7 `localist.ts` — Localist API fetcher
```ts
// UCSB and any Localist civic calendar. base e.g. https://events.ucsb.edu
export async function fetchLocalist(base: string, w: DateWindow, opts: { allowGroups?: string[]; denyKeywords?: RegExp[] }): Promise<RawCandidate[]> {
  // GET {base}/api/2/events?start={from}&end={to}&pp=100&page=N  (paginate via page_size/total).
  // Each event → event.event_instances[].start/.end (ISO). Expand instances within window.
  // Apply opts allow/deny to strip academic-only / internal items. structured time.
}
```

### 2.8 `occasionTags.ts` — seed-tag mapping
Adapters pass `{ category, sourceCategory?, keywords[] }`; this returns seed `OccasionTag[]`. Enrich confirms/extends later — adapters only seed.

```ts
export function seedOccasionTags(input: { category: HappeningCategory; sourceCategory?: string; text?: string }): OccasionTag[] {
  // e.g. live_music → ['catch_a_show','nightlife']; recurring_market → ['wine_food','free_sb','family_day'];
  // text match 'family'/'kids' adds family_day; 'free'/'no cost' adds free_sb; 'wine'/'tasting' adds wine_food; etc.
}
```

### 2.9 `fetchHtml.ts` — polite fetcher + break-glass wrapper
All scrape adapters fetch through this. Real desktop User-Agent, 15s timeout, 2 retries with backoff, honors a per-source min-interval. **Direct by default;** only if `useManagedScrape === true` for that adapter **and** a direct attempt returns a block signal (403/429/empty body/anti-bot marker) does it route through the existing Scrapfly client. Log the route taken to `source_runs.notes`.

> **Robots/ToS gate:** `fetchHtml` checks the host's `robots.txt` once per run and **skips (logs `robots_disallow`)** any path disallowed for our UA. If a Wave's primary path is disallowed, stop and surface it for the founder/attorney rather than working around it.

---

## 3. Registry write-back (the snippet model)

Rhythms (weekly markets, recurring nightlife, standing outdoor departures) are **Tier-2 recurring entries** destined for `recurringRegistry.ts`. They flow through the same pipeline but with three differences.

**3.1 Candidate shape.** Extend `RawCandidate` (or add a sibling type) with:
```ts
registryCandidate?: true;
recurrence?: { frequency: 'weekly' | 'biweekly' | 'monthly'; daysOfWeek: number[]; startTime: string; endTime?: string; nthOfMonth?: number; };
```
The adapter emits the **rhythm**, not expanded dated instances.

**3.2 Gate branch.** In `gate.ts`, when `registryCandidate`:
- require `recurrence.frequency`, non-empty `recurrence.daysOfWeek`, and `recurrence.startTime` matching `^\d{2}:\d{2}$`;
- if any missing → drop, reason `registry_incomplete_time`. (Same strictness as the dated path — a clock time is mandatory.)

**3.3 Dedupe-against-registry.** Before landing, compare each registry candidate to the **current** `recurringRegistry.ts` (import it directly — it's in the repo) on a key of `slug(venueName)+daysOfWeek+slug(title)`. If already present → drop, reason `registry_exists`. This stops the nightly run from re-proposing rhythms already live.

**3.4 Landing.** Registry candidates land in the cockpit `needs_review` queue tagged `kind: 'registry'` (a filter/tab in the cockpit, not a new table).

**3.5 Cockpit approval → paste-ready snippet.** When the founder approves a `kind: 'registry'` item, the cockpit renders a copy button containing a `recurringRegistry.ts` entry in the file's existing shape, e.g.:
```ts
{
  title: 'Saturday Farmers\' Market — Santa Barbara',
  venueName: 'Santa Barbara Certified Farmers\' Market (Santa Barbara & Cota)',
  neighborhood: 'downtown',
  category: 'recurring_market',
  frequency: 'weekly',
  daysOfWeek: [6],
  startTime: '08:30',
  endTime: '13:00',
  occasionTags: ['wine_food','free_sb','family_day','outdoors_active'],
  sourceUrl: 'https://sbfarmersmarket.org/markets/',
},
```
The founder pastes it into `recurringRegistry.ts` (or hands the block to Claude Code to insert). Nothing publishes until that file change ships — preserving the founder-maintained model. **Build this affordance once in the cockpit; every registry-bound adapter reuses it.**

---

## 4. Dedupe priority edit

`dedupe.ts` resolves duplicates by canonical-source priority. Replace the current array with the order below — **existing adapters keep their existing pairwise order** (ticketmaster ▸ soho ▸ independent ▸ citysb ▸ registry ▸ submission); new sources slot in by authority (venue/institution-direct beats curated listings beats broad aggregators).

```ts
export const SOURCE_PRIORITY = [
  'ticketmaster',        // structured ticketing API
  // — venue-direct (authoritative for their own events) —
  'soho',
  'sbbowl', 'lobero', 'granada', 'arlington',
  'musicacademy', 'alcazar', 'centerstage', 'carpinteriaArts',
  // — institution-direct —
  'moxi', 'naturalHistory', 'botanicGarden', 'sbma',
  'ucsb', 'libraries',
  // — curated local listings / civic —
  'independent',         // (existing)
  'citysb',              // (existing) City of SB Localist
  'goletaCivic', 'carpinteriaCivic',
  'downtownSB', 'visitsb', 'coastalView', 'sbcountyArts',
  // — broad aggregators (dedupe losers; backstop fill) —
  'eventbrite', 'allevents', 'seatgeek',
  // — recurring + user —
  'registry',            // (existing)
  'submission',          // (existing)
] as const;
```
Unknown keys must fail loudly in tests. Trigram×day matching is unchanged; only the winner-selection order changes.

---

## 5. GitHub Action / env additions

- Add repository secret **`SEATGEEK_CLIENT_ID`** (Wave 4). No other credentials are required — every other source is keyless.
- No new schedule. New adapters register in `worker/sources/index.ts` and run inside the existing nightly job.
- Optional: a `SOURCES_ENABLED` comma-list env (or per-adapter `enabled` flag) so a wave can be toggled on without a code change. If the repo already has an enable mechanism, use it; otherwise add a minimal one — it makes the founder's wave-by-wave "turn it on and watch" step (click-guide) possible without redeploys.

---

## 6. WAVE 1 — foundation

Build order within the wave: shared helpers (§2) → registry affordance (§3.5) → adapters below.

### 6.1 `sbbowl` + `lobero` (and the venue pattern) — server-detail scrape ✓ verified free
**Access.** Fetch the venue's own listing page (Lobero: `lobero.org/whats-on/monthly-calendar/`; Bowl: the shows/calendar page), collect event detail URLs, then fetch each detail page for the **exact showtime**. Both are WordPress; prefer `wpEvents` (§2.5) if `tribe/events` is exposed — it returns structured times in one call. Fall back to the scrape below.

**Representative full stub (server-detail, reused by all venues):**
```ts
import { fetchHtml } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

export const lobero: SourceAdapter = {
  key: 'lobero',
  label: 'Lobero Theatre',
  useManagedScrape: false,
  async fetch(w) {
    const list = await fetchHtml('https://www.lobero.org/whats-on/monthly-calendar/');
    const urls = parseEventLinks(list);            // /events/{slug} hrefs, de-duped
    const out: RawCandidate[] = [];
    for (const url of urls) {
      const page = await fetchHtml(url);
      const [ev] = extractEvents(page);            // JSON-LD on the WP detail page
      const startISO = ev?.startDate ?? parseDetailTime(page); // structured first
      if (!startISO) continue;                      // no clock time → drop (gate will log)
      out.push({
        source: 'lobero', title: ev?.name ?? parseTitle(page),
        venueName: 'Lobero Theatre', address: '33 E Canon Perdido St, Santa Barbara, CA',
        neighborhood: 'downtown', tier: 1, category: 'arts_theater', type: 'event',
        startISO, endISO: ev?.endDate, startStrategy: ev?.startDate ? 'structured' : 'server_detail',
        priceLow: ev?.offersLow ?? null, sourceUrl: url, buyUrl: parseBuyUrl(page), // → AXS
        reasonToGo: undefined, localNote: undefined, // enrich writes these
        occasionTags: seedOccasionTags({ category: 'arts_theater', text: ev?.name }),
        raw: { url },
      });
    }
    return out;
  },
};
```
**Mapping.** Tier 1 · `arts_theater` (or `live_music` for music bills) · seed `catch_a_show, date_night, arts_culture, nightlife`. **Gate:** detail page must yield a clock time. **Lands in:** Cockpit. **Build the `sbbowl` adapter from the same template** (venue address = Santa Barbara Bowl; neighborhood `riviera`/`upper_state` per actual).

**Exit check:** `source_runs` shows `lobero` and `sbbowl` qualifying ≥1 dated event each with non-null `startISO`; `buyUrl` populated; zero items landing without a time.

### 6.2 `ucsb` — Localist API ✓ verified free
**Access.** `fetchLocalist('https://events.ucsb.edu', w, { denyKeywords: [/exam/i,/dissertation defense/i,/faculty meeting/i,/advising/i], allowGroups: [/* Arts & Lectures, MultiCultural Center, AS Program Board, Pollock Theater, Music dept */] })`. Localist returns structured ISO instance times.
**Mapping.** Tier 1 · `arts_theater` / `live_music` / `community_gathering` by Localist `event_type`; seed `arts_culture, catch_a_show, free_sb, family_day, solo`. **Filter:** Isla Vista/UCSB campus is in-scope; strip purely academic/administrative items via deny list; drop online. **Lands in:** Cockpit.
**Exit check:** qualifies public-facing events with ISO times; academic noise visibly filtered in `ingest_drops` (reason `denylist`).

### 6.3 `libraries` — LibCal iCal ✓ verified free
**Access.** SB Public Library + Goleta Valley Library run Springshare LibCal. Find each branch's iCal export URL (LibCal exposes per-calendar `.ics` / RSS) and parse via `ics.ts`. One adapter, multiple feeds.
**Mapping.** Tier 1 (one-off programs) and Tier 2 (standing storytimes → registry candidate if truly recurring). Seed `family_day, free_sb, solo, arts_culture`. **Lands in:** Cockpit (dated programs); Registry (standing weekly storytime, via §3).
**Exit check:** at least one branch feed parsing to ISO-timed items; any `RRULE` storytime routed as a registry candidate, not a dated drop.

### 6.4 `farmersMarkets` — static scrape → **Registry** ✓ verified free
**Access.** `sbfarmersmarket.org` markets page lists the weekly markets (day, hours, location). Scrape the five **in-scope** markets (Santa Barbara Saturday & Tuesday, Goleta, Montecito, Carpinteria); emit each as a **registry candidate** (§3.1) — no dated expansion.
```ts
out.push({
  source: 'farmersMarkets', registryCandidate: true,
  title: "Saturday Farmers' Market — Santa Barbara",
  venueName: "SB Certified Farmers' Market (Santa Barbara & Cota)", neighborhood: 'downtown',
  tier: 2, category: 'recurring_market', type: 'recurring',
  recurrence: { frequency: 'weekly', daysOfWeek: [6], startTime: '08:30', endTime: '13:00' },
  startStrategy: 'structured', explicitlyFree: true, sourceUrl: 'https://sbfarmersmarket.org/markets/',
  occasionTags: seedOccasionTags({ category: 'recurring_market' }),
});
```
**Lands in:** Registry queue → founder approves → paste snippet. **Exit check:** five rhythms land as `kind:'registry'`; none auto-publishes; approving one yields a correct paste-ready block; re-running the worker drops them as `registry_exists` (dedupe-against-registry works) once present.

> **Wave 1 Checkpoint → STOP.** See §11.

---

## 7. WAVE 2 — arts/culture depth + thin-city anchors

### 7.1 `granada` + `arlington` — server-detail scrape *(confirm free; mirror Lobero)*
Same template as §6.1. Confirm each renders its show list server-side (expected — same venue-site family). Tier 1 · `arts_theater`/`live_music` · Cockpit.

### 7.2 cultural institutions — `moxi`, `naturalHistory`, `botanicGarden`, `sbma`
**`moxi` ✓ verified free, cleanest:** WordPress + The Events Calendar → `fetchTribeEvents('https://moxi.org', w)` (REST) or `moxi.org/events/?ical=1`. Inline structured times.
**Others:** build each as its own adapter; try `discoverWpEventsRoute` first, else server-detail scrape. Natural History & Botanic Garden also carry **Tier-3 spots** (the museum/garden itself) — emit those as evergreen `culture_spot`/`scenic_chill` once, not nightly.
**Mapping.** Tier 1 events + Tier 3 spots; seed `family_day, arts_culture, date_night, outdoors_active`. Cockpit. **Exit check:** MOXI via feed (no scrape); each museum yields ≥1 timed event or a clean drop reason.

### 7.3 `musicacademy` — server-detail scrape *(confirm)*
Summer festival on its own off-AXS campus (`musicacademy.org`). Many free events. Tier 1 · `arts_theater`/`live_music` · seed `catch_a_show, arts_culture, free_sb, date_night`. Cockpit.

### 7.4 `alcazar` — server-detail scrape *(confirm)* — Carpinteria anchor
`thealcazar.org`. Tier 1 · `arts_theater`/`live_music` · seed `catch_a_show, family_day, arts_culture, date_night`. Cockpit.

### 7.5 `goletaCivic` + `carpinteriaCivic` — civic calendar *(confirm platform)*
Identify each platform (Localist → `fetchLocalist`; CivicPlus → its `.ics`; else scrape). City-of-SB `citysb` already covers SB; these are net-new for the other two cities. Tier 1 · `community_gathering` · seed `free_sb, family_day`. Cockpit. Filter to public community events (skip internal council/admin minutiae).

### 7.6 `downtownSB` — server-rendered scrape ✓ verified free (mini-aggregator)
**Access.** `downtownsb.org/happenings/calendar?d=next30#cal` renders events inline (venue, time, date) with category filters. Parse the list; map categories (Concerts & Live Music, Art & Exhibits, Dance, Family Friendly, Theatre & Shows, 1st Thursdays) to tier/tags. 1st-Thursday is a monthly rhythm → registry candidate; the rest are dated → Cockpit.
**Dedupe note.** It re-lists other venues (Lobero, Historical Museum, Night Lizard). Priority (§4) makes venue-direct win; Downtown is the catch-all for venues we don't adapt directly. **Exit check:** dated items land in Cockpit with times; 1st-Thursday lands as a registry candidate; overlaps with `lobero`/`citysb` collapse via dedupe (inspect that duplicates resolve to the higher-priority source).

> **Wave 2 Checkpoint → STOP.**

---

## 8. WAVE 3 — indie long-tail + curated rhythms + Carpinteria depth

### 8.1 `eventbrite` — server-rendered pages + detail JSON-LD + hard filter ✓ verified free
**Access (two-step).**
1. Fetch the city + category pages (server-rendered): `/d/ca--santa-barbara/all-events/`, `/d/ca--santa-barbara/events--this-weekend/`, and `/b/ca--santa-barbara/{music,food-and-drink,arts,family-and-education,charity-and-causes}/`. Collect `/e/{slug}-{id}` URLs + the inline rough date/time.
2. For each in-window candidate, fetch the **detail page** and read JSON-LD (`extractEvents`, §2.2) for the **canonical ISO `startDate`**. The event id (tail of the URL) is the stable dedupe key.

**Representative full stub (server pages + JSON-LD + filter):**
```ts
export const eventbrite: SourceAdapter = {
  key: 'eventbrite', label: 'Eventbrite (SB)', useManagedScrape: false,
  async fetch(w) {
    const pages = [
      'https://www.eventbrite.com/d/ca--santa-barbara/all-events/',
      'https://www.eventbrite.com/d/ca--santa-barbara/events--this-weekend/',
      'https://www.eventbrite.com/b/ca--santa-barbara/music/',
      'https://www.eventbrite.com/b/ca--santa-barbara/food-and-drink/',
      'https://www.eventbrite.com/b/ca--santa-barbara/arts/',
      'https://www.eventbrite.com/b/ca--santa-barbara/family-and-education/',
    ];
    const urls = new Set<string>();
    for (const p of pages) collectEventUrls(await fetchHtml(p)).forEach(u => urls.add(stripQuery(u)));
    const out: RawCandidate[] = [];
    for (const url of urls) {
      if (!/eventbrite\.com\/e\//.test(url)) continue;          // drop .com.ar/.es/.ca locales
      const [ev] = extractEvents(await fetchHtml(url));
      if (!ev?.startDate) continue;                              // need ISO clock time
      const cand: RawCandidate = {
        source: 'eventbrite', title: ev.name, venueName: ev.locationName, address: ev.address,
        tier: 1, category: classify(ev), type: 'event',
        startISO: ev.startDate, endISO: ev.endDate, startStrategy: 'structured',
        priceLow: ev.offersLow ?? null, explicitlyFree: ev.isFree ?? undefined,
        sourceUrl: url, buyUrl: url,
        occasionTags: seedOccasionTags({ category: classify(ev), text: ev.name }),
        raw: { id: idFromUrl(url) },
      };
      if (!isInScope(cand)) continue;                            // HARD geo/online filter
      out.push(cand);
    }
    return out;
  },
};
```
**Filter is mandatory** — the raw feed is heavy with online/foreign/conference noise. Drop non-`.com` locale domains, online/virtual, and anything `!isInScope`. **Lands in:** Cockpit. **Exit check:** qualified items are all in-person, in-scope, ISO-timed; `ingest_drops` shows substantial `geo`/`online` drops (proof the filter fired); spot-check 5 against the live site.

### 8.2 `nightlifeRhythms` — light per-venue scrape → **Registry**
Validation Ale, Brass Bear, Figueroa Mtn, Dargan's, Wine Therapy, Hotel Californian. Where the venue has a standing weekly night on its own site, scrape day+time → registry candidate. **Instagram-only nights are out of scope to scrape** → leave for founder submission (note in cockpit, don't fabricate). Tier 2 · `recurring_nightlife` · seed `nightlife, wine_food, date_night, free_sb, solo`. Registry.

### 8.3 `outdoorsOperators` — schedule scrape → **Registry**
Condor Express (whale watch, fixed daily departures), SB Adventure Co (kayak/surf set times), Ice in Paradise (public skate sessions). Scrape the standing schedule → registry candidates (weekly pattern + time). Tier 2 · `recurring_outdoors` · seed `outdoors_active, family_day, date_night, solo, hosting_visitors`. Registry.

### 8.4 `carpinteriaArts` — server-detail scrape *(confirm)*
`carpinteriaartscenter.org`. Dated shows → Cockpit; the monthly Arts & Craft Faire → registry candidate. Tier 1 + Tier 2 · `arts_theater`/`recurring_arts` · seed `arts_culture, family_day, free_sb`.

### 8.5 `centerstage` — server-detail scrape *(confirm)* — off-AXS
`centerstagetheater.org`. Tier 1 · `arts_theater` · seed `catch_a_show, arts_culture, date_night`. Cockpit.

### 8.6 `coastalView` — calendar scrape *(confirm; check LiveNotes overlap)*
`coastalview.com` Carpinteria events. **First confirm it isn't already inside `livenotes`** (dedupe will collapse, but avoid redundant adapters). Tier 1 · `community_gathering` · seed `community, arts_culture, family_day, free_sb`. Cockpit. Low expected pass (prose-heavy); strict gate.

### 8.7 `natureProgramsFree` — calendar scrape → **Registry** *(confirm)*
Land Trust for SB County + Sierra Club Los Padres standing hikes/walks. Recurring → registry candidates; one-off dated hikes → Cockpit. Tier 1/2 · `recurring_outdoors`/`sports_outdoors_event` · seed `outdoors_active, free_sb, solo, family_day`.

> **Wave 3 Checkpoint → STOP.**

---

## 9. WAVE 4 — optional backstops + evergreen content

### 9.1 `seatgeek` — Platform API ✓ verified free (needs free client_id)
**Access.** `GET https://api.seatgeek.com/2/events?client_id={SEATGEEK_CLIENT_ID}&lat=34.4208&lon=-119.6982&range=15mi&datetime_utc.gte={fromUTC}&per_page=100&page=N`. Structured `datetime_utc`, venue, performers, `stats.lowest_price`. **Backstop only** — priority (§4) keeps venue-direct/TM records winning; SeatGeek fills gaps + sports. Tier 1 · `live_music`/`sports_outdoors_event` · Cockpit. **Exit check:** authenticates with the secret; most items dedupe against existing sources (expected); net-new fills are in-scope.

### 9.2 `sbcountyArts` — portal scrape *(confirm; check citysb overlap)*
`sbac.ca.gov`. Confirm incremental value over `citysb`/`ucsb` before fully wiring. Tier 1 · `arts_theater`/`community_gathering` · Cockpit.

### 9.3 `allevents` — server-rendered scrape + hard geo filter ✓ verified free (thin-city backstop)
**Access.** `allevents.in/santa-barbara/all` (+ Goleta/Carpinteria pages). Returns clean structured data (absolute datetime+TZ, venue, price, categories). **Geo is loose** (Carpinteria page surfaced Ojai) → `isInScope` is mandatory. Tier 1 · classify by category · Cockpit. **Backstop only;** expect heavy dedupe + geo drops. **Exit check:** qualified items in-scope and ISO-timed; large `geo` drop count; net contribution is genuinely net-new vs other sources (if near-zero unique, leave disabled).

### 9.4 `newVic` — **conditional** scrape
Ensemble Theatre Co at The New Vic (`etcsb.org`). **Only build if The New Vic is NOT ticketed via AXS** (if it is, the Granada/Arlington/AXS-pattern or venue-direct already captures it). Verify first; if redundant, skip and note.

### 9.5 Urban Wine Trail / Funk Zone → **Discover SB content** (not a daily adapter)
`urbanwinetrailsb.com` (~30 rooms). This is **evergreen Tier-3 content**, not a nightly ingest. Capture the room list once (name, neighborhood, address, hours where published) and build a **Discover SB** neighborhood guide entry (Funk Zone / Waterfront). Seed `wine_food, date_night, solo`. No gate (evergreen). Refresh manually, not nightly. **Exit check:** appears under Discover SB, not in the Explore dated feed.

> **Wave 4 Checkpoint → STOP.** Final acceptance below.

---

## 10. Per-source landing map (where each must end up)

| Lands in | Sources |
|---|---|
| **Cockpit → publish-direct** (dated T1) | sbbowl, lobero, granada, arlington, musicacademy, alcazar, centerstage, moxi, naturalHistory, botanicGarden, sbma, ucsb, libraries (programs), goletaCivic, carpinteriaCivic, downtownSB (dated), eventbrite, coastalView, seatgeek, sbcountyArts, allevents, newVic, carpinteriaArts (shows) |
| **Cockpit → Registry queue → paste snippet** (rhythms) | farmersMarkets, nightlifeRhythms, outdoorsOperators, natureProgramsFree, libraries (standing storytime), downtownSB (1st Thursday), carpinteriaArts (monthly faire) |
| **Discover SB** (evergreen T3) | Urban Wine Trail; the museum/garden "spot" entries from §7.2 |

A source landing in the wrong surface is a build failure even if it ingests cleanly. Verify routing at each checkpoint.

---

## 11. Checkpoints (acceptance per wave — do not skip)

After each wave, run the nightly worker against a real window and confirm in `source_runs` / `ingest_drops` / the cockpit:

**Wave 1 done when:** helpers unit-tested; `lobero`, `sbbowl`, `ucsb`, `libraries` each qualify ≥1 correctly-timed event; `farmersMarkets` lands 5 rhythms in the **Registry** queue, none auto-published, approving one yields a correct paste block, and a second run drops them as `registry_exists`; zero candidates land without a clock time; `SOURCE_PRIORITY` updated and tests green.

**Wave 2 done when:** `granada`/`arlington`/`musicacademy`/`alcazar`/`centerstage` confirmed server-rendered and ingesting; `moxi` runs via **feed** (not scrape); `downtownSB` overlaps with venue-direct collapse correctly via dedupe; civic adapters filtered to public events; museum "spot" entries appear under Discover SB, not the dated feed.

**Wave 3 done when:** `eventbrite` qualifies only in-person in-scope ISO-timed events with visible geo/online drops; registry-bound rhythms (nightlife, outdoors, faire, nature) land in the Registry queue with valid paste blocks; no adapter copies source description text (spot-check `reasonToGo`/`localNote` are null pre-enrich).

**Wave 4 done when:** `seatgeek` authenticates and contributes net-new only; `allevents`/`sbcountyArts`/`newVic` either earn their place (unique in-scope contribution) or are left disabled with a one-line rationale; Urban Wine Trail lives under Discover SB.

**Global acceptance:** every "lands in" cell in §10 verified; `useManagedScrape` is `false` everywhere and Scrapfly was never invoked (check `source_runs.notes`); `CLAUDE.md` "Active Sources" section updated to list the new adapters and their routes; any place this doc disagreed with the code is flagged in the final summary.

---

## 12. Guardrails recap

- **Free routes only; Scrapfly stays off** (per-source break-glass, logged if ever used).
- **Venue-direct, never AXS-direct.** Ticket links become `buyUrl`.
- **Facts only.** Enrich writes blurbs; adapters never copy descriptions; no step invents a date/time.
- **Gate is absolute** — deterministic clock time or drop, dated and recurring alike.
- **Trust rule untouched** — ranker never reads sponsor status.
- **`recurringRegistry.ts` stays hardcoded** — approval emits a paste snippet; no migration, no auto-publish.
- **Robots/ToS honored** — `fetchHtml` checks `robots.txt`; disallowed primary paths stop the wave for founder/attorney review; no account creation anywhere.
- **Build wave-by-wave; stop at every checkpoint; flag stale docs, follow the code.**
