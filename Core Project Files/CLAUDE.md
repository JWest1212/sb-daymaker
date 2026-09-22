# CLAUDE.md — SB Daymaker

`Status: v11 canon · last updated 2026-09-22 (Remediation R1, Wave 8) · supersedes v10 and all earlier material`

> **What this file is.** The always-loaded context for building **SB Daymaker**. Claude Code reads this at the start of every session. It encodes the product, the constraints, the stack, and the rules of engagement so I don't have to re-explain them each time. **Read this before doing anything.** When a detail here conflicts with your training instincts, this file wins. When this file conflicts with the canonical documents, the documents win, except where this file records a later shipped decision (the v11 note in §3 and the R1 decision ledger D1 to D14 in `docs/remediation-r1/00_R1_INDEX.md`); those win over any older document (see "Source of truth" below).
>
> **Current build target: v11, a four-section app: Explore · Saved · Discover SB · Plan, as shipped by Remediation R1 (`docs/remediation-r1/`, 2026-09-21 to 2026-09-22).** The first three are the bottom-nav tabs. **Plan** is a full section reached from "Build your day" on Explore (Today view) and "Build a day" on Saved; it is **not a bottom-nav tab** (a dormant Plan icon exists in `BottomNav` but is not in the tab list). The Map screen stays removed. The R1 decision ledger (D1 to D14) is canon; where any older document disagrees with it or with the §3 v11 note, this file (v11) supersedes it.

---

## 1. What we're building (one paragraph)

SB Daymaker is a **mobile-first daily companion for Santa Barbara, CA** that you open like you check the weather. It answers one question — *"what's worth doing in Santa Barbara today?"* — then helps you **find it, save it, and share it**, with the warmth of a knowing local friend. It is **happenings-first** (the spine is a three-tier cascade of what's actually happening, so the screen is never empty), **tunable** (three doors, Area, Occasion and Activity, plus a six-pill WHEN row, retune the feed), and **frictionless** (no end-user accounts; saving lives on-device, is never deleted by the app, and has an optional magic-link backup). It is a **two-sided** product: a public installable PWA *and* a private admin cockpit. The public app has **four sections — Explore · Saved · Discover SB · Plan** (the first three are the bottom-nav tabs; **Plan** is reached from "Build your day" on Explore and "Build a day" on Saved, not a tab). It must be operable by **one person in ~15 minutes a day** and run on a **~$45/month platform floor**.

**Positioning line:** *Find what's worth doing in Santa Barbara today — find it, save it, share it.*

---

## 2. The load-bearing constraints (never violate without asking me first)

These are settled decisions, not preferences. If a piece of work appears to require breaking one, **stop and flag it** — name the constraint, name the tradeoff, and price the added complexity. Do not quietly work around them.

1. **Solo-operator time budget: ~15 min/day.** Every feature that needs daily human attention is measured against this. If something would blow the budget, it's wrong.
2. **Cost floor: ~$45/month** in platform fees at launch (Vercel Pro ~$20 + Supabase Pro ~$25). Variable costs (mainly Google Places photos) scale with users and are managed by the image resolver + hard billing cap. Don't add paid services without flagging the cost.
3. **Batch AI only — no per-request AI.** All Claude API calls run in the nightly pipeline. The live app is **fully deterministic**: every section (Explore, Saved, Discover SB, Plan) and search render from pre-computed data; Plan's `buildConciergeDay` and `/api/search` are pure rules over the pool. No feature makes an AI call in response to a user tap.
4. **No end-user accounts.** Saves live in `localStorage` and the app never deletes one: Saved resolves each saved id directly, and an id it cannot resolve renders "No longer listed" with a Remove the visitor chooses (D1). The only stored end-user PII is the user's *own* email (digest opt-in + optional magic-link save-restore), treated as one boundary. No login wall, ever.
5. **Happenings-first, not place-first.** The content spine is the three-tier cascade (dated → recurring → evergreen). **Today's pick is never blank:** an eligible dated pick today, then an eligible recurring pick occurring today, then the evergreen rotation, then the static Courthouse card. It is computed before the Area, Occasion and Activity filters, so no filter combination can blank it (R1 W2.4).
6. **No in-app transactions.** Ticketing hands off to AXS/Ticketmaster. SB Daymaker never takes payment, never holds a cart.
7. **WCAG 2.2 AA is the build floor, not a finishing pass.** Build accessible from the first component (see §6).
8. **The trust rule (load-bearing):** the hero/feed ranker **never reads sponsor status.** Sponsored placements (Phase 2) are clearly labeled and structurally separate from ranking.

---

## 3. Source of truth (read these; don't re-derive)

The thinking is already done. Build *from* these, don't reinvent them.

| File | What it is | Use it for |
|---|---|---|
| `sbdaymaker_schema.sql` | **The data contract.** Runnable Postgres schema. | Every table, enum, and relationship. Run it as-is into Supabase; don't redesign it. |
| `sbdaymaker_tokens.css` | **The design system.** Single source of truth for color, type, space, motion. | Every color, font, spacing, and radius. Mirror into the Tailwind config; never hardcode a hex. |
| `02b_SBDaymaker_Wireframe.html` | **The interactive prototype: canonical for UI layout and flow** of the three browse sections (Explore · Saved · Discover SB) wherever R1 did not change them. The **Plan** surface postdates it; its visual target is the Concierge Day prototype. | What every browse screen looks like and how it behaves. Where R1 changed a screen (the WHEN row, the three doors, the one card anatomy, Saved counts and labels, the first-visit strip, recipient pages), shipped R1 behavior wins; otherwise it is the visual tiebreaker on any UI question except Plan. |
| `03_SBDaymaker_Platform_Architecture.html` | The technical/data architecture. | The nightly pipeline, the image resolver, the cron design, infra decisions. |
| `02_SBDaymaker_Product_Bible.html` | Every screen + annotations, IA, content model, flows, the cockpit. | Screen-level detail, edge cases, empty/error states, the six cockpit surfaces. **See the v9 note below — parts of this doc predate v9.** |
| `01_SBDaymaker_Business_Plan.html` | Product overview, positioning, GTM, cost/revenue, roadmap. | The "why," the audience, what's in V1 vs Phase 2. |
| `04_SBDaymaker_PreBuild_Audit.html` | The 26-finding gate-review audit. | The risks that were found and how each was resolved. |
| `05_SBDaymaker_PreBuild_Decisions.html` | Every gap resolved + dependency matrix + cost model. | The settled answer to "why did we decide X." |
| `06_SBDaymaker_Critical_UX_Assessment.html` | The evidence-based UX review. | The rationale behind the locked UX decisions. |
| `07_SBDaymaker_Innovation_Differentiation.html` | The differentiation study — the "Your Santa Barbara" north-star + the V1 idea slate. | Why the product wins; what the relationship-layer features are and the order to build them. |
| `08_SBDaymaker_Build_Plan.md` | **The phased build runbook (this build's route).** Ten phases, each with a kickoff prompt + acceptance checklist. | The order to build in. Follow it phase by phase; don't skip ahead. The `.html` twin is the human-facing version. |
| `09_SBDaymaker_Seed_Data_Guide.html` | How to produce seed/content data correctly. | Phase 1 (dev fixtures) and Phase 8/launch (real content). **Rule: enrich real facts, never invent them.** |
| `SBDaymaker_Credentials_and_Env.md` | Every account, API key, and env var the app needs + where each goes. | When wiring Supabase/OpenWeather/Resend/Anthropic. **Never expose a service-role or API key in client code.** |
| `00_SBDaymaker_Project_Context.md` | The master overview (everything above, summarized). | Orientation. Read first if you've read nothing else. |
| `docs/elevation-v1/GATE_4_planner_engine.md` | **The Concierge Day spec** (Elevation v1 Gate 4): the seven-question setup and the deterministic constraint engine `buildConciergeDay`, extending the `docs/plan-feature/` architecture (now history). | How Plan works today. Read with R1's `03_R1_W3_Plan_Integrity.md` (notes, meals, area honesty) and `04_R1_W4_Where_Things_Are.md` (the 8 areas). |
| `docs/elevation-v1/SBDaymaker_ConciergeDay_Prototype.html` | **The visual target for Plan** (the concierge prototype the wizard and go-bar are built to). | The tiebreaker on any Plan UI question. The `docs/plan-feature/` mockup is superseded. |
| `14_SBDaymaker_Build_Deltas.md` | **The canon-amendment ledger**, newest first; one entry per build that changed canon, one per R1 wave. | Why canon says what it says. |
| `docs/remediation-r1/` | **Remediation R1** (2026-09-21 to 2026-09-22): the index and decision ledger D1 to D14, eight wave specs, the coverage matrix, BASELINE.md, PROGRESS.md (every deviation), evidence screenshots, FINAL.md. | Why the product behaves as it does after R1. The ledger is canon. |
| `docs/audits/` | The 2026-09-21 UI audit log and technical pass that R1 closed. | Finding IDs (EXP-, SAV-, PLN-, TP-) cited in code comments. |
| `lib/strings.ts` | **The vocabulary**: one exported string per user-facing concept; re-exports `CADENCE_LINE`. Area labels live in `lib/areas.ts`. | Every UI string that names a concept (§8 rule 12). |

> **All files, titles, and references read SB Daymaker** (e.g. `sbdaymaker_schema.sql`, `02b_SBDaymaker_Wireframe.html`). The previous brand name appears nowhere in the canon. If you ever encounter it, it's an out-of-date artifact — flag it.

**Precedence when they disagree:** the R1 decision ledger (D1 to D14) and the v11 note below win first. Then the wireframe v9 on any UI/flow question R1 did not change. Then the locked UX decisions + follow-on decisions (in `00_SBDaymaker_Project_Context.md` and Document 6), then Document 5, then the rest. The schema and tokens files are authoritative for their domains.

> **v11 note (current build target; resolves every stale-surface conflict; decisions D1 to D14 in `docs/remediation-r1/00_R1_INDEX.md`, what shipped in `docs/remediation-r1/PROGRESS.md`; the v10 note's history lives in Doc 14):**
> - The app has **four sections: Explore · Saved · Discover SB · Plan.** The bottom nav has three tabs (Explore, Saved, Discover SB). **Plan** is reached from "Build your day" on Explore (Today view) and "Build a day" in Saved's bottom stack; it is a full section, **not a bottom-nav tab** (a dormant Plan icon exists in `BottomNav` but is not in the tab list). **No Map tab.** (Plan lineage: `docs/plan-feature/` → `docs/plan-simplification/` → `docs/revert back to simple plan/` → `docs/elevation-v1/GATE_4_planner_engine.md` → R1 Waves 3 and 4.)
> - **Explore:** the value-prop hero over the golden-hour skyline · **Today's pick** above the feed, never blank (§2.5), gated on `hero_eligible`, a real address and a start no more than 30 minutes past · **three doors: Area, Occasion, Activity**, each a sheet of tiles with live counts ("Which part of town?", "What's the occasion?", "What do you want to do?"); zero-count tiles show disabled with their count, never hidden; choices stack as AND filters with removable chips and one **Reset** · **the WHEN row: six pills in the locked order Today, Tomorrow, Weekend, Next Wknd, Week, Month** (D7), each with its date range in its accessible name; the pills carry no counts, the sheet tiles do (TP-C8-05) · the cascade feed in **one card anatomy** on every horizon, each recurring series collapsed to one card (D6) · **header search** (deterministic `/api/search`: dedupes by series then title, excludes civic and archived rows, tolerates a typo with "Did you mean") · filter and horizon state in the URL (`?when=&area=&occasion=&activity=`), read by the server, so a shared link opens on the same view · "Build your day" on Today · the newsletter block ("Santa Barbara, twice a week").
> - **Area is one vocabulary** (D5): `lib/areas.ts` holds the 8 public areas (Downtown and State Street; Funk Zone; Waterfront and Harbor; The Mesa; Mission and Riviera; Upper State; Goleta and Isla Vista; Montecito, Summerland, and Carpinteria) plus "Anywhere in SB". `areaForThing()` resolves `neighborhood`, then `nearby_zone`, never "other"; an unknown area displays as nothing. Explore, Plan, Saved, detail pages and the digest all read it. `nearby_zone` is mapped to the 8, not migrated.
> - **Plan is the seven-question Concierge Day** (PLN-008): When (today, tomorrow, or any day in the next 31 days) · Which parts of the day (Morning, Afternoon, Evening) · Who's coming · Where you're starting (the 8 areas or Anywhere in SB) · Getting around · Budget · Which meals. "Just draft me something" and "Start from a blank day" skip the questions. There is no Vibe step. The pure `buildConciergeDay` (`lib/plan/`) returns an **editable draft plus honest notes** (fewer than two stops, an unfilled meal, "Nothing found for [block] yet", "We widened beyond [area] to fill the day"). A stop reads "From your saves" or "Suggested", never both. Open-hours checks run only where hours are known, and the copy says "Open when we schedule it, as far as we know; check before you go." Go-bar: **Reset · Redo · Share day**; the plan is ephemeral (no Save). Shared plans ride `shared_states` at `/p/[token]` (`kind='shared_plan'`). **No AI at tap time.** Still dead in code, do **not** revive: `SwapSheet`, `PinPickerSheet`, `DayShapeSelector`, the drum-roll time picker, `buildDay.ts`, `dayShapes.ts`, and **`.ics` export.** Saved plans have no surface (`MyPlansDrawer` is unmounted), so nothing offers "Save this plan" (§10).
> - **Near Me is on Saved only** (D11). It is an in-view grouping, not a map: the chosen area becomes its own top group, it offers the 8 areas plus "Anywhere in SB", appears once 4 or more saves are in view, and falls back from geolocation to the list after 6 seconds. **Explore has no Near Me**; the Area door covers it (EXP-020).
> - **Sharing** is a **view-only link** (Option A): one item, a multi-select batch, a plan, or a guide; a friend can save their own copy of a list. When the native share sheet does not take it, a sheet shows the URL with Copy (`useShareLink`). Recipient pages `/s`, `/p`, `/r` share one frame (the wordmark, "A friend's picks from SB Daymaker, what's worth doing in Santa Barbara.", a persistent "Open SB Daymaker"), start with empty hearts, and mark past items by one rule (`isOver`: archived, or a dated event whose end has passed). No recipient PII is stored.
> - **Welcome** (D8, D10): the first visit shows a dismissible strip above the pick ("New here? Tap a heart to save it. Mark what you did. How it works.") over real, tappable content; the blocking overlay is gone. `sbd.tour.v1` is written when the strip is closed, not on mount. The three-panel tour opens from **How it works** (the strip, the footer on every page, the empty Saved screen) and teaches on a clearly labeled example card. The first-three-visits hero rule was never built and is dropped from canon.
> - **One Perfect SB Day / "Make My Day" is scrapped (2026-07-04).** Do **not** build it on Explore or Plan. `OnePerfectDayCard` is orphaned dead code.
> - **Discover SB** holds the Living Postcard guides, each surfacing the live happenings scoped to it. Published: **The Funk Zone** and **State Street** (one public name per guide, from `shortGuideTitle` in `mapGuide`); the theme group exists in the model with none published. The index names the next guide and its month from an optional `upcoming` object in a published guide's `content` jsonb, or shows no notice. The guides' "one detail is wrong on purpose" game is retired (D13), and the stop-marking passport is hidden until marking is built.
> - **Removed, do NOT build even if an older doc describes it:** the Map screen · the drum-roll time picker · **`.ics` calendar export** · Near Me on Explore (D11) · the blocking welcome overlay (D8) · the first-three-visits hero rule (D10) · the photo-over-text Month card (`RockTile`, retired R1 W6.4) · the guides' deliberate-error game (D13) · One Perfect SB Day.
> - Where the Product Bible, Business Plan, Audit, UX Assessment, wireframe or `14_SBDaymaker_Explore_Current_State_Spec.md` still describe five tabs, a Map screen, a forbidden planner, Near Me on Explore, Today / This Week / This Month as the only horizons, doors named Place and Vibe, or a blocking first-run overlay, treat that content as superseded by this note and the R1 ledger.

---

## 4. The stack (boring on purpose — don't add to it)

| Layer | Tech |
|---|---|
| Framework | **Next.js** (App Router) — UI + API routes + server actions + SSR/ISR |
| UI | **React + Tailwind**, tokens from `sbdaymaker_tokens.css` |
| Hosting / edge | **Vercel Pro** (precise cron + Fluid Compute) |
| Database | **Supabase (Postgres)** — free in dev, Pro by launch |
| Admin auth | **Supabase Auth + 2FA** (admin cockpit only — there is no end-user auth). Live console is **`/admin/*`** (Queue · Coverage · Live catalog · Hero plan); **`/cockpit/login`** is the current login page and **`/cockpit`** redirects to `/admin/review`. *(Current, not final; relocating login is an unscheduled cockpit task. That "Wave 4" belonged to the pre-R1 program, not R1's Wave 4.)* |
| Intelligence | **Claude API** — nightly batch only (tiered: Haiku for blurbs/tagging/parsing, Sonnet for ranking). **Pinned nightly enrich model: `claude-haiku-4-5`** (`ingest/enrich.ts` — exact ID, never `"latest"`). |
| Location | **Browser Geolocation API** (free, native, falls back to the area list after 6 seconds) + the static area module `lib/areas.ts`: powers Saved's Near Me, the only Near Me (D11). **No map tiles in V1.** |
| Weather | **OpenWeather** |
| Email | **Resend**: the twice-weekly edition ("Twice a week, Thursday and Sunday", one string, `CADENCE_LINE` in `lib/edition/cadence.ts`) plus the confirm, restore-link and already-on-the-list emails, all on the edition's template (`lib/email/transactional.ts`) with a plain-text alternative. |
| Analytics | **Vercel Web Analytics** — **installed** (Wave 1): `@vercel/analytics` mounted in `app/layout.tsx`, cookieless (no consent banner), firing **seven** custom events via `lib/analytics.ts`. Stays inert until the Vercel dashboard toggle is enabled (a human step). |
| Scheduling | **GitHub Actions** for the nightly ingest (`.github/workflows/ingest.yml`, 09:00 UTC, `npx tsx ingest/run.ts`), which also archives finished events (`ingest/retire.ts`, D2), writes slugs, and on success POSTs `/api/revalidate` (CRON_SECRET bearer) so public pages refresh; the same workflow drafts the edition Wed and Sat. **Vercel Cron** (`vercel.json`) runs the weekly reaper (`/api/cron/reaper`, Mon 08:00 UTC), the edition send (`/api/cron/send-edition`, Thu and Sun 14:00 UTC) and the missed-run heartbeat (`/api/cron/heartbeat`, daily). `/api/cron/nightly` is a deprecated no-op. ISR is a 300 s safety net on /saved, /plan, /discover, /discover/[id], /thing/[id]. |

**Deliberately NOT in the stack:** a separate backend server, Kubernetes, Redis, a queue, microservices, end-user auth, an ORM that fights the schema, **and — as of v9 — Mapbox** (the full map moved entirely to Phase 2; Near Me is an area grouping on Saved, so V1 needs no map SDK or token). If you think we need one of these, flag it — the answer is almost always no.

**Why the nightly ingest lives on GitHub Actions (not Vercel Cron):** the worker needs process isolation, a ~20-minute timeout, and its own GitHub secrets — all awkward inside a Vercel function. Leave it there; don't "helpfully" migrate it back into a Vercel cron.

**Model pinning:** always use exact model IDs, never `"latest"`. Every AI call gets a timeout + one retry + a graceful fallback (skip and flag; the hero falls back to the evergreen card).

---

## 5. House aesthetic (the feel)

**Spanish Colonial Revival meets a daily broadsheet/postcard.** Warm, editorial, local — the voice of a knowing local friend, never corporate, never breathless.

- **Type:** Fraunces (display, used with restraint) · Inter (body + UI) · JetBrains Mono (data/timestamps). Minimum body **16px**; nothing anywhere under **12px**, including at 320px width and 200% zoom (R1 W6.5); minimum touch target **44×44px**.
- **Color:** Plaster `#F6F1E7` background, Paper `#FCFAF5` cards, Ink `#241C16` text, Pacific `#16586A` links/accents, Terracotta `#C0532E` for large headings/UI. **Always build against the semantic tokens** (`--bg`, `--text`, `--accent`, …) so contrast stays enforced.
- **The accessibility usage rule (don't break this):** small text uses only Ink / Ink-2 / Pacific. Accent colors (Gold, Tile Light, Sage, Terracotta) are for large headings, badges, icons, and fills — **never small text on a light background.** When an accent must carry a small label, use the `-text` darkened variants in the tokens file.
- **Signature element:** the golden-hour hero, where the sun tracks the real time of day. Micro-interactions (heart pop, sun pulse, sheet slide) all honor `prefers-reduced-motion`.
- **Voice promises only what exists** (XC-004): copy never claims memory, learning, a map, a sort, a verification or a control the product lacks. Saves stay on the device, so say "Everything you save and mark stays on this phone." "Verified" means a person checked it (`verified_at`), never that the scraper saw it again. "Everything worth doing in Santa Barbara, in one place" stays; report a gap to Jim rather than softening the line.
- **Icons, not emoji:** tags, Saved, Discover and not-found pages use the icon set (`components/ui/SBIcon.tsx`), never emoji (DET-012).

---

## 6. Accessibility (build it in, every component)

WCAG 2.2 AA is a floor we build *to*, not a pass we do at the end. On every component:

- Color contrast follows the token usage rule above (the tokens are pre-checked; respect them and contrast is handled).
- Every interactive element has a visible `:focus-visible` ring (Pacific) and is keyboard-operable.
- The save heart needs `aria-label="Save {title}"` / `"Saved {title}"`.
- Touch targets are ≥44×44px.
- All looping animations (sun pulse, urgency pulse, freshness dot) stop under `prefers-reduced-motion` and show a static state instead.
- Images lazy-load and carry meaningful `alt` text (or `alt=""` if decorative).
- Every page exposes header, main, nav and footer landmarks (one shared `PageFooter`) and exactly one h1 (R1 W7.8).
- A 44×44 hit area lives on the control itself, never only in a pseudo-element that audit tools cannot see (R1 W6).
- No page scrolls sideways at 390px or 320px, and every control is reachable at 200% zoom (R1 W6.5).
- Card and detail photographs carry title-plus-venue alt; the skyline and motifs are `alt=""` (R1 W5.7).

---

## 7. How I work with you (Jim)

- I'm a **solo, non-technical-leaning founder** with an AI/digital-strategy background, building in **VS Code with Claude Code**. Explain what you're doing in plain terms; don't assume I'll read the diff to understand the change.
- **Honest over optimistic.** If something is weak, risky, or a bad idea, say so and say why. Don't cheerlead. Stress-test my asks.
- **Complexity is a cost, not a sign of thoroughness.** Justify any added complexity against the solo-operator constraint. The simplest thing that's correct wins.
- **Show me before you commit to a direction.** For anything visual or structural, I want to *see* the rendered result, not just a description. Run the dev server; tell me what to look at.
- **Work in reviewable phases.** Do a phase, stop, tell me what changed and what to test. I test each build immediately and flag bugs fast. Don't run ten phases without checking in.
- I approve or redirect with short confirmations. Handle implementation details without re-explaining them to me.

---

## 8. Working rules for you (Claude Code)

1. **Read the relevant source-of-truth file before writing code for that area.** Building a screen? Open the wireframe (v9). Touching data? Open the schema. Don't guess at something that's already specified.
2. **Never hardcode a color, font, or spacing value.** Pull from the tokens. If a token seems missing, flag it — don't invent one.
3. **Run the schema as-is.** `sbdaymaker_schema.sql` is the contract. Don't "improve" it mid-build. If it genuinely needs a change, stop and tell me why.
4. **One phase at a time.** Finish a coherent chunk, verify it runs, then summarize for me: what you built, what changed, what to test, what's next. Wait for my go-ahead on the next phase.
5. **Verify before declaring done.** Start the dev server, confirm the screen renders, check the console for errors. A blank screen is always a JavaScript runtime error (usually variable scoping relative to `return`), not a CSS problem — check scoping first.
6. **Keep the two PII boundaries clean.** Subscriber email + magic-link address are the *only* end-user PII. **Saved-list share-links store no recipient contact info.** Don't introduce new PII.
7. **When unsure, ask — don't assume.** A wrong assumption costs more than a question. Especially on anything touching the eight constraints in §2.
8. **No secrets in the repo.** API keys go in environment variables (`.env.local`, Vercel project settings), never committed.
9. **`react-hooks/exhaustive-deps` is never disabled without a comment proving the omitted dependency is inert.** (Five silent disables in one file shipped the been-marking regression — Wave 1 W1.1.)
10. **Never write code that can delete a visitor's saves (D1).** Saved resolves ids with `getThingsByIds()` (published and archived, no tier, quality or row limits). An unknown id renders "No longer listed" with a Remove the visitor taps; a network failure throws `ThingsUnreachableError` and reads as offline, never as missing; no effect may call `remove()` (pinned by `components/saved/noAutoDelete.test.ts`); an unreadable stored list is preserved in `sbd.saves.v1.unreadable`, never overwritten.
11. **No em dashes, anywhere (D9, THE GOLDEN RULE).** U+2014 never appears in code, copy, data, emails, alt text or slugs. En dashes (U+2013) become a hyphen in a numeric range ("5-7 PM"), the word "to" in a day, month or clock range ("Monday to Friday", "10am to 2pm"), and a comma where they separate. `scripts/check-emdash.mjs` fails on either character in `.ts/.tsx/.mts/.mjs/.js/.css` under app, components, lib, ingest, packages, scripts and public; `next.config.ts` runs it in the production-build phase, so `next build` fails however it is started, and `npm run lint` and the `golden-rule` workflow run it too. Data is normalized at write time (`ingest/land.ts`, `ingest/enrich.ts`) and render time (`cleanText` in `lib/text/stripEmDash.ts`), and the AI prompts forbid both characters.
12. **One name per concept, from `lib/strings.ts`.** Every user-facing name for a concept (Area, Occasion, Activity, Reset, Saved, Want to go, Been, "N on your list", How it works, Suggest an event or business, Morning, Afternoon, Evening, the newsletter heading and name) is imported from `lib/strings.ts`; area labels come from `lib/areas.ts` and the cadence from `CADENCE_LINE`. Never spell one out by hand in UI. Retired from the UI: Place (as the where-concept), Vibe, "Where to?", "Clear filters", Night as a part of day, "replay". One Title Case label per category on cards and sheets ("Arts & Culture"); uppercase is CSS. Admin and cockpit are exempt.
13. **Public reads state their own rules.** Filter `status` explicitly (never RLS alone) and page past PostgREST's hard 1,000-row ceiling with `.range()` against `count: "exact"`; a larger `.limit()` cannot lift it. `getPublishedThings()` is the single chokepoint: published, not civic, not finished (`lib/poolFilter.ts`), `quality_tier` 3 dropped.

---

## 9. What's in V1 vs deferred (don't build deferred work)

**V1 (launch) — four sections (Explore · Saved · Discover SB · Plan):**

- **Explore** (the front door): the value-prop hero over the golden-hour skyline · Today's pick (never blank) · the three doors **Area · Occasion · Activity** · the six-pill WHEN row (**Today, Tomorrow, Weekend, Next Wknd, Week, Month**) · header search · the happenings cascade feed (dated → recurring → evergreen) in one card anatomy, each recurring series collapsed to one card · state in the URL · "Build your day" on Today. **No Near Me on Explore** (D11). *(One Perfect SB Day / "Make My Day" was scrapped 2026-07-04; see Removed.)*
- **Saved**: two-state on-device saves, **Want to go / Been**; the tab badge counts Want to go only and "N to go, M been" sits under the toggle · every save resolves by id and is **never auto-deleted** (D1): unknown ids show "No longer listed" with Remove, past items keep their state with "Already happened, [date]" · "Did you make it?" labelled from the event's own time · undated saves under "Places and regulars" · **Near Me**, the only one (D11) · **share**, one item or a multi-select batch, as a view-only link a friend opens and can save their own copy · magic-link backup from the first save · "Build a day" into Plan · works offline from the device.
- **Discover SB**: the Living Postcard city guides, each surfacing the live happenings scoped to it (ISR 300 s, refreshed after every ingest). Published: The Funk Zone and State Street; theme guides are supported, none published. "Right now" blocks hide after 45 days. The index names the next guide and month, or shows no notice (R1 W8.5).
- **Plan** (reached from "Build your day" on Explore and "Build a day" on Saved; **NOT a bottom-nav tab**): the seven-question **Concierge Day** (§3 v11 note), or "Just draft me something" / "Start from a blank day", lands on an **editable draft** from the pure `buildConciergeDay` (saved-first; each stop "From your saves" or "Suggested", never both), with honest notes when the day is thin, a meal is unfilled, or it had to widen beyond the chosen area. Every stop is removable and replaceable; Redo gives a fresh draft that excludes the current one and says when the pool is exhausted. Bottom bar **Reset · Redo · Share day** (no Save; the plan is ephemeral). **This is NOT the retired auto-day**: no "Make My Day" button, no day-shape pills. `lib/plan/buildDay.ts` and `lib/plan/dayShapes.ts` were removed; do not reintroduce them.
- **Plus:** the twice-weekly email ("Twice a week, Thursday and Sunday"; `/digest/sample` renders the coming send window from live data, D12) · the public submission form ("Suggest an event or business") · the six-surface admin cockpit · the nightly pipeline.

**How the catalog behaves (R1; do not undo without asking):**
- **Retirement (D2).** The public pool drops an event at read time once `coalesce(ends_at, starts_at + 4h)` is more than a day past (`lib/poolFilter.ts`). The nightly `ingest/retire.ts` archives it 7 days after it ends; nothing is deleted, and rows with no `starts_at` are never archived by this rule. Archived detail pages stay reachable with "This already happened on [date]", noindex and a working heart, so saved, shared and restore links never 404.
- **Civic (D3, D14).** Civic meetings and closure notices carry `is_civic`, set at land time by rules kept as data in `ingest/civic.ts` (title-tested; the city calendar is not blanket-flagged). They keep ingesting for a possible future surface and never reach the public pool, so the feed, the pick, search, Plan and nearby lists never show them. The cockpit shows them with a Civic chip.
- **Series (D6, D4).** `series_key` (normalized title plus venue, `ingest/series.ts`) groups occurrences. The feed shows one card per series per horizon ("Every Sunday, next Sep 27", "N dates"); every occurrence stays its own row (consolidation deferred, §10). Library programs stay; "LOTG" reads "Library on the Go".
- **Copy.** Cards read `blurb`; detail reads `blurb_long ?? blurb`. `ingest/blurbRules.ts` rejects a blurb that repeats the title, names the wrong weekday, holds a street address or a banned phrase. One `priceLabel()` for card and detail (`price_note` first, never blank).
- **Routes.** Every in-app link emits the slug; a UUID URL 308s to its slug; old slugs and merged duplicates 308 too. Missing things and guides answer a real 404; the root not-found page is branded with header, nav and three ways back.
- **Offline.** `public/sw.js` serves /saved from its own cached copy (rendered from the device, titles remembered at save time) and /offline for every other page; it never caches the app's data requests.
- **Metadata.** Every public route has its own og:title, og:image and description (`lib/seo/pageMeta.ts`, `lib/seo/ogCard.tsx`). /s, /p, /r and archived detail pages are noindex; robots.txt keeps search crawlers out of /s/, /p/, /r/ and lets link-preview bots in.

**Phase 2 (committed, sequenced — do NOT build in V1):** web push for installed users · the **full Mapbox map** (clustering, sub-tabs, filter-sync) · live Happy Hour countdowns · the full Spanish-language layer · operator-submitted photos · account-based cross-device sync.

**Removed (retired, do NOT build):** the Map screen · the drum-roll time picker · `.ics` calendar export · **One Perfect SB Day / the "Make My Day" express button** (scrapped 2026-07-04) · Near Me on Explore (D11) · the blocking first-visit overlay (D8) · the first-three-visits hero rule (D10) · the photo-over-text Month card (`RockTile`) · the guides' "one detail is wrong on purpose" game (D13). Near Me replaced the Map, as an area grouping on Saved.

**Plan lineage.** v9.1 revived a deliberately narrower planner (`docs/plan-feature/`) and simplified it (`docs/plan-simplification/`, `docs/revert back to simple plan/`). Elevation v1 Gate 4 then made it the Concierge Day (`docs/elevation-v1/GATE_4_planner_engine.md`), and R1 Waves 3 and 4 made it honest (one notes reducer, real meals, the 8 areas, a 31-day horizon). It stays no-accounts (localStorage), deterministic (pure rules over pre-computed `things`), no transactions, no `.ics`, no map. The saved-list share and the Plan share ride the same `shared_states` mechanism.

**Never:** in-app ticketing/payment · reviews/ratings · separate Visitor/Local modes · a full account system · AI-written digest *synthesis* (editions assemble pre-approved content only).

If an idea is in the Phase-2, Removed, or Never list, don't build it as a surprise. Flag it and let me decide.

---

## 10. Known open items (do not silently "fix"; the record is `docs/remediation-r1/PROGRESS.md`)

These are **known and tracked**, not bugs to surprise-fix. If your work touches one, flag it; don't quietly resolve it out of scope. Remove an item here once the wave that owns it closes it.

- **Resend sending domain.** The edition send path is built (`lib/edition/send.ts`, `/api/cron/send-edition`); verifying the sending domain in Resend is a human step (LAUNCH_CHECKLIST).
- **Happy-hour windows**: no per-venue time-window data yet, so Happy Hour is a "last confirmed" list, not live.
- **Legacy `lib/pipeline.ts` + `lib/enrich.ts`**: the retired duplicate of the GitHub-Action worker (`ingest/`) still sits in the tree, dead. Removal is an unscheduled cleanup (the "Wave 4" once named for it was the pre-R1 program's).
- **Migrations tree is incomplete**: not every applied change has a checked-in migration. Elevation v1's live objects are documented in `supabase/migrations/RECONCILE_20260720_documentation.sql`; the R1 DDL exists only in `docs/remediation-r1/00_R1_INDEX.md`. Reconciling is unscheduled.
- **Itineraries store and saved plans**: `components/plan/ItinerariesProvider.tsx` and `lib/plan/itineraries.ts` both own `sbd.itineraries.v1`, and no screen lists saved plans (`SavedDays`, `MyPlansDrawer`, `SaveNameSheet` are orphaned), so the shared plan's "Save this plan" is hidden. Pick one store, then surface Days or drop the idea.
- **Series data-model consolidation** (deferred by D6): every occurrence is still its own `things` row and the feed collapses them by `series_key` at render. One row per series with an occurrences table is future work.
- **A civic surface** (D3, D14): civic rows keep ingesting and are flagged `is_civic`, and nothing public reads them. Any civic page is a new product decision; Jim confirms the civic source list.
- **Push and preview deploys are blocked**: iCloud has evicted git objects in this `~/Documents` repo, so `git push` hangs and `remediation-r1` exists only locally. Durable fix: move the repo to a non-synced path, which also retires the `node_modules.nosync` and `.next.nosync` workarounds.
- **Mobile LCP on / is 8.3 s** against a 4 s target (baseline 16.0 s). A throttled real browser paints it in 1.2 s; the honest measurement is on a deployed preview, blocked by the push.
- **Pipeline runs carried out of R1 Wave 5**: the AI re-enrichment batch (thin blurbs, wrong weekdays) and the W5.7 image waterfall change. The rules and validators are in place; the runs are not. Also: `ingest/clean.ts` `cleanTitle` runs only as a backfill, not in `ingest/land.ts`.
- **W4.4 forward rule unbuilt**: rows with an address but no area should land as `needs_review`; no such gate exists yet.
- **Dead listing and guide URLs** answer 404 but draw their body in the browser (a thrown `notFound()` escapes server rendering in this Next version); with JavaScript off the page is blank. Kept over a soft 404.
- **Detail routes render on demand** (TP-A3-03): no `generateStaticParams`, so `revalidate` has no prerendered entry to attach to.
- **Area gaps**: 26 published rows have no area (8 public and live, all on the city placeholder address); Oak Park and Arroyo Burro Open Space are flagged `review: true` in `ingest/data/venues.json`.
- **Door sheet tile photographs** (`/tiles/place/*`, `/tiles/vibe/*`, `/tiles/activity/*`) were never shipped and 404 in production; the sheets fall back to their plain tile.
- **Guide stop marking** (the passport and stamp) is not built; its promises are hidden until it is.
- **Not yet verified on a real device**: iOS Safari offline and 200% zoom behavior; the confirmation email in Gmail.
---

*End of CLAUDE.md. Keep this file current as decisions evolve — it's the contract between me and you for every session.*
