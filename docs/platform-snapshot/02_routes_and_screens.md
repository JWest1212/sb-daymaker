# 02 — Routes & Screens (as-built)

| Field | Value |
|---|---|
| Repo | `sb-daymaker` |
| Branch | `main` |
| Commit | `caa73028f1fb2bde2f3a50a62a999417ec3e5c65` (`caa7302` — "feat(cockpit): Cockpit v2 admin redesign") |
| Snapshot date | 2026-07-03 |
| Framework | Next.js **16.2.9** (App Router) · React **19.2.4** / react-dom 19.2.4 |
| Key deps | `@supabase/ssr ^0.12.0`, `@supabase/supabase-js ^2.108.2`, `@anthropic-ai/sdk ^0.105.0`, `cheerio ^1.2.0`, `uuid ^11.1.0` |

> READ-ONLY snapshot. Where code contradicts CLAUDE.md / build-plan prose, the code is reported as truth and the conflict is flagged. Env vars named only; no secrets.

## Route inventory (from `find app`)

**Page routes:** `/` (Explore), `/saved`, `/discover`, `/discover/[id]`, `/submit`, `/thing/[id]` (in-shell) · `/plan`, `/s/[token]`, `/p/[token]`, `/r/[token]`, `/confirm`, `/unsubscribe`, `/offline`, `/cockpit`, `/cockpit/login`, `/admin/review`, `/admin/coverage`, `/admin/catalog`, `/admin/heroes`.

**API routes:** `/api/subscribe`, `/api/cron/reaper`, `/api/cron/nightly`, `/api/review/{queue,approve,reject,update,image-fetch}`, `/api/admin/catalog/{route,edit,delete}`, `/api/admin/coverage/{route,cell}`, `/api/admin/hero-eligible`, `/api/admin/hero-pins`, `/api/admin/restock/{route,list}`.

**Layouts:** root (`app/layout.tsx`), `(app)/layout.tsx` (phone shell), `admin/layout.tsx` (cockpit shell + auth gate), `plan/layout.tsx`, `p/[token]/layout.tsx`.

### Rendering strategy at a glance

| Route | Strategy | Note |
|---|---|---|
| `/` Explore | **SSR** (`export const dynamic = "force-dynamic"`) | Fresh DB read every request |
| `/saved` | **ISR** `revalidate = 600` | Pool ISR; saved-list filtered client-side |
| `/discover`, `/discover/[id]` | **ISR** `revalidate = 600` | No `generateStaticParams` — `[id]` rendered on-demand & cached |
| `/thing/[id]` | **ISR** `revalidate = 600` | No `generateStaticParams` |
| `/plan` | **ISR** `revalidate = 600` | Content pool for the client planner |
| `/submit` | **Static** | Pure client form below |
| `/offline` | **Static** | PWA fallback |
| `/s/[token]`, `/p/[token]`, `/r/[token]` | **SSR** `dynamic="force-dynamic"` | `robots: noindex` |
| `/confirm`, `/unsubscribe` | **SSR** `dynamic="force-dynamic"` | `robots: noindex`; token in `searchParams` |
| `/cockpit` | **SSR** `dynamic="force-dynamic"` | `redirect("/admin/review")` |
| `/cockpit/login` | **Static** | Client `LoginForm` |
| `/admin/*` | **SSR** `dynamic="force-dynamic"` | Auth-gated by `admin/layout.tsx` |
| all `/api/*` | Route handlers, `dynamic="force-dynamic"` | see per-route below |

No route in the tree uses `generateStaticParams`, `unstable_noStore`, or `runtime` config. Weather uses `fetch(..., { next: { revalidate: 1800 } })` (data-cache TTL, not a segment).

---

## Auth model (two independent mechanisms)

1. **Admin/cockpit** — Supabase Auth email+password. `LoginForm` (client) calls `getBrowserSupabase().auth.signInWithPassword`. Session lives in cookies via `@supabase/ssr`. Every admin page and every `/api/admin/*` + `/api/review/*` handler calls `getAdminUser()` (`lib/reviewServer.ts`), which does `getServerSupabase().auth.getUser()` and 401s / `redirect("/cockpit/login")` when null. **There is no `middleware.ts`** — the gate is enforced per-route inside `app/admin/layout.tsx` and inside each handler, not by edge middleware.
2. **Cron** — `/api/cron/reaper` checks `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron injects it). No Supabase auth on that route.

Public reads use the anon/publishable key (`getSupabase`, `lib/supabase.ts`); RLS exposes only `published` rows. All admin data writes use the **service-role** client `getAdminSupabase()` (`SUPABASE_SECRET_KEY`, bypasses RLS, server-only) — never the cookie-auth client.

Env vars referenced: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `OPENWEATHER_API_KEY`, `NEXT_PUBLIC_SITE_URL`. (Resend key referenced indirectly via `lib/email.ts`.)

---

# DEEP WALKTHROUGH — Explore (`/` = `app/(app)/page.tsx`)

**Server page** (`app/(app)/page.tsx`, `dynamic="force-dynamic"`). Runs three reads in parallel:
- `getPublishedThings()` (`lib/things.ts`) — all `things` where RLS gives `published`, ordered `happening_tier ASC`, with joined `thing_tags`, `happy_hour_windows`, `recurring_schedules`.
- `getWeather()` (`lib/weather.ts`) — OpenWeather one-call (lat/lng hardcoded to SB 34.42/-119.70), cached 1800s; returns null on missing key / failure.
- `getLiveHeroPinId()` (`lib/heroServer.ts`) — today's founder hero pin (service-role read), or null.

It passes `things`, `tod` (`getTimeOfDay()`), `dateLabel`, `weather`, `nowMs=Date.now()`, `pinnedHeroId` to **`ExploreClient`** (`components/explore/ExploreClient.tsx`).

### Feed assembly (client, `lib/explore.ts`)
State: `lens: OccasionKey|null`, `horizon: "today"|"week"|"month"` (default `"today"`), `zone: Zone|null`, `tuneOpen`. The `ordered` memo is the whole ranking pipeline in one line:
```
inHorizon = things.filter(withinHorizon(t, horizon, nowMs))
lensed    = filterByLens(inHorizon, lens)
ordered   = nearMeSort(cascade(lensed), zone)
```

- **`withinHorizon`** — Tier-1 (dated) items are horizon-bound; Tier-2/3 always pass (`return true`). Uses `sbDay()` (America/Los_Angeles calendar key) so a Tier-1 whose SB day `< today` is dropped ("already passed in SB time"). `today` → `startKey === todayKey`; `week` → `< 7` days; `month` → `< 31` days.
- **`filterByLens`** — keeps things whose `tags` include the selected occasion key.
- **`cascade`** (the three-tier cascade) — stable sort by `happening_tier` ASC (1 dated → 2 recurring/HH → 3 evergreen); within Tier-1, soonest `starts_at` first (`localeCompare`); otherwise preserves input order (already tier-sorted by the DB query). Section titles come from `TIER_META`: "Happening soon" / "On the regular" / "Always worth it".
- **`nearMeSort`** — stable partition bubbling `nearby_zone === zone` to the top, ties broken by original index. Does not filter — it only re-sorts.

**NOTE (feed-vs-coverage divergence, documented in code):** the public feed **never expands `recurring_schedules`** — Tier-2 items simply always pass the horizon. Exact recurrence math lives only in `lib/occurrences.ts` for the cockpit Coverage/Hero surfaces (see comment in `lib/occurrences.ts` header). Lead-breakout helpers (`byDateAsc`, `groupByDay`, `formatWhen`, `pickPerfectDay`) exist in `lib/explore.ts` for a Phase-16 horizon breakout and are consumed by the feed components, not by `cascade`.

### Hero pick (`ExploreClient` `hero` memo)
1. If `pinnedHeroId` is set **and** the pinned thing is present in `ordered` (i.e. it survived horizon/lens/zone), the pin wins the hero slot.
2. Otherwise `ordered[0]` (top of the cascade) is the hero.
3. `feed = ordered.filter(t => t.id !== hero.id)` — the hero is removed from the cascade list below.

The pin is **sponsor-blind** — `getLiveHeroPinId` reads only `hero_pins` + validates the row is `published`, `hero_eligible`, and `occursOnDate(today)`; it never reads sponsor/featured flags. Fail-soft: any error → null → ranker picks (hero never breaks).

**Render:** `<Hero>` (with weather chips + save toggle) → `<ControlRow>` (horizon toggle + Tune button + Near-Me chip) → `<CascadeFeed items={feed}>` → footer with `<EmailSignup>`, trust line ("No accounts, no login wall. Saves live on your device."), submit link. `<TuneSheet>` drives lens + zone. Occasion tags ("Lens") and Near Me both live in the `TuneSheet`; horizon lives in the always-visible `ControlRow`.

---

# DEEP WALKTHROUGH — Saved (`/saved`)

**Server** (`app/(app)/saved/page.tsx`, ISR 600): reads `getPublishedThings()` and hands the whole pool to **`SavedClient`**. The saved list is computed **entirely client-side** from localStorage — server only provides the pool.

### Storage & want/been model (`components/saves/SavesProvider.tsx`)
- Single localStorage key **`sbd.saves.v1`** → `Record<id, "want" | "been">`. Provider lives in the **root** layout so `/s` and `/r` public pages can also use it.
- Hydration-safe: server + first client render share `{}` (no mismatch), then `useEffect` loads storage and flips `hydrated`. A second effect persists on every `saves` change.
- API: `toggle` (none → want → none; save/unsave heart), `setState(id, "been")`, `remove`, `saveMany` (adds as "want", skips existing), `merge` (restore — incoming wins), `asMap`, and `counts {want, been, total}`. There is **no "want" step from toggle into "been"** — "been" is set explicitly via `setState`.

### SavedClient behaviors (`components/saved/SavedClient.tsx`)
- **Ghost-save cleanup**: removes saved ids not present in the live pool (guarded to skip when pool is empty or ≥1000).
- **Want/Been toggle** (`SavedToggle`); Near-Me appears only at ≥4 in-view items.
- **Past-event split**: in the "want" view, past-dated `event`s are pulled into a "Past events" section with a "Did you make it?" prompt. A stable mount-time `nowMs` snapshot decides `isPastEvent`.
- **Editorial status line** ("Two spots on your list · N happening this weekend"), spelled-out counts.
- **C2 "Did you make it?" card**: most-recent past-dated want not yet dismissed; "Yes I went" → `setState("been")` + dismiss; dismissals persisted to localStorage key **`sbd_c2_dismissed`**.
- **C3 been-acknowledgment toast** on any flip into "been".
- **MemoryRecap** in the "been" view.
- **Grouping** via `groupSaved` (`lib/savedGroups.ts`), coloured dots.
- **Bottom stack**: "Build a day" → `/plan`; "Share my list" → select-mode; `<RestorePanel>` shown at ≥5 total.

### Share flow
Select-mode collects ids → `createSharedList(ids)` (`lib/shares.ts` → RPC `create_shared_list`) → URL `${origin}/s/${token}` → `shareUrl()` (`components/saved/share.ts`) which tries `navigator.share`, falls back to clipboard, then to showing the raw URL. Single-card share via `onShareOne([id])`.

### Save-restore (backup) — `components/saved/RestorePanel.tsx`
Email + current saves map → `createSaveRestore(email, saves)` (RPC `create_save_restore`) → returns token → shows `${origin}/r/${token}`. **NOTE:** the panel copy says emailing the link "arrives in a later step" — restore link is currently **shown to copy**, not emailed. (Comment in the file still references "Phase 7".)

---

# DEEP WALKTHROUGH — Discover SB (`/discover`, `/discover/[id]`)

- **`/discover`** (ISR 600): `getPublishedGuides()` reads `guides (id,title,kicker,intro,kind,zone,tag,cover_url)` ordered by `kind`. Splits into `neighborhood` vs `theme` sections; empty-state when zero. `GuideCard` per guide.
- **`/discover/[id]`** (ISR 600, no `generateStaticParams`): `getGuide(id)` (guide + embedded `guide_stops (position,label,note,thing_id)` sorted by position) **and** `getPublishedThings()` in parallel. Not-found → back-to-Discover empty state.
- **Live-scoped happenings** = `cascade(matchGuideThings(guide, things))`. `matchGuideThings` (`lib/guides.ts`): neighborhood guides filter `nearby_zone === guide.zone`; theme guides filter `tags.includes(guide.tag)`. Rendered with the shared `<CascadeFeed horizon="today">`, so guides show the same cascade ordering as Explore but always at the "today" horizon.

---

# DEEP WALKTHROUGH — Share-link flow (`/s/[token]`, `/p/[token]`)

Both SSR `force-dynamic`, `robots: noindex`, resolved via `getSharedState(token)` (`lib/shares.ts` → RPC `get_shared_state`). All shared-state reads/writes go through **SECURITY DEFINER RPCs** (`shared_states_rpc.sql`), so the publishable key is enough and the `shared_states` table stays locked.

- **`/s/[token]`** (shared list): payload discriminant `kind==="shared_list"`, `payload.ids: string[]`. Page fetches `getPublishedThings()`, maps ids → things (dropping missing), renders `<SharedListView>`. Wrong-kind / missing token → "Link not found" with a CTA to `/`.
- **`/p/[token]`** (shared plan): `kind==="shared_plan"`, `payload` is a `SharedPlanPayload` (`lib/plan/types`). Renders `<SharedPlanView>`. Standalone layout (`p/[token]/layout.tsx` renders bare children — no header/nav).

`SharedStateResult.payload` can carry `ids?`, `saves?`, plus plan fields (`Partial<SharedPlanPayload>`). Creation helpers: `createSharedList`, `createSaveRestore(email,…)`, `createSharedPlan`.

---

# DEEP WALKTHROUGH — Magic-link / digest flow

### `/api/subscribe` (POST)
Body `{ email }`. Validates it's a string containing "@" (400 otherwise). Calls RPC `subscribe_email(p_email)` → `{ status, confirm_token, unsubscribe_token }`. If `status==="confirmed"` returns `{ok:true, status:"already"}`. Else sends a double-opt-in email via `sendEmail` (`lib/email.ts`, no-op if Resend unconfigured) containing `${origin}/confirm?token=…` and `${origin}/unsubscribe?token=…`, returns `{ok:true, status:"pending"}`. Errors: 400 bad JSON/email, 500 not-configured / subscribe-failed. **No rate limiting, no auth gate** (public endpoint).

### `/confirm` (SSR)
`searchParams.token` → RPC `confirm_subscription(p_token)`; boolean drives "You're in!" vs "Link not valid". Copy says "twice a week."

### `/unsubscribe` (SSR)
`searchParams.token` → RPC `unsubscribe(p_token)`; boolean drives copy.

### `/r/[token]` — save-restore (SSR, noindex)
`getSharedState` where `kind==="save_restore"`; `payload.saves` → `<RestoreView>`. "Restore N to this device" calls `merge(saves)` from `SavesProvider` (incoming wins), then links to `/saved`. This is the save-restore counterpart to `RestorePanel`.

---

# In-shell secondary pages

### `/thing/[id]` (ISR 600)
`getThing(id)` (`lib/things.ts`) — detail select adds `local_note`, with a fallback to the base select if that column is missing (pre-`phase7.sql` resilience). Renders media, tags (`OCCASION_BY_KEY`), reason-to-go, body (`blurb_long ?? blurb`), a facts `<dl>` (Where/When/Price/21+/Setting), a "Local's secret" `local_note` aside, "Get tickets" (`buy_url`) and `<DetailSaveButton>`. Not-found → back-to-Explore empty state.

### `/submit` (static)
Client `<SubmitForm>` → `submitThing()` (`lib/submissions.ts`) → RPC `submit_thing(p_kind, p_payload{name,where,when,price,caption}, p_name, p_email, p_consent)`; lands in `submissions` (status 'new'). Note: the caption field promises "paste an Instagram caption and we'll pull details" — extraction happens in the ingest worker's `submissions` adapter, not here.

### `/plan` (ISR 600) + `/plan/layout.tsx`
`getPublishedThings()` → client `<PlanClient>` (the day-planner; slots saved things into a spine). Owns its own header (deliberately not the `(app)` shell header) but reuses `BottomNav`.

### `/offline` (static)
PWA offline fallback served by the service worker (`ServiceWorkerRegister` in root layout).

---

# COCKPIT / ADMIN (Cockpit v2 — C0–C5 plan)

**Shell & auth.** `app/admin/layout.tsx` (SSR force-dynamic) is the single auth gate: `getAdminUser()` → `redirect("/cockpit/login")` if null; loads `loadCockpitCounts()` for the tab-strip badges and renders `<CockpitTabs>` (Queue · Coverage · Live catalog · Hero plan) around each nested page. `/cockpit` just `redirect("/admin/review")`. `/cockpit/login` hosts the Supabase password `LoginForm`, which on success pushes to `/admin/review`.

Every admin/review handler independently re-checks `getAdminUser()` and 401s — the gate is not solely the layout. Writes use `getAdminSupabase()` (service role). Most mutations call `revalidatePublic()` (`revalidatePath` for `/`, `/discover`, `/saved`, and the `[id]` pages) so approved content appears within seconds rather than the 10-min ISR window. Every mutation also inserts an `audit_log` row (`actor:"founder"`).

### Queue — `/admin/review` (C1 · built)
`loadCockpitData()` (`lib/reviewServer.ts`) builds `{ queue, drops, sources }`:
- **queue** = pending `thing_edits` overlays (live row merged with pending payload, flagged `overlay_id`/`edit_of`) **prepended** to `prioritize(needs_review things)`. `THINGS_SELECT` pulls tags + recurring schedules + `photo_options`. Registry-proposal Tier-2 rows get a `registrySnippet`.
- **drops** = last 40 `ingest_drops` (source, title, reason, detail, source_url).
- **sources** = `rollupSources(source_runs)` — latest run per source rolled up to ok/fail status.
`ReviewQueue` (client) drives keyboard review, image picker, inline edit. Counts (`loadCockpitCounts`) = queue head-count, drop count, down-source count.

**Queue API:**
- `GET /api/review/queue` → `loadCockpitData()` (admin).
- `POST /api/review/approve` — the single write path to `status='published'`. Modes: (a) `overlay_id` → apply a pending `thing_edits` to its LIVE row ("Approve & replace live"), mark overlay `applied`; (b) single `ids` + `edits` → apply founder edits + publish in one press (§A5); (c) bulk `{ids}` publish. Server-side enforces the negative-tag rules via `filterTags` + explicit rejection of illegal tags (400). Optional `hero_eligible`, `photo`. **AI never sets a start time — edits carry no time field.**
- `POST /api/review/reject` — `overlay_id` → discard pending edit (live row untouched); else archive the thing (`status='archived'`) with reason. The uuid5 id keeps it deduped on re-ingest.
- `POST /api/review/update` — founder inline edit of voice + classification only (blurb, blurb_long, neighborhood ∈ `NEIGHBORHOODS`, tags via `filterTags`, optional photo). **Start time intentionally not editable** (comment: reject & re-ingest to change a time).
- `POST /api/review/image-fetch` — **PHASE-13 STUB.** Returns `{ok:false, reason:"phase13"}` with 200. The cap-checked Google Places photo fetch is not built here. **FLAG:** memory notes claim Phase-13 image waterfall shipped, but this in-app endpoint is still a stub (image resolution happens in the ingest worker, not this route).

### Coverage — `/admin/coverage` (C2 · built)
`loadCoverage("vibe")` (`lib/coverageServer.ts`) — one query over published things, aggregated in-process into a RAG heatmap per vibe (occasion tag) or zone, across cumulative windows **7/14/30/45** days plus an evergreen (Tier-3) count. Occurrence math is the exact `lib/occurrences.ts` helper (`occurrencesByWindow`): Tier-1 = 1 if the dated start falls in the window; Tier-2 = exact recurrence count (weekly exact; **monthly ≈ "1st weekday of month"**, **biweekly ≈ `ceil(matches/2)` with no phase anchor — a documented approximation**); Tier-3 excluded from the window math.
- `GET /api/admin/coverage?dim=vibe|zone` → heatmap rows.
- `GET /api/admin/coverage/cell?dim&key&window` → drilldown: contributing things for one cell (`loadCoverageCell`), sorted Tier-1-soonest then Tier-2 by descending window frequency.

**Restock (C2 queued path · built; C2b run-now · DEFERRED):**
- `POST /api/admin/restock` — validates `scope_kind ∈ {vibe,zone}`, `scope_key` against the occasion-tag / zone vocab, `window_days ∈ {7,14,30,45}`; inserts a `restock_directives` row `status='queued'` for tonight's worker; audits. **The `when:'now'` `workflow_dispatch` branch from the build plan §3 is NOT implemented here** — the route always queues. Memory confirms C2b run-now is deferred pending a new `GITHUB_DISPATCH_TOKEN`.
- `GET /api/admin/restock/list` — last 12 directives for the rail; degrades to `{directives:[]}` if the table is missing.

### Live catalog — `/admin/catalog` (C3 · built)
`loadCatalog({page:1})` (`lib/catalogServer.ts`) — lists published things, 50/page, globally bucket-ordered (today+future dated chrono → recurring alpha → evergreen alpha → past dated at bottom) with day-group labels, plus a `pending_edit` flag (a `thing_edits` awaiting review) for the page's ids. Client `<CatalogView>`.
- `GET /api/admin/catalog?tier&vibe&zone&q&page` → `loadCatalog` (filtered/paginated).
- `POST /api/admin/catalog/edit` — founder edit applied **directly to the live published row, no review queue** (admin trusts own edits; `revalidatePublic()` → live immediately). Rejects non-published targets (400). Negative-tag rules enforced. Start time not editable.
- `POST /api/admin/catalog/delete` — soft-delete: sets `status='archived'` (reversible; row retained), disappears from site + catalog immediately; audits `action:'archive'`. **This route + `docs/first-run-tutorial/` are untracked/new in git status at snapshot time** (`?? app/api/admin/catalog/delete/`).

### Hero plan — `/admin/heroes` (C4 · built; pin CONSUMPTION partial)
`loadHeroPlan()` (`lib/heroServer.ts`) — a next-14-days rail: each day's pin (+ validity), the ranker's projected **Auto** pick (via the site's own `cascade()` — never forked), and valid candidates (via shared `occursOnDate`). Candidate pool = published + `hero_eligible` things.
- `GET /api/admin/hero-pins` → the 14-day plan.
- `POST /api/admin/hero-pins` `{pin_date, thing_id}` → `validatePin` (must be published, `hero_eligible` ⭑, and occur on that date) then upsert on `pin_date`; `revalidatePublic()` because a today-pin changes the live hero.
- `DELETE /api/admin/hero-pins` `{pin_date}` → clear pin (back to Auto).
- `POST /api/admin/hero-eligible` `{thing_id, hero_eligible}` → immediate ⭑ metadata flag (no re-review), from Queue or Catalog.

**Live-hero override IS consumed** by the public Explore path (`getLiveHeroPinId` → `ExploreClient` hero memo), which is the C4→product bridge this commit added. **FLAG:** `lib/heroServer.ts` header still says "No edition-drafter consumes them yet … pin *consumption* awaits the edition-drafter build" — that caveat is about the (unbuilt) nightly **edition drafter**; the same-day live Explore hero override *is* wired. Both statements are true for their respective consumers.

**C5 hardening** — a `02_CockpitV2_C5_Hardening.md` doc exists; specific hardening status not separately verifiable from routes alone.

---

# CRONS & background

- **`/api/cron/reaper`** (GET) — the **only** Vercel cron (`vercel.json`: `{ "path": "/api/cron/reaper", "schedule": "0 8 * * 1" }` = Mon 08:00 UTC weekly). Gated by `Authorization: Bearer ${CRON_SECRET}` (401 otherwise). Deletes `shared_states` idle > 90 days (`last_accessed_at < cutoff`), returns `{ok, deleted}`. Sliding-expiry token cleanup.
- **`/api/cron/nightly`** (GET) — **DEPRECATED no-op**. Returns `{ok:false, deprecated:true, moved_to:"GitHub Action worker (ingest/run.ts)"}`. The nightly ingest (gate → dedupe → enrich → images → land, incl. the public `submissions` adapter) runs as a **GitHub Action** (`ingest/run.ts`, Node 22), **not** a Vercel cron. The endpoint is retained only so a stray call can't re-run the retired duplicate pipeline (`lib/pipeline.runNightly`).

---

# Conflicts & anomalies flagged

1. **No `middleware.ts`.** Admin auth is enforced per-route (layout `redirect` + per-handler `getAdminUser` 401), not by edge middleware. A new admin API route that forgets its own `getAdminUser()` check would be unprotected.
2. **`/api/review/image-fetch` is still a Phase-13 stub** returning `{reason:"phase13"}` at HTTP 200, despite memory notes describing a shipped image waterfall (that waterfall lives in the ingest worker, not this in-app route).
3. **Restock run-now not built.** `POST /api/admin/restock` always queues; the build-plan §3 `when:'now'` `workflow_dispatch` branch and any `GITHUB_*` dispatch secret are absent (C2b deferred).
4. **Save-restore isn't emailed yet.** `RestorePanel` shows the `/r/[token]` link to copy; its own copy says emailing "arrives in a later step."
5. **Feed vs Coverage recurrence divergence (by design, documented).** Explore never expands `recurring_schedules` (Tier-2 always passes horizon); exact recurrence counts exist only in `lib/occurrences.ts` for cockpit surfaces, with monthly/biweekly approximations.
6. **Uncommitted files at snapshot:** `app/api/admin/catalog/delete/` and `docs/first-run-tutorial/` are untracked; `CatalogView.tsx`, `cockpit.css`, `catalog/edit/route.ts`, `lib/catalogServer.ts`, `lib/review.ts` show unstaged modifications (per `git status`).
