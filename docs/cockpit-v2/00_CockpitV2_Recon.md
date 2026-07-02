# Cockpit v2 — Codebase Recon (ground-truth snapshot)

**Generated:** 2026-07-02 · **Method:** read-only reconnaissance of the live repo · **Changes:** none (one new file: this one).
**Reconciles against:** `docs/cockpit-v2/SBDaymaker_CockpitV2_Build_Plan.md` · **Contract docs checked:** `Core Project Files/sbdaymaker_schema.sql`, `Core Project Files/11_SBDaymaker_Ingestion_Build_Guide.md`, `Core Project Files/CLAUDE.md`.

> **How to read this file.** Where the live code disagrees with a canonical doc, this file records the **code's reality** and flags the doc as stale (Section 10 ledger). Nothing was "fixed" during recon. Every claim carries a file path; excerpts are trimmed to be unambiguous.
>
> **Source-of-truth note on the DB (Section 3):** there is no safe way to introspect the live Supabase instance from this repo without credentials/side effects, so the DB "code truth" here is the **union of `supabase/migrations/**` applied on top of `sbdaymaker_schema.sql`** (the schema file is run as-is, then migrations alter it). That is the actual applied state by construction.
>
> **Path corrections vs. the prompts.** (a) The recon/build docs live at `docs/cockpit-v2/` (not a repo-root `docs/`). (b) The build plan and recon prompt both reference `14_SBDaymaker_Build_Deltas.md` — **that file does not exist**; the `14_*` file in the repo is `Core Project Files/14_SBDaymaker_Explore_Current_State_Spec.md`. Recorded in Section 10.

---

## 1. Admin cockpit — routes & components (as built)

**Routes that exist under the admin surface:**

| Route | File | Kind |
|---|---|---|
| `/admin/review` | `app/admin/review/page.tsx` | Server component (auth gate) — the entire cockpit today |
| `/cockpit` | `app/cockpit/page.tsx` | Redirects to `/admin/review` |
| `/cockpit/login` | `app/cockpit/login/page.tsx` + `LoginForm.tsx` | Email/password login |

**The four Cockpit v2 tabs do not exist yet** — `app/admin/coverage`, `app/admin/catalog`, `app/admin/heroes` are absent (verified by directory listing). Cockpit v2 builds all three plus a shared shell around the existing review page.

**Component tree for the review queue** (all under `app/admin/review/`):

- `page.tsx` — **server** shell; calls `getAdminUser()`, redirects to `/cockpit/login` if unauthenticated, then loads data and renders `<ReviewQueue>` + the two sidebars.
- `ReviewQueue.tsx` — **client** (`"use client"`); owns queue state, keyboard handling, toasts, optimistic remove/undo, bulk-approve. This is the interactivity hub.
  - `ReviewCard.tsx` — **client**; one card, inline edit forms, contains inline `ImagePicker` + `RegistrySnippetPanel`.
  - `ImagePicker.tsx` — **client**; arrow-through image option selector.
- `DroppedPanel.tsx` — **server**; "dropped tonight" sidebar (renders `ingest_drops`).
- `SourceHealth.tsx` — **server**; source-health sidebar (renders `source_runs`).
- `cockpit.css` — scoped stylesheet for the cockpit.

**Admin auth enforcement — the exact gate:**

There is **no `middleware.ts`** (verified: no `middleware.*` at repo root or in `app/`). Auth is enforced **per-route** by a server helper.

- Gate helper — `lib/reviewServer.ts:26-31`:
  ```ts
  export async function getAdminUser() {
    const sb = await getServerSupabase();
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }
  ```
- Page gate — `app/admin/review/page.tsx:13-15`: `const user = await getAdminUser(); if (!user) redirect("/cockpit/login");`
- API gate (same pattern on every route) — e.g. `app/api/review/approve/route.ts:9-11`: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`
- Login — `app/cockpit/login/LoginForm.tsx:19` uses `supabase.auth.signInWithPassword({ email, password })`.

**⇒ Cockpit v2 implication:** every new v2 route (`/api/admin/coverage`, `/restock`, `/hero-pins`, `/catalog`, etc.) must call `getAdminUser()` at the top and 401 on null — there is no middleware to inherit the gate from. Note the build plan's stated boundary "existing admin auth (recon §1)" = this per-route helper, **not** 2FA (CLAUDE.md §4 lists "Supabase Auth + 2FA" as intended; 2FA is not implemented here — password only).

**CSS approach (as built):**

- **Tailwind v4** — there is **no `tailwind.config.*`**; Tailwind is wired via `postcss.config.mjs` (`"@tailwindcss/postcss": {}`) and `@theme inline` in `app/globals.css:19-26`, which maps semantic tokens (`--color-bg: var(--bg)`, etc.).
- Tokens are mirrored from `Core Project Files/sbdaymaker_tokens.css` into `app/sbdaymaker_tokens.css`, imported app-wide.
- Class convention is **`.sbd-*`** (`.sbd-cockpit`, `.sbd-btn`, `.sbd-toast`, …).
- **Hardcoded hex values in cockpit files: none found.** Every color in `app/admin/review/cockpit.css` reads a token, e.g. `.sbd-cockpit .topbar { background: var(--pacific-dark); color: var(--paper); }`. This satisfies CLAUDE.md §8.2; v2 must keep it that way.

---

## 2. Review queue API — the exact contracts

All routes live under `app/api/review/` and gate with `getAdminUser()`.

| Route | Method | Request | Writes |
|---|---|---|---|
| `queue` | GET | none (auth only) | reads `things` (needs_review) + `ingest_drops` + `source_runs` |
| `approve` | POST | `{ ids: string[], photo?: {url,source} }` | `things.status='published'` (+ optional photo); `audit_log` rows |
| `reject` | POST | `{ id, reason? }` | `things.status='archived'`; `audit_log` row w/ reason |
| `update` | POST | `{ id, blurb?, blurb_long?, neighborhood?, tags?, photo? }` | `things` blurb/neighborhood/photo; `thing_tags` replace; `audit_log` |
| `image-fetch` | POST | `{ id }` (ignored) | **nothing — Phase-13 stub** |

**`queue` (GET)** — `app/api/review/queue/route.ts`; returns `loadCockpitData()` → `{ queue, drops, sources }`. Each `QueueRow` already carries: `id, type, title, blurb, blurb_long, happening_category, happening_tier, neighborhood, address, price_band, free, is_21_plus, starts_at, source, photo_url, photo_source, photo_options, tags, when, chip` (trust chip), and optional `registrySnippet` (`lib/reviewServer.ts:44-66`). **Note:** it already returns `tags` and `photo_options`; the build plan's §3 "queue extended to include tags, zone, hero_eligible, photo fields" is partially already true — **missing today: `nearby_zone` and `hero_eligible`** are not in the row shape.

**`approve` (POST)** — `app/api/review/approve/route.ts:15-37`:
```ts
const { ids, photo } = (await req.json()) as { ids?: string[]; photo?: { url: string; source: string } };
const patch = { status: "published" }; if (photo?.url) { patch.photo_url = photo.url; patch.photo_source = photo.source; }
await sb.from("things").update(patch).in("id", ids);
await sb.from("audit_log").insert(ids.map(id => ({ entity_type: "thing", entity_id: id, action: "approve", actor: "founder" })));
```
- **Field by field:** sets `status='published'` on all `ids`; optionally overwrites `photo_url`/`photo_source` from a pre-fetched option. **Does NOT accept an arbitrary edit payload** — editing is a separate `update` call made *before* approve. It does **not** set `last_confirmed` today.
- **Bulk-approve is built into this route via the `ids[]` array** — not a separate route, not a client loop of N calls. `ReviewQueue.tsx:88-94` filters green-chip cards, collects ids, and sends one `{ ids }` POST.

**`reject` (POST)** — `app/api/review/reject/route.ts:17-26`: `things.status='archived'`; then `audit_log` insert `{ action:'reject', actor:'founder', payload:{ reason } }`. The client currently passes a hardcoded `reason:"founder reject"` (`ReviewQueue.tsx:85`). No `ingest_drops` write on reject; archived rows stay dq'd by uuid5.

**`update` (POST) — the edit/save route exists today** — `app/api/review/update/route.ts:43-70`: patches `blurb`, `blurb_long`, `neighborhood` (validated against a NEIGHBORHOODS constant), optional `photo`; **deletes then re-inserts `thing_tags`** with `tag_source:'founder', confidence:1.0`; server-side `filterTags()` enforces negative rules (21+ → no `family_day`, etc.); writes `audit_log { action:'edit', payload:{ neighborhood, tags } }`. **Start time is intentionally not editable** (comment at `route.ts:9`: "to change a time, reject & re-ingest so the gate re-runs").

**`audit_log` writes exist today** on approve, reject, and edit — all with shape `{ entity_type:'thing', entity_id, action, actor:'founder', payload? }`. **⇒ v2 gets the audit pattern for free** and should reuse this exact shape (build-plan §0.5 invariant is already the house style).

**Gap vs. build plan:** the build plan wants a single **approve-with-edits** route (`{ id, edits?, hero_eligible? }` applying edits + publish in one transaction). Today that is **two calls** (`update` then `approve`) and there is **no `hero_eligible` write path anywhere**. This is the core C1 change.

---

## 3. Database — actual state vs. the schema contract

Applied state = `sbdaymaker_schema.sql` **+** the four migrations in `supabase/migrations/`.

**Migrations (code truth), by file:**
- `20260624_ingestion.sql` — creates enum `recur_frequency('weekly','biweekly','monthly')`; **adds `recurring_schedules.frequency`**; creates tables **`source_runs`** (id, source, started_at, finished_at, fetched, qualified, dropped, landed, ok, error) and **`ingest_drops`** (id, run_id→source_runs, source, title, reason, detail, source_url, raw jsonb, created_at) + indexes.
- `20260625_images.sql` — creates **`image_spend`** (month PK, google_calls, over_cap, updated_at) and **`image_cache`** (place_key PK, photo_url, photo_source, photo_options jsonb, attribution, resolved_at).
- `20260625_photo_options.sql` — **adds `things.photo_options jsonb not null default '[]'`.**
- `20260628_shared_plan.sql` — adds `'shared_plan'` to enum `shared_state_kind`.

**Drift table (schema.sql ⟷ migrations):**

| Object | In schema.sql? | In migrations? | Drift | Stale-doc flag |
|---|---|---|---|---|
| `source_runs` | no | yes (`20260624`) | migration-only | schema.sql stale |
| `ingest_drops` | no | yes (`20260624`) | migration-only | schema.sql stale |
| `recur_frequency` enum | no | yes | migration-only | schema.sql stale |
| `recurring_schedules.frequency` | no | yes | migration-only column | schema.sql stale |
| `things.photo_options` | no | yes (`20260625`) | migration-only column | schema.sql stale |
| `image_spend` | no | yes | migration-only | schema.sql stale |
| `image_cache` | no | yes | migration-only | schema.sql stale |
| `shared_state_kind` values | 2 (`save_restore`,`shared_list`) | +`shared_plan` | enum extended by migration | schema.sql stale |
| everything in §"Confirm specifically" below | yes | (unchanged) | consistent | — |

**Specifically confirmed present (with evidence):**
- `things.hero_eligible` — `sbdaymaker_schema.sql:153` `hero_eligible boolean not null default true`. ✅ (v2's hero-flag toggle writes this column; currently no code reads/writes it — see §2.)
- `things.editorial_weight` — `schema.sql:154` `editorial_weight smallint not null default 0` (−5..+5 nudge). ✅ **Not read by the live ranker** (§6).
- `things.happening_tier` — `schema.sql:121` `smallint not null default 3 check (between 1 and 3)`. ✅ (the ranker's primary sort key.)
- `things.nearby_zone` — `schema.sql:127`, type `nearby_zone`. ✅ Enum `nearby_zone` = **six values** `funk, downtown, waterfront, montecito, mesa, goleta` (`schema.sql:80`) — matches build-plan decision §1.9 ("six `nearby_zone` values").
- `thing_tags` — `schema.sql:183-190`: `(thing_id, tag occasion_tag, confidence numeric(3,2) default 1.0, tag_source tag_source default 'ai', created_at)`, PK `(thing_id, tag)`. ✅
- `recurring_schedules` — `schema.sql:220-232`: `day_of_week smallint (0-6)` at `:224`, `start_time time` **nullable** at `:225`, `end_time time` nullable at `:226`, plus migration-added `frequency`. ✅ **`start_time` is nullable** — Tier-2 rhythms can be day-known/time-unknown (matches gate behavior in §4).
- `editions` — `schema.sql:275-281` (`edition_date date unique`, `status`, `approved_at`). `edition_picks` — `:283-291` with **unique index `edition_one_hero on edition_picks(edition_id) where slot='hero'`** at `:291`. ✅ Tables exist; **nothing populates them** (§6).
- `audit_log` — `schema.sql:354-362` (`entity_type, entity_id, action, actor, ai_confidence, payload jsonb, created_at`). ✅
- `source_runs`, `ingest_drops` — migration-only (above). ✅ present in applied DB, absent from schema.sql.
- `thing_status` enum — `schema.sql:45` **exactly** `('draft','needs_review','published','archived')`. ✅

**No collision for the three new v2 tables:** `restock_directives`, `hero_pins`, `thing_edits` **do not exist** anywhere in schema or migrations. The build plan's C0 migration is clean to apply (additive, no name/enum clash).

**Supabase client patterns:**
- `lib/supabase.ts:13` `getSupabase()` — **anon** key, public browser reads (RLS-scoped to published).
- `lib/supabaseServer.ts:9` `getServerSupabase()` — **anon** + cookie session; used only for **auth** (`getAdminUser`).
- `lib/supabaseBrowser.ts:4` `getBrowserSupabase()` — **anon**; login form only.
- `lib/supabaseAdmin.ts:9` `getAdminSupabase()` — **service-role** (`SUPABASE_SECRET_KEY`), server-only, RLS-bypass; carries a "never import into client code" warning. Used by the review API routes, pipeline, reaper.
- **⇒ v2 admin write routes use `getAdminSupabase()` (service-role) after the `getAdminUser()` gate** — the established pattern in `approve`/`reject`/`update`.
- **RLS posture:** public policies expose only `status='published'` rows on content tables (`schema.sql:384-408`). Admin/ops tables (`submissions, subscribers, sponsors, audit_log, shared_states`, and migration tables `source_runs, ingest_drops, image_spend, image_cache`) have **no public policies** — reachable only via service-role. New v2 tables should follow suit (no public RLS policy).

---

## 4. The ingestion worker — as it actually runs

**Entrypoint `ingest/run.ts`, real step order** (differs from the doc's clean "gate→dedupe→enrich→images→land→digest" — gate runs *inside* the fetch loop and closures run before digest):

1. Per-adapter fetch loop, isolated so one bad adapter can't sink the run — `run.ts:151-185`. `gate(r)` is called **inside** this loop (`:159`); gate-drops recorded immediately (`:175`); a registry-dedupe check (`isAlreadyInRegistry`) also runs inline (`:166`).
2. `dedupe(gated, existing)` — `:198` (cross-source + against DB rows in the 45-day window).
3. `enrich(deduped)` — `:201` (skipped when `DRY_RUN=1`).
4. `resolveImages(keep, sb)` — `:207-212`.
5. `landCandidates` → `landTags` → `landRecurring` → `finishRun` — `:224-238`.
6. `detectClosures` then `sendDigest` — `:256-268` (live only). Two sidecar modes (`BACKFILL`, `IMAGE_BACKFILL`) short-circuit before the loop (`:137-138`). `WINDOW_DAYS = 45`.

**Adapter registry — `ingest/adapters/registry.ts:49`: 31 active adapters** (doc 11 describes ~2). Ordered by source priority: `ticketmaster`; venue-direct (`soho, sbbowl, lobero, granada, arlington, musicacademy, alcazar, centerstage, carpinteriaArts, newVic`); institutions (`moxi, naturalHistory, botanicGarden, sbma, ucsb, libraries`); civic/curated (`independent, citySites, goletaCivic, carpinteriaCivic, downtownSB, coastalView, sbcountyArts`); aggregators (`eventbrite, allevents, seatgeek`); rhythms (`farmersMarkets, nightlifeRhythms, outdoorsOperators, natureProgramsFree, recurringRegistry, submissions`).

**`SourceAdapter` interface** (`types.ts:13-28`): `{ key, label, fetch(window: DateWindow): Promise<RawCandidate[]>, useManagedScrape? }` with `DateWindow = { fromISO, toISO }`. **Adapters take a date window but NO scope/vibe/zone parameter.** Some ignore even the window (`soho.ts:61` `fetch()` is arg-less). **⇒ Build-plan §5.1 answer: restock's targeted pass cannot pass a vibe/zone into adapters — it must run adapters and *filter candidates post-gate* by proposed tag/zone before landing** (the plan already anticipates this "if zero-arg" branch; the reality is "date-window-only," same consequence).

**Batch Claude call — `ingest/enrich.ts`:**
- Model pinned: **`const MODEL = 'claude-haiku-4-5';`** (`enrich.ts:19`) — matches CLAUDE.md §4 (Haiku for blurbs/tagging). No Sonnet ranking call exists (ranking is the deterministic `cascade`, §6).
- Client: `new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 })` (`:200`) — one retry, 90s timeout (matches CLAUDE.md's "timeout + one retry").
- Writes per id: `blurb`, `blurb_long`, `proposed_tags[{tag,confidence}]` via a forced tool `enrich_batch` (`tool_choice` forced, `:169-176`). **`starts_at` is never sent to Claude** (`buildItems` omits it). Negative-rule enforcement in code post-call (`applyNegativeRules:65-79`). Candidate set = whole night's deduped candidates, chunked `CHUNK_SIZE=20`, sequential. Fail-soft: any failure returns rows unchanged (no blurb) rather than blocking. Every draft logged to `audit_log` (`payload:{ tags, model }`).

**The gate — `ingest/gate.ts`:**
- Signature: `export function gate(c: RawCandidate): GateResult` (`:72`). Pure, no I/O.
- **`requiresStart(tier) => tier === 1`** (`:27-28`) — **TIER-1 ONLY**, with an in-file comment: "requiresStart is TIER-1-ONLY. The seed has 6 Tier-2 rows with no start." **This contradicts doc 11 §4**, which coded `requiresStart` as `tier === 1 || tier === 2`. **⇒ Consequence for Coverage:** Tier-2 recurring rows legitimately land with `starts_at = null`; their "occurrences" live entirely in `recurring_schedules`, not in `starts_at`. Coverage's Tier-2 math therefore *must* expand `recurring_schedules` (see §7) — it cannot read `starts_at`.
- Drop reasons emitted by the gate: `no_title` (`:74`), `no_address` (`:76`, reused for tier-3 missing `reason_to_go` at `:108`), `no_source` (`:77`), `no_start` (`:82`), and **`registry_incomplete_time`** (`:92-101`, a reason not in doc 11). `duplicate` is emitted by `dedupe.ts`; `registry_exists` by `run.ts:167`.

**Tests: `npm test` → `vitest run` → ALL GREEN: 16 files, 330 tests passed, 0 failed** (gate suite alone = 227 tests). Runner is **Vitest 3.2.6**, tests co-located as `*.test.ts`.

**Landing & drops:** `land.ts:17-45` `toThingRow` sets `status: 'needs_review'` (`:20`), inserted idempotently `.upsert(..., { onConflict:'id', ignoreDuplicates:true })` (`:92`). Drops → `ingest_drops` via `recordDrops` (`land.ts:142-158`): `insert({ run_id, source, title, reason, detail, source_url, raw })`.

**Edition drafting: NOT built in the nightly run (or anywhere).** Grep across `ingest/`, `lib/`, `app/` for `editions`/`edition_picks`/`draftEdition`/`pickHero` returns **zero code matches** — only the schema DDL. The nightly run ends at closures + digest; `digest.ts` only emails a queue link + source-health. **⇒ This is the decisive input to the Hero-plan phase — see §6.**

---

## 5. Scheduling & GitHub Actions

**`.github/workflows/ingest.yml` — name `nightly-ingest`:**
- Trigger: `schedule: - cron: '0 9 * * *'` (09:00 UTC = 02:00 PDT) **and** `workflow_dispatch` **with inputs** `enrich_backfill` (bool) + `image_backfill` (bool).
- **Node version: `'22'`** (comment: "Node 22+ required for native WebSocket") — **drift vs. doc 11's `node-version:'20'`** and doc 03/build-plan assumptions; matches the memory note.
- Steps: `npm ci` → `npx tsx ingest/run.ts`.
- Secrets referenced (names only): `SUPABASE_URL, SUPABASE_SERVICE_ROLE, TICKETMASTER_API_KEY, ANTHROPIC_API_KEY, PEXELS_API_KEY, GOOGLE_PLACES_KEY, RESEND_API_KEY, DIGEST_TO, NEXT_PUBLIC_SITE_URL, MANAGED_SCRAPE, SCRAPFLY_KEY, SEATGEEK_CLIENT_ID`.

**Vercel Cron (`vercel.json`):** exactly one — `{ "path": "/api/cron/reaper", "schedule": "0 8 * * 1" }` (Mondays 08:00 UTC). `app/api/cron/reaper/route.ts` deletes share/restore tokens idle > 90 days, gated by `Authorization: Bearer ${CRON_SECRET}` (`:9`). **`app/api/cron/nightly/route.ts` is a deprecated no-op stub** (returns `{ deprecated:true, moved_to:"GitHub Action worker" }`) — the nightly pipeline is the Action, not a Vercel cron.

**BUILD-CRITICAL for "Run now" restock:**
- (a) `workflow_dispatch` **already exists** — adding a `directive_id` input is a one-line change; the plumbing pattern (boolean inputs → env flags read in `run.ts`) is already there to copy.
- (b) **No GitHub token exists anywhere.** Grep of `.env.local` (7 vars, none GitHub), the credentials doc, `ingest.yml` secrets (12, none GitHub), and all `.ts` (`GITHUB_TOKEN`/`GH_TOKEN`/PAT) → **zero**. **A GitHub PAT/token is a NEW secret** that must be created before the restock route can call the GitHub REST API (`workflow_dispatch`). Flag at C2 per the plan; it is genuinely net-new, server-side only.

---

## 6. Edition drafting & the hero today

**Edition drafting:** **does not exist** (see §4 grep). `editions`/`edition_picks` tables are schema-only, unpopulated by any code.

**⇒ Decisive for the Hero-plan phase (build-plan §5.3):** we are in the "edition drafting is NOT built yet" world. The Hero-plan tab can be built as **pin *intent* storage** (`hero_pins` table + API + rail UI), but **pin *consumption* cannot be wired** — there is no nightly drafter to teach. The plan already contains this branch ("build nothing speculative … flag at C4 that pin consumption awaits the edition-drafter build"). This recon confirms that branch is the operative one. `hero_pins` degrades gracefully exactly as the plan's §2 rationale intends.

**How the live hero is selected today — computed live from `things`, no editions, no sponsor read:**
- `app/(app)/page.tsx:5` is `force-dynamic`; fetches `getPublishedThings()` + weather only — **no editions read**.
- The hero is literally `ordered[0]` of the deterministic pipeline in `components/explore/ExploreClient.tsx:42-49`:
  ```ts
  const ordered = useMemo(() => nearMeSort(cascade(filterByLens(things.filter(t => withinHorizon(t, horizon, nowMs)), lens)), zone), [...]);
  const hero = ordered[0] ?? null;
  ```
- The ordering brain is `cascade()` — `lib/explore.ts:21-29`: sort by `happening_tier` asc, then within Tier 1 by `starts_at` asc. It reads **only** `happening_tier` and `starts_at`.

**Trust rule — CONFIRMED, holds strongly.** `cascade`, `withinHorizon`, `filterByLens`, `nearMeSort` read only `happening_tier`, `starts_at`, `tags`, `nearby_zone`. Neither `is_featured` nor `sponsor_id` is read — **and they are never even selected into the read path**: `lib/things.ts:51-56` `BASE_COLS`/`RELATIONS` omit them, and the `Thing` interface (`lib/things.ts:22-47`) has no such field. Repo-wide grep for `is_featured`/`sponsor_id`/`sponsor` across `lib/app/components` → **zero matches** (independently re-verified). The tokens exist only in `schema.sql:94,155-156` (Phase-2 reserved columns + the audit comment "The hero ranker must NEVER read is_featured / sponsor_id"). **⇒ v2's "Auto" hero fallback should call/extract `cascade()`+`withinHorizon()` — do not fork ranking logic.** Note `editorial_weight` (§3) exists but the live ranker does **not** use it.

---

## 7. The public-site read paths Coverage must mirror

**⚠ Load-bearing finding — the "site's own cascade expansion logic" the build plan tells Coverage to reuse does not exist for recurring occurrences.**

- The live feed decides "what's on in a window" with **`withinHorizon(thing, horizon, now)`** — `lib/explore.ts:34-48`:
  ```ts
  if (thing.happening_tier !== 1 || !thing.starts_at) return true;   // Tier 2 & 3 ALWAYS pass
  const startKey = sbDay(start); if (startKey < todayKey) return false;
  if (horizon === "today") return startKey === todayKey;
  const days = (start - now) / 86_400_000;
  if (horizon === "week") return days < 7; return days < 31;
  ```
  **Only Tier-1 dated things are gated by the window.** Tier-2 and Tier-3 unconditionally pass. There is **no day-of-week expansion** of `recurring_schedules` on the public side — `Thing.recurring` is fetched (`lib/things.ts:46,56,85`) but **never read** by any Explore code.
- The only `day_of_week` expansion in the whole repo is in the **admin cockpit** display helper — `lib/review.ts:139` (`whenString`, `DOW[s.day_of_week]`) / `lib/reviewServer.ts:52` — which formats a human "when" string, **not** an occurrence count in a window.

**⇒ Reconciliation for Coverage (build-plan §1.2 / §3 `/api/admin/coverage`):** the premise "reuse the site's occurrence expansion so cockpit math and site can't disagree" is **not directly satisfiable** — the site has no per-date recurring expansion to reuse. Coverage's exact Tier-2 occurrence math (count of each `recurring_schedules.day_of_week` in the next N days, honoring the migration-added `frequency`) **must be built new**, ideally extracted into a shared `lib/` helper. The raw material is available (`recurring_schedules.day_of_week` + `frequency`, and the cockpit's `whenString` as a formatting reference). For Tier-1 the reusable primitive is `withinHorizon` / the `sbDay` day-keying. This should be surfaced as a delta at C0.

**Occasion-tag filtering:** reads `Thing.tags` (flattened from a `thing_tags(tag)` join) via `filterByLens` — `lib/explore.ts:50-53`: `things.filter(t => t.tags.includes(tag))`. **No confidence threshold at read time** — the public query selects only `thing_tags(tag)`, not `confidence` (`lib/things.ts:54`). Confidence gating happens upstream at enrich/ingest (`lib/pipeline.ts:94` drops `confidence < 0.6`). **⇒ Coverage's vibe dimension should mirror this: plain `tags.includes(key)` membership, no runtime threshold constant.**

---

## 8. Environment & secrets inventory (names only)

**[Next.js app]** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`lib/supabase*.ts`), `SUPABASE_SECRET_KEY` (`lib/supabaseAdmin.ts:11`), `NEXT_PUBLIC_SITE_URL` (`app/robots.ts`, `sitemap.ts`, `layout.tsx`), `OPENWEATHER_API_KEY` (`lib/weather.ts:54`), `RESEND_API_KEY` + `RESEND_FROM` (`lib/email.ts`), `CRON_SECRET` (`app/api/cron/reaper/route.ts:9`), `ANTHROPIC_API_KEY` (`lib/enrich.ts:51`).

**[Ingest worker / Action]** — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE` (CI names) with `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY` local fallback (`ingest/db.ts:16-18`), `TICKETMASTER_API_KEY`, `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, `GOOGLE_PLACES_KEY`, `RESEND_API_KEY`, `DIGEST_TO`, `NEXT_PUBLIC_SITE_URL`; behavior flags `DRY_RUN, ENRICH_BACKFILL, IMAGE_BACKFILL, IMAGE_FORCE, IMAGE_MONTHLY_CALL_CAP, MANAGED_SCRAPE, SCRAPFLY_KEY, SEATGEEK_CLIENT_ID, CHECK_CLOSURES, CLOSURE_MAX_PER_RUN`.

**`.env.local` (7 names only):** `ANTHROPIC_API_KEY, CRON_SECRET, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, RESEND_API_KEY, SUPABASE_SECRET_KEY`.

**Read-in-code but MISSING from `SBDaymaker_Credentials_and_Env.md` (stale-doc flags):** `RESEND_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, the CI name `SUPABASE_URL`, and the Phase-13+ flags `DRY_RUN, ENRICH_BACKFILL, IMAGE_BACKFILL, IMAGE_FORCE, IMAGE_MONTHLY_CALL_CAP, MANAGED_SCRAPE, SCRAPFLY_KEY, SEATGEEK_CLIENT_ID, CHECK_CLOSURES, CLOSURE_MAX_PER_RUN` (14 total). **Documented-but-never-read:** none. **New for v2:** a GitHub token (§5) — not present in any inventory.

---

## 9. Conventions the build must match

- **Naming/placement:** PascalCase components co-located with their route (`app/admin/review/*.tsx`), not a shared `components/` dir for admin. Page = server (auth gate) → passes data as props to a `"use client"` orchestrator (`ReviewQueue`) → leaf client cards; static sidebars stay server components. v2 shell should be a server layout wrapping these.
- **Toasts / optimistic UI (already built — reuse it):** `ReviewQueue.tsx` has a `Toast { msg, undo? }` model (`:12,24,33-37`) and a **delayed-commit optimistic pattern** — `commitAction` (`:47-72`) removes the card immediately, schedules the real server call after `COMMIT_MS`, and Undo cancels the timer + re-splices the row at its original index. **⇒ This is exactly the "5-second delayed commit" the build-plan §4b offers as the Undo fallback — it already exists; v2 should extend it, not invent a compensating route.**
- **Tests:** Vitest, `npm test` → `vitest run`, co-located `*.test.ts`, no `vitest.config` (defaults). 330 tests green.
- **Lint/format:** ESLint v9 flat config (`eslint.config.mjs`: `eslint-config-next` core-web-vitals + typescript), `npm run lint`. **No Prettier.**
- **Keyboard pattern (extend, don't reinvent) — `ReviewQueue.tsx:164-187`:** one `window` `keydown` listener; guards when focus is in `INPUT/TEXTAREA/SELECT`; **edit-mode lockout** swallows action keys while a card is being edited (only `←/→` cycle images and `Esc`/`e` save). Live map: **A**=approve, **E**=edit/save, **R**=reject, **↑/↓**=move active card, **B**=bulk-approve greens, **←/→**=cycle image (edit mode). **⇒ v2 adds H (hero toggle) and the tab-switch keys into this same handler; the input-guard + edit-lockout structure is the thing to preserve.**

---

## 10. Drift ledger & open questions

### Consolidated drift ledger

| # | Finding | File(s) | Canonical doc says | Code says | Recommendation |
|---|---|---|---|---|---|
| D1 | Gate requires start for **Tier 1 only** | `ingest/gate.ts:27-28` | Doc 11 §4: `tier === 1 || tier === 2` | `tier === 1`; Tier-2 rows land `starts_at=null` | **Follow code.** Drives D2. Doc 11 stale. |
| D2 | No recurring day-of-week expansion in the **public** read path | `lib/explore.ts:34-48`; `Thing.recurring` unread | Build plan §1.2/§3: "reuse the site's cascade expansion" | Site never expands `recurring_schedules`; only cockpit `whenString` formats DOW | **Flag to Jim.** Coverage Tier-2 math must be built new (shared helper), not "reused." Highest-impact delta. |
| D3 | **Edition drafting not built** anywhere | grep `ingest/ lib/ app/` | Build plan §5.3 conditional; schema has `editions` | tables unpopulated; no drafter | **Follow code.** Hero-plan = pin *intent* only; consumption deferred (flag at C4). |
| D4 | **No GitHub token** in any inventory | `.env.local`, `ingest.yml`, creds doc | Build plan §3 asks "does one exist?" | none | **Flag to Jim.** New secret required for "Run now" (C2b). Server-side only. |
| D5 | Approve is **publish-only**; edits are a separate `update` call; **no `hero_eligible` write path** | `app/api/review/approve/route.ts`, `update/route.ts` | Build plan §3: single approve-with-edits `{id,edits?,hero_eligible?}` | two routes; hero_eligible never written | **Follow plan (build it).** This is the core C1 upgrade; `audit_log` shape already exists to reuse. |
| D6 | Migrations added tables/columns never back-ported into `schema.sql` | `supabase/migrations/*` | `schema.sql` omits `source_runs, ingest_drops, image_*, photo_options, frequency, shared_plan` | present in applied DB | **Follow code.** `schema.sql` is stale as a mirror; treat migrations as truth. Optional: back-port later. |
| D7 | Registry has **31 adapters**, adapters take **DateWindow only** (no scope param) | `ingest/adapters/registry.ts:49`, `types.ts:13-28` | Doc 11 shows ~2 adapters | 31 active; date-window signature | **Follow code.** Restock filters candidates post-gate by tag/zone (build plan's fallback branch). |
| D8 | Action pinned **Node 22** | `.github/workflows/ingest.yml:30` | Doc 11/03 imply Node 20 | Node 22 (WebSocket) | **Follow code.** Any new Action step targets Node 22. |
| D9 | Gate emits extra reason `registry_incomplete_time` | `ingest/gate.ts:92-101` | Doc 11 lists 5 reasons | 6th reason exists | **Follow code.** Drop-reason UI should handle it. |
| D10 | **`14_SBDaymaker_Build_Deltas.md` does not exist** | `Core Project Files/` | Recon prompt §10 + build plan §6 write to it | file is `14_SBDaymaker_Explore_Current_State_Spec.md` | **Flag to Jim.** Delta entries go to a new/renamed target (see below); do not assume the referenced file. |
| D11 | Credentials doc missing 14 read env vars | `SBDaymaker_Credentials_and_Env.md` | doc lists ~11 | 14 more read in code | **Follow code.** Update doc when convenient (not blocking). |
| D12 | Auth is **per-route `getAdminUser()`**, no middleware, **no 2FA** | `lib/reviewServer.ts:26-31`; no `middleware.*` | CLAUDE.md §4: "Supabase Auth + 2FA" | password only, per-route gate | **Follow code** for wiring (call `getAdminUser()` in every v2 route). 2FA gap noted for launch hardening, not this build. |

### Open questions (blocking — only Jim can answer)

1. **Coverage Tier-2 math ownership (D2):** confirmed acceptable to **build a new shared occurrence-expansion helper** (count `recurring_schedules.day_of_week` × `frequency` over N days) rather than "reuse" a site function that doesn't exist? This is the one place the build plan's stated approach can't be followed literally.
2. **GitHub token for "Run now" (D4):** OK to introduce a new server-side GitHub PAT/fine-grained token as a Vercel env var + repo secret at C2b? (Alternative: ship C2 queued-path only and defer "Run now.")
3. **Delta-ledger target (D10):** where should approved delta entries be written — create `docs/cockpit-v2/01_CockpitV2_Deltas.md` per build-plan §6 (recommended), and separately create `14_SBDaymaker_Build_Deltas.md`, or point existing references at the existing `14_*_Explore_Current_State_Spec.md`?

### Proposed delta-ledger entries (for your approval — NOT written anywhere during recon)

- *Gate is Tier-1-only for start-time; Tier-2 rhythms are `starts_at`-null and expressed via `recurring_schedules(day_of_week, frequency)`. Coverage occurrence math is a new shared helper, not a reuse of a (non-existent) public expansion.*
- *Edition drafting is unbuilt; Hero-plan ships as pin-intent storage only; pin consumption deferred to a future edition-drafter.*
- *"Run now" restock depends on a new server-side GitHub token; queued-path restock has no such dependency.*
- *Approve-with-edits + `hero_eligible` are net-new write paths; today approve is publish-only and edits go through `/api/review/update`.*
- *`sbdaymaker_schema.sql` is stale relative to `supabase/migrations/**`; migrations are DB truth.*
- *Referenced `14_SBDaymaker_Build_Deltas.md` does not exist (repo has `14_*_Explore_Current_State_Spec.md`).*

---

## Exit verification — `git status --short`

```
?? docs/cockpit-v2/00_CockpitV2_Recon.md
```
(Plus the pre-existing untracked `docs/cockpit-v2/` siblings — build plan, recon prompt, mockup. No tracked file was modified, created, or deleted by this recon other than this file. `npm test` was run read-only: 330/330 green.)
