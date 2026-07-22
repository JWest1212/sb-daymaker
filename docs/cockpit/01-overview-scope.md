# Section 1 - Overview, Scope, and Route Census

## 1.1 What the Cockpit is

The Cockpit is the authenticated admin console of SB Daymaker, a Santa Barbara "what to do today" content product. It is operated by a single founder-operator; there are no end-user accounts anywhere in the product, so every authentication mechanism described in this spec is admin-only. The Cockpit's job is content operations: reviewing and publishing items ("things") that an automated ingestion pipeline queues up, fixing the live catalog, planning the front-page hero, curating the weekly email edition, managing venues and their photos, watching source health and neighborhood coverage, and triaging user-submitted flags. The live console lives under /admin/*; a legacy prefix /cockpit/* survives as the login page plus a redirect.

## 1.2 Scope definition (final path list)

The Cockpit is not a single route prefix. After verifying imports across the codebase, the in-scope surface is:

UI routes and their components:

- app/admin/** - the live console: 11 pages, 26 view/support components, 1 layout, 1 stylesheet (app/admin/review/cockpit.css)
- app/cockpit/** - legacy prefix: the login page (app/cockpit/login/page.tsx + LoginForm.tsx), a redirect stub (app/cockpit/page.tsx redirects to /admin/review), legacy server actions (app/cockpit/actions.ts, still importable and functional), and one orphaned component (app/cockpit/ReviewCard.tsx, imported by nothing)

API routes:

- app/api/admin/** - 55 route.ts files
- app/api/review/** - 5 route.ts files (the review queue's own API, kept under a separate prefix for historical reasons; guarded the same way)

Cockpit-adjacent background jobs (documented in 07-api-backend.md, not part of the interactive console):

- app/api/cron/nightly/route.ts, app/api/cron/heartbeat/route.ts, app/api/cron/reaper/route.ts, app/api/cron/send-edition/route.ts

Shared lib files imported by the scoped code (sharedness flagged per file in the coverage checklist in index.md and per component in 03-components.md):

- Cockpit-centric server libs: lib/reviewServer.ts, lib/review.ts, lib/sourcesServer.ts, lib/venuesServer.ts, lib/imagesServer.ts, lib/flagsServer.ts, lib/coverageServer.ts, lib/catalogServer.ts, lib/neighborhoodSweepServer.ts, lib/recurringRhythmsServer.ts, lib/edition/cockpitServer.ts, lib/edition/cockpitTypes.ts
- Supabase client factories: lib/supabaseAdmin.ts, lib/supabaseServer.ts, lib/supabaseBrowser.ts
- Shared with the public app or the ingest worker: lib/heroServer.ts, lib/coverage.ts, lib/neighborhoodSweep.ts, lib/recurringRhythms.ts, lib/explore.ts, lib/venuePool.ts, lib/venueFetch.ts, lib/visualAssignment.ts, lib/occasions.ts, lib/zones.ts, lib/doorZones.ts, lib/geo.ts, lib/slug/ensureSlug.ts, lib/pipeline.ts, lib/useFocusTrap.ts, lib/edition/{types,draft,imageHost,imageDiscovery,send,render,renderData,window}.ts, ingest/images.ts, ingest/marqueeVenues.ts, ingest/dedupe.ts, ingest/confidence.ts, packages/shared/types.ts, components/ui/* (via the barrel components/ui/index.ts), components/explore/derive.ts

There is NO middleware.ts anywhere in the repo (verified by find at generation time). Page-level auth is enforced by app/admin/layout.tsx; API-level auth is enforced per-route. See 08-auth-permissions.md.

Legacy and orphaned code is in scope and labeled as such throughout: app/cockpit/ReviewCard.tsx (orphaned; imports a `Tag` component and `prettify` from the public app but is imported by nothing), app/cockpit/actions.ts (legacy server actions used only by the orphaned ReviewCard, except signOut which is not referenced by any live file either - see 05-routes-verification.md), and app/admin/TabStub.tsx (a placeholder view component - live usage checked in 05-routes-verification.md).

## 1.3 Route census (ground truth; re-verified in 05-routes-verification.md)

Pages (12 page.tsx files under scoped paths):

| # | File | URL | Screen ID |
|---|---|---|---|
| 1 | app/admin/review/page.tsx | /admin/review | SCR-01 |
| 2 | app/admin/coverage/page.tsx | /admin/coverage | SCR-02 |
| 3 | app/admin/coverage/sources/page.tsx | /admin/coverage/sources | SCR-03 |
| 4 | app/admin/coverage/neighborhood-sweep/page.tsx | /admin/coverage/neighborhood-sweep | SCR-04 |
| 5 | app/admin/coverage/recurring-rhythms/page.tsx | /admin/coverage/recurring-rhythms | SCR-05 |
| 6 | app/admin/catalog/page.tsx | /admin/catalog | SCR-06 |
| 7 | app/admin/heroes/page.tsx | /admin/heroes | SCR-07 |
| 8 | app/admin/edition-draft/page.tsx | /admin/edition-draft | SCR-08 |
| 9 | app/admin/venues/page.tsx | /admin/venues | SCR-09 |
| 10 | app/admin/images/page.tsx | /admin/images | SCR-10 |
| 11 | app/admin/flags/page.tsx | /admin/flags | SCR-11 |
| 12 | app/cockpit/login/page.tsx | /cockpit/login | SCR-12 |
| 13 | app/cockpit/page.tsx | /cockpit (redirect only) | SCR-13 |

API routes (60 route.ts files): the full list with methods and API-NN ids is in 07-api-backend.md; the id assignment (path-sorted) is:

| ID | Route |
|---|---|
| API-01 | /api/admin/catalog/bulk |
| API-02 | /api/admin/catalog/delete |
| API-03 | /api/admin/catalog/edit |
| API-04 | /api/admin/catalog/find-more-images |
| API-05 | /api/admin/catalog/photo |
| API-06 | /api/admin/catalog/redraft |
| API-07 | /api/admin/catalog |
| API-08 | /api/admin/catalog/venue-photos/fetch |
| API-09 | /api/admin/coverage/cell |
| API-10 | /api/admin/coverage/neighborhood-sweep/apply |
| API-11 | /api/admin/coverage/neighborhood-sweep/dictionary |
| API-12 | /api/admin/coverage/neighborhood-sweep |
| API-13 | /api/admin/coverage/neighborhood-sweep/triage |
| API-14 | /api/admin/coverage/recurring-rhythms/[id] |
| API-15 | /api/admin/coverage/recurring-rhythms |
| API-16 | /api/admin/coverage |
| API-17 | /api/admin/coverage/sources/[key] |
| API-18 | /api/admin/coverage/sources |
| API-19 | /api/admin/dedupe/unmerge |
| API-20 | /api/admin/editions/[id]/picks/[pickId]/blurb-edit |
| API-21 | /api/admin/editions/[id]/picks/[pickId]/find-more-images |
| API-22 | /api/admin/editions/[id]/picks/[pickId]/image |
| API-23 | /api/admin/editions/[id]/picks/[pickId] |
| API-24 | /api/admin/editions/[id]/preview |
| API-25 | /api/admin/editions/[id] |
| API-26 | /api/admin/editions/[id]/search-things |
| API-27 | /api/admin/editions/[id]/swap |
| API-28 | /api/admin/editions/archive |
| API-29 | /api/admin/editions |
| API-30 | /api/admin/flags/[id] |
| API-31 | /api/admin/hero-eligible |
| API-32 | /api/admin/hero-pins |
| API-33 | /api/admin/image-budget |
| API-34 | /api/admin/images/ack |
| API-35 | /api/admin/images/auto-assign |
| API-36 | /api/admin/images/auto-google |
| API-37 | /api/admin/images/locate |
| API-38 | /api/admin/images/pool-build |
| API-39 | /api/admin/images/prefetch |
| API-40 | /api/admin/images |
| API-41 | /api/admin/restock/list |
| API-42 | /api/admin/restock |
| API-43 | /api/admin/venues/[id]/things |
| API-44 | /api/admin/venues/ack |
| API-45 | /api/admin/venues/create |
| API-46 | /api/admin/venues/detach |
| API-47 | /api/admin/venues/edit |
| API-48 | /api/admin/venues/lookup-place-ids |
| API-49 | /api/admin/venues/match |
| API-50 | /api/admin/venues/photos/approve |
| API-51 | /api/admin/venues/photos/fetch |
| API-52 | /api/admin/venues/photos/remove |
| API-53 | /api/admin/venues/photos/reorder |
| API-54 | /api/admin/venues |
| API-55 | /api/admin/weight |
| API-56 | /api/review/approve |
| API-57 | /api/review/image-fetch |
| API-58 | /api/review/queue |
| API-59 | /api/review/reject |
| API-60 | /api/review/update |

## 1.4 Redirects and navigation topology

- /cockpit redirects unconditionally to /admin/review (app/cockpit/page.tsx: `redirect("/admin/review")`, with `export const dynamic = "force-dynamic"` and a comment explaining the Phase-8 cockpit is superseded by the Phase-12 review cockpit).
- Every /admin/* page is wrapped by app/admin/layout.tsx, which redirects unauthenticated visitors to /cockpit/login (`if (!user) redirect("/cockpit/login")`, app/admin/layout.tsx line 13).
- After successful login, LoginForm pushes to /admin/review (app/cockpit/login/LoginForm.tsx line 26: `router.push("/admin/review")`).
- So the real topology is: /cockpit/login is the only unauthenticated Cockpit page; /cockpit is a bounce; everything else lives under /admin/* behind the layout gate. There is no logout button in the live console ([INFERRED] from the absence of any signOut call site in app/admin/**; the legacy signOut server action exists in app/cockpit/actions.ts but nothing renders a control that calls it - see 14-ux-pain-points.md).

# Section 2 - Runtime, Dependency, and Configuration Surface

## 2.1 Tech stack (exact versions from package.json / package-lock.json)

| Layer | Technology | Version (locked) |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.9 |
| UI runtime | React / React DOM | 19.2.4 |
| Styling | Tailwind CSS, v4 CSS-first mode | 4.3.1 (via @tailwindcss/postcss) |
| Database | Supabase (hosted Postgres) | @supabase/supabase-js 2.108.2 |
| Auth | Supabase Auth (email+password), cookie sessions via @supabase/ssr | @supabase/ssr 0.12.0 |
| Hosting | Vercel ([INFERRED] from Vercel Cron comments in app/api/cron/* and @vercel/analytics dependency) | n/a |
| LLM | Anthropic SDK (one endpoint: edition blurb rewrite) | @anthropic-ai/sdk 0.105.0 |

Version-specific facts a downstream AI would otherwise guess wrong:

- Tailwind is v4 in CSS-first mode. There is NO tailwind.config.js/ts anywhere in the repo. Tokens live in CSS custom properties (app/sbdaymaker_tokens.css plus Core Project Files/sbdaymaker_tokens.css); do not propose changes to a Tailwind config file, it does not exist. In practice the Cockpit does not use Tailwind utility classes at all: it is styled by hand-written BEM-style classes in app/admin/review/cockpit.css (see 02-design-system.md).
- Next.js 16: params and searchParams are async (Promises) in pages and route handlers; the codebase consistently awaits them. Route handlers use the app-router `route.ts` convention. `export const dynamic = "force-dynamic"` appears on the admin layout and several pages.
- React 19: no forwardRef patterns needed; the code uses plain function components and hooks only.
- This is NOT a stock Next.js: the repo's AGENTS.md warns that this Next version has breaking changes vs. training data and points to node_modules/next/dist/docs/ for the real conventions.

## 2.2 Dependency inventory (runtime deps the scoped code actually imports)

| Package | Version | Used by Cockpit code for |
|---|---|---|
| next | 16.2.9 | routing, redirect(), revalidatePath(), NextResponse, next/link, next/navigation, next/cache |
| react / react-dom | 19.2.4 | all client components (useState/useEffect/useMemo/useRef/useCallback) |
| @supabase/supabase-js | 2.108.2 | createClient for the service-role client (lib/supabaseAdmin.ts); SupabaseClient type in lib/venueFetch.ts, lib/edition/*.ts, ingest/images.ts |
| @supabase/ssr | 0.12.0 | createServerClient (lib/supabaseServer.ts, cookie-bound auth session) and createBrowserClient (lib/supabaseBrowser.ts, login form) |
| @anthropic-ai/sdk | 0.105.0 | app/api/admin/editions/[id]/picks/[pickId]/blurb-edit/route.ts (AI rewrite of an edition pick's blurb) |

Not used by any scoped file (public-app or worker only): @vercel/analytics, cheerio, svix, uuid. Notably, lib/analytics.ts (the public event tracker) is NOT imported by any Cockpit file; the Cockpit fires no analytics (per-screen confirmation in 04-screens.md).

## 2.3 Environment/config surface (names only, never values)

Vars referenced by in-scope code, what they control, and what breaks without them:

| Var | Referenced in | Controls | Without it |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | lib/supabaseAdmin.ts, lib/supabaseServer.ts, lib/supabaseBrowser.ts | Supabase project URL for all three client factories | getAdminSupabase() returns null (every API route then returns its "supabase not configured"-style 500); auth clients throw (non-null asserted) |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | lib/supabaseServer.ts, lib/supabaseBrowser.ts | anon key for the cookie auth session + login form | login and getAdminUser() fail; the whole Cockpit is unreachable |
| SUPABASE_SECRET_KEY | lib/supabaseAdmin.ts | service-role key; ALL Cockpit data reads/writes go through this client (bypasses RLS) | every data operation fails; pages render empty, mutations 500 |
| NEXT_PUBLIC_SITE_URL | app/api/admin/editions/[id]/preview/route.ts line 23, lib/edition/send.ts line 52 | absolute links in edition preview/send (falls back to https://www.sbdaymaker.com) | wrong/staging links in the email edition |
| ANTHROPIC_API_KEY | app/api/admin/editions/[id]/picks/[pickId]/blurb-edit/route.ts line 76 | the AI blurb-rewrite button on the edition draft screen | that endpoint returns an error; rest of Cockpit unaffected |
| GITHUB_DISPATCH_TOKEN | app/api/admin/restock/route.ts line 15 | dispatching the ingest GitHub Action ("restock" run-now) | route returns `GITHUB_DISPATCH_TOKEN is not configured on the server` |
| GITHUB_REPO / GITHUB_WORKFLOW_FILE / GITHUB_WORKFLOW_REF | app/api/admin/restock/route.ts lines 17-19 | which repo/workflow/branch the restock dispatch targets (defaults: JWest1212/sb-daymaker, ingest.yml, main) | defaults used |
| GOOGLE_PLACES_KEY | ingest/images.ts line 53 (used by image endpoints the Cockpit calls) | Google Places photo lookups in the image waterfall | Google steps of the waterfall are skipped/fail |
| IMAGE_MONTHLY_CALL_CAP | ingest/images.ts line 52 | monthly cap on paid image API calls (default 1200) | default cap applies |
| CRON_SECRET | app/api/cron/heartbeat, reaper, send-edition route.ts | Bearer auth for Vercel Cron endpoints (cockpit-adjacent) | crons reject/accept incorrectly depending on Vercel config |
| DIGEST_TO | app/api/cron/heartbeat/route.ts | recipient of the "nightly ingest did not run" dead-man's-switch alert | the heartbeat detects a missed run but silently alerts no one |
| RESEND_API_KEY / RESEND_FROM | lib/email.ts lines 14-16, 48-50 (called by edition send path) | Resend email dispatch for the weekly edition | send silently returns false (no throw), see 10-observability.md |

Behavior flags such as DRY_RUN, ENRICH_BACKFILL, CONFIDENCE_*, DEDUPE_*, EVENT_KEY_*, EVENT_SOURCES_BACKFILL exist as npm scripts (package.json scripts block) but are consumed by the ingest worker (ingest/run.ts), which runs in GitHub Actions, not inside the app. They change what the pipeline writes into the tables the Cockpit reads, but no in-app scoped code reads them.

## 2.4 Internationalization

None. There is no i18n machinery anywhere in the Cockpit (no locale files, no i18n library in package.json, no locale route segments). All copy is hardcoded English strings in the components.
