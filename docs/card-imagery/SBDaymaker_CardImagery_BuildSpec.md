# SB Daymaker · Card Imagery Overhaul · Build Spec for Claude Code

**Scenario D: the Earned-Photo Hybrid with venue-photo inheritance and founder-curated photo pools.**
Spec version 1.0 · 2026-07-09 · Supersedes the imagery portions of any earlier delta spec. Companion founder guide: `SBDaymaker_CardImagery_BuildGuide.html`.

---

## 0 · Ground rules (read before writing any code)

1. **Code is truth.** This spec was reconciled against snapshot `caa7302` (2026-07-03). Your first action in every phase is to re-read the live files listed in that phase and reconcile. If the live code differs from what this spec describes, the live code wins; note the difference, adapt, and record it in the Build Deltas ledger (`docs/14_SBDaymaker_Build_Deltas.md`).
2. **CLAUDE.md is the contract.** All of its constraints apply: batch-AI only (no per-request AI calls), ~$45 to 95/mo cost envelope, no end-user accounts, WCAG 2.2 AA, additive-only schema changes, the Trust Rule (the ranker never reads sponsor status; this build extends that rule to the visual tier: photo/motif selection never reads sponsor status either).
3. **DDL is a human act.** You never run DDL against the hosted database. Every schema change in this spec is marked `FOUNDER-RUN DDL` and is pasted by Jim into the Supabase SQL Editor. You may generate and verify the SQL, and you must stop and tell Jim exactly when to run it. You may assume it has been run only after Jim confirms.
4. **One phase per session arc, one hard stop-and-show per phase.** At each phase's stop-and-show, present the running app (or a static render if the phase is pipeline-only) at ~390px and ~1280px and wait for approval before merging. Do not begin the next phase without explicit go-ahead.
5. **Ledger discipline.** Every deviation from this spec, every judgment call, and every completed phase gets a dated entry in the Build Deltas ledger with rationale.
6. **Idempotence and reversibility.** Every pipeline change must be safe to re-run. Phase 0 must be revertible with a single ranking-array change.
7. **No copy changes.** This build touches imagery and plumbing only. Card copy, asides, and personality features are a separate track and are out of scope except where explicitly named (the big-type fallback text in Phase 3).

## 1 · Current state (as audited; re-verify at build)

**The resolver** (`ingest/images.ts`):
- Waterfall per candidate: `image_cache` hit (keyed by `cacheKey()` = `place_id` or normalized `title|neighborhood`) → gather `pexelsMany(q,3)` + `wikimedia(q)` for every card → `rankOptions()` sorts with hardcoded `['owned','pexels','wikimedia','google']` → Google only if `!found.length && c.place_id && GOOGLE_KEY && calls < CAP` → placeholder.
- `CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1400)` with a stale `$0.007/call` comment. The env var is currently unset in Vercel/GitHub.
- `googlePhoto()` makes two billable calls (Place Details `photos` fieldmask, then Place Photo `media` with `skipHttpRedirect=true`) and stores the returned `photoUri` string. **This URI-storage pattern is being replaced in Phase 2** (URIs are not stable; terms favor short retention).
- `wikimedia()` uses `generator=search` in namespace 6, `iiurlwidth=1200`, parses `extmetadata.Artist`. Title search, not geosearch.
- Spend counter: `image_spend` (month-keyed), shared with the closure-check feature. Per-place memo: `image_cache` (390 rows live).
- Result in production: **591 of 592 things resolve to Pexels; 1 to Wikimedia; 0 Google/owned/placeholder.**

**Catalog shape** (live counts, 2026-07-03): 592 things. Tier 1 dated = 516 (87%), Tier 2 recurring = 25, Tier 3 evergreen = 51. Key categories: `community_gathering` 210, `arts_theater` 132, `live_music` 121, `sports_outdoors_event` 32, `food_drink_spot` 25, `food_drink_event` 19, `culture_spot` 11, `recurring_market` 10.

**Other relevant as-builts:**
- `things` has `address`, `lat`, `lng`, `place_id`, `photo_source` (enum: `pexels|wikimedia|google|owned|placeholder`), `photo_url`, `photo_query`, `photo_attribution`, `photo_options` (jsonb, the cockpit picker's ranked alternates).
- `ingest/run.ts` supports `IMAGE_BACKFILL=1` (backfill mode) and `IMAGE_FORCE=1` (skip cache, re-resolve everything).
- `components/ui/Card.tsx` `ListCard` already renders an occasion-color gradient + centered icon when there is no photo. The hero pick renders `photo_url` and inherits all of this automatically.
- Cockpit v2 has Queue / Coverage / Live catalog / Hero plan tabs; the photo picker arrows through `photo_options`.
- Ingestion drops candidates with `no_address`, so every published dated event has an address (and generally lat/lng).

## 2 · Target architecture (Scenario D)

**The doctrine: a photo has to earn its slot, and every photo a user sees was approved by the founder or passed a strict gate.**

Resolution order per card, first hit wins:

| Priority | Tier | Applies to | Source |
|---|---|---|---|
| 1 | Owned | any card with an owned photo | `owned` |
| 2 | Venue pool | any card (place or dated event) that resolves to a venue in the registry with a non-empty approved photo pool | `google` (pool rotation) or `wikimedia` (pinned pool entries) |
| 3 | Direct Google | food and drink places (`food_drink_spot`, venue-anchored `weekly_special`/`happyhour` types) not covered by a pool | `google` (capped, cached, nightly-refreshed) |
| 4 | Gated Wikimedia geosearch | non-food real places (T2/T3) with `lat`/`lng`, one attempt behind the quality gate | `wikimedia` |
| 5 | Motif | all remaining dated events and any miss above (Phase 3; until then, gradient) | `motif` |
| 6 | Big-type | card whose category maps to no motif (Phase 3) | `motif` (kind `bigtype`) |
| 7 | Gradient | final safety net (already live in `ListCard`) | `placeholder` |

**Pexels is removed entirely in Phase 3** (and demoted to last-resort-only in Phase 0).

**The venue registry and photo pools** (the D increment):
- `venues`: canonical venues, founder-curated, seeded by a fuzzy-match pass over the live catalog.
- `venue_photos`: per-venue photo pool. Each row stores a **stable identifier**, never a serving URI as the source of truth: for Google, the photo resource name (`places/{place_id}/photos/{photo_reference}`); for Wikimedia, the Commons file title. A `serving_url` column holds the current hotlinkable URL and is refreshed nightly for Google rows.
- Cockpit gains a **Venues tab**: match review (attach things/events to venues), pool curation (approve/reject candidate photos per venue), and pin controls.
- Deterministic rotation: an event at a venue with an approved pool gets `pool[hash(thing_id + date) % pool.length]`, then a per-feed-render dedupe pass demotes repeats so one venue's photo appears at most once per feed view; siblings fall to the next unused pool photo, then motif/gradient.

**Google compliance pattern (replaces URI storage):**
- Persist `place_id` (cacheable indefinitely per Google terms) and the photo resource name.
- A nightly refresh step re-requests fresh `photoUri` serving URLs for every Google-sourced row that the app currently displays, writing them to `serving_url`. Every URI the app serves is therefore under ~24h old. Refresh calls count against the same monthly cap.
- Render Google's returned `authorAttributions` on the thing detail page. Wikimedia rows render artist + license the same way.

**Cost posture:** `IMAGE_MONTHLY_CALL_CAP=500`, set explicitly in both Vercel and GitHub Actions. Expected steady state ~$0 (inside the free tier); the cap is the runaway guard and is shared with closure checks, so leave headroom. Every Google request path must call the existing `onCall`-style counter.

---

## 3 · Phase 0 · Triage (1 session · no DDL · fully reversible)

**Goal:** stop the stock swamp this week. No new sources, no schema changes.

**Files to reconcile first:** `ingest/images.ts`, `ingest/run.ts`, `ingest/pipeline.ts`, `components/ui/Card.tsx`.

### 3.1 Changes

1. **Relevance-first ranking.** In `rankOptions()`, change the order array to `['owned','wikimedia','google','pexels']`. Pexels remains as a last-resort real image until Phase 3 removes it.
2. **Events skip photo resolution.** In the resolver loop (or at the call site in `pipeline.ts`, whichever is cleaner against live code), candidates whose derived tier is 1 (dated events) resolve to `photo_url = null`, `photo_source = 'placeholder'`, with `photo_options` still gathered and stored so the cockpit picker can override per-thing (founder can still hand-assign a photo to any event; the default is no photo). `ListCard`'s existing gradient fallback renders these. **Exception:** if a cockpit-picked photo already exists on the thing (photo chosen by the founder previously), preserve it; never clobber founder picks.
3. **De-dup guard.** Within a single resolver run, track chosen `photo_url`s; if a URL was already chosen this run for a different `place_key`, prefer the next-ranked alternate. (Cheap in-memory `Set`; per-feed render dedupe comes later with pools.)
4. **Stale comment and cap.** Update the `$0.007/call` comment to reflect current pricing reality (Enterprise-class ≈ $20 per 1,000; two billable calls per photo). Change the code default cap from 1400 to 500. (Jim will also set the env var explicitly in Phase 2; the default change is belt-and-suspenders.)
5. **Backfill.** After merge, run the forced backfill (`IMAGE_BACKFILL=1 IMAGE_FORCE=1`) via the existing GitHub Actions path (workflow_dispatch if wired; otherwise run it the same way the nightly job runs; do not have Jim run terminal commands). Confirm stats output: expect the vast majority of dated events at `placeholder`, places resolving Wikimedia-first.
6. **Coverage report (one-off, read-only).** Emit a small report (console/markdown artifact) from live data: things per category × current photo_source; distinct address/lat-lng clusters for T1 events sorted by event count (this seeds the Phase 2 venue registry with real concentration data). No schema changes; read-only queries.

### 3.2 Acceptance criteria

- Explore feed at 390px and 1280px: no Pexels image visible above the fold on a typical day; dated events render the gradient fallback; place cards showing Wikimedia images where the old title-search finds something reasonable.
- No card ever blank; hero never blank (verify hero fallback path).
- `image_spend` unchanged (no Google calls fired).
- Revert path documented in the PR description: restore the order array and remove the tier-1 skip.

**Stop-and-show, then Build Deltas entry: "Phase 0 triage".**

---

## 4 · Phase 1 · SB-true photos for places + marquee inheritance (~2 sessions · expected zero DDL)

**Goal:** places look like Santa Barbara; events at the ~12 marquee landmarks inherit genuinely beautiful free photos.

**Files to reconcile first:** `ingest/images.ts`, cockpit picker routes/components, thing detail page component, `packages/shared/types`.

### 4.1 Wikimedia geosearch upgrade

Replace the title-search adapter with a two-mode adapter:
- **Geosearch mode** (places with `lat`/`lng`): `action=query&generator=geosearch&ggscoord={lat}|{lng}&ggsradius=200&ggslimit=10&ggsnamespace=6` + `prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200`. Start radius 200m; make radius and limit constants at top of file.
- **Title mode** (no coords): keep the existing behavior as fallback for places only (never events).

### 4.2 The quality gate (pure, unit-tested function)

Reject a candidate photo if any of:
- width < 800px (use `iiprop=size`);
- aspect ratio outside 1:1 to 2.2:1;
- filename/category matches a blocklist regex: `map|plan|diagram|logo|seal|coat_of_arms|document|scan|page|sheet|chart|svg|pdf|book|newspaper`;
- MIME not jpeg/png/webp.

Score survivors: keyword overlap between the file title/description and the thing title/neighborhood (+2 per token), license preference (PD/CC0 +3, CC-BY +2, CC-BY-SA +1, anything else 0 and flag), distance ascending as tiebreak. Choose the top score above a minimum threshold (start: score >= 2); below threshold = miss (falls through). Store parsed license short-name and artist into attribution.

### 4.3 Attribution rendering

- Persist attribution for every non-owned photo: `things.photo_attribution` (exists) formatted as `"{artist} · {license} · Wikimedia Commons"` or `"{author} · Google"`.
- Render it on the **thing detail page** only (not the 108px card rail): small `text-secondary` line in the photo block, AA-contrast, with source link where available. Add once in the detail component so all sources inherit it.

### 4.4 Marquee registry (code-level, no DDL)

- New founder-maintained file `ingest/marqueeVenues.ts` (same pattern as the recurr registry): ~12 entries `{ key, names: string[], lat, lng, radiusM, pinnedPhoto?: { url, source: 'wikimedia'|'owned', attribution } }`. Seed with: Santa Barbara Bowl, Arlington Theatre, Granada Theatre, Lobero Theatre, SB County Courthouse / Sunken Gardens, Old Mission, Stearns Wharf, MOXI, SB Museum of Art, Chase Palm Park, Alameda Park, SB Zoo. Leave `pinnedPhoto` empty; Jim pins via cockpit.
- Resolver step (between owned and direct-Google): match a candidate to a marquee venue by name token match OR haversine distance <= radiusM. On match with a pinned photo, use it (`photo_source='wikimedia'` or `'owned'`).
- **Cockpit pinning:** in the Live catalog picker, when a thing matches a marquee venue, surface top-5 gated geosearch results for that venue's coordinates as picker alternates labeled "landmark"; founder's pick writes the pin back. Emit a paste-ready `marqueeVenues.ts` snippet on pin (same UX as the recurr registry snippet flow) so the registry file stays the source of truth.

### 4.5 Direct Google for food and drink (initial wiring)

- Route `food_drink_spot` (and `weekly_special`/`happyhour`-type venue-anchored T2 things, if present) with a `place_id` to `googlePhoto()` **before** Wikimedia, still capped and cached. Keep URI storage for now (Phase 2 replaces it); it is acceptable for days, not months.
- Before enabling: re-verify current Places API photo pricing and free-tier numbers against Google's live pricing page and record findings in the ledger. If materially worse than ~$20/1k with ~1,000 free events/mo, stop and flag to Jim before firing calls.
- Run a scoped backfill for the food set only.

### 4.6 Acceptance criteria

- Courthouse/Mission/Wharf-type things show real, correct SB photos; food places show their actual venue.
- Events at marquee venues (e.g. anything at the Bowl) show the pinned landmark photo.
- Detail pages show attribution for every non-owned photo; card rail shows none.
- Quality gate unit tests pass (include fixture cases: a map file, a logo, a portrait-orientation reject, a PD photo outranking CC-BY-SA).
- `image_spend` shows only the expected food-set calls; counter increments 2 per photo.

**Stop-and-show, then ledger entry: "Phase 1 places + marquee".**

---

## 5 · Phase 2 · Venue registry, photo pools, compliant Google pattern (~3 sessions · DDL Moment 1)

**Goal:** the D increment. Events inherit founder-approved venue photos with rotation and dedupe; Google storage moves to the stable-reference + nightly-refresh pattern.

**Files to reconcile first:** everything from Phases 0/1, plus cockpit tab components, `ingest/run.ts` (nightly step insertion point), Supabase schema.

### 5.1 FOUNDER-RUN DDL (Moment 1)

Generate exactly this (adjust names only if they collide; additive only), hand it to Jim, and wait for confirmation:

```sql
-- Card Imagery Phase 2 · venues + photo pools (additive)
create table if not exists venues (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,            -- slug, e.g. 'soho-music-club'
  display_name  text not null,
  place_id      text,                            -- Google place_id (cacheable identifier)
  lat           double precision,
  lng           double precision,
  radius_m      integer not null default 150,
  name_patterns text[] not null default '{}',    -- lowercase match tokens
  status        text not null default 'active',  -- 'active' | 'archived'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists venue_photos (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references venues(id) on delete cascade,
  source        text not null,                   -- 'google' | 'wikimedia' | 'owned'
  stable_ref    text not null,                   -- google photo resource name, commons file title, or owned URL
  serving_url   text,                            -- current hotlinkable URL (google rows refreshed nightly)
  attribution   text,
  approved      boolean not null default false,  -- only approved rows ever render
  sort_order    integer not null default 0,
  refreshed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (venue_id, stable_ref)
);

alter table things add column if not exists venue_id uuid references venues(id);

create index if not exists venue_photos_venue_idx on venue_photos (venue_id) where approved;
create index if not exists things_venue_idx on things (venue_id);

-- RLS: public read of venues + approved photos only (mirror existing published-read patterns)
alter table venues enable row level security;
alter table venue_photos enable row level security;
create policy public_read_venues on venues for select using (status = 'active');
create policy public_read_venue_photos on venue_photos for select using (approved);
```

Service-role writes only (pipeline + cockpit), consistent with existing tables. Verify the exact RLS idiom against the live schema before handing over.

### 5.2 Venue registry seeding (pipeline, idempotent)

- One-off seeding script (run via the Actions path): cluster published things by `place_id` (exact) then by lat/lng proximity (<=75m) + fuzzy name match (`pg_trgm` style, in TS), using the Phase 0 concentration report. Emit **proposed** venues (status rows in a seed report) covering every location hosting >= 3 dated events, expected ~30 to 60 venues. Marquee registry entries import as venues automatically (keep `marqueeVenues.ts` as the seed source; DB becomes runtime truth).
- Write proposed matches as `things.venue_id` **only after founder approval** in the cockpit (below). The matcher runs nightly for new things: exact `place_id` match auto-attaches; fuzzy matches queue for review.

### 5.3 Cockpit · Venues tab

Add a fifth tab with three panes (follow cockpit v2 component conventions and house tokens):
1. **Matches to review:** proposed thing→venue attachments (fuzzy tier). Approve / reject / reassign. Approve writes `venue_id`.
2. **Photo pools:** per venue, a candidate strip and an approved strip. "Fetch candidates" pulls up to 10 Google photos (Place Details `photos` fieldmask, 1 billable call per venue; store resource names; render preview via a short-lived media call) plus top-5 gated Wikimedia geosearch results. Approve moves a candidate to the pool (sets `approved=true`, assigns `sort_order`); target pool size 3 to 5. Reject hides it. Reorder via sort controls.
3. **Venue editor:** rename, adjust radius, add name patterns, archive.

Every fetch that hits Google increments the shared spend counter. Batch the preview media calls (fetch on demand per venue, not eagerly for all venues).

### 5.4 Resolver integration: pool rotation + per-feed dedupe

- Resolver: if `thing.venue_id` has approved photos, assign `photo_source='google'|'wikimedia'` (per pool row), `photo_url = serving_url`, and store `pool_pick = hash(thing_id) % pool.length` semantics via a pure function `pickFromPool(thingId, isoDate, poolLen)` (date-hash so it rotates day to day; unit-test determinism).
- **Per-feed dedupe at render time** (Explore/Discover feed assembly, server-side): walk the feed order; if a venue's photo instance already appeared, advance that card to the next unused pool photo; if the pool is exhausted, fall to motif/gradient. Pure function over the feed array; unit-test with a synthetic 5-events-one-venue feed.
- Founder per-thing picker overrides always win over rotation.

### 5.5 Nightly Google URI refresh (compliance step)

- New step in `run.ts` after resolution: select all `venue_photos` where `source='google'` and `approved`, plus `things` rows with `photo_source='google'` not backed by a pool; re-request Place Photo media per `stable_ref` (`maxWidthPx=1200&skipHttpRedirect=true`), write `serving_url`, `refreshed_at`. Each request increments the cap counter. Alert (existing failure-isolation pattern) if refresh failure rate > 20% or the cap would be exceeded; on cap-exceeded, keep yesterday's URIs and log `over_cap`.
- Sizing check in code comments: pools (~40 to 60 venues × 3 to 5 photos) + food set ≈ 200 to 350 calls/night is TOO MANY against a 500/mo cap. Therefore: refresh **only photos currently assigned to a published, visible thing** (assigned serving photos, not whole pools), expected ~40 to 80/night... which is still ~1,200 to 2,400/mo. **Resolution (build this, do not silently choose otherwise):** request `maxWidthPx` media URIs which per Google docs remain valid for a period after issuance; refresh each assigned photo only when `refreshed_at` is older than 20 hours AND the photo is scheduled to render in the next feed build; verify empirically during the phase how long URIs actually live; if daily refresh of assigned photos cannot fit under the cap with the free tier (~1,000 events/mo Enterprise), raise the cap decision to Jim with exact math in the stop-and-show rather than deciding unilaterally. Record the chosen refresh cadence in the ledger.
- Fallback resilience: if a Google `serving_url` 403s/404s at render time is not detectable server-side cheaply, so instead: `onError` on the card image element falls back to the gradient (client-side, one-line handler), guaranteeing no broken-image state between refreshes.

### 5.6 Acceptance criteria

- An event at SOhO shows an approved SOhO photo; three same-day SOhO events show three different pool photos or motif/gradient after exhaustion; no venue photo repeats within one feed render.
- Cockpit Venues tab: full match-review and pool-curation loop works end to end; every Google fetch increments `image_spend`.
- No Google `photoUri` older than the verified validity window is served; `refreshed_at` populated; broken-image fallback verified by poisoning one URL in dev.
- Attribution renders for pool photos on detail pages (Google author attributions included).
- All new pure functions unit-tested: `pickFromPool`, feed dedupe, matcher scoring.
- Cap math documented in the ledger with real observed call counts.

**Stop-and-show (include the SOhO repetition demo), then ledger entry: "Phase 2 venues + pools + compliant refresh".**

---

## 6 · Phase 3 · The motif tier and Pexels retirement (~2 sessions + art sessions elsewhere · DDL Moment 2)

**Goal:** every card that earns no photo renders a house-drawn v3 ink motif; Pexels exits the codebase.

**Inputs:** the working motif art lives in `SBDaymaker_Explore_Feed_Mockup_v1.html` (symbols, grain/vig/tremble filters, tint classes) and the card-visuals handoff v2 (§9 technical learnings). **Copy the working SVG symbols and filters; do not redraw.** Note: SVG `<use>` requires inline style attrs per the handoff.

### 6.1 FOUNDER-RUN DDL (Moment 2)

```sql
-- Card Imagery Phase 3 · motif tier (additive)
alter type photo_source add value if not exists 'motif';
alter table things add column if not exists visual_kind text;   -- 'motif' | 'bigtype' | null
alter table things add column if not exists visual_key  text;   -- motif id, e.g. 'wharf'
alter table things add column if not exists visual_seed integer;
```

### 6.2 Build

- **Motif library module** (`components/visuals/`): port the 8 approved motifs + tint families from the mockup into a single sprite/registry keyed by `visual_key`; deterministic mapping `category/venue-family → motif` with `visual_seed = hash(thing_id)` for tint/variant selection. Batch-safe: assignment happens in the pipeline, render is pure.
- **Big-type fallback (D8):** for categories with no motif, render one true fact (Fraunces, large) sourced from existing structured fields only (year, neighborhood, day); never AI at runtime.
- **Card.tsx:** render order photo → motif (`visual_kind='motif'`) → bigtype → existing gradient. 108px rail crop-safe; AA contrast on all tint families; `prefers-reduced-motion` respected (no animated filters).
- **Resolver:** tier-1 events and all misses assign `photo_source='motif'` + visual columns instead of `placeholder` (gradient remains the code-level final catch).
- **Pexels retirement:** delete `pexelsMany`, remove `'pexels'` from ranking, remove the env key from code paths (Jim deletes the secret; keep the enum value, historical rows re-resolve in backfill). Full forced backfill; confirm zero `photo_source='pexels'` rows remain.
- Remaining motifs beyond the 8 arrive from the art track as SVG symbols; the registry must accept drop-in additions without code changes elsewhere.

### 6.3 Acceptance criteria

- Zero Pexels rows; zero Pexels requests in a nightly run log.
- A full Explore day renders: photos where earned, motifs elsewhere, no two identical adjacent visuals, no blank cards, hero intact.
- Lighthouse a11y pass on Explore >= previous score; contrast checks on every tint family.

**Stop-and-show, then ledger entry: "Phase 3 motif tier + Pexels retirement".**

---

## 7 · Environment variables and secrets (Jim sets these; you verify presence, never print values)

| Var | Where | Value | When |
|---|---|---|---|
| `IMAGE_MONTHLY_CALL_CAP` | Vercel + GitHub Actions | `500` | Phase 2 start |
| `GOOGLE_PLACES_KEY` | exists | unchanged | verify Phase 1 |
| `PEXELS_API_KEY` | exists | **deleted by Jim** | after Phase 3 backfill confirms |

## 8 · Out of scope (do not build)

Openverse adapter; generative geometry backing; duotone rescue; asides/pelican/personality layers; any per-request AI; any non-additive schema change; any sponsor-aware logic anywhere in visual selection.

## 9 · Definition of done (whole build)

1. Feed composition roughly: ~45 to 60% founder-approved or gated real photos, remainder motifs/big-type, gradient rare.
2. Steady-state image cost ~$0/mo with a hard 500-call cap enforced and observed in `image_spend`.
3. No stored Google serving URI older than the verified validity window; bytes never stored.
4. Attribution on every non-owned photo's detail page.
5. Founder daily ops unchanged (~15 min); pool curation is an explicit, bounded weekly touch.
6. Build Deltas ledger has one entry per phase plus one per deviation.
