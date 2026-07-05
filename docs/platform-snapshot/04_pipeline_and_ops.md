# 04 · Pipeline & Ops — as-built snapshot

| | |
|---|---|
| **Repo** | `sb-daymaker` |
| **Branch** | `main` |
| **Commit** | `caa73028f1fb2bde2f3a50a62a999417ec3e5c65` (`caa7302`) |
| **Snapshot date** | 2026-07-03 |
| **Next.js** | 16.2.9 |
| **Node (worker)** | 22 (required — supabase-js realtime needs native WebSocket) |
| **Anthropic SDK** | `@anthropic-ai/sdk` (batch enrich model `claude-haiku-4-5`) |

> READ-ONLY as-built record. Code is the source of truth; drift from
> `Core Project Files/CLAUDE.md` / the build-plan docs is flagged inline as **[DRIFT]**.
> No secrets — env vars are named only.

---

## 0. Cron / scheduled-job inventory

There are **two** live schedulers plus **two deprecated / no-op** HTTP cron endpoints.

| Job | Scheduler | Schedule (cron) | Local time | Entry point | Auth gate |
|---|---|---|---|---|---|
| **Nightly ingest** | GitHub Action `.github/workflows/ingest.yml` (`nightly-ingest`) | `0 9 * * *` | 02:00 America/Los_Angeles (PDT); 01:00 PST in winter | `npx tsx ingest/run.ts` | GitHub secrets; runner is trusted |
| **Manual ingest** | same workflow, `workflow_dispatch` | on demand | — | same, with `enrich_backfill`/`image_backfill` boolean inputs → `ENRICH_BACKFILL=1` / `IMAGE_BACKFILL=1` | GitHub UI (repo write) |
| **Reaper** | Vercel cron `vercel.json` | `0 8 * * 1` | Mon 08:00 UTC (weekly) | `GET /api/cron/reaper` | `CRON_SECRET` bearer token |
| **Nightly HTTP (retired)** | none (Vercel cron entry removed) | — | — | `GET /api/cron/nightly` | returns `{ok:false, deprecated:true}` no-op |

Notes:
- The GitHub Action has `timeout-minutes: 20` at the job level — the single hard
  wall-clock cap on the whole nightly pipeline.
- `.github/workflows/ingest.yml` steps: `actions/checkout@v4` → `actions/setup-node@v4`
  (`node-version: '22'`) → `npm ci` → `npx tsx ingest/run.ts`.
- Secrets/env passed to the run step (names only): `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE`, `TICKETMASTER_API_KEY`, `ANTHROPIC_API_KEY`,
  `PEXELS_API_KEY`, `GOOGLE_PLACES_KEY`, `RESEND_API_KEY`, `DIGEST_TO`,
  `NEXT_PUBLIC_SITE_URL`, `MANAGED_SCRAPE`, `SCRAPFLY_KEY`, `SEATGEEK_CLIENT_ID`.
- The workflow comment states each optional key "degrades gracefully (free image
  sources only / placeholders / digest skipped), never a hard failure" — confirmed
  in code (see fail-soft notes below).

**[DRIFT / carry-over]** `CHECK_CLOSURES=1` and `CLOSURE_MAX_PER_RUN` are read by
`ingest/adapters/googlePlaces.ts` but are **not** set in the workflow env, so
permanent-closure detection is effectively **off in every scheduled run**
(`detectClosures` returns `0` immediately when `CHECK_CLOSURES !== '1'`). The header
comment claims "the weekly run sets it" — there is no weekly run of `ingest/run.ts`
in this repo (the only weekly cron is the reaper, which does not run the worker).

---

## 1. Nightly orchestrator — `ingest/run.ts` step-by-step (as implemented)

Entry: `main().catch(...)` at `ingest/run.ts:281-284`; on any uncaught throw it logs
`[ingest] fatal:` and `process.exit(1)` — the **only** way the whole run hard-fails.

Env flags read at top (`ingest/run.ts:25-28`):
- `WINDOW_DAYS = 45` (constant) → fetch window is now .. now+45d.
- `DRY_RUN=1` → `DRY` (prints tallies, writes nothing, **skips the Claude call and
  images entirely**).
- `ENRICH_BACKFILL=1` → `BACKFILL` (branch to `backfillEnrich`, returns early).
- `IMAGE_BACKFILL=1` → `IMAGE_BACKFILL` (branch to `backfillImages`, returns early).

`main()` dispatch (`ingest/run.ts:137-139`): backfill flags short-circuit before the
normal pipeline. Otherwise the normal flow below runs.

### Step 1 — FETCH + GATE, per source, isolated (`run.ts:151-186`)

For each `adapter` in `registry` (order = `ingest/adapters/registry.ts:49-68`):
1. `startRun(sb, adapter.key)` inserts a `source_runs` row (`land.ts:64-72`); in DRY
   mode a synthetic in-memory `RunRow{id:0}` is used.
2. `adapter.fetch(win)` → `RawCandidate[]`. **Per-source try/catch** (`run.ts:180-185`):
   any throw is caught, logged `… ERROR: <msg>`, the run is `finishRun(..., false, msg)`
   (marks `ok=false`, records the error string), and the source is deleted from the
   `runs` map so it isn't finished twice. **One bad adapter cannot sink the run.**
3. Each raw candidate → `gate(r)` (`ingest/gate.ts:72`). On `!ok` it becomes a
   `DropRecord` (reason `no_title`/`no_address`/`no_source`/`no_start`/
   `registry_incomplete_time`), `run.dropped++`, skipped.
4. Registry candidates (`r.registryCandidate`) additionally checked against the live
   `recurringRegistry.ts` file via `isAlreadyInRegistry(r)` (`run.ts:167`); a match is
   dropped with reason `registry_exists` (no DB round-trip — pure file compare).
5. Passing rows push `{cand, sourceKey}` into `gated`, `run.qualified++`.
6. Drops for the source are written via `recordDrops(sb, run.id, drops)`
   (`ingest_drops` table).

**Output:** `gated: {cand, sourceKey}[]`, populated `runs` map, `totalFetched`,
`totalGateDropped`. Per-source console line: `<label> fetched N qualified N dropped N`.

### Step 2 — DEDUPE (`run.ts:188-199`)

- Loads existing DB rows in the window with a non-null `starts_at`
  (`things.select('id,title,starts_at,source')` between `fromISO`/`toISO`).
- `dedupe(gated.map(g => g.cand), existing)` → `{keep: deduped, drops: dedupeDrops}`.
- Algorithm traced in §2.
- **Output:** `deduped: Candidate[]`, `dedupeDrops: DropRecord[]`.

### Step 3 — ENRICH (`run.ts:201-203`)

- `keep = DRY ? deduped : await enrich(deduped, {sb})`. In DRY mode Claude is **not**
  called (`enrich skipped — dry run`).
- **This is the only Claude call in the nightly path.** Model
  **`'claude-haiku-4-5'`** — `ingest/enrich.ts:19` (`const MODEL = 'claude-haiku-4-5'`).
- System prompt: `ingest/enrich.ts:26-35` (`SYSTEM`). Tool schema `enrich_batch`:
  `ingest/enrich.ts:104-140`. User message assembled at `ingest/enrich.ts:175`.
- **Trust guarantee:** `buildItems` (`enrich.ts:50-62`) deliberately omits
  `starts_at`/`ends_at` from the payload, so the model can never see or alter a start
  time. `mergeEnrichment` (`enrich.ts:89-102`) only ever writes `blurb`/`blurb_long`/
  `proposed_tags`; all other fields are `...c` byte-identical.
- **Chunking:** `CHUNK_SIZE = 20` (`enrich.ts:161`); processed **sequentially**.
  `max_tokens = min(8000, max(1024, chunk.length*250))` (`enrich.ts:168`).
- **Timeout / retry:** client is `new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 })`
  (`enrich.ts:200`) — 90 s per call, 1 SDK retry.
- **Fallback / partial failure:** three layers, all fail-soft:
  - No `ANTHROPIC_API_KEY` → returns candidates unchanged, logs
    `landing rows with plain titles` (`enrich.ts:194-198`).
  - A chunk that throws (timeout/API error) is caught per-chunk (`enrich.ts:218-223`);
    that chunk's originals are pushed unchanged — the rest of the batch still enriches.
  - `enrichChunk` with no `tool_use` block in the response returns the chunk unchanged
    (`enrich.ts:178`).
- **Audit:** `logDrafts` inserts an `audit_log` row (`action:'ai_draft'`, `actor:'ai'`,
  `payload.model = MODEL`, averaged confidence) per enriched candidate (`enrich.ts:142-156`).
- **Code-side negative tag rules** (never delegated to the model) in
  `applyNegativeRules` (`enrich.ts:65-79`): drop off-enum tags, dedupe keeping highest
  confidence, `is_21_plus` ⇒ no `family_day`, non-free ⇒ no `free_sb`.
- **Output:** `keep: Candidate[]` (blurbs + proposed_tags attached).

**[NOTE — second, unused Haiku call]** `lib/enrich.ts:81` has a **separate**
per-item Haiku call (`model: "claude-haiku-4-5"`, tool `enrich`, 30 s timeout,
`maxRetries: 1`). It is reached only via `lib/pipeline.ts` → `runNightly`, which is
imported by `app/cockpit/actions.ts` (cockpit "run" action) and the **retired**
`app/api/cron/nightly` note. It is **not** part of the GitHub-Action nightly path.
So there are two live model IDs in the repo, both `claude-haiku-4-5`, but only
`ingest/enrich.ts` runs on the schedule.

### Step 4 — IMAGES (`run.ts:205-213`)

- Skipped entirely in DRY mode (`if (sb)` guard).
- `resolveImages(keep, sb)` → `{cands: toLand, stats}` (see §3).
- Console: `images free N google N placeholder N over-cap N`.
- **Output:** `toLand: Candidate[]` with `photo_url`/`photo_source`/`photo_options`.

### Step 5 — attribute counts (`run.ts:215-221`)

- Each `dedupeDrop` increments its source's `run.dropped`.
- Each kept candidate increments its origin source's `run.landed` (via `keptIds`).
- Purely bookkeeping for the digest / `source_runs`.

### Step 6 — LAND (`run.ts:223-239`, all inside `if (sb)`)

1. `dedupeDrops` are bucketed by their source's `run.id` and written via `recordDrops`
   (drops whose source-run errored / has `id:0` are silently skipped — `if (id)`).
2. `landCandidates(sb, toLand)` — upsert into `things` on conflict `id`,
   `ignoreDuplicates:true`; returns count NEWLY landed (`land.ts:95-103`). All land as
   `status='needs_review'`.
3. `landTags(sb, toLand)` — upsert `thing_tags` (`tag_source:'ai'`) on `thing_id,tag`
   (`land.ts:107-123`).
4. `landRecurring(sb, toLand)` — upsert `recurring_schedules` on
   `thing_id,day_of_week,category`; `start_time` may be null (time TBD, never guessed)
   (`land.ts:127-147`).
5. `finishRun(sb, run, true)` for every remaining run (`ok=true`).
- **Output:** `landed` count.

### Step 7 — SUMMARY (`run.ts:241-255`)

- Console: `N fetched · N kept · N gate-dropped · N dedupe-dropped · N newly landed`.
- DRY mode prints up to 200 "would land" lines then returns (no closures/digest).

### Step 8 — CLOSURES + DIGEST (`run.ts:257-278`, live only)

1. `consumeDirectives(sb, toLand)` (restock) wrapped in its own try/catch
   (`run.ts:261-266`) — a failure logs `restock skipped:` and never sinks the run.
   Informational only: it counts how many of tonight's candidates match each queued
   `restock_directives` scope, marks the directive `done`, writes an `audit_log` row,
   and **lands nothing extra** (`ingest/restock.ts:39-74`). Never overwrites
   `things.source` (which is the uuid5 dedupe key).
2. `detectClosures(sb)` (`ingest/adapters/googlePlaces.ts:30`) — **no-op unless
   `CHECK_CLOSURES=1`** (not set in the workflow → returns 0). When enabled: Google
   Places (New) `businessStatus`, up to `CLOSURE_MAX_PER_RUN` (default 80) oldest
   places, archives `CLOSED_PERMANENTLY`, counts calls against the shared
   `image_spend` monthly cap.
3. `sendDigest(sb, {...})` (§4). **Not** wrapped in try/catch at the call site — a
   throw here (unlikely; `sendEmail` swallows its own errors) would bubble to the
   top-level fatal handler. All of §8 runs only on live (non-DRY) runs.

### Partial-failure behavior summary

| Failure | Effect |
|---|---|
| One adapter `fetch` throws | source_run `ok=false`, error stored, run continues |
| Enrich key missing / chunk error / no tool_use | rows land with plain titles, run continues |
| Image source miss/error | falls through waterfall to placeholder, run continues |
| Restock directive error | that directive `failed`, others continue, run continues |
| Closures disabled/missing key | returns 0, no-op |
| Digest key missing | logged skip, no throw |
| **Uncaught throw anywhere else** (e.g. a `land.ts` DB error) | `[ingest] fatal:` + `process.exit(1)` → GitHub Action fails |

---

## 1b. Reaper — `app/api/cron/reaper/route.ts`

- `export const dynamic = "force-dynamic"`. `GET(req)`.
- **CRON_SECRET gate:** reads `process.env.CRON_SECRET`; requires header
  `Authorization: Bearer ${CRON_SECRET}`. If `CRON_SECRET` is unset **or** the header
  doesn't match → `401 {ok:false, error:"unauthorized"}`. Vercel Cron injects this
  header automatically.
- If `getAdminSupabase()` returns null → `500 {error:"not configured"}`.
- Action: deletes `shared_states` rows with `last_accessed_at < now-90d` (sliding
  expiry of share/restore tokens), `count:"exact"`; returns `{ok:true, deleted:count}`.
- No AI, no email, no ingest. Purely a token-GC job.

---

## 2. Ingestion sources — wired vs. catalogue

Registry file: `ingest/adapters/registry.ts:49-68` (order is load-bearing — it mirrors
the dedupe canonical-source ranking). **32 adapters registered** (there is no
`enabled` boolean; presence in the array = active). Two are **code-present but return
`[]`** (functionally disabled). The "~23-source" catalogue is exceeded here because
several waves and registry-bound rhythm adapters were added.

### Adapter table (all 32, in registry order)

| # | Key | Label | Parse method | Fetch helper | Status |
|---|---|---|---|---|---|
| 1 | `ticketmaster` | Ticketmaster (SB) | **API** — Discovery v2 `events.json` (`apikey`, `latlong`) | native `fetch` | **LIVE** (needs `TICKETMASTER_API_KEY`) |
| 2 | `soho` | SOhO | **Cheerio HTML scrape** (regex + `cheerio.load`) | `./http` `fetchHtml` | **LIVE** |
| 3 | `sbbowl` | SB Bowl | HTML scrape | `_shared/fetchHtml` polite | **LIVE** |
| 4 | `lobero` | Lobero | HTML scrape | `_shared/fetchHtml` polite | **LIVE** |
| 5 | `granada` | Granada | **WP `tribe_events` + ICS + JSON-LD** (multi-strategy) | polite + `wpEvents`/`ics`/`jsonLd` | **LIVE** |
| 6 | `arlington` | Arlington | WP tribe_events + ICS + JSON-LD | polite + shared | **LIVE** |
| 7 | `musicacademy` | Music Academy | HTML scrape | polite | **LIVE** |
| 8 | `alcazar` | Alcazar | WP tribe_events + ICS + JSON-LD | polite + shared | **LIVE** |
| 9 | `centerstage` | Center Stage | HTML scrape | polite | **LIVE** |
| 10 | `carpinteriaArts` | Carpinteria Arts | **ICS** (public Google Calendar iCal) | `ics` (plain fetch) | **LIVE** |
| 11 | `newVic` | New Vic (ETC) | JSON-LD + HTML | polite + `jsonLd` | **LIVE** |
| 12 | `moxi` | MOXI | **WP tribe_events + ICS** | `wpEvents`/`ics` (plain fetch) | **LIVE** |
| 13 | `naturalHistory` | Natural History | WP tribe_events + ICS + JSON-LD | polite + shared | **LIVE** |
| 14 | `botanicGarden` | Botanic Garden | WP tribe_events + ICS + JSON-LD | polite + shared | **LIVE** |
| 15 | `sbma` | SB Museum of Art | WP tribe_events + ICS + JSON-LD | polite + shared | **LIVE** |
| 16 | `ucsb` | UCSB | **Custom RHC / "Calendarize it!" JSON** endpoint | plain fetch (UA) | **LIVE** |
| 17 | `libraries` | Libraries | HTML scrape | polite | **LIVE** |
| 18 | `independent` | The Independent | **Cheerio HTML scrape** | `./http` `fetchHtml` | **LIVE** |
| 19 | `citySites` | City sites | HTML scrape | `./http` `fetchHtml` | **LIVE** |
| 20 | `goletaCivic` | Goleta civic | **Localist API + ICS + JSON-LD** | polite + `localist`/`ics`/`jsonLd` | **LIVE** |
| 21 | `carpinteriaCivic` | Carpinteria civic | WP tribe_events + JSON-LD | polite + shared | **LIVE** |
| 22 | `downtownSB` | Downtown SB | HTML scrape (also `registryCandidate:true`) | polite | **LIVE** |
| 23 | `coastalView` | Coastal View | HTML scrape | (per-adapter) | **LIVE** |
| 24 | `sbcountyArts` | SB County Arts | HTML/feed | (per-adapter) | **LIVE** |
| 25 | `eventbrite` | Eventbrite (SB) | (planned API) | — | **DISABLED — returns `[]`** |
| 26 | `allevents` | AllEvents (SB) | (planned scrape) | — | **DISABLED — returns `[]`** |
| 27 | `seatgeek` | SeatGeek | **API** — `api.seatgeek.com/2/events` (`client_id`) | native `fetch` | **LIVE** (needs `SEATGEEK_CLIENT_ID`) |
| 28 | `farmersMarkets` | Farmers markets | Registry-bound (`registryCandidate:true`) | hardcoded rhythms | **LIVE** |
| 29 | `nightlifeRhythms` | Nightlife rhythms | Hardcoded schedules (`registryCandidate:true`) | none | **LIVE** |
| 30 | `outdoorsOperators` | Outdoors operators | Hardcoded schedules (`registryCandidate:true`) | none | **LIVE** |
| 31 | `natureProgramsFree` | Free nature programs | HTML/hardcoded | (per-adapter) | **LIVE** |
| 32 | `registry` (`recurringRegistry`) | Recurring registry | **Curated in-file `RHYTHMS[]`** | DB dedupe read | **LIVE** |
| 33 | `submission` (`submissions`) | Public submissions | **DB read** — `submissions` table (`status='new'`) | Supabase | **LIVE** |

(`recurringRegistry` and `submissions` sit at the end so they lose all dedupe ties.)

**Disabled adapters (return `[]`):**
- `eventbrite` (`ingest/adapters/eventbrite.ts:22-26`): Eventbrite is a React SPA;
  server HTML is an empty shell. Comment says the real path is Eventbrite API v3 with a
  free `EVENTBRITE_TOKEN` secret — **[DRIFT vs §8.1]** (doc expected server-rendered HTML).
- `allevents` (`ingest/adapters/allevents.ts:22-26`): also a client-rendered SPA, no
  public API. Comment notes Scrapfly-with-JS would work but `useManagedScrape` is kept
  off per founder directive — **[DRIFT vs §9.3]**.

### Parse-method families in `_shared/`

- `jsonLd.ts` — schema.org `Event` JSON-LD extraction.
- `localist.ts` — Localist calendar API (`goletaCivic`, and `ucsb` uses a custom
  RHC/Calendarize-it variant, not this helper).
- `wpEvents.ts` — WordPress "The Events Calendar" (`tribe_events`) REST + route discovery.
- `ics.ts` — iCalendar / `.ics` feed parsing.
- `fetchHtml.ts` (polite) — 15 s timeout, per-source 500 ms rate limit, runtime
  robots.txt check (fail-open on network error; `robots_disallow` throw on deny),
  and a fall-back to `./http` `baseFetch` on timeout when not managed.
- `geoFilter.ts`, `occasionTags.ts`, `inferYear.ts`, `relativeDate.ts` — normalization.

### Dedupe algorithm — `ingest/dedupe.ts`

Two layers, run **in-batch AND against existing DB rows in the window** (`dedupe.ts:127-172`):
1. **EXACT id** — the uuid5 `id` (from `gate.idFor`, keyed `source|title`, places on
   the `seed:google_places|title` sentinel). Already-in-DB (`existingIds`) or repeated
   in this batch → dropped, reason `duplicate` (`dedupe.ts:152-153`).
2. **NEAR** — title trigram (Dice coefficient over char trigrams, `titleSimilarity`,
   `dedupe.ts:106-121`) `> NEAR_THRESHOLD (0.55)` **AND** same SB calendar day
   (`sbDateKey` via `ingest/tz.ts`). Checked against already-kept-this-run rows and
   against existing DB rows.
- **Canonical-source preference:** candidates are sorted by `sourceRank` (a
  `[RegExp, number]` table, `dedupe.ts:37-77`) so lower-rank (venue-direct) sources are
  processed first and the weaker source's near-dupe is the one dropped. Rank order:
  venue-direct ticketing (soho 0 … 9) → structured APIs (ticketmaster/livenation/axs 10)
  → institution-direct (moxi 15 … library 21) → civic/curated (independent 30 … 37) →
  aggregators (eventbrite 50, allevents 51, seatgeek 52) → unknown 99.
- **[DRIFT — flagged in code]** `dedupe.ts:33-36`: Doc 16 proposes `SOURCE_PRIORITY`
  as a string-key `as const` array; the code instead uses **URL-pattern (RegExp)
  matching**. Author kept the code structure and flagged the mismatch (`§0 mismatch`).

### MANAGED_SCRAPE / Scrapfly switch — `ingest/adapters/http.ts`

- **Off by default.** `isManaged(sourceKey, flag)` (`http.ts:13-17`) returns true only
  if the adapter sets `useManagedScrape:true` **or** the source key appears in the
  comma-separated `MANAGED_SCRAPE` env list.
- When managed, `managedGet` routes the page through **Scrapfly**
  (`api.scrapfly.io/scrape?...&render_js=true&asp=true&country=us`, `http.ts:19-45`),
  requiring `SCRAPFLY_KEY` (throws `MANAGED_SCRAPE on but SCRAPFLY_KEY not set` if
  absent). Comment: Apify is "a one-function swap."
- **Every registered adapter currently sets `useManagedScrape: false`** (verified
  across all Wave adapters). With `MANAGED_SCRAPE` unset, no source is fronted by
  Scrapfly today. It's a break-glass reserve — the two SPA sources (`eventbrite`,
  `allevents`) are the intended candidates but are left off per founder directive.
- `_shared/fetchHtml.ts` polite fetcher passes `opts.managed` through but the Wave
  adapters call it without the flag, and its timeout-fallback re-enters `./http`
  `baseFetch` (which re-checks `isManaged`).

---

## 3. Image resolver — `ingest/images.ts`

Called once per live run (`run.ts:209`) as `resolveImages(keep, sb)`; also reused by
the `IMAGE_BACKFILL` path (`run.ts:100-135`, with a `force` option that bypasses cache).

### Waterfall order (quoted from `ingest/images.ts:5-10` header, matching code)

```
0. image_cache (per place)  -> zero cost, never re-pay
1. Pexels        (free)
2. Wikimedia     (free)
3. Google Place Photo (PAID) -> only if free tiers miss, the card has a place_id,
   and the persisted monthly counter is under the cap. Counts every Google call.
4. branded placeholder      -> ONLY if the cap is hit or no image exists anywhere.
```

Implementation detail (`images.ts:154-204`):
- **Cache key** = `place_id` if present, else normalized `title|neighborhood`
  (`cacheKey`, `images.ts:33-37`).
- Cache is batch-loaded up front from `image_cache` for all keys (`images.ts:147-152`).
  A cache hit with a real (non-placeholder) `photo_source` short-circuits the whole
  waterfall for that card (unless `force`).
- On a miss it gathers **all free alternates first** so the cockpit picker can arrow
  through them: `pexelsMany(q, 3)` (up to 3 Pexels) then `wikimedia(q)` (one).
- **Google is only reached** when `!found.length && c.place_id && GOOGLE_KEY` AND
  `calls < CAP` (`images.ts:171-178`). Each Google request calls `onCall()` — it makes
  **two billable calls** per photo (Place Details `photos` field, then Place Photo
  media). If the cap is hit while free missed, `stats.overCap++` and it falls to
  placeholder.
- `rankOptions` (`images.ts:46-50`) orders `owned > pexels > wikimedia > google` and
  **always appends** a `placeholder` option as the final alternate.
- The chosen result and full option list are upserted into `image_cache`
  (`onConflict:'place_key'`) so a place is never re-fetched/re-paid (`images.ts:196-203`).

### Cost exposure & guardrails

- **Cap:** `CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1400)` (`images.ts:19`)
  — comment "~$10 at $0.007/call". Monthly counter persisted in `image_spend`
  (`month`, `google_calls`, `over_cap`) keyed by UTC `YYYY-MM` (`images.ts:118-130`);
  loaded at start, saved once at the end (`images.ts:143,206`).
- **Free-first + per-place caching** keep real spend ≈ $0; the monthly cap is the only
  runaway guard. `IMAGE_MONTHLY_CALL_CAP` is **not** set in the workflow → default 1400.
- Pexels needs `PEXELS_API_KEY`; Google needs `GOOGLE_PLACES_KEY`; both degrade to
  `[]`/`null` on missing key or error (each network source is wrapped in try/catch and
  returns null/[] on any failure — `images.ts:56-114`).
- Every card always lands with *something*: a real image or the branded placeholder
  (`land.ts:46` defaults `photo_source` to `'placeholder'`).
- **Shared cap:** `googlePlaces.detectClosures` charges the **same** `image_spend`
  monthly counter, so closure checks and photo fetches compete for one budget.

---

## 4. Email / edition pipeline

### 4a. Nightly digest — `ingest/digest.ts` (operator email)

- `sendDigest(sb, summary)` (`digest.ts:26`). Recipient = `process.env.DIGEST_TO`; if
  unset → logs `digest skipped — DIGEST_TO not set` and returns (`digest.ts:27-28`).
- Assembles from the **last ~2 hours** of DB activity (`since = now - 2h`,
  `digest.ts:30`): total `needs_review` count, this run's `ingest_drops` (by reason),
  and this run's `source_runs` (per-source landed/fetched, 🟢/🔴 up/down).
- Also folds in image stats (`free · google · placeholder`), an over-cap warning, and
  the archived-closures count from the summary object.
- Subject: `SB Daymaker — {queued} in review queue ({landed} new tonight)`. Body is a
  hand-rolled HTML table with a `→ Review the queue` button to
  `${NEXT_PUBLIC_SITE_URL}/admin/review` (default `https://www.sbdaymaker.com`).
- Sent via `sendEmail` (`lib/email.ts`); logs sent/skipped.
- **Cadence: every live run** (i.e. every night, and every manual dispatch), **not**
  2×/week. This is the founder/operator ops digest, not the public reader edition.

### 4b. `lib/email.ts` — Resend transport

- Minimal REST call to `https://api.resend.com/emails` (no SDK). Uses
  `RESEND_API_KEY` (returns **false**, never throws, if unset), `from` = `RESEND_FROM`
  or default `SB Daymaker <onboarding@resend.dev>` (**[NOTE]** still the resend.dev
  sandbox sender — no verified domain wired). All errors swallowed → returns false.

### 4c. Subscribe / confirm / unsubscribe (public reader digest)

- `POST /api/subscribe` (`app/api/subscribe/route.ts`): validates email, calls RPC
  `subscribe_email` → `{status, confirm_token, unsubscribe_token}`. If already
  `confirmed` → `{status:"already"}`. Otherwise **double-opt-in**: emails a
  `/confirm?token=…` link (and an unsubscribe link) via `sendEmail` (no-op if Resend
  unconfigured). Returns `{status:"pending"}`.
- `/unsubscribe` (`app/unsubscribe/page.tsx`): server component, `robots:noindex`,
  calls RPC `unsubscribe(p_token)`; renders "You're unsubscribed" / "Link not valid".
- **[GAP]** There is a subscribe/confirm/unsubscribe flow and an operator ops-digest,
  but **no code in this snapshot assembles or sends a recurring public reader edition**
  (no 2×/week "weekend digest" sender was found). The subscriber list is collected;
  the edition that would go to it is not built here. The build-plan's "2×/week cadence"
  is therefore **not implemented as a scheduled send** — flag for the ops owner.

---

## 5. Error visibility — how failures surface to the operator

Blunt answer: **mostly they don't, unless you read logs or the nightly ops digest.**

Signal channels, in order of usefulness:

1. **The nightly ops digest email** (`ingest/digest.ts`) — the primary operator-facing
   signal. It lists 🔴 down sources with their error string and a drops breakdown. But:
   it only fires if `DIGEST_TO` **and** `RESEND_API_KEY` are set, it's sent from the
   resend.dev sandbox sender, and it covers only the last ~2 h window. A source that
   fetched 0 rows silently (SPA returning `[]`, e.g. eventbrite/allevents) shows as
   🟢 with `0 new / 0 fetched` — **no distinction between "healthy but empty" and
   "quietly broken."**
2. **`source_runs` + `ingest_drops` tables** — every run/adapter records `ok`,
   `error`, counts, and per-drop reasons. Visible to the `/admin/review` cockpit and
   queryable, but there is **no alerting** on top of them.
3. **GitHub Action job status** — the workflow fails (red X, and any configured GH
   notifications) **only** on an uncaught throw that hits `process.exit(1)`
   (`run.ts:281-284`). Because the pipeline is aggressively fail-soft (per-adapter
   try/catch, per-chunk enrich fallback, per-source image fallback, isolated restock),
   **most real problems never fail the Action** — they land as `ok=false` rows or
   plain-title / placeholder cards and continue.
4. **Console logs** — rich `console.log` throughout, but they live only in the GitHub
   Action run logs; nobody is paged.

Not wired: no Sentry/error-tracking, no Slack/webhook alert, no dead-man's-switch for a
**missed** run (if the Action never fires, nothing notices). `enrich`/image/Resend
failures are logged and swallowed. The honest summary: **the only push signal is the
nightly digest email; everything else is pull (logs / cockpit tables), and a silently
empty adapter or a skipped run produces no alarm at all.**

---

## Load-bearing files (quick index)

- Orchestrator: `ingest/run.ts`
- Gate: `ingest/gate.ts` · Dedupe: `ingest/dedupe.ts` · Land: `ingest/land.ts`
- Enrich (Claude `claude-haiku-4-5`): `ingest/enrich.ts` (unused twin: `lib/enrich.ts`)
- Images: `ingest/images.ts` · Closures: `ingest/adapters/googlePlaces.ts`
- Digest: `ingest/digest.ts` · Transport: `lib/email.ts`
- Registries: `ingest/adapters/registry.ts`, `ingest/adapters/recurringRegistry.ts`
- Managed-scrape switch: `ingest/adapters/http.ts` · Polite fetch: `ingest/adapters/_shared/fetchHtml.ts`
- Reaper: `app/api/cron/reaper/route.ts` · Schedulers: `.github/workflows/ingest.yml`, `vercel.json`
