# 01 — Repo Map (as-built)

> **Repo:** sb-daymaker · **Branch:** main · **Commit:** `caa73028f1fb2bde2f3a50a62a999417ec3e5c65` (caa7302)
> **Snapshot date:** 2026-07-03 · **Read-only survey — nothing here was modified.**
> **Framework:** Next.js **16.2.9** · React **19.2.4** (App Router, Turbopack dev).
> **Key deps:** @anthropic-ai/sdk ^0.105.0 · @supabase/ssr ^0.12.0 · @supabase/supabase-js ^2.108.2 · cheerio ^1.2.0 · uuid ^11.1.0.
> **Dev:** tailwindcss ^4 · @tailwindcss/postcss ^4 · typescript ^5 · vitest ^3.2.0 · tsx ^4.20.0 · eslint ^9 · eslint-config-next 16.2.9.
>
> **Where code contradicts CLAUDE.md / spec docs, this file reports what the code does and flags the conflict.** No secrets: env vars are referenced by NAME only.

**Scope:** ~24,835 source lines across app/ components/ lib/ ingest/ packages/ scripts/ supabase/ fixtures/ plus top-level config. `app/components.css` (5,053 lines) is the single largest file and dominates the CSS layer.

---

## 1. Source tree with per-file line counts (excl. node_modules, .next, .git, lockfiles, build artifacts)

### app/ — routes, API, PWA metadata, CSS layer

**Root / metadata**
```
  85  app/layout.tsx              Root HTML: next/font (Fraunces/Inter/JetBrains), CSS cascade order, SavesProvider + ItinerariesProvider + ServiceWorkerRegister
  26  app/manifest.ts             PWA web app manifest (name, icons, orientation, theme color)
  34  app/opengraph-image.tsx     Dynamic OG image (ImageResponse: tagline + wordmark)
  14  app/robots.ts               robots.txt generator: allow /, disallow /cockpit /api /s/ /r/ /confirm /unsubscribe /offline
  11  app/sitemap.ts              sitemap.xml: home, /discover, /saved (weekly)
  36  app/globals.css             Tailwind v4 @import + font-var mapping + @theme color mirrors
 166  app/sbdaymaker_tokens.css   Design-system source of truth (colors, typography, spacing, radius) — mirror of Core Project Files/sbdaymaker_tokens.css
5053  app/components.css          Component CSS layer (all reusable UI blocks; largest file in repo)
```

**app/(app) — public browse shell (route group)**
```
  21  app/(app)/layout.tsx           App shell: BrandHeader (sticky) + main + BottomNav
  26  app/(app)/page.tsx             Explore homepage: published things + weather + hero pin → ExploreClient
  53  app/(app)/discover/page.tsx    Discover SB guides (ISR ~10min), grouped by neighborhood/theme
  97  app/(app)/discover/[id]/page.tsx  Single guide page (stops list)
  23  app/(app)/submit/page.tsx      "Suggest an event/business" → SubmitForm
  11  app/(app)/saved/page.tsx       Saved page: published pool (ISR) → SavedClient (local-state filtering)
 126  app/(app)/thing/[id]/page.tsx  Thing detail page (facts, blurb, save, back)
```

**app/plan — plan-a-day surface (own layout, NOT the (app) group)**
```
  11  app/plan/page.tsx      Fetches published things (ISR ~10min) → PlanClient
  17  app/plan/layout.tsx    Standalone plan chrome (deliberately NOT the (app) AppHeader — see §3)
  40  app/plan/loading.tsx   Suspense loading skeleton
```

**app/admin — Cockpit v2 (LIVE; see §3 admin-vs-cockpit)**
```
  21  app/admin/layout.tsx           Auth gate (getAdminUser → redirect /cockpit/login) + CockpitTabs shell + loadCockpitCounts
  52  app/admin/CockpitTabs.tsx      Topbar + tab strip: Queue · Coverage · Live catalog · Hero plan (+ counts)
  18  app/admin/TabStub.tsx          Placeholder for deferred tab views
  15  app/admin/review/page.tsx      Queue view: loadCockpitData → ReviewQueue
 326  app/admin/review/ReviewQueue.tsx  Queue orchestrator (keyboard nav, approve/reject, source health)
 258  app/admin/review/ReviewCard.tsx   Per-item review card (trust chips, image picker, inline edit)
  41  app/admin/review/ImagePicker.tsx  Photo-options picker (ranked alternates)
  70  app/admin/review/SourceHealth.tsx Source-run health strip
  36  app/admin/review/DroppedPanel.tsx Dropped/gated-out items panel
 336  app/admin/review/cockpit.css      Cockpit v2 styles (topbar, tabs, digest cards, phone fallback)
  11  app/admin/coverage/page.tsx    Coverage grid: fetch by vibe/zone → CoverageView
 239  app/admin/coverage/CoverageView.tsx  RAG coverage matrix (vibe × zone × time windows)
  11  app/admin/catalog/page.tsx     Live published catalog → CatalogView
 239  app/admin/catalog/CatalogView.tsx  Searchable/paginated published grid (edit/delete inline) [MODIFIED in working tree]
  11  app/admin/heroes/page.tsx      14-day hero plan → HeroPlanView
 135  app/admin/heroes/HeroPlanView.tsx  Hero pins/auto-picks rail + pin/unpin
```

**app/cockpit — Phase-8 cockpit (LEGACY / mostly dead; see §3)**
```
  10  app/cockpit/page.tsx           force-dynamic redirect → /admin/review (superseded by Phase 12)
  20  app/cockpit/login/page.tsx     Login page (the ONLY still-reachable cockpit route — admin layout redirects here)
  58  app/cockpit/login/LoginForm.tsx  Supabase email/password login form (getBrowserSupabase)
  95  app/cockpit/ReviewCard.tsx     ORPHAN — Phase-8 review card, never imported (replaced by admin/review/ReviewCard)
  52  app/cockpit/actions.ts         ORPHAN — Phase-8 approve/reject server actions, only referenced by the orphan ReviewCard
```

**app/api/review/** (publishing pipeline endpoints)
```
  11  app/api/review/queue/route.ts        GET today's queue (pending/dropped/sources), admin-gated
 156  app/api/review/approve/route.ts      POST publish (bulk or with edits/photos/hero_eligible); applies pending overlays
  42  app/api/review/reject/route.ts       POST archive things / discard pending edits (audit-logged)
  74  app/api/review/update/route.ts       POST founder inline edit (blurb/tags/photo only — NEVER start time)
  16  app/api/review/image-fetch/route.ts  POST — Phase-13 STUB for Google Places photo resolution (placeholder)
```

**app/api/admin/** (cockpit operations)
```
  23  app/api/admin/catalog/route.ts         GET paginated published things (filters: tier/vibe/zone/q)
  59  app/api/admin/catalog/edit/route.ts    POST founder edit DIRECTLY to live row (no queue; start time not editable) [MODIFIED in working tree]
  28  app/api/admin/catalog/delete/route.ts  POST archive (status='archived', reversible) [NEW, untracked in working tree]
  14  app/api/admin/coverage/route.ts        GET coverage matrix (vibe|zone × 7/14/30/45-day + evergreen)
  23  app/api/admin/coverage/cell/route.ts   GET one cell's contributing things
  59  app/api/admin/hero-pins/route.ts       GET 14-day hero plan; POST pin; DELETE unpin
  35  app/api/admin/hero-eligible/route.ts   POST toggle hero_eligible flag
  47  app/api/admin/restock/route.ts         POST queue a restock directive (scope + window)
  21  app/api/admin/restock/list/route.ts    GET recent restock directives (rail)
```

**app/api/subscribe + app/api/cron/**
```
  49  app/api/subscribe/route.ts       POST email signup → double opt-in confirm + unsubscribe tokens via Resend
  16  app/api/cron/nightly/route.ts    DEPRECATED no-op (nightly moved to GitHub Action ingest/run.ts); returns {ok:false, deprecated:true}
  27  app/api/cron/reaper/route.ts     GET (Vercel cron) delete share/restore tokens idle >90d, auth via CRON_SECRET
```

**app/ public token + email pages**
```
  39  app/p/[token]/page.tsx          Shared-plan viewer (kind='shared_plan')
 173  app/p/[token]/SharedPlanView.tsx  Read-only shared plan render
   7  app/p/[token]/layout.tsx        Standalone layout (no AppHeader/BottomNav)
  39  app/r/[token]/page.tsx          Save-restore magic link (kind='save_restore')
  47  app/r/[token]/RestoreView.tsx   Restore-saves confirmation UI
  43  app/s/[token]/page.tsx          Shared-list viewer (kind='shared_list')
  69  app/s/[token]/SharedListView.tsx  Read-only shared-list render
  44  app/confirm/page.tsx            Double-opt-in confirm (confirm_subscription RPC)
  44  app/unsubscribe/page.tsx        Unsubscribe (unsubscribe RPC)
  36  app/offline/page.tsx            PWA offline fallback screen
```

### components/ — UI

**Root / shell**
```
  30  components/BrandHeader.tsx      Global "Golden Hour" brand header (mark + wordmark + horizon glow) — LIVE (app/(app)/layout)
 134  components/brand-header.css     BrandHeader styles (sun/glint animations)
  16  components/app/AppHeader.tsx    ORPHAN — compact internal header, never imported (only named in comments)
 117  components/app/BottomNav.tsx    Bottom tab nav: Explore · Saved · Discover SB · Plan (badge count)
```

**detail / discover**
```
  18  components/detail/BackButton.tsx        router.back() fallback with label
  14  components/detail/DetailSaveButton.tsx  Save/unsave heart (SavesProvider)
  27  components/discover/GuideCard.tsx       Neighborhood/theme guide card link
```

**explore**
```
 111  components/explore/ExploreClient.tsx    Explore root: state + Hero + ControlRow + TuneSheet + CascadeFeed + EmailSignup
 112  components/explore/Hero.tsx             "One Front Page" hero: SB skyline SVG, time-of-day sky/glow, weather chips, pinned pick
  74  components/explore/ConditionChips.tsx   Weather + sunset-countdown chips (90-min golden-hour window)
 256  components/explore/CascadeFeed.tsx      Cascade: today/week/month sections, tier-1 lead rail + tier-2/3 grids
  57  components/explore/LeadDayRail.tsx      Week lead: tier-1 grouped by SB-local day, spine nodes
  83  components/explore/RockTile.tsx         Full-bleed image tile (month lead) + CardActions overlay
  58  components/explore/ControlRow.tsx       Horizon segmented control (Today/Week/Month) + filter count + Tune
 119  components/explore/TuneSheet.tsx        Bottom sheet: lens (occasion) + zone pickers + geolocation
  82  components/explore/NearMeSheet.tsx      Near-me zone picker (geolocation-driven)
  51  components/explore/LensSheet.tsx        ORPHAN — standalone lens picker, superseded by TuneSheet
  30  components/explore/OnePerfectDayCard.tsx  ORPHAN — "One Perfect SB Day" CTA card, not imported
 143  components/explore/derive.ts            Card/hero copy helpers (cardBlurb, cardFacts, heroCta, heroTime, …)
```

**plan** (several orphans — Plan Simplification / "revert to simple plan" left dead code)
```
  45  components/plan/PlanClient.tsx          Plan state machine (setup → results)
 288  components/plan/PlanSetup.tsx           Questionnaire (When/Who/Periods/Vibe) — LIVE
 224  components/plan/PlanResults.tsx         Results view: ItinerarySpine + AddStopSheet + share/save
  15  components/plan/PlanHeader.tsx          Plan sticky header
  84  components/plan/ItinerarySpine.tsx      Vertical timeline (period blocks + stop cards + add-slot)
 101  components/plan/SpineStopCard.tsx       Stop item on spine (title/time/place/tags/save/remove)
 173  components/plan/AddStopSheet.tsx        Add-stop picker (ranked candidates + saved carousel)
 128  components/plan/ItinerariesProvider.tsx localStorage context for saved itineraries
  34  components/plan/DayShapeSelector.tsx    ORPHAN — removed in Plan simplification
  81  components/plan/MyPlansDrawer.tsx       ORPHAN — saved-plans drawer, not imported
  72  components/plan/SaveNameSheet.tsx       ORPHAN — save-plan name editor, not imported
 138  components/plan/SwapSheet.tsx           ORPHAN — swap-stop picker (swap feature removed)
 121  components/plan/PinPickerSheet.tsx      ORPHAN — build-from-saved drawer, not imported
```

**saved / saves / signup / submit / pwa**
```
 428  components/saved/SavedClient.tsx     Saved root: Want/Been toggle + nearby zone + cards + MemoryRecap + ShareBar + RestorePanel
 117  components/saved/SavedCard.tsx       Saved item card (state toggle, share/remove)
  78  components/saved/SavedDays.tsx       ORPHAN — saved-plans list, not imported (SavedClient uses lib/savedGroups instead)
  51  components/saved/SavedToggle.tsx     Want/Been tab toggle
  25  components/saved/ShareBar.tsx        Floating share bar (N selected)
  73  components/saved/RestorePanel.tsx    Save-restore magic-link generator
 103  components/saved/MemoryRecap.tsx     "Your Santa Barbara" recap (been-items by zone)
  20  components/saved/share.ts            shareUrl() helper
 117  components/saves/SavesProvider.tsx   localStorage want/been context (hydrate-on-mount)
  68  components/signup/EmailSignup.tsx    Email subscribe form → POST /api/subscribe
 136  components/submit/SubmitForm.tsx     Public submission form (event/business)
  41  components/pwa/ServiceWorkerRegister.tsx  SW register (prod cache-first, dev cache-clear)
```

**ui/ (barrel library)**
```
  36  components/ui/Button.tsx           Variants (cta/primary/secondary), block, icon slot
 181  components/ui/Card.tsx             PickCard (image-led) + ListCard (compact row)
  87  components/ui/BottomSheet.tsx      Slide-up modal (backdrop, scroll lock, focus trap)
  68  components/ui/SaveHeart.tsx        Save heart toggle + pop (reduced-motion aware)
  48  components/ui/Chip.tsx             Tag (static) + Chip (toggle filter)
  59  components/ui/CardActions.tsx      Floating save + share overlay
  50  components/ui/Pill.tsx             OccasionPill + DateEyebrow + PlacePill
  54  components/ui/SectionHeader.tsx    Lead / collapsible section headers
  37  components/ui/SegmentedControl.tsx Mutually-exclusive tab switch
  77  components/ui/SBIcon.tsx           Inline SVG icon set
  27  components/ui/EmptyState.tsx       Icon + title + message + action
  39  components/ui/Skeleton.tsx         Shimmer placeholder + SkeletonCard
  12  components/ui/index.ts             UI barrel export
```

### lib/ — server helpers, data access, domain logic
```
 122  lib/things.ts          Thing types (place/event/firstlook/happyhour), HappyHourWindow, RecurringSchedule
 162  lib/explore.ts         Explore feed filtering/rendering with SB day-keying
 138  lib/pipeline.ts        Nightly submission→published pipeline (drafting/enrich/flag) — LARGELY SUPERSEDED by ingest/ worker (see §7)
  96  lib/enrich.ts          Claude API blurb/blurb_long/occasion-tag generation per candidate
  76  lib/guides.ts          Neighborhood & theme guides (curated stops)
 136  lib/heroServer.ts      Server-only hero plan (14-day rail, pins, auto-picks, eligibility)
 120  lib/catalogServer.ts   Server-only live-catalog reads with pending_edit flag (50/page) [MODIFIED in working tree]
 114  lib/coverageServer.ts  Server-only coverage aggregation (service-role, occurrence counting)
  71  lib/coverage.ts        Client-safe coverage types + RAG shading math
 130  lib/occurrences.ts     Tier-1/Tier-2 occurrence math (coverage + plan eligibility)
 279  lib/review.ts          Shared review shapes + pure helpers (formatters, vocab) [MODIFIED in working tree]
 191  lib/reviewServer.ts    Server-only cockpit data access (service-role reads + admin auth guard)
  41  lib/occasions.ts       10 occasion tags (the Lens) with color/text styling
  62  lib/zones.ts           Near-Me zone anchors (six coarse neighborhood points)
  25  lib/savedGroups.ts     Grouped saved display (Events/Happy Hours/First Looks/Places)
  61  lib/shares.ts          Isomorphic shared_states RPC wrappers (saves + shared plans)
  33  lib/submissions.ts     Public submission landing (→ submissions table)
  74  lib/weather.ts         Time-of-day (SB) + OpenWeather current (cached, graceful degrade)
  78  lib/sun.ts             Deterministic sunset time (Sunrise/Sunset Algorithm) for hero countdown
  31  lib/email.ts           Minimal Resend sender (REST, no SDK)
  22  lib/supabase.ts        Public anon client builder (null if unconfigured)
  16  lib/supabaseAdmin.ts   Service-role client (bypasses RLS; server/CI only)
   9  lib/supabaseBrowser.ts Browser auth client (cockpit login)
  32  lib/supabaseServer.ts  Cookie-bound auth-session client (cockpit)
```
**lib/plan/**
```
  60  lib/plan/buildDraft.ts     Pure spine seeder (one ranked pick per period)
  68  lib/plan/dates.ts          SB-tz date helpers (todayISO, formatting)
  87  lib/plan/itineraries.ts    localStorage SavedItinerary management (no accounts)
  27  lib/plan/labels.ts         Human zone/block labels (null-safe)
 114  lib/plan/rankCandidates.ts Pure deterministic ranking (no AI)
  91  lib/plan/types.ts          Plan UI types (Block/Tod/PlanAnswers/Stop/VibeKey)
```

### ingest/ — nightly ingestion worker (runs via GitHub Action, `npx tsx ingest/run.ts`)
```
 284  ingest/run.ts        Worker entrypoint: fetch → gate → dedupe → land (per-source isolation); flags: DRY_RUN, ENRICH_BACKFILL, image/closure backfill
 168  ingest/land.ts       Land gated+deduped candidates as needs_review (idempotent upsert) + run bookkeeping
 178  ingest/gate.ts       Strict gate (pure): enforce start times, addresses, sources; NO AI before gate; uuid5 IDs
 172  ingest/dedupe.ts     Two-layer dedupe (exact uuid5, then trigram NEAR-dedupe on same-day events)
 229  ingest/enrich.ts     Claude Haiku batch blurb + occasion tags (audit-logged)
 208  ingest/images.ts     Image waterfall: Pexels → Wikimedia → Google Place Photos (monthly cap)
  78  ingest/digest.ts     Nightly summary email (source_runs + ingest_drops + image stats)
  74  ingest/restock.ts    Queued-path restock consumption (mark directives done by counting landed)
 140  ingest/parseSeed.ts  String-aware seed-SQL parser (quotes/commas/casts/arrays)
  23  ingest/buildFixtures.ts  Parse 107-row seed → fixtures/seed_rows.json (gate-test oracle)
  28  ingest/db.ts         Service-role client for worker (GH Action secrets first, .env fallback)
  56  ingest/tz.ts         Build ISO-8601 with correct America/Los_Angeles offset (PDT/PST)
```
**ingest/adapters/_shared/** (helpers)
```
 151  fetchHtml.ts     Polite fetcher (15s timeout, per-source rate limit, robots.txt, managed-scrape routing) — used by ~14 scrape adapters
  43  geoFilter.ts     In-scope validator (SB/Goleta/Montecito/Carpinteria/Summerland/Isla Vista + zips)
 226  ics.ts           iCal parser (DTSTART/DTEND → ISO; RRULE → recurring registry)
  47  inferYear.ts     Year inference for "weekday+month+day" (weekday as checksum)
 104  jsonLd.ts        Extract schema.org Event from ld+json blocks
 144  localist.ts      Localist event API fetcher (paginated)
  54  occasionTags.ts  Seed-tag mapping (adapter hints; enrich refines)
  73  relativeDate.ts  "Today/Tomorrow/this Saturday" → ISO (SB tz)
 124  wpEvents.ts      WordPress/Tribe discovery+fetch (Tribe REST → iCal → scrape)
```
**ingest/adapters/** (37 files: 33 registered feeds + `registry`, `types`, `http`, `googlePlaces`)
```
  68  registry.ts      ORDERED active-adapter list (order = dedupe canonical-source preference)
  28  types.ts         SourceAdapter interface
  50  http.ts          Shared fetch + managed-scrape (Scrapfly) switch, OFF by default — DUP of _shared/fetchHtml (see §8)
  66  googlePlaces.ts  Permanent-closure detection (businessStatus; weekly, cost-capped) — used by run.ts, not registry
```
Registered feed adapters (one line each):
```
 174 alcazar          Alcazar Theater (Carpinteria) — WP Tribe REST → iCal → scrape
  27 allevents        AllEvents.in — SPA blocker; Scrapfly off; STUB
 168 arlington        Arlington Theatre — WP Tribe REST → iCal → scrape
 153 botanicGarden    SB Botanic Garden — WP Tribe REST → iCal → scrape + Tier-3 spot
  63 carpinteriaArts  Carpinteria Arts Center — Google Calendar iCal (RRULE)
 127 carpinteriaCivic City of Carpinteria — WP Tribe REST → HTML scrape
 172 centerstage      Center Stage Theater — ARTdynamix CMS JSON scrape
  84 citySites        City of SB civic calendar — aria-label parser
  27 coastalView      Coastal View News — Evvnt SPA blocker; Scrapfly off; STUB
 192 downtownSB       Downtown SB happenings — server-rendered scrape
  27 eventbrite       Eventbrite — SPA blocker; uses free API v3
 106 farmersMarkets   SB Certified Farmers' Markets — registry candidates (5 markets)
 165 goletaCivic      City of Goleta — Localist API → CivicPlus iCal → scrape
 185 granada          Granada Theatre — WP Tribe REST → iCal → scrape
  83 independent      SB Independent events — server-rendered scrape
 211 libraries        SB Public Library (Drupal 11 + LibCal) — scrape
 117 lobero           Lobero Theatre — listing → detail scrape (og:description → time)
  62 moxi             MOXI Museum — WP Tribe REST/iCal (no HTML fallback)
 114 musicacademy     Music Academy of the West — custom maw-api/v1 REST
 166 naturalHistory   SB Museum of Natural History — WP Tribe REST → iCal → scrape + Tier-3 spot
  58 natureProgramsFree  Free nature programs — registry candidates
 166 newVic           Ensemble Theatre @ New Vic — JSON-LD Event scrape
 130 nightlifeRhythms SB nightlife recurring rhythms — registry candidates (website-only, not IG)
 138 outdoorsOperators SB outdoor operators — registry candidates (Condor whale watches, Ice in Paradise)
 142 recurringRegistry Curated Tier-2 recurring registry (founder-maintained; honest "time TBD")
 116 sbbowl           Santa Barbara Bowl — listings → detail scrape
  31 sbcountyArts     SB County Arts Commission — Tockify SPA blocker; no API; STUB
 157 sbma             SB Museum of Art — WP Tribe REST → iCal → scrape + Tier-3 spot
 107 seatgeek         SeatGeek API — geo-scoped 15mi; lowest-priority gap-filler
  85 soho             SOhO Tickets — server-rendered listing (one request)
  82 submissions      Public /submit entries — same gate→dedupe→enrich→images→land pipeline
  97 ticketmaster     Ticketmaster Discovery API — free, structured, geo+date scoped
 135 ucsb             UCSB events (WordPress + Calendarize it! v4) — custom REST
```

### packages/ · scripts/ · supabase/ · fixtures/
```
 134  packages/shared/types.ts   Gate↔DB↔Cockpit contract (ThingType/Status/Tier/PriceBand/Tod/Neighborhood/HappeningCategory/Candidate)
  23  scripts/gen-icons.mjs      Rasterize public/icon.svg → PWA/Apple PNGs (192/512/maskable-512/apple-180)
  62  supabase/migrations/20260624_ingestion.sql     Phase 9: frequency enum, source_runs, ingest_drops
  29  supabase/migrations/20260625_images.sql        Phase 13: image_spend (monthly cap), image_cache
  14  supabase/migrations/20260625_photo_options.sql Phase 12: photo_options jsonb on things
   4  supabase/migrations/20260628_shared_plan.sql   Phase 8: add 'shared_plan' to shared_state_kind enum
  46  supabase/migrations/20260702_cockpit_v2.sql    Cockpit v2: restock_directives, hero_pins, thing_edits (additive)
       fixtures/seed_rows.json    121 KB regression oracle (107-row seed parsed → JSON) for the gate test
```

**public/** (7 non-source assets): `apple-icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `icon.svg`, `hero/sb-skyline.svg`, `sw.js` (service worker).

**Tests (19 vitest files):** ingest/{dedupe,enrich,gate,images,restock,tz}.test.ts; ingest/adapters/{citySites,http,independent,recurringRegistry,submissions}.test.ts; ingest/adapters/_shared/{geoFilter,inferYear,jsonLd,occasionTags,relativeDate}.test.ts; lib/{coverage,occurrences,review}.test.ts. Test coverage is concentrated in the ingest pipeline; the app/components UI layer has no unit tests.

---

## 2. Directory purposes (one line each)

- **app/** — Next.js App Router: routes, API handlers, PWA metadata (manifest/robots/sitemap/OG), and the CSS cascade files.
- **app/(app)/** — Public browse shell (Explore/Discover/Saved/Submit/Thing) under a shared BrandHeader + BottomNav layout.
- **app/plan/** — Plan-a-day surface with its own standalone chrome (intentionally NOT the (app) group header).
- **app/admin/** — Cockpit v2 (LIVE): four-tab founder console (Queue · Coverage · Live catalog · Hero plan) behind one auth gate.
- **app/cockpit/** — Phase-8 cockpit (LEGACY): only `/cockpit/login` still functions; `/cockpit` redirects to `/admin/review`.
- **app/api/review/** — Publishing endpoints (queue/approve/reject/update/image-fetch).
- **app/api/admin/** — Cockpit operations (catalog/coverage/hero/restock).
- **app/api/cron/** — reaper (live Vercel cron) + nightly (deprecated no-op).
- **app/{p,r,s}/[token]/** — Public tokenized share/restore views (shared plan / save-restore / shared list).
- **components/** — React UI: shell, explore, plan, saved, submit, signup, PWA, and the ui/ primitive library.
- **components/ui/** — Design-system primitives (Button, Card, Chip, BottomSheet, SaveHeart, SBIcon, …) exported via index.ts barrel.
- **lib/** — Server helpers, Supabase clients (4 variants), domain logic (things/explore/coverage/hero/review), and lib/plan engine.
- **ingest/** — Standalone nightly ingestion worker (fetch → gate → dedupe → enrich → images → land) run by GitHub Action.
- **ingest/adapters/** — 33 registered source feeds + shared helpers; `registry.ts` orders them for dedupe preference.
- **packages/shared/** — Single shared type contract spanning gate/DB/cockpit.
- **scripts/** — One-off tooling (icon generation).
- **supabase/migrations/** — Additive SQL migrations (Phase 9 → Cockpit v2).
- **fixtures/** — Regression oracle JSON (parsed 107-row seed) for the gate test.
- **public/** — Static PWA assets + service worker + hero skyline SVG.

---

## 3. Dead / orphaned / duplicated code (verified by grepping imports)

### Confirmed ORPHANS (import count = 0 outside their own file)
Grep swept every component/lib basename for import references excluding self:
| File | Lines | Status |
|---|---|---|
| `components/app/AppHeader.tsx` | 16 | ORPHAN — name appears only in comments in app/plan/layout.tsx & app/p/[token]/layout.tsx (both say they deliberately do NOT use it). Never imported. |
| `components/explore/OnePerfectDayCard.tsx` | 30 | ORPHAN — not imported anywhere. |
| `components/explore/LensSheet.tsx` | 51 | ORPHAN — superseded by TuneSheet. |
| `components/plan/DayShapeSelector.tsx` | 34 | ORPHAN — Plan simplification removed it. |
| `components/plan/MyPlansDrawer.tsx` | 81 | ORPHAN. |
| `components/plan/SaveNameSheet.tsx` | 72 | ORPHAN. |
| `components/plan/SwapSheet.tsx` | 138 | ORPHAN — swap feature removed. |
| `components/plan/PinPickerSheet.tsx` | 121 | ORPHAN. |
| `components/saved/SavedDays.tsx` | 78 | ORPHAN — **newly found** (not in the team's known list). SavedClient groups saves via `lib/savedGroups.groupSaved` instead. |
| `app/cockpit/ReviewCard.tsx` | 95 | ORPHAN — **newly found** legacy Phase-8 card; nothing imports it. |
| `app/cockpit/actions.ts` | 52 | ORPHAN-ADJACENT — **newly found**; only imported by the orphan `app/cockpit/ReviewCard.tsx`, so the pair is dead together (the redirect stub in `app/cockpit/page.tsx` never renders them). |

The team's pre-known list is all confirmed orphaned. **Three NOT previously flagged:** `components/saved/SavedDays.tsx`, `app/cockpit/ReviewCard.tsx`, and `app/cockpit/actions.ts` (dead as a pair). Total dead surface ≈ 768 lines across these 11 files.

### Deprecated but intentionally retained (not dead — behavior on purpose)
- **`app/api/cron/nightly/route.ts`** — explicit deprecation no-op; returns `{ok:false, deprecated:true}`. Kept so a stray call can't re-run the retired duplicate pipeline. NOT wired into vercel.json (only reaper is).
- **`app/cockpit/page.tsx`** — `force-dynamic` redirect to `/admin/review`. Live redirect; the directory around it is legacy.
- **`lib/pipeline.ts`** (138 lines) — the old in-app `runNightly` pipeline. The nightly path moved to the `ingest/` worker + `submissions` adapter (per the nightly route's own deprecation comment). Grep shows lib/pipeline is still referenced by `lib/submissions.ts`/submit flow, so it is not fully dead, but it is the superseded duplicate of the ingest worker's gate→enrich→land path. **FLAG: two parallel "submission → published" pipelines (lib/pipeline.ts vs ingest/adapters/submissions.ts).**

### CockpitV2 auth-path quirk (not a bug, worth noting)
`app/admin/layout.tsx` redirects unauthenticated users to `/cockpit/login` (the legacy path) — so the legacy cockpit dir survives only for its login form. This couples the LIVE admin console to a LEGACY directory.

---

## 4. Duplicated / overlapping code (FLAG)

**Two parallel HTML fetchers in ingest/adapters:**
- `_shared/fetchHtml.ts` → `fetchHtmlPolite()` — robots.txt aware, per-source rate limiting, cache; used by ~14 scrape adapters (lobero, arlington, sbbowl, granada, sbma, …).
- `adapters/http.ts` → `fetchHtml()` — managed-scrape (Scrapfly) switch; used by 3 adapters (independent, soho, citySites).
- Verified they do NOT share code: `http.ts` calls raw `fetch()` directly (does not wrap `fetchHtmlPolite`). So the polite/rate-limit/robots logic and the managed-scrape logic live in two separate implementations. Consolidating would unify robots-handling + managed-scrape under one fetcher.

**Two "ReviewCard" components:** `app/admin/review/ReviewCard.tsx` (LIVE, 258 lines) vs `app/cockpit/ReviewCard.tsx` (ORPHAN, 95 lines). Same concept, different eras.

**Two submission→publish pipelines:** `lib/pipeline.ts` (in-app, older) vs `ingest/adapters/submissions.ts` (worker, current) — see §3.

**Supabase client family (NOT duplication — 4 distinct roles, intentional):** `lib/supabase.ts` (public anon, null-safe), `lib/supabaseAdmin.ts` (service-role, RLS-bypass), `lib/supabaseBrowser.ts` (browser auth), `lib/supabaseServer.ts` (cookie auth session). Plus `ingest/db.ts` (worker service-role). Documented here so future readers don't collapse them.

---

## 5. package.json dependencies (with usage verification)

**dependencies**
| Package | Version | Verified usage |
|---|---|---|
| next | 16.2.9 | Framework. |
| react / react-dom | 19.2.4 | UI. |
| @anthropic-ai/sdk | ^0.105.0 | USED — `lib/enrich.ts` + `ingest/enrich.ts` (Claude blurb/tag generation). |
| @supabase/ssr | ^0.12.0 | USED — proxy.ts + lib/supabaseBrowser/Server (cookie/browser auth). |
| @supabase/supabase-js | ^2.108.2 | USED — all supabase clients + ingest/db. |
| cheerio | ^1.2.0 | USED — 14 scrape adapters (HTML parsing). |
| uuid | ^11.1.0 | USED but NARROW — the only real import is `import { v5 as uuidv5 }` in `ingest/gate.ts` (+ its test). Other "uuid" grep hits are variable/type names, not the package. Deterministic candidate IDs. |

**devDependencies:** @tailwindcss/postcss ^4, tailwindcss ^4, @types/{node ^20, react ^19, react-dom ^19, uuid ^10.0.0}, eslint ^9, eslint-config-next 16.2.9, tsx ^4.20.0, typescript ^5, vitest ^3.2.0.

**Notes / suspicious:**
- **uuid is barely used** (one v5 call). Not unused, but its footprint is a single line — worth knowing.
- **No `sharp`** despite `scripts/gen-icons.mjs` rasterizing PNGs — confirm the script's rasterizer at run time (it may rely on a system/optional dep). Icons already exist in public/, so the script is likely run-once tooling.
- `@types/uuid ^10` while runtime `uuid ^11` — major-version skew on the types package (cosmetic; uuid v11 ships its own types anyway).

**scripts:** `dev` (next dev), `build`, `start`, `lint` (eslint), `build:fixtures` (tsx ingest/buildFixtures.ts), `test` (vitest run), `ingest` (tsx ingest/run.ts), `ingest:dry` (DRY_RUN=1), `enrich:backfill` (ENRICH_BACKFILL=1). Note: **no `typecheck` script** and **`lint` has no target/args** (`eslint` alone).

---

## 6. Config files

### next.config.ts (verbatim, 34 lines)
```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    const rules = [{ source: "/:path*", headers: securityHeaders }];
    // Dev only: Turbopack chunk URLs are stable and the dev server returns a
    // stale ETag, so browsers revalidate, get 304s, and keep old CSS/JS. Tell
    // the browser never to store dev static assets so it always refetches.
    if (process.env.NODE_ENV !== "production") {
      rules.push({
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      });
    }
    return rules;
  },
};

export default nextConfig;
```

### vercel.json (verbatim)
```json
{
  "crons": [
    { "path": "/api/cron/reaper", "schedule": "0 8 * * 1" }
  ]
}
```
Only the reaper cron (Mon 08:00 UTC weekly). The nightly ingest is NOT here — it runs from `.github/workflows/ingest.yml` (cron `0 9 * * *` = 02:00 PT; `npx tsx ingest/run.ts`; plus workflow_dispatch inputs enrich_backfill/image_backfill).

### postcss.config.mjs (verbatim) — Tailwind v4, no tailwind.config file
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```
**There is NO `tailwind.config.{js,ts}`.** Tailwind v4 config is CSS-first: theme lives in `app/globals.css` via `@import "tailwindcss"` + `@theme inline { … }` (semantic color mirrors), with fonts wired through `:root` CSS vars. Tokens come from `app/sbdaymaker_tokens.css` (imported in `app/layout.tsx`, ahead of components.css — cascade: tokens → globals → components).

### app/globals.css (verbatim, 36 lines)
```css
@import "tailwindcss";

/* NOTE: the design tokens (sbdaymaker_tokens.css) and the component layer
   (components.css) are imported as CSS modules in app/layout.tsx, in order,
   so the cascade is: tokens → these overrides → components. (Chaining them via
   CSS @import here breaks Tailwind v4's dev pipeline under Turbopack.) */

:root {
  --font-display: var(--font-fraunces), Georgia, serif;
  --font-body: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), "JetBrains Mono", monospace;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-text-link: var(--text-link);
  --color-border: var(--border);
  --color-accent: var(--accent);
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-body);
  -webkit-font-smoothing: antialiased;
}
```

### proxy.ts (verbatim, ~45 lines) — the middleware
This repo's middleware is `proxy.ts` at the repo root (exports `proxy` + `config` with `matcher: ["/cockpit/:path*"]`). **There is no `middleware.ts`.** It gates `/cockpit/*` behind a Supabase auth session and refreshes it.
```ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Guard /cockpit/* behind a Supabase auth session (also refreshes the session).
export async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  if (path.startsWith("/cockpit") && path !== "/cockpit/login" && !user) {
    return NextResponse.redirect(new URL("/cockpit/login", req.url));
  }
  if (path === "/cockpit/login" && user) {
    return NextResponse.redirect(new URL("/cockpit", req.url));
  }

  return res;
}

export const config = { matcher: ["/cockpit/:path*"] };
```
**FLAG (conflict, code is truth):** The middleware matcher only covers `/cockpit/:path*`, but the LIVE admin console is now under `/admin/*`. `/admin` is protected instead by `app/admin/layout.tsx` (server auth gate), not by middleware. So `/admin` and `/cockpit` are guarded by two different mechanisms. `/api/admin/*` and `/api/review/*` are not middleware-matched (each route enforces its own admin check).

**Referenced env vars (names only):** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, CRON_SECRET, NEXT_PUBLIC_SITE_URL, OPENWEATHER_API_KEY (added in recent commit 47c5784), plus ingest-side keys (Pexels/Google Places/Ticketmaster/SeatGeek/Eventbrite/Scrapfly — set as GitHub Action secrets). `MANAGED_SCRAPE`, `CHECK_CLOSURES`, `DRY_RUN`, `ENRICH_BACKFILL` are behavior flags.

---

## 7. docs/ spec directories — current vs stale (~15 dirs)

All docs are **build-spec runbooks / mockups**, mostly HISTORICAL: they describe features that have since been built (so they read as "the spec that produced this code"), not living reference. Judged by git-log recency + whether the described feature exists in current code.

| Dir (git last-touch) | Verdict | Note |
|---|---|---|
| `docs/first-run-tutorial/` (uncommitted, dated 2026-07-03) | **CURRENT** | `00_current_frontend_surface_spec.md` is a code-accurate survey against this exact commit (`caa7302`); the actual first-run overlay is NOT yet built. Freshest doc in repo. |
| `docs/platform-snapshot/` (uncommitted) | **CURRENT** | This snapshot set (you are here). `06_crown_jewels/` subdir is empty scaffolding. |
| `docs/cockpit-v2/` (2026-07-02) | **CURRENT** | Recon + deltas + C5 hardening for Cockpit v2, which shipped in commit caa7302 (the latest). Matches app/admin. |
| `docs/hero-visual-update/` (2026-07-02) | **CURRENT** | `hero-one-front-page-spec.md` matches the live skyline Hero (components/explore/Hero.tsx + public/hero/sb-skyline.svg). |
| `docs/explore-card-UX-simplify/` (2026-07-01) | CURRENT-ish | Phase 7 explore simplification; reflected in current CascadeFeed/ControlRow. |
| `docs/explore-card-UX-improvements/` (2026-07-01) | CURRENT-ish | Phase 6 explore build; superseded in part by the later simplify + hero rebuild. |
| `docs/data-source-expansion/` (2026-06-30) | **CURRENT** | Doc 15/16/17 drove the 33 registered adapters — matches ingest/adapters wave 1/2. |
| `docs/brand-header-build/` (2026-06-30) | **CURRENT** | "Golden Hour" header spec → components/BrandHeader.tsx (live). |
| `docs/explore-redesign-build/` (2026-06-30) | HISTORICAL | Earlier explore redesign, largely superseded by later explore docs + hero rebuild. |
| `docs/explore-time-horizons/` (2026-06-30) | CURRENT-ish | Horizon/lead-breakout → ControlRow + LeadDayRail (live). |
| `docs/plan-simplification/` (2026-06-30) | **CURRENT (explains orphans)** | This simplification pass is why the plan/ orphans (SwapSheet, PinPickerSheet, DayShapeSelector, …) are dead. |
| `docs/revert back to simple plan/` (2026-06-30) | **CURRENT (winning direction)** | The "revert to simple plan" spine/ToD build is what's live (PlanSetup/ItinerarySpine). Directory name has a space — awkward but intentional. |
| `docs/saved-page-enhancements/` (2026-06-30) | CURRENT-ish | Saved elevation/update → SavedClient/MemoryRecap (live). Contains screenshots. |
| `docs/plan-feature/` (2026-06-27) | **STALE** | Original full plan feature ("fresh setup", swap, pin-picker). Superseded by plan-simplification + revert-to-simple; describes the now-orphaned components. |
| `docs/wave-next/` (2026-06-30) | MIXED | "Wave Next" build spec + duplicated files (`… 2.md`, `… 2.html`) — the ` 2` copies look like accidental duplicates. |

**Top-level spec files:**
- `README.md` — **STALE / boilerplate.** Verbatim create-next-app template (talks about Geist font, `app/page.tsx`, yarn/pnpm/bun) — does NOT describe SB Daymaker. Notable: the project README was never written.
- `LAUNCH_CHECKLIST.md` — CURRENT. Pre-launch checklist (content publish, env vars, Vercel Pro cron, PWA, a11y/Lighthouse, domain). Lists required env vars by name.
- `phase7.sql` — Phase 7 detail-note column + submissions/subscribers RPC. Historical migration (run-once).
- `phase8_seed.sql` — **DEV DEMO, "delete before launch."** A few DRAFT things to feed the pipeline demo.
- `seed_fixtures.sql` — **DEV FIXTURES, "delete before launch."** ~25 throwaway "(fixture)" rows.
- `shared_states_rpc.sql` — Phase 5 shared_states RPC API (SECURITY DEFINER; the only public door to the table).
- **`Core Project Files/`** — the v9 CANON set (authoritative per CLAUDE.md): `CLAUDE.md` (v9 canon), `START_HERE.md`, `08_SBDaymaker_Build_Plan.md`, `sbdaymaker_schema.sql` (data contract), `sbdaymaker_tokens.css` (design source of truth), `sbdaymaker_seed_all-2.sql`, Docs 00–17 (business/product/architecture/ingestion). `14_SBDaymaker_Build_Deltas.md` is the canon-amendment ledger (newest-first) that reconciles code drift with canon — the place where code-vs-canon conflicts are supposed to be recorded.

---

## 8. Notable code-vs-spec conflicts (code is truth)

1. **Cron topology vs "nightly cron" mental model:** nightly ingest is a GitHub Action (`ingest/run.ts`), NOT a Vercel cron; `app/api/cron/nightly` is a deprecated no-op. Only reaper is a Vercel cron.
2. **Two submission pipelines:** `lib/pipeline.ts` (in-app, older) coexists with `ingest/adapters/submissions.ts` (worker, current). The nightly route comment says the in-app pipeline was retired, but lib/pipeline.ts still has a live reference path via lib/submissions — a partial migration.
3. **Middleware scope vs live console:** `proxy.ts` matcher guards `/cockpit/*` only; the live console is `/admin/*` (guarded separately in its layout). Legacy `/cockpit/login` is where BOTH the middleware and the admin layout send unauthenticated users, coupling the live console to a legacy dir.
4. **README is create-next-app boilerplate** — never customized.
5. **Two HTML fetchers** (`_shared/fetchHtml.ts` vs `adapters/http.ts`) with non-shared implementations (§4).
6. **`app/globals.css` header comment says tokens/components are imported "as CSS modules in app/layout.tsx"** — accurate: Tailwind v4 config is CSS-first with no tailwind.config file.
```
