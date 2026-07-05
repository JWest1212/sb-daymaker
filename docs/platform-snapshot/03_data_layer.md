# 03 · Data Layer — As-Built Platform Snapshot

| Field | Value |
|---|---|
| Repo | `sb-daymaker` |
| Branch | `main` |
| Commit | `caa73028f1fb2bde2f3a50a62a999417ec3e5c65` (`caa7302`) |
| Snapshot date | 2026-07-03 |
| Framework | Next.js 16.2.9 (App Router) |
| Database | Supabase (Postgres) |
| DB introspection | **YES — connected** via `SUPABASE_SECRET_KEY` (service key, read-only SELECT/count/head probes only) |

> **Read-only note.** Every DB fact below came from `.select(..., { count: 'exact', head: true })`, ordered `limit(1)` range probes, and client-side aggregation over grouping columns. No DDL, no writes, no PII. Counts and non-PII aggregates only.

> **How this schema was derived.** Base = `Core Project Files/sbdaymaker_schema.sql` (v9 canon contract). On top of it, applied in date order: `supabase/migrations/20260624_ingestion.sql`, `20260625_photo_options.sql`, `20260625_images.sql`, `20260628_shared_plan.sql`, `20260702_cockpit_v2.sql`, plus the hand-run top-level SQL (`phase7.sql`, `shared_states_rpc.sql`, `phase8_seed.sql`, `seed_fixtures.sql`). The live shape was then confirmed by column-existence probes against the deployed DB.

---

## 1. THE LIVE SCHEMA AS DEPLOYED

This is the reconciled live schema: the base contract with all migrations applied. Objects added *after* the base contract are flagged **[ADDED]**; changes to base objects are flagged **[CHANGED]**. Section 2 lists the full diff per-object.

### 1.1 Extensions

- `pgcrypto` — `gen_random_uuid()`
- `citext` — case-insensitive email
- `pg_trgm` — fuzzy dedupe on title/venue (GIN index on `things.title`)

### 1.2 Enums (types)

Base contract enums (all still live):

| Enum | Values |
|---|---|
| `thing_type` | `place`, `event`, `firstlook`, `happyhour` |
| `thing_status` | `draft`, `needs_review`, `published`, `archived` |
| `price_band` | `free`, `$`, `$$`, `$$$` |
| `occasion_tag` | `date_night`, `family_day`, `nightlife`, `catch_a_show`, `arts_culture`, `outdoors_active`, `wine_food`, `free_sb`, `hosting_visitors`, `solo` |
| `tod` | `morning`, `afternoon`, `evening`, `late` |
| `photo_source` | `pexels`, `wikimedia`, `google`, `owned`, `placeholder` |
| `tag_source` | `ai`, `founder`, `rule` |
| `happening_category` | **T1:** `live_music`, `festival_fair`, `arts_theater`, `community_gathering`, `food_drink_event`, `sports_outdoors_event` · **T2:** `weekly_special`, `recurring_nightlife`, `recurring_market`, `recurring_arts`, `recurring_outdoors` · **T3:** `outdoor_activity`, `food_drink_spot`, `culture_spot`, `shopping_browse`, `scenic_chill` |
| `shared_state_kind` | `save_restore`, `shared_list` **[CHANGED — see below]** |
| `neighborhood` | `funk_zone`, `downtown`, `waterfront`, `montecito`, `mesa`, `mission_canyon`, `riviera`, `upper_state`, `goleta`, `carpinteria`, `other` |
| `nearby_zone` | `funk`, `downtown`, `waterfront`, `montecito`, `mesa`, `goleta` |
| `guide_kind` | `neighborhood`, `theme` |
| `edition_slot` | `hero`, `secondary` |
| `submission_kind` | `event`, `business` |
| `submission_status` | `new`, `parsed`, `approved`, `rejected`, `spam` |
| `subscriber_status` | `pending`, `confirmed`, `unsubscribed` |

Migration-added enum values / new enums:

| Enum | Change | Source |
|---|---|---|
| `shared_state_kind` | **[CHANGED]** `+ 'shared_plan'` (now `save_restore`, `shared_list`, `shared_plan`) | `20260628_shared_plan.sql` |
| `recur_frequency` **[ADDED]** | `weekly`, `biweekly`, `monthly` | `20260624_ingestion.sql` |
| `restock_scope` **[ADDED]** | `vibe`, `zone` | `20260702_cockpit_v2.sql` |
| `restock_status` **[ADDED]** | `queued`, `running`, `done`, `failed` | `20260702_cockpit_v2.sql` |

### 1.3 Table: `sponsors`

Phase-2 reserved. `id uuid pk`, `name text not null`, `contact_email citext`, `active boolean not null default true`, `created_at timestamptz not null default now()`. RLS: enabled implicitly by lack of policy (no public policy → service-role only). Trust rule: rankers must never read `sponsor_id`/`is_featured`.

### 1.4 Table: `things` (the unified content unit)

Base columns (identity/copy, classification, location, timing, photos, curation, provenance) — unchanged from the contract, plus migration-added columns:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `type` | `thing_type` not null | |
| `status` | `thing_status` not null default `draft` | |
| `title` | text not null | |
| `blurb`, `blurb_long`, `category` | text | AI-drafted copy |
| `happening_tier` | smallint not null default 3, check 1–3 | derived from structure |
| `happening_category` | `happening_category` | AI-proposed; required at publish (app code) |
| `reason_to_go` | text | required for Tier 3 (app code) |
| `neighborhood` | `neighborhood` | granular |
| `nearby_zone` | `nearby_zone` | Near-Me sort + neighborhood guides |
| `address`, `lat`, `lng` | text / double precision | |
| `price_band` | `price_band` | |
| `free` | boolean **generated always** as `(price_band = 'free') stored` | |
| `indoor`, `is_21_plus` | boolean not null default false | weather + family negative-rule |
| `time_of_day_fit` | `tod[]` not null default `{}` | |
| `starts_at`, `ends_at` | timestamptz | event-only |
| `buy_url` | text | AXS/TM hand-off |
| `place_id`, `photo_source`, `photo_url`, `photo_query`, `photo_attribution` | text / `photo_source` | photo waterfall |
| `hero_eligible` | boolean not null default true | |
| `editorial_weight` | smallint not null default 0 | −5..+5 nudge |
| `is_featured` | boolean not null default false | labeled placement (Phase 2) |
| `sponsor_id` | uuid → `sponsors(id)` | |
| `last_confirmed` | timestamptz | freshness |
| `source` | text | provenance |
| `created_at`, `updated_at` | timestamptz not null default now() | |
| `local_note` | text | **[ADDED]** `phase7.sql` — local's-secret detail callout |
| `photo_options` | jsonb not null default `'[]'` | **[ADDED]** `20260625_photo_options.sql` — cockpit image-picker alternates |

Constraint: `events_have_start check (type <> 'event' or starts_at is not null)`.

Indexes: `things_status_idx`, `things_type_idx`, `things_nearby_zone_idx`, `things_starts_at_idx`, `things_last_confirmed_idx`, `things_hero_idx (where status='published')`, `things_title_trgm_idx (GIN gin_trgm_ops)`.

Trigger: `trg_things_updated before update` → `set_updated_at()`.
RLS: enabled. Policy `public_read_things` — `select using (status = 'published')`.

### 1.5 Table: `thing_tags`

`thing_id uuid → things(id) on delete cascade`, `tag occasion_tag not null`, `confidence numeric(3,2) not null default 1.0`, `tag_source tag_source not null default 'ai'`, `created_at`, PK `(thing_id, tag)`. Index `thing_tags_tag_idx`. RLS: `public_read_tags` — select allowed when the parent thing is published. Negative rule (app-enforced): `is_21_plus` never gets `family_day`; non-free never gets `free_sb`.

### 1.6 Table: `happy_hour_windows`

`id uuid pk`, `thing_id → things(id) cascade`, `day_of_week smallint check 0–6`, `starts_local time`, `ends_local time`, `deal_text text`, `unique (thing_id, day_of_week)`. Index `hh_windows_thing_idx`. RLS: `public_read_hhw` (parent published).

### 1.7 Table: `recurring_schedules`

`id uuid pk`, `thing_id → things(id) cascade`, `category happening_category not null` (a Tier-2 value, app-validated), `day_of_week smallint check 0–6`, `start_time time`, `end_time time`, `label text`, `last_confirmed date`, **`frequency recur_frequency not null default 'weekly'` [ADDED, `20260624_ingestion.sql`]**, `unique (thing_id, day_of_week, category)`. Indexes: `recurring_sched_thing_idx`, `recurring_sched_dow_idx`. RLS: `public_read_recurring` (parent published).

> Note: there is **no `active`/`status` column** on `recurring_schedules`. "Active recurring schedules" = rows whose parent thing is `published`; the table itself has no soft-delete flag.

### 1.8 Tables: `guides` + `guide_stops`

`guides`: `id uuid pk`, `title text not null`, `kicker`, `intro`, `kind guide_kind not null default 'theme'`, `zone nearby_zone`, `tag occasion_tag`, `cover_url`, `status thing_status not null default 'draft'`, `created_at`, `updated_at`. Constraint `guide_scope_ck` (neighborhood ⇒ zone set; theme ⇒ zone null). Indexes `guides_kind_idx`, `guides_zone_idx (where zone is not null)`. Trigger `trg_guides_updated`. RLS `public_read_guides` (published).

`guide_stops`: `id uuid pk`, `guide_id → guides(id) cascade`, `position smallint not null`, `thing_id → things(id)` (nullable), `label text not null`, `note text`, `unique (guide_id, position)`. Index `guide_stops_guide_idx`. RLS `public_read_guidestops` (parent guide published).

### 1.9 Tables: `editions` + `edition_picks`

`editions`: `id uuid pk`, `edition_date date not null unique`, `status thing_status not null default 'draft'`, `approved_at timestamptz`, `created_at`. RLS `public_read_editions` (published).

`edition_picks`: `edition_id → editions(id) cascade`, `thing_id → things(id)`, `slot edition_slot not null`, `position smallint default 0`, PK `(edition_id, thing_id)`. Unique partial index `edition_one_hero on (edition_id) where slot='hero'` (exactly one hero). RLS `public_read_editionpicks` (parent edition published).

### 1.10 Table: `submissions`

`id uuid pk`, `kind submission_kind`, `status submission_status default 'new'`, `raw_payload jsonb not null`, `submitter_name text`, `submitter_email citext`, `consent boolean default false`, `parsed_thing_id → things(id)`, `created_at`. Index `submissions_status_idx`. No public RLS policy → service-role only; public insert routed via `submit_thing()` RPC (SECURITY DEFINER).

### 1.11 Table: `subscribers`

The only end-user account-adjacent PII table. `id uuid pk`, `email citext not null unique`, `status subscriber_status default 'pending'`, `confirm_token uuid`, `unsubscribe_token uuid`, `consented_at`, `confirmed_at`, `created_at`. No public RLS policy; access via `subscribe_email()` / `confirm_subscription()` / `unsubscribe()` RPCs.

### 1.12 Table: `shared_states`

`token text pk` (opaque URL key), `kind shared_state_kind not null`, `payload jsonb not null`, `email citext` (save_restore delivery only; NULL otherwise), `created_at`, `last_accessed_at timestamptz not null default now()`. Indexes `shared_states_kind_idx`, `shared_states_last_access_idx`. No public RLS policy — read/written only via SECURITY DEFINER RPCs (`create_shared_list`, `create_save_restore`, `get_shared_state`, `create_shared_plan`). Sliding expiry via `last_accessed_at`.

### 1.13 Table: `audit_log`

`id uuid pk`, `entity_type text`, `entity_id uuid`, `action text`, `actor text`, `ai_confidence numeric(3,2)`, `payload jsonb`, `created_at`. Index `audit_entity_idx (entity_type, entity_id)`. No public policy.

### 1.14 [ADDED] Table: `source_runs` — `20260624_ingestion.sql`

Per-run bookkeeping for the nightly digest + source-health panel. `id bigint identity pk`, `source text`, `started_at timestamptz default now()`, `finished_at timestamptz`, `fetched int default 0`, `qualified int default 0`, `dropped int default 0`, `landed int default 0`, `ok boolean default true`, `error text`. Index `source_runs_started_idx (started_at desc)`.

### 1.15 [ADDED] Table: `ingest_drops` — `20260624_ingestion.sql`

Every dropped candidate with a reason (nothing vanishes silently). `id bigint identity pk`, `run_id → source_runs(id) cascade`, `source text`, `title text`, `reason text` (`no_start`|`no_title`|`no_address`|`no_source`|`duplicate`), `detail text`, `source_url text`, `raw jsonb`, `created_at`. Index `ingest_drops_created_idx (created_at desc)`.

### 1.16 [ADDED] Table: `image_spend` — `20260625_images.sql`

Monthly Google Place Photo billing counter (enforces the ~$10/mo cap). `month text pk ('YYYY-MM')`, `google_calls int default 0`, `over_cap int default 0`, `updated_at timestamptz`.

### 1.17 [ADDED] Table: `image_cache` — `20260625_images.sql`

Per-place resolution cache so a place is never paid for twice. `place_key text pk`, `photo_url text`, `photo_source text`, `photo_options jsonb not null default '[]'`, `attribution text`, `resolved_at timestamptz`.

### 1.18 [ADDED] Table: `restock_directives` — `20260702_cockpit_v2.sql`

Founder intent the nightly worker consumes. `id uuid pk`, `scope_kind restock_scope not null`, `scope_key text not null` (occasion_tag or nearby_zone value, app-validated), `window_days smallint default 30 check in (7,14,30,45)`, `status restock_status default 'queued'`, `requested_at`, `started_at`, `finished_at`, `results_count int`, `run_note text`. Index `restock_status_idx (status, requested_at desc)`.

### 1.19 [ADDED] Table: `hero_pins` — `20260702_cockpit_v2.sql`

Founder pre-decides the hero slot for a date (not a parallel hero system). `pin_date date pk`, `thing_id → things(id) cascade`, `created_at`.

### 1.20 [ADDED] Table: `thing_edits` — `20260702_cockpit_v2.sql`

Pending edits of LIVE things as an overlay (published row never destabilized). `id uuid pk`, `thing_id → things(id) cascade`, `payload jsonb not null` (only changed fields), `status text default 'pending' check in ('pending','applied','discarded')`, `created_at`, `resolved_at`. Partial unique index `thing_edits_one_pending on (thing_id) where status='pending'`.

### 1.21 Functions

| Function | Security | Purpose | Source |
|---|---|---|---|
| `set_updated_at()` | trigger fn | bumps `updated_at` on `things`, `guides` | base |
| `submit_thing(text, jsonb, text, citext, boolean)` | DEFINER | public submission → `submissions` | `phase7.sql` |
| `subscribe_email(citext)` | DEFINER | double opt-in signup | `phase7.sql` |
| `confirm_subscription(uuid)` | DEFINER | confirm via token | `phase7.sql` |
| `unsubscribe(uuid)` | DEFINER | unsubscribe via token | `phase7.sql` |
| `create_shared_list(jsonb)` | DEFINER | `shared_list` token (payload = `{ids:[...]}`) | `shared_states_rpc.sql` |
| `create_save_restore(citext, jsonb)` | DEFINER | magic-link save/restore, keyed by own email | `shared_states_rpc.sql` |
| `get_shared_state(text)` | DEFINER | read payload + bump expiry (never echoes email) | `shared_states_rpc.sql` |
| `create_shared_plan(jsonb)` | DEFINER | `shared_plan` token snapshot | `shared_states_rpc.sql` |

All eight RPCs are `granted execute to anon, authenticated`. They are the only public door to the no-policy tables (`submissions`, `subscribers`, `shared_states`).

### 1.22 RLS posture summary

- **Public read (published only):** `things`, `guides`, `editions`, `thing_tags`, `happy_hour_windows`, `recurring_schedules`, `guide_stops`, `edition_picks` (child tables gate on parent `status='published'`).
- **No public policy → service-role / RPC only:** `sponsors`, `submissions`, `subscribers`, `audit_log`, `shared_states`.
- **Migration-added tables (`source_runs`, `ingest_drops`, `image_spend`, `image_cache`, `restock_directives`, `hero_pins`, `thing_edits`):** the migrations create them **without** `alter table … enable row level security` and without policies. In Postgres, a table with RLS *not* enabled is fully readable/writable by any role that has table privileges. Under Supabase defaults the `anon`/`authenticated` roles typically lack direct grants on these, but **this is a drift worth flagging** — the base contract explicitly enables RLS on its content tables, whereas the cockpit-v2 / ingestion / image tables rely on absence-of-grant rather than an explicit RLS lock. See §2.

---

## 2. DIFF vs `Core Project Files/sbdaymaker_schema.sql`

Everything the live schema adds to or changes from the base contract.

### 2.1 New tables (10, none in the base contract)

| Table | Migration | Purpose |
|---|---|---|
| `source_runs` | `20260624_ingestion.sql` | nightly ingest run bookkeeping |
| `ingest_drops` | `20260624_ingestion.sql` | dropped-candidate audit trail |
| `image_spend` | `20260625_images.sql` | monthly Google photo billing cap |
| `image_cache` | `20260625_images.sql` | per-place photo resolution cache |
| `restock_directives` | `20260702_cockpit_v2.sql` | founder restock intent for the worker |
| `hero_pins` | `20260702_cockpit_v2.sql` | founder hero pin per date |
| `thing_edits` | `20260702_cockpit_v2.sql` | pending-edit overlay for live things |

(Base already had: `sponsors`, `things`, `thing_tags`, `happy_hour_windows`, `recurring_schedules`, `guides`, `guide_stops`, `editions`, `edition_picks`, `submissions`, `subscribers`, `shared_states`, `audit_log`.)

### 2.2 Added columns

| Table.column | Type | Source | Note |
|---|---|---|---|
| `things.local_note` | text | `phase7.sql` | local's-secret detail callout |
| `things.photo_options` | jsonb default `'[]'` | `20260625_photo_options.sql` | cockpit image-picker alternates |
| `recurring_schedules.frequency` | `recur_frequency` default `weekly` | `20260624_ingestion.sql` | expresses biweekly/monthly rhythms |

### 2.3 Enum changes

| Enum | Change | Source |
|---|---|---|
| `shared_state_kind` | `+ 'shared_plan'` | `20260628_shared_plan.sql` |
| `recur_frequency` (new) | `weekly`, `biweekly`, `monthly` | `20260624_ingestion.sql` |
| `restock_scope` (new) | `vibe`, `zone` | `20260702_cockpit_v2.sql` |
| `restock_status` (new) | `queued`, `running`, `done`, `failed` | `20260702_cockpit_v2.sql` |

### 2.4 New functions (RPCs) not in the base contract

All of `submit_thing`, `subscribe_email`, `confirm_subscription`, `unsubscribe`, `create_shared_list`, `create_save_restore`, `get_shared_state`, `create_shared_plan` are new (the base contract only shipped `set_updated_at()`). These landed via hand-run `phase7.sql` + `shared_states_rpc.sql`, not the versioned `supabase/migrations/` tree.

### 2.5 RLS drift

- Base contract explicitly `enable row level security` + public-read policies on its 8 content tables. **Confirmed present.**
- The 7 migration-added tables ship **without** an explicit `enable row level security` statement and without policies. They are protected only by the absence of role grants, not by an RLS lock. **Flag:** inconsistent with the base contract's explicit-RLS posture; recommend an explicit `enable row level security` on each (service-role bypasses RLS anyway, so this is a defense-in-depth gap, not a live leak, assuming default Supabase grants).

### 2.6 Provenance drift (not a schema bug, but note it)

`phase7.sql`, `shared_states_rpc.sql`, `phase8_seed.sql`, `seed_fixtures.sql` live at the repo root and were run "by hand in the SQL editor," **outside** `supabase/migrations/`. The `supabase/migrations/` tree is therefore **not** a complete replay of the live DB — an operator replaying only `migrations/` onto a fresh DB would be missing `things.local_note`, all 8 RPCs, and the seed data. This is the single most operationally important drift.

### 2.7 `phase8_seed.sql` / `seed_fixtures.sql`

Dev-demo inserts (`source = 'pipeline_demo'`, marked "delete before launch") and Phase-1 fixtures. Not schema; they explain some of the non-null seed rows in §3.

---

## 3. DATA HEALTH SNAPSHOT (live, read-only, no PII)

Probed against the deployed DB on 2026-07-03 via `count/head` and client-side grouping. Numbers only.

### 3.1 Rows per table

| Table | Rows |
|---|---:|
| `sponsors` | 0 |
| `things` | 592 |
| `thing_tags` | 1381 |
| `happy_hour_windows` | 0 |
| `recurring_schedules` | 32 |
| `guides` | 0 |
| `guide_stops` | 0 |
| `editions` | 0 |
| `edition_picks` | 0 |
| `submissions` | 0 |
| `subscribers` | 2 |
| `shared_states` | 22 |
| `audit_log` | 1590 |
| `source_runs` | 309 |
| `ingest_drops` | 4258 |
| `image_spend` | 2 |
| `image_cache` | 390 |
| `restock_directives` | 2 |
| `hero_pins` | 2 |
| `thing_edits` | 0 |

### 3.2 `things` by `status`

| Status | Count |
|---|---:|
| `published` | 520 |
| `needs_review` | 36 |
| `archived` | 36 |
| `draft` | 0 |
| **total** | **592** |

### 3.3 `things` by `happening_tier`

| Tier | Count |
|---|---:|
| 1 (dated) | 516 |
| 2 (recurring) | 25 |
| 3 (evergreen) | 51 |

> Heavily Tier-1-weighted (87%). The evergreen backstop pool (Tier 3 = 51) is thin relative to the dated flood — worth noting since the hero's "never blank" guarantee leans on evergreen fallback.

### 3.4 `things` by `happening_category`

| Category | Count | Tier |
|---|---:|---|
| `community_gathering` | 210 | 1 |
| `arts_theater` | 132 | 1 |
| `live_music` | 121 | 1 |
| `sports_outdoors_event` | 32 | 1 |
| `food_drink_spot` | 25 | 3 |
| `food_drink_event` | 19 | 1 |
| `culture_spot` | 11 | 3 |
| `recurring_market` | 10 | 2 |
| `recurring_outdoors` | 7 | 2 |
| `scenic_chill` | 6 | 3 |
| `recurring_nightlife` | 5 | 2 |
| `outdoor_activity` | 5 | 3 |
| `shopping_browse` | 4 | 3 |
| `recurring_arts` | 3 | 2 |
| `festival_fair` | 2 | 1 |
| `weekly_special` | 0 | 2 |
| `arts_culture` (n/a — not a category value) | — | — |

(All 592 rows carry a category; none null.)

### 3.5 Images

- Things with a non-null `photo_url`: **592 / 592 (100%)**.
- By `photo_source`: `pexels` = **591**, `wikimedia` = **1**. No `google`, `owned`, or `placeholder` rows.
- `image_cache` holds **390** resolved place rows; `image_spend` has **2** monthly rows (Google billable-call counter — the ~$10/mo cap is being tracked). Because 100% of live photos are free-source (Pexels/Wikimedia), the Google spend path is essentially cold.

### 3.6 Tier-3 things lacking `reason_to_go`

- **0.** Every Tier-3 row has a `reason_to_go`. The app-code invariant ("required for Tier 3") holds in the live data.

### 3.7 Recurring schedules (active)

- Total `recurring_schedules` rows: **32**, across **27 distinct things**.
- By frequency: `weekly` = 28, `monthly` = 3, `biweekly` = 1.
- No `status`/`active` column exists (see §1.7); "active" here = rows attached to things (all 27 parent things are within the published catalog). The `20260624` art-walk backfill (1 monthly + 1 biweekly) is reflected.

### 3.8 Tier-1 (dated) coverage window

- Earliest `starts_at`: **2026-06-26** (01:00 UTC).
- Latest `starts_at`: **2026-12-10** (04:00 UTC).
- Coverage runs **~5 months out** from snapshot date.
- **Stale past-dated rows: 86** Tier-1 rows have `starts_at` before "now" (2026-07-03). These are lingering — a reaper/archival sweep is not pruning past-dated events from the live set. This matches the deferred "reaper" note in project memory (Phase 9 launch hardening).

### 3.9 `thing_tags` coverage

- **413 distinct things** carry ≥1 tag (out of 592 total; ~70%).
- 1381 tag rows total ⇒ ~3.3 tags per tagged thing.
- ~179 things carry no occasion tag yet — those are invisible to the occasion-tag Lens filter.

### 3.10 Editions + digest send

- `editions` count: **0**. Most recent `edition_date`: **none**.
- No editions have ever been assembled/sent in this DB. The nightly edition-drafter / 2×-week digest has not produced a persisted edition here. (`hero_pins` has 2 rows — founder pre-decisions exist, but no `editions` row consumes them yet.)

### 3.11 `shared_states`

- Count only: **22**. (No breakdown printed — kind/email withheld to avoid any PII surface. All access is via RPC token.)

### 3.12 Other live signals

- `audit_log`: 1590 rows — the AI-draft/approval trail is actively populated.
- `source_runs`: 309 runs; `ingest_drops`: 4258 dropped candidates — the ingest gate is doing heavy filtering (drop:land ratio is high, consistent with the "enrich real facts, never invent" posture).
- `restock_directives`: 2 (founder restock intents recorded).
- `submissions`: 0, `sponsors`: 0, `guides`/`guide_stops`: 0, `happy_hour_windows`: 0 — these surfaces are un-seeded in the live DB.

---

## 4. localStorage / sessionStorage CONTRACT

Every client storage key discovered by grepping `components/`, `app/`, `lib/`. All keys are namespaced `sbd.*` / `sbd_*`. Saves and itineraries are the two no-accounts stores mandated by CLAUDE.md §2.4.

### 4.1 `sbd.saves.v1` — on-device saves (localStorage)

- **Writer/reader:** `components/saves/SavesProvider.tsx`.
- **Shape:** `Record<string, SaveState>` where `SaveState = "want" | "been"`, keyed by `thing.id`. Serialized as a flat JSON object, e.g. `{ "<uuid>": "want", "<uuid>": "been" }`.
- **Hydration:** empty `{}` on server + first client render (no hydration mismatch), then `getItem` on mount; every change re-serializes via `setItem`. Corrupt JSON and quota errors are swallowed (`try/catch`).
- **Versioning:** version is baked into the key suffix (`.v1`). No in-place migration handler — a future `.v2` would be a new key, not a transform of `.v1`.

### 4.2 `sbd.itineraries.v1` — saved Plan itineraries (localStorage)

- **Two writers, same key — DRIFT (flag).** Both `components/plan/ItinerariesProvider.tsx` and `lib/plan/itineraries.ts` (`useItineraries` hook) read/write `sbd.itineraries.v1`, but with **different payload shapes**:
  - `components/plan/ItinerariesProvider.tsx` → `Itinerary[]` with fields `{ id, title, dateISO, blocks, stops, createdAt, updatedAt }` (from `lib/plan/types.ts`).
  - `lib/plan/itineraries.ts` → `SavedItinerary[]` with fields `{ id, title, answers, stops, savedAt }`.
  - `app/layout.tsx` mounts the **`components/plan/ItinerariesProvider`** context (the `Itinerary[]` shape), but the consumers (`components/saved/SavedDays.tsx`, `components/plan/MyPlansDrawer.tsx`, `app/p/[token]/SharedPlanView.tsx`) import `useItineraries` from **`lib/plan/itineraries`** (the `SavedItinerary[]` shape). Two incompatible schemas share one storage key and one hook name. Reads written by one shape will not carry the fields the other expects (e.g. `answers`/`savedAt` vs `blocks`/`createdAt`). **This is a real correctness risk and the most notable client-side drift** — worth a follow-up to unify on one store.
- **Shape (both):** JSON array of itinerary objects; each `stops` entry is a `Stop = { id, block, thingId, fromSaved, fromDraft }`.
- **Hydration/versioning:** same pattern as saves (empty → hydrate on mount → persist on change; swallowed errors). Key-suffix versioning (`.v1`), no migration handler.

### 4.3 `sbd_c2_dismissed` — dismissed Saved-tab C2 prompts (localStorage)

- **Writer/reader:** `components/saved/SavedClient.tsx` (`readDismissed` / `persistDismissed`).
- **Shape:** JSON array of string ids (`string[]`), read into a `Set<string>`. Tracks which "restock / re-engagement" prompt cards the user has dismissed so they don't reappear.
- **Versioning:** none (no `.v#` suffix). No migration handler; corrupt reads fall back to empty set.

### 4.4 `sbd.open-plan` — plan hand-off (sessionStorage)

- **Writer:** `components/saved/SavedDays.tsx` (`handleOpen`) — `sessionStorage.setItem("sbd.open-plan", JSON.stringify(plan))` then `router.push("/plan")`.
- **Shape:** a single serialized `SavedItinerary` (from `lib/plan/itineraries`), used to pass the chosen plan to the `/plan` route on open. Session-scoped (cleared when the tab closes), so it's a transient hand-off buffer rather than durable state.
- **Versioning:** none.

### 4.5 Summary of client storage keys

| Key | Store | Shape | Writer(s) | Versioned |
|---|---|---|---|---|
| `sbd.saves.v1` | localStorage | `Record<id, "want"\|"been">` | `SavesProvider` | key-suffix `.v1` |
| `sbd.itineraries.v1` | localStorage | array of itineraries (**two conflicting shapes**) | `components/plan/ItinerariesProvider` + `lib/plan/itineraries` | key-suffix `.v1` |
| `sbd_c2_dismissed` | localStorage | `string[]` (dismissed prompt ids) | `SavedClient` | none |
| `sbd.open-plan` | sessionStorage | one `SavedItinerary` snapshot (transient) | `SavedDays` | none |

> No `localStorage`/`sessionStorage` writes carry PII. Saves, itineraries, dismissals, and the plan hand-off are all `thing.id` / local-uuid based. The only end-user email ever leaves the device via the `create_save_restore` RPC (magic-link backup), stored server-side in `shared_states.email` — outside the localStorage contract.

---

*End of 03_data_layer.md — as-built snapshot, read-only, no secrets, no PII.*
