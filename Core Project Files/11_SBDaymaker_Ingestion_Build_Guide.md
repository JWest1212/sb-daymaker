# SB Daymaker — Ingestion Pipeline Build Guide (Claude Code execution spec)

**Generated:** 2026-06-24 · **Status:** build-ready · **Companion to:** `10_SBDaymaker_Ingestion_Pipeline.md` (strategy/options/phases) and `cockpit_wireframe.html` (visual target).

This document is the **executable contract**. Doc 10 says *what* and *why*; this says *exactly how*, with file paths, type definitions, ready-to-run SQL, and per-phase exit criteria Claude Code can self-verify. Language is **TypeScript** end-to-end (worker + gate + app share one type system).

---

## 0. How to drive this with Claude Code

- **Work one phase at a time** (Phases 9–14 from Doc 10). Each phase below has a *task list* and an *exit check*. Do not start a phase until the prior exit check passes.
- **The gate is the foundation — build and test it first (Phase 9) against the 107 seed rows as fixtures.** Every seed row must pass the gate; every documented drop reason must reproduce. If a seed row fails the gate, the gate is wrong, not the row.
- **Hard invariants Claude Code must never violate** (these are trust rules, not style):
  1. **AI never sets or alters a start time.** The batch-Claude step runs *after* the gate and may only write `blurb`, `blurb_long`, and proposed tags. If a row has no deterministic start, it was already dropped before Claude saw it.
  2. **Nothing sets `is_featured` / sponsor fields.** Ingestion is sponsor-blind. The ranker trust rule depends on it.
  3. **Everything lands `status='needs_review'`.** Ingestion never publishes. Only the cockpit (a human tap) writes `status='published'`.
  4. **No per-request AI.** Claude is called once per nightly run, in batch, over the whole night's candidate set.
  5. **A dropped row is logged, never silently discarded** (`ingest_drops`), so the digest and cockpit can show what was held back.

---

## 1. Repo / file layout

Ingestion lives as versioned code in the existing repo, run by a GitHub Action (Doc 10 Option B). The cockpit is a route in the existing Next.js app. Shared types sit in a package both import.

```
/ (existing Next.js repo root)
├─ app/
│  └─ admin/
│     └─ review/
│        ├─ page.tsx                 # cockpit queue (server component shell)
│        ├─ ReviewQueue.tsx          # client: cards, keyboard, bulk-approve
│        ├─ ReviewCard.tsx           # one card (maps 1:1 to wireframe card)
│        ├─ DroppedPanel.tsx         # "dropped tonight" sidebar
│        └─ SourceHealth.tsx         # source-health sidebar
├─ app/api/review/
│  ├─ approve/route.ts               # POST: id -> status=published (+audit)
│  ├─ reject/route.ts                # POST: id,reason -> status=archived (+audit)
│  └─ queue/route.ts                 # GET: needs_review rows + tonight's drops
│
├─ ingest/                           # the nightly worker (Node, run by Action)
│  ├─ run.ts                         # entrypoint: orchestrates the 7 steps
│  ├─ gate.ts                        # THE STRICT GATE (pure, unit-tested)
│  ├─ gate.test.ts                   # runs gate against the 107 seed fixtures
│  ├─ dedupe.ts                      # uuid5 exact + trigram×date near-match
│  ├─ enrich.ts                      # ONE batch Claude call (voice + tags only)
│  ├─ images.ts                      # Phase-8 waterfall (owned→…→placeholder)
│  ├─ land.ts                        # insert needs_review (on conflict do nothing)
│  ├─ digest.ts                      # compose + send nightly email
│  ├─ db.ts                          # Supabase service-role client
│  └─ adapters/
│     ├─ types.ts                    # SourceAdapter interface (the contract)
│     ├─ registry.ts                 # ordered list of active adapters
│     ├─ ticketmaster.ts             # API adapter (reference impl below)
│     ├─ soho.ts                     # server-rendered scrape (reference impl)
│     ├─ visitsb.ts                  # (Phase 13)
│     ├─ independent.ts              # (Phase 13)
│     ├─ citySites.ts                # (Phase 13)
│     ├─ livenotes.ts                # (Phase 13)
│     ├─ recurringRegistry.ts        # (Phase 14) curated Tier-2 rhythms
│     └─ googlePlaces.ts             # (Phase 13) metadata + closure detection
│
├─ packages/shared/
│  └─ types.ts                       # Candidate / Thing / Tag / enums (single source)
│
├─ fixtures/
│  └─ seed_rows.json                 # the 107 rows, parsed from sbdaymaker_seed_all.sql
│
├─ supabase/migrations/
│  └─ 2026xxxx_ingestion.sql         # source_runs, ingest_drops, frequency enum
│
└─ .github/workflows/
   └─ ingest.yml                     # nightly cron -> node ingest/run.ts
```

---

## 2. Schema migration (ready to run)

Apply before any code (Phase 9). Additive only; touches nothing in the existing `things` contract except adding the `frequency` enum the seed pass proved is needed.

```sql
-- supabase/migrations/2026xxxx_ingestion.sql
-- Additive ingestion provenance + recurrence-cadence fix. Idempotent guards throughout.

-- 1) recurring cadence: day_of_week alone cannot express "1st Thursday" / "bi-monthly".
do $$ begin
  create type recur_frequency as enum ('weekly','biweekly','monthly');
exception when duplicate_object then null; end $$;

alter table recurring_schedules
  add column if not exists frequency recur_frequency not null default 'weekly';
-- Backfill the known sub-weekly rows from the seed (1st Thursday, Funk Zone Art Walk).
-- (Run once, by label match, after migration — see Phase 9 task list.)

-- 2) per-run bookkeeping for the digest + source-health panel
create table if not exists source_runs (
  id            bigint generated always as identity primary key,
  source        text        not null,             -- adapter key, e.g. 'soho'
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  fetched       int         not null default 0,   -- raw items pulled
  qualified     int         not null default 0,   -- passed the gate
  dropped       int         not null default 0,   -- failed the gate
  landed        int         not null default 0,   -- newly inserted (post-dedupe)
  ok            boolean     not null default true, -- false => surfaced in digest
  error         text                              -- message if ok=false
);
create index if not exists source_runs_started_idx on source_runs (started_at desc);

-- 3) every dropped candidate, with reason, so nothing vanishes silently
create table if not exists ingest_drops (
  id           bigint generated always as identity primary key,
  run_id       bigint references source_runs(id) on delete cascade,
  source       text        not null,
  title        text,                              -- best-effort title for display
  reason       text        not null,             -- 'no_start' | 'no_title' | 'no_address' | 'no_source' | 'duplicate'
  detail       text,                              -- human note: 'said "8-ish"'
  source_url   text,
  raw          jsonb,                             -- the raw candidate, for manual rescue
  created_at   timestamptz not null default now()
);
create index if not exists ingest_drops_created_idx on ingest_drops (created_at desc);
```

---

## 3. Shared types (the contract that flows gate → DB → cockpit)

`packages/shared/types.ts` — imported by the worker *and* the app. This is why TypeScript was chosen: the gate's output is the cockpit's input, checked at compile time.

```ts
// packages/shared/types.ts

export type ThingType = 'place' | 'event' | 'firstlook' | 'happyhour';
export type Status = 'draft' | 'needs_review' | 'published' | 'archived';
export type Tier = 1 | 2 | 3;
export type PriceBand = 'free' | '$' | '$$' | '$$$';
export type Tod = 'morning' | 'afternoon' | 'evening' | 'late';

export type Neighborhood =
  | 'funk_zone' | 'downtown' | 'waterfront' | 'montecito' | 'mesa'
  | 'mission_canyon' | 'riviera' | 'upper_state' | 'goleta' | 'carpinteria' | 'other';

export type HappeningCategory =
  // Tier 1
  | 'live_music' | 'festival_fair' | 'arts_theater' | 'community_gathering'
  | 'food_drink_event' | 'sports_outdoors_event'
  // Tier 2
  | 'weekly_special' | 'recurring_nightlife' | 'recurring_market'
  | 'recurring_arts' | 'recurring_outdoors'
  // Tier 3
  | 'outdoor_activity' | 'food_drink_spot' | 'culture_spot'
  | 'shopping_browse' | 'scenic_chill';

export type OccasionTag =
  | 'date_night' | 'family_day' | 'nightlife' | 'catch_a_show' | 'arts_culture'
  | 'outdoors_active' | 'wine_food' | 'free_sb' | 'hosting_visitors' | 'solo';

export type PhotoSource = 'pexels' | 'wikimedia' | 'google' | 'owned' | 'placeholder';

/**
 * How an adapter proves a start time. The gate consults this to decide whether a
 * start is "deterministic". 'structured' = a machine field (e.g. Ticketmaster
 * dateTime). 'server_detail' = an explicit clock time on a server-rendered detail
 * page (the SOhO pattern). 'none' = no start exists (evergreen Tier-3 only).
 * Prose-derived guesses are NEVER a valid strategy — there is no enum value for them.
 */
export type StartStrategy = 'structured' | 'server_detail' | 'none';

/** Raw, pre-gate item emitted by an adapter. Deliberately permissive. */
export interface RawCandidate {
  source: string;                 // adapter key
  title?: string;
  venueName?: string;
  address?: string;
  lat?: number; lng?: number;
  tier: Tier;
  category: HappeningCategory;
  type: ThingType;
  startISO?: string;              // ISO 8601 with offset, IF the adapter has one
  endISO?: string;
  startStrategy: StartStrategy;   // how (and whether) the start was obtained
  priceLow?: number | null;       // lowest ticket price, if known
  explicitlyFree?: boolean;       // only true if the source literally says free
  sourceUrl?: string;
  buyUrl?: string;
  placeId?: string;
  neighborhood?: Neighborhood;
  reasonToGo?: string;            // required for Tier-3 at gate time
  localNote?: string;
  raw?: unknown;                  // original payload, for drop logging / rescue
}

/** Post-gate row, ready to land. Note start_at is required for T1/T2 by construction. */
export interface Candidate {
  id: string;                     // uuid5, deterministic
  type: ThingType;
  status: 'needs_review';
  title: string;
  tier: Tier;
  happening_category: HappeningCategory;
  neighborhood?: Neighborhood;
  address: string;                // navigable (or resolved-from-venue) — required
  lat?: number; lng?: number;
  price_band: PriceBand | null;
  time_of_day_fit: Tod[];
  starts_at: string | null;       // non-null for T1/T2; null only for evergreen T3
  ends_at: string | null;
  buy_url?: string;
  source_url: string;             // required
  place_id?: string;
  reason_to_go?: string;          // required for T3
  local_note?: string;
  last_confirmed: string;         // run date
  start_strategy: StartStrategy;  // carried through for the cockpit trust chip
  // image fields (set by resolveImages, pre-landing — see §7b):
  photo_url?: string;             // current pick = photo_options[0] at land time
  photo_source?: PhotoSource;     // provenance shown as the card's source-pill
  photo_options?: { url: string; source: PhotoSource; width?: number; height?: number; attribution?: string }[];
  // AI-written fields, filled later by enrich.ts (never here):
  blurb?: string;
  blurb_long?: string;
  proposed_tags?: { tag: OccasionTag; confidence: number }[];
}

export type DropReason = 'no_title' | 'no_address' | 'no_source' | 'no_start' | 'duplicate';
export interface GateResult {
  ok: boolean;
  candidate?: Candidate;
  reason?: DropReason;
  detail?: string;                // e.g. 'start said "8-ish"'
}
```

---

## 4. The strict gate (`ingest/gate.ts`)

The §7 pseudocode from Doc 10, as real code. **Pure function, no I/O, no AI** — so it is unit-testable against the seed fixtures.

```ts
// ingest/gate.ts
import { v5 as uuidv5 } from 'uuid';
import type { RawCandidate, Candidate, GateResult, Tod, PriceBand } from '../packages/shared/types';

const NS = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'; // same namespace as the seed

/** Categories whose Tier-1/2 form REQUIRES a start time. (All T1/T2 event-like cats do.) */
function requiresStart(tier: number): boolean {
  return tier === 1 || tier === 2;
}

/** The linchpin. A start is deterministic ONLY if it came from a structured field
 *  or an explicit server-rendered clock time, AND parses to a real instant. */
function hasDeterministicStart(c: RawCandidate): boolean {
  if (c.startStrategy === 'none') return false;
  if (!c.startISO) return false;
  const t = Date.parse(c.startISO);
  if (Number.isNaN(t)) return false;
  // Reject date-only values masquerading as datetimes (must carry a clock time).
  // ISO date-only is length 10 ('2026-07-04'); require a 'T' and offset.
  if (!/\dT\d{2}:\d{2}/.test(c.startISO)) return false;
  return true; // strategy is 'structured' | 'server_detail' AND value is a real instant
}

function bucketTod(startISO: string): Tod[] {
  const h = new Date(startISO).getHours();
  if (h >= 5 && h < 11) return ['morning'];
  if (h >= 11 && h < 17) return ['afternoon'];
  if (h >= 17 && h < 22) return ['evening'];
  return ['late'];
}

function mapPrice(c: RawCandidate): PriceBand | null {
  if (c.explicitlyFree) return 'free';
  if (c.priceLow == null) return null;          // never infer
  if (c.priceLow < 20) return '$';
  if (c.priceLow <= 50) return '$$';
  return '$$$';
}

function idFor(c: RawCandidate): string {
  // Events keyed on source_url|title; places keyed on seed-style place key.
  const key = c.type === 'place'
    ? `seed:google_places|${c.title}`
    : `${c.sourceUrl}|${c.title}`;
  return uuidv5(key, NS);
}

export function gate(c: RawCandidate): GateResult {
  // --- hard rejects ---
  if (!c.title?.trim()) return { ok: false, reason: 'no_title' };
  const address = c.address ?? (c.venueName ? resolveVenue(c.venueName) : undefined);
  if (!address) return { ok: false, reason: 'no_address', detail: c.venueName ?? '' };
  if (!c.sourceUrl) return { ok: false, reason: 'no_source' };

  // --- THE START-TIME GATE (T1/T2) ---
  if (requiresStart(c.tier)) {
    if (!hasDeterministicStart(c)) {
      return { ok: false, reason: 'no_start', detail: describeStart(c) };
    }
  }

  // --- Tier-3 rule: never a bare place ---
  if (c.tier === 3 && !c.reasonToGo?.trim()) {
    return { ok: false, reason: 'no_address', detail: 'tier-3 missing reason_to_go' };
    // (reused reason bucket; see note — or add a 'no_reason' DropReason if preferred)
  }

  const startISO = requiresStart(c.tier) ? c.startISO! : null;

  const candidate: Candidate = {
    id: idFor(c),
    type: c.type,
    status: 'needs_review',
    title: c.title.trim(),
    tier: c.tier,
    happening_category: c.category,
    neighborhood: c.neighborhood,
    address,
    lat: c.lat, lng: c.lng,
    price_band: mapPrice(c),
    time_of_day_fit: startISO ? bucketTod(startISO) : tod3Default(c),
    starts_at: startISO,
    ends_at: c.endISO ?? null,
    buy_url: c.buyUrl,
    source_url: c.sourceUrl,
    place_id: c.placeId,
    reason_to_go: c.reasonToGo,
    local_note: c.localNote,
    last_confirmed: new Date().toISOString().slice(0, 10),
    start_strategy: c.startStrategy,
  };
  return { ok: true, candidate };
}

// --- helpers Claude Code implements in Phase 9 ---
// resolveVenue(name): look up a sourced venue name -> known street address.
//   This is the ONE allowed "lookup" (deterministic, not invention). Back it with
//   a small static map seeded from the 107 rows + Google Places; return undefined on miss.
declare function resolveVenue(name: string): string | undefined;
// describeStart(c): human string for the drop log, e.g. 'date-only, no clock time'.
declare function describeStart(c: RawCandidate): string;
// tod3Default(c): time_of_day_fit for evergreen places (usually ['morning','afternoon','evening']).
declare function tod3Default(c: RawCandidate): Tod[];
```

### 4a. Gate test against the seed (`ingest/gate.test.ts`)

The 107 rows are the regression fixture. Build `fixtures/seed_rows.json` by parsing `sbdaymaker_seed_all.sql` (the same parser pattern used in the seed validation). Then:

- **Every published-shape seed row must pass `gate()`** (its strategy is known-good).
- **Each documented drop reason must reproduce** — include a handful of negative fixtures (the "8-ish" open mic, the "dusk" yoga, a day-only trivia) and assert `reason === 'no_start'`.
- **uuid5 determinism:** `gate()` must reproduce the *exact* IDs already in the seed for the matching rows.

Exit check for the gate: `npm test` green, all 107 pass, all negatives drop with the right reason, IDs match the seed byte-for-byte.

---

## 5. The adapter contract (`ingest/adapters/types.ts`)

Every source implements the same interface, so adding a source is mechanical and the worker stays generic.

```ts
// ingest/adapters/types.ts
import type { RawCandidate } from '../../packages/shared/types';

export interface SourceAdapter {
  key: string;                 // 'ticketmaster' | 'soho' | ...
  label: string;               // 'Ticketmaster API' (shown in source-health)
  /** Pull raw payloads and emit RawCandidates. MUST set startStrategy honestly:
   *  'structured' (machine field), 'server_detail' (explicit page time), or 'none'.
   *  MUST NOT guess a time from prose — emit startStrategy:'none' and let the gate drop it. */
  fetch(window: DateWindow): Promise<RawCandidate[]>;
  /** Optional escape hatch: route this adapter's fetch through a managed scraper
   *  (Scrapfly/Apify) only if the source starts blocking. Off by default. */
  useManagedScrape?: boolean;
}
export interface DateWindow { fromISO: string; toISO: string; } // typically now .. now+45d
```

### 5a. Reference adapter — Ticketmaster (`adapters/ticketmaster.ts`)

The free, structured backbone. Exposes an exact `dateTime` → `startStrategy: 'structured'`.

```ts
// ingest/adapters/ticketmaster.ts
import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';

const BASE = 'https://app.ticketmaster.com/discovery/v2/events.json';

export const ticketmaster: SourceAdapter = {
  key: 'ticketmaster',
  label: 'Ticketmaster API',
  async fetch({ fromISO, toISO }) {
    const key = process.env.TICKETMASTER_API_KEY!;
    // Scope tightly: SB geo + date range. Paginate if total > page size.
    const url = `${BASE}?apikey=${key}&latlong=34.4208,-119.6982&radius=15&unit=miles`
      + `&startDateTime=${fromISO}&endDateTime=${toISO}&size=100&sort=date,asc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ticketmaster ${res.status}`);
    const json: any = await res.json();
    const events = json?._embedded?.events ?? [];
    return events.map((e: any): RawCandidate => {
      const venue = e?._embedded?.venues?.[0];
      const dt = e?.dates?.start?.dateTime;              // <-- deterministic instant
      const price = e?.priceRanges?.[0]?.min ?? null;
      return {
        source: 'ticketmaster',
        title: e?.name,
        venueName: venue?.name,
        address: venue ? [venue?.address?.line1, venue?.city?.name, venue?.state?.stateCode, venue?.postalCode].filter(Boolean).join(', ') : undefined,
        lat: venue?.location ? Number(venue.location.latitude) : undefined,
        lng: venue?.location ? Number(venue.location.longitude) : undefined,
        tier: 1,
        category: classifyTM(e),                         // map TM segment -> HappeningCategory
        type: 'event',
        startISO: dt,                                     // present => structured
        startStrategy: dt ? 'structured' : 'none',       // no dt => gate drops it
        priceLow: price,
        explicitlyFree: false,
        sourceUrl: e?.url,
        buyUrl: e?.url,
        raw: e,
      };
    });
  },
};

// classifyTM: TM 'classifications[0].segment.name' (Music/Sports/Arts & Theatre) ->
// live_music | sports_outdoors_event | arts_theater | community_gathering. Phase 10.
declare function classifyTM(e: any): RawCandidate['category'];
```

### 5b. Reference adapter — SOhO (`adapters/soho.ts`)

The server-rendered long-tail pattern. The per-event detail page carries an explicit show time → `startStrategy: 'server_detail'`.

```ts
// ingest/adapters/soho.ts
import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';

export const soho: SourceAdapter = {
  key: 'soho',
  label: 'SOhO ticketing',
  async fetch() {
    // 1) list page -> per-show detail URLs (tickets.sohosb.com/e/<slug>)
    const listHtml = await get('https://tickets.sohosb.com/');
    const slugs = extractShowUrls(listHtml);              // Phase 10
    const out: RawCandidate[] = [];
    for (const url of slugs) {
      const html = await get(url);
      const $ = cheerio.load(html);
      const title = $('h1').first().text().trim();
      const startISO = parseShowDateTime($);              // explicit doors/show time on the page
      out.push({
        source: 'soho',
        title,
        venueName: 'SOhO Restaurant & Music Club',
        address: '1221 State St #205, Santa Barbara, CA 93101',
        tier: 1,
        category: 'live_music',
        type: 'event',
        startISO: startISO ?? undefined,
        startStrategy: startISO ? 'server_detail' : 'none', // no parseable time => drop
        priceLow: parsePrice($),                            // null if not shown
        explicitlyFree: /donation|free/i.test($('body').text()) ? false : false,
        sourceUrl: url,
        buyUrl: url,
        raw: { url },
      });
    }
    return out;
  },
};

declare function get(url: string): Promise<string>;         // fetch w/ UA + retry; managed-scrape hook
declare function extractShowUrls(html: string): string[];
declare function parseShowDateTime($: cheerio.CheerioAPI): string | null; // returns ISO w/ offset or null
declare function parsePrice($: cheerio.CheerioAPI): number | null;
```

**Adapter authoring rule (put in `CLAUDE.md`):** the only honest values for `startStrategy` are `structured`, `server_detail`, or `none`. If a source only gives prose ("8-ish", "dusk", a weekday with no time), the adapter emits `startStrategy: 'none'` and lets the gate drop it. **Never** regex a guess into `startISO`.

---

## 6. Dedupe (`ingest/dedupe.ts`)

```ts
// ingest/dedupe.ts
// 1) Exact: uuid5 id collision => same row (drop the dupe, log reason 'duplicate').
// 2) Near: title trigram similarity (>0.55) AND same calendar day for starts_at =>
//    same event from a different source. Prefer the venue-owned ticketing source
//    as canonical; drop the other as 'duplicate'.
// Uses the existing things_title_trgm_idx pattern; for in-batch dedupe compute
// trigram similarity in-process, and also check against already-published rows in DB.
export function dedupe(cands: Candidate[], existing: PublishedRow[]): { keep: Candidate[]; drops: DropRecord[] };
```

Canonical-source preference order (highest wins): venue-owned ticketing (SOhO, Polo) > Ticketmaster > Visit SB > Independent > LiveNotes > aggregators.

---

## 7. Batch enrichment (`ingest/enrich.ts`) — one Claude call, voice + tags only

```ts
// ingest/enrich.ts
// ONE batched call over the whole night's gated candidates. Returns, per id:
//   blurb (≤ ~24 words, house voice), blurb_long, proposed_tags[] with confidence.
// HARD RULES baked into the system prompt AND validated on the way out:
//   • NEVER returns or modifies a start time / date. (We don't even send it as editable.)
//   • Negative tag rules enforced post-hoc: if is_21_plus -> strip 'family_day';
//     if price_band !== 'free'/null -> strip 'free_sb'. Drop any tag outside the enum.
//   • Voice: Spanish-Colonial-meets-broadsheet; concrete, non-salesy (see tokens/Doc 02).
// Output is attached to the Candidate; the human still approves every row.
export async function enrich(cands: Candidate[]): Promise<Candidate[]>;
```

Use the Claude API in batch (model per project standard). Log every draft to the existing `audit_log`. If the call fails, land rows *without* blurbs (raw title) rather than blocking the run — the digest notes "enrichment skipped."

---

## 7b. Image resolution (`ingest/images.ts`) — runs PRE-LANDING, every card gets a real image

Image resolution moved **before** `land` so the exact public image is attached to every row when it reaches the cockpit — approving a card approves its image. **Every card lands with a real image already in place**; the branded placeholder is a true last resort (cap exhausted, or even the paid source has nothing).

**Resolution waterfall (per card, in order — stop at the first hit):**

```ts
// ingest/images.ts
// For each candidate, walk the waterfall and resolve a REAL image for the card.
// FREE tiers, tried first (zero cost):
//   1. owned          (none at ingest time in v1 — reserved for a later "supply your own")
//   2. Pexels         (free API)
//   3. Wikimedia      (free API)
// PAID tier, fired AUTOMATICALLY when all free tiers miss — NOT deferred to review:
//   4. Google Places Photo — called during the nightly run for any free-tier-miss card,
//      provided the persisted monthly spend counter is under the cap.
// LAST RESORT only:
//   5. branded placeholder gradient — used ONLY when (a) the monthly cap is already hit
//      (overflow cards), or (b) Google Places also returned nothing. Either case is
//      noted in the digest so you know why a card has no photo.
//
// In addition to the chosen image, resolveImages ALSO gathers the other available
// candidates into candidate.photo_options[] (ranked) so the cockpit picker can swap
// among real, pre-fetched alternates with no per-click cost. photo_url / photo_source
// are set to options[0] (the chosen image).

export interface ImageOption {
  url: string;
  source: PhotoSource;          // 'owned'|'pexels'|'wikimedia'|'google'|'placeholder'
  width?: number; height?: number;
  attribution?: string;         // required for Wikimedia/Pexels credit
}
export async function resolveImages(cands: Candidate[]): Promise<Candidate[]>;
```

**Cost control specifics:**
- Maintain a persisted monthly counter (`image_spend` row or a Supabase KV) of Google Places Photo calls; **check it before each paid call**; never exceed the cap.
- **Cap behavior (decided):** when the cap is reached mid-month, further free-tier-miss cards get the **placeholder** (cheapest, safe) and are counted in the digest as "N cards over photo cap → placeholder." The cap is a hard ceiling; nothing auto-raises it.
- Cache resolved options by `place_id`/`photo_query` so re-runs don't re-pay (the Place Photo caching terms from audit flag B6 apply — re-confirm SKU at setup). Because the paid call now fires nightly for misses, caching is doubly important: a place resolved once should never trigger a second paid call.
- **Tradeoff acknowledged:** firing the paid fallback nightly means a card you later reject may have incurred one paid call. This is bounded by the cap and minimized by caching + the fact that most cards resolve on free tiers; it is the deliberate price of "every card arrives with a real image."

### 7c. Pre-fetched alternates for the cockpit picker

Alongside the chosen image, `resolveImages` gathers **up to 3–5 ranked options per card** (the real images the free + paid tiers returned, plus placeholder as the final entry), stored on `candidate.photo_options` and persisted with the row. This powers the Edit-mode picker (§9a) — the founder arrows through real, already-fetched thumbnails with no per-click cost. Because the paid tier already ran nightly, **a card showing a placeholder is the exception, not the norm** (it means the cap was hit or no image exists anywhere). (Supplying your own image is a **later** addition, not v1 — the `owned` slot exists in the type but is unused at ingest for now.)

---

## 8. Land + digest

```ts
// ingest/land.ts
// Insert each kept Candidate with status='needs_review' using
//   insert ... on conflict (id) do nothing
// so re-emitted rows are idempotent (exactly the seed pattern). Insert proposed_tags
// into thing_tags with tag_source='ai'. Insert/refresh recurring_schedules for T2
// (now including the frequency column). Write the source_runs + ingest_drops rows.

// ingest/digest.ts
// Compose the nightly email from source_runs + ingest_drops for this run:
//   "N new in queue · M dropped (breakdown by reason) · K sources down: <names>"
// One link to /admin/review. Send via a transactional email provider (Resend/SES).
```

---

## 9. The cockpit (maps 1:1 to `cockpit_wireframe.html`)

Build the wireframe as real components. The wireframe is the visual + interaction spec; these are the wiring notes.

**Route:** `app/admin/review/page.tsx` (auth-gated to founder; reuse existing magic-link/admin guard).

**Data in:** `GET /api/review/queue` returns `{ queue: Candidate[], drops: DropRecord[], sources: SourceRunSummary[] }` (today's run). `queue` sorted: T1/T2 by soonest `starts_at`, then T3 by newest.

**Components:**
- `ReviewQueue.tsx` (client) — owns keyboard handling (A/E/R, ↑↓, B), filter pills, optimistic remove-on-action with Undo toast. *Copy the keyboard + bulk-approve logic straight from the wireframe's script.*
- `ReviewCard.tsx` — one card. The **start-time trust block is the signature**: chip color from `start_strategy` (`structured`/`server_detail` → green "Deterministic start"; T2 monthly/biweekly → amber "Confirm cadence"; evergreen T3 → blue "Evergreen"), the mono `starts_at` string, and the provenance line linking `source_url`. The **image slot shows the live resolved image** (`photo_url`) with a small source-pill (`photo_source`: "Pexels"/"Wikimedia"/"Google Places"/"placeholder") as a second provenance signal. Inline-edit opens fields for blurb/tags/neighborhood **and the image picker** (§9a) — but **not** start time (to change a time you reject and re-ingest, preserving the gate guarantee).

### 9a. Edit-mode image picker (the arrow-through selector)

When the founder clicks **Edit** (or presses `E`) on a card, the image slot becomes interactive:

- Left/right **arrow buttons** (and ← / → keys while editing) cycle through `candidate.photo_options` — the 3–5 pre-fetched ranked thumbnails. Each shows its source-pill and attribution. **No network call per arrow** — they're already fetched, so it's instant and free.
- The currently-shown option is the selected one; a small **"Use this image"** confirmation (or just leaving it selected on Save) sets `photo_url` + `photo_source` to that option. **Every card already arrives with a real image selected**, so the daily action is *swapping* to a preferred alternate, not sourcing from scratch.
- **Rare placeholder case:** if a card shows the placeholder (only when the nightly cap was hit or no image exists anywhere), the picker shows a **"Try fetching a photo"** button. If the monthly cap still has room, it triggers one Google Places Photo call for that card and selects the result. If the cap is exhausted, the button is disabled with a short note ("Monthly photo budget reached — resets [date]"), so the placeholder is honestly the final state until the budget resets.
- Approving the card persists the chosen `photo_url`/`photo_source` to the published row. (v1 has no "upload your own" — that slot is reserved; see §7c.)

**Component:** extend `ReviewCard.tsx` with an `ImagePicker` subcomponent bound to `photo_options` and the card's selected index; on Save, write the selected option into the candidate before the approve call. A11y: arrows are real buttons with `aria-label="Previous image option"` / `"Next image option"`; the selected option is announced.

**API:** the single-card Google fetch (rare placeholder case) goes through `POST /api/review/image-fetch` `{ id }` → checks the cap, returns the new `ImageOption` (and increments the spend counter server-side) or a "cap reached" response; everything else needs no new endpoint since options are already on the row.
- `DroppedPanel.tsx` — renders `ingest_drops` for the run, each with reason + detail + a "Review manually" button that loads the raw payload for one-off rescue.
- `SourceHealth.tsx` — `source_runs` summary; green/amber/red dot per source; red = surfaced because `ok=false`.

**Actions out:**
- `POST /api/review/approve` `{ id }` → `status='published'`, write `audit_log` (actor=founder, action=approve). Returns ok; client animates the card out.
- `POST /api/review/reject` `{ id, reason }` → `status='archived'` + audit. (Rejected rows stay dq'd by their uuid5 id, so the same item won't re-land.)
- **Bulk-approve green:** client collects visible green-chip ids and calls approve in a batch; one Undo restores all.

**A11y (WCAG 2.2 AA floor):** visible focus rings (already in tokens), 44px targets, `aria-pressed` on filters, `aria-label` on icon buttons, reduced-motion honored.

---

## 10. The worker entrypoint + GitHub Action

```ts
// ingest/run.ts  — orchestrates the 7 steps, per-source isolation so one bad
// adapter can't sink the run (catch per adapter, mark source_runs.ok=false).
import { registry } from './adapters/registry';
import { gate } from './gate';
import { dedupe } from './dedupe';
import { enrich } from './enrich';
import { resolveImages } from './images';
import { land } from './land';
import { sendDigest } from './digest';

async function main() {
  const window = { fromISO: nowISO(), toISO: plusDaysISO(45) };
  const gated: Candidate[] = [];
  const dropRecords: DropRecord[] = [];

  for (const adapter of registry) {
    const run = await startRun(adapter.key);
    try {
      const raw = await adapter.fetch(window);
      run.fetched = raw.length;
      for (const r of raw) {
        const g = gate(r);
        if (g.ok) gated.push(g.candidate!);
        else dropRecords.push(toDrop(run.id, adapter.key, r, g));
      }
      run.qualified = gated.length; run.dropped = dropRecords.length;
      await finishRun(run, true);
    } catch (err) {
      await finishRun(run, false, String(err));   // surfaces in digest + source-health
    }
  }

  const { keep, drops } = dedupe(gated, await fetchPublished());
  dropRecords.push(...drops);
  const enriched = await enrich(keep);
  const withImages = await resolveImages(enriched);     // PRE-LANDING: free tiers, then paid
                                                         // Google fallback (auto, under cap),
                                                         // placeholder only if cap hit / no image
  await land(withImages, dropRecords);                  // card now shows the exact public image
  await sendDigest();
}
main();
```

```yaml
# .github/workflows/ingest.yml
name: nightly-ingest
on:
  schedule: [{ cron: '0 9 * * *' }]   # 02:00 America/Los_Angeles (09:00 UTC)
  workflow_dispatch: {}                # manual run button
jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install chromium   # only if any adapter needs JS render
      - run: node --loader tsx ingest/run.ts
        env:
          SUPABASE_URL:           ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE:  ${{ secrets.SUPABASE_SERVICE_ROLE }}
          TICKETMASTER_API_KEY:   ${{ secrets.TICKETMASTER_API_KEY }}
          ANTHROPIC_API_KEY:      ${{ secrets.ANTHROPIC_API_KEY }}
          GOOGLE_PLACES_KEY:      ${{ secrets.GOOGLE_PLACES_KEY }}
          RESEND_API_KEY:         ${{ secrets.RESEND_API_KEY }}
```

---

## 11. Phase checklist (execute in order; each gates the next)

**Phase 9 — Gate + schema.**
- [ ] Apply `2026xxxx_ingestion.sql`; backfill `frequency` for the two monthly/biweekly seed rows (1st Thursday → `monthly`; Funk Zone Art Walk → `biweekly`).
- [ ] Build `packages/shared/types.ts`.
- [ ] Build `ingest/gate.ts` + `resolveVenue` static map (seed from the 107 addresses).
- [ ] Build `fixtures/seed_rows.json` (parse the seed SQL) and `gate.test.ts`.
- [ ] **Exit:** all 107 fixtures pass; negative fixtures drop with correct reason; uuid5 IDs match the seed exactly.

**Phase 10 — Two adapters, end-to-end (no AI yet).**
- [ ] `adapters/types.ts`, `adapters/registry.ts`, `adapters/ticketmaster.ts`, `adapters/soho.ts`.
- [ ] `dedupe.ts`, `land.ts`, `db.ts`, `run.ts`; wire the Action with `workflow_dispatch`.
- [ ] **Exit:** a manual run lands real SOhO + Bowl rows as `needs_review`, idempotent on re-run, with drops + source_runs logged.

**Phase 11 — Batch Claude enrichment.**
- [ ] `enrich.ts` (one call; negative-rule validation; audit_log).
- [ ] **Exit:** landed rows have house-voice blurbs + tags; start times provably untouched (diff test: `starts_at` identical pre/post enrich).

**Phase 12 — Cockpit.**
- [ ] `/admin/review` route + the four components + the three API routes (+ `image-fetch`).
- [ ] `ReviewCard.tsx` renders the live `photo_url` + source-pill; build the `ImagePicker` subcomponent (arrow through `photo_options`, select, Save persists the pick).
- [ ] **Exit:** clear a seeded `needs_review` queue end-to-end from one screen with keyboard only; approve writes published + audit; bulk-approve + Undo work; **arrowing through image alternates on Edit changes the saved image with no per-arrow fetch.**

**Phase 13 — Remaining adapters + digest + image pipeline.**
- [ ] `visitsb.ts`, `independent.ts`, `citySites.ts`, `livenotes.ts`, `googlePlaces.ts` (closure detection → archive permanently-closed places).
- [ ] `images.ts`: free-tier resolution (Pexels/Wikimedia) first, then **Google Places Photo fired automatically for any free-tier miss** while under the cap, so every card lands with a real image; placeholder only when the cap is hit or no image exists. Persisted monthly spend counter enforcing the cap (overflow → placeholder, logged in digest); per-`place_id` caching so no place is paid for twice. **Re-confirm Place Photo SKU pricing + caching terms now (audit flag B6).**
- [ ] `digest.ts` + email provider; switch the Action to the `schedule` cron.
- [ ] **Exit:** full nightly run across all sources; **every card arrives with a real image** (free-sourced where possible, Google-sourced otherwise), with placeholders only on genuine misses/cap-overflow; one digest email summarizes new/dropped/down/image-cap-status; a deliberately-broken adapter shows red in source-health and in the digest, not in production.

**Phase 14 — Recurring registry + hardening.**
- [ ] `recurringRegistry.ts` honoring `frequency`; day-confirmed/time-unknown rhythms land `starts_at=null` with a flag (never a guessed time).
- [ ] Per-adapter `useManagedScrape` hook (the Option-C reserve) — flip one flag to route a blocked source through Scrapfly/Apify.
- [ ] **Exit:** pipeline runs unattended nightly; founder spends ≤15 min/day in the cockpit; incremental cost sits ~$0–15/mo with headroom under the $50 cap.

---

## 12. Guardrails to paste into `CLAUDE.md`

```
INGESTION INVARIANTS (do not violate):
1. AI never writes or edits a start time/date. enrich.ts may only set blurb,
   blurb_long, proposed_tags. The gate runs BEFORE Claude; no-start rows are
   already gone.
2. startStrategy has exactly three honest values: structured, server_detail, none.
   If a source only gives prose ("8-ish","dusk", weekday-only) emit 'none' and let
   the gate drop it. Never regex a guess into startISO.
3. Ingestion is sponsor-blind: never set is_featured or any sponsor field.
4. Ingestion never publishes. Everything lands status='needs_review'. Only the
   cockpit approve action (a human tap) sets status='published'.
5. Every drop is logged to ingest_drops with a reason. Nothing is silently discarded.
6. Idempotency via uuid5 + 'on conflict (id) do nothing' — exactly the seed pattern.
7. Optional fields (local_note, ends_at, buy_url, price_band) blank never drops a row.
8. Tier-3 requires reason_to_go; price_band is 'free' only if the source says so.
```
