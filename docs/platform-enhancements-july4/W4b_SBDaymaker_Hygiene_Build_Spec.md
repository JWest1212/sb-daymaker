# W4b Build Spec — Hygiene: Make the Codebase Smaller Than the Product

`Doc W4b · for Claude Code · schedule anytime after Wave 1 (ideally after W4a) · written against commit caa7302 + Docs 18/19`

---

## What this is

One deletion-heavy pass that retires ~770 lines of confirmed dead code, ends the two-pipelines and two-fetchers duplication, fixes the localStorage plan-store collision, hardens the auth topology, and clears the small professional debts. Nothing user-visible should change — **"no behavior change" is the acceptance bar for most phases, and you will prove it, not assert it.**

## §0 · Ground rules

1. Read `CLAUDE.md` (v10); reconcile everything below against the live repo — earlier waves have landed since `caa7302`, and some orphans may have gained importers. **Re-verify every "orphan" claim by grepping imports yourself before deleting.** Anything with a live importer is not deleted; it's flagged.
2. Phases in order; stop-and-show after each; commit per phase so any regression bisects cleanly.
3. After every deletion phase: `npm run test`, `npx next build`, dev click-through of Explore / Saved / Plan / Discover / a thing page / cockpit login+queue, console clean.
4. **Out of scope:** any feature work; any ranking/feed change; rate limiting; the been-snapshot design (Doc W5).

---

## PHASE W4b.1 — Delete the confirmed dead code

Verified orphans at snapshot (re-verify each): `components/app/AppHeader.tsx` · `components/explore/OnePerfectDayCard.tsx` · `components/explore/LensSheet.tsx` · `components/plan/DayShapeSelector.tsx` · `components/plan/MyPlansDrawer.tsx` · `components/plan/SaveNameSheet.tsx` · `components/plan/SwapSheet.tsx` · `components/plan/PinPickerSheet.tsx` · `components/saved/SavedDays.tsx` · `components/saved/MemoryRecap 2.tsx` (the filename-with-space copy artifact) · plus the dead-as-a-pair `app/cockpit/ReviewCard.tsx` + `app/cockpit/actions.ts`.

Also sweep: any CSS blocks in `app/components.css` that styled only deleted components (grep each deleted component's class prefixes; remove clearly-dedicated blocks, leave anything shared); the `sbd.open-plan` sessionStorage handoff (its only writer is the deleted `SavedDays` — remove the reader too if one exists).

**Note before deleting the cockpit pair:** `app/cockpit/actions.ts` is the only importer of `lib/pipeline.ts`'s `runNightly` from the app — its deletion is what makes Phase 2 possible. `app/cockpit/page.tsx` (the redirect) and `app/cockpit/login/*` stay for now (Phase 4 relocates login).

**Acceptance:** grep proof of zero importers per deleted file (shown in the stop-and-show); build/tests/click-through clean; line-count delta reported.

## PHASE W4b.2 — Retire the legacy pipeline (ends the C3 nuance)

**Goal:** exactly one enrich implementation (`ingest/enrich.ts`) and one submission path (the worker's `submissions` adapter), with the Anthropic SDK unreachable from the app's module graph.

1. Trace every remaining importer of `lib/pipeline.ts` and `lib/enrich.ts`. At snapshot, `lib/submissions.ts` (the public submit landing) had a reference into the pipeline path — investigate what it actually uses. The public submit flow per the routes doc is `SubmitForm → submitThing() → RPC submit_thing` (no pipeline involvement at request time); if `lib/submissions.ts` imports pipeline pieces for types or helpers, relocate those pieces (types → `packages/shared/types.ts`; helpers → wherever the worker's `submissions` adapter keeps its equivalents, deduplicating rather than copying).
2. Delete `lib/pipeline.ts` and `lib/enrich.ts`. Confirm `app/api/cron/nightly/route.ts` (the deprecated no-op) imports neither — it shouldn't; it stays as the tombstone.
3. **Proof of the constraint win:** show that `@anthropic-ai/sdk` no longer appears in any module reachable from `app/` (grep imports transitively; the SDK now lives only under `ingest/`). Add one line to CLAUDE.md's known-open block (removing this item) per the WC ledger pattern.
4. Verify the public submit flow end-to-end in dev (form → `submissions` row) and that a dry ingest run still processes the submissions adapter.

**Acceptance:** SDK reachable only from `ingest/`; submit flow works; tests/build clean; Doc 14 entry "legacy pipeline retired — single enrich implementation."

## PHASE W4b.3 — Fix the `sbd.itineraries.v1` collision

**The defect:** two incompatible shapes share one localStorage key under the same `useItineraries` hook name — `components/plan/ItinerariesProvider.tsx` (`{id,title,dateISO,blocks,stops,createdAt,updatedAt}`, mounted in the root layout) vs `lib/plan/itineraries.ts` (`{id,title,answers,stops,savedAt}`). After W4b.1, the only surviving consumer of the losing store is `app/p/[token]/SharedPlanView.tsx` — a live route.

1. **The Provider wins** (it's mounted). Read `SharedPlanView`'s actual use of `useItineraries` (likely a "save this shared plan to my device" action) and port it to the Provider's API, mapping the shared-plan payload into the Provider's `Itinerary` shape. If the payload lacks a Provider-required field, derive it sensibly (`createdAt = now`) — never widen the Provider's shape to accommodate the dead one.
2. Delete `lib/plan/itineraries.ts`. Grep for any other `useItineraries` import.
3. **Data-compat decision (decided here):** existing on-device data under the key may be in either shape. Add a small tolerant read in the Provider's hydration: entries missing Provider-required fields are migrated if trivially mappable (`savedAt→createdAt`, `answers` dropped) or skipped with a console.warn — never crash, never wipe the key wholesale. Unit-test the migration function (pure).
4. Verify: create a plan, save it, share it, open `/p/[token]`, save the shared plan to device, reload — all intact.

**Acceptance:** one store, one hook, one shape; migration tests green; end-to-end plan flow verified at ~390px.

## PHASE W4b.4 — Auth topology: widen the middleware, relocate login

1. `proxy.ts` matcher → `["/cockpit/:path*", "/admin/:path*", "/api/admin/:path*", "/api/review/:path*"]`. Behavior split: **page** paths redirect unauthenticated users to login (current behavior); **API** paths (`/api/…`) return `401 {ok:false,error:"unauthorized"}` JSON — never a redirect (clients expect JSON). Keep every existing per-route `getAdminUser()` check — the middleware is belt-and-braces, not a replacement (and edge middleware auth alone is not sufficient defense). One exception check: confirm no `/api/admin|review` route is legitimately called by the public (none should be); if one is found, stop and flag.
2. Relocate login: move the page + form to `/admin/login`; `app/admin/layout.tsx` must **exclude** the login route from its own auth gate (or login lives outside the gated layout segment — pick the cleaner Next idiom and say which); redirects updated (`admin/layout`, middleware, post-login push). Keep `/cockpit/login` and `/cockpit` as permanent redirects to the new paths (bookmarks). Delete nothing under `app/cockpit/` except what the redirects no longer need.
3. Verify: logged-out hits to `/admin/review` → login page; logged-out `POST /api/admin/weight` (or any admin API) → 401 JSON; login → lands on `/admin/review`; old `/cockpit/login` bookmark still works.

**Acceptance:** the matrix above demonstrated; no auth regression for the logged-in founder path; `next build` middleware output sane.

## PHASE W4b.5 — Tokens, README, and the small debts

1. **The been-green:** `app/components.css:~211` hardcodes `#2F6248`. First check `sbdaymaker_tokens.css` for an existing AA-safe dark-forest text variant; if one exists at ≥4.5:1 on paper/plaster, use it. If not: **stop-and-ask** — adding `--forest-dark: #2F6248` formalizes an already-shipping hex but technically amends the locked v9 token set, which is Jim's call (recommend approval; it's codifying reality with a tracked ratio, not inventing a color).
2. **The Georgia stacks** (`components.css:~707, 825, 1975`): add `--font-serif` to the tokens file mapping to the existing `Georgia, serif` stack (no visual change — pure tokenization) and reference it at all three sites. If Jim would rather these become Fraunces, that's a separate visual decision — default is no visual change.
3. **README:** replace the create-next-app boilerplate with a real one: what SB Daymaker is (two sentences), the four sections, the stack table, how to run (`dev`/`test`/`build`), where the canon lives (`Core Project Files/`), the cron topology, and the standing rules pointer to CLAUDE.md. Half a page, founder-readable.
4. **Scripts:** add `"typecheck": "tsc --noEmit"`; make `"lint": "eslint ."` (currently target-less). Run both; fix nothing beyond what they newly surface trivially (report anything non-trivial instead).
5. **`@types/uuid`:** remove it (uuid v11 ships its own types) or align the major — whichever `npm run typecheck` proves clean.
6. **The two SPA stubs:** implement `eventbrite` properly via the free API v3 (its own comment names the path): fetch events geo-scoped to SB using `EVENTBRITE_TOKEN`; when the token is unset, the adapter **throws a clear "not configured" error** so `source_runs` records `ok=false` and the W4a.3 health surfaces show it honestly (silent `[]` is exactly the pathology W4a fixed — don't reintroduce it). ▶ **JIM DOES THIS:** create a free Eventbrite API token and add it as GH secret `EVENTBRITE_TOKEN` (Claude Code puts the exact click-path in the stop-and-show). Remove `allevents` from the registry entirely (no API exists; Scrapfly stays off per standing directive) and delete its adapter file.

**Acceptance:** token changes shown with contrast ratios; README rendered; `typecheck`+`lint` green; eventbrite live-or-honestly-failing demonstrated in a dry run; `allevents` gone from registry and health.

---

## Wave close-out

Doc 14 entries per phase; remove the closed items from CLAUDE.md's known-open block; final line-count delta and dependency-graph note ("SDK worker-only") in the summary; full verification suite.

*End of Doc W4b.*
