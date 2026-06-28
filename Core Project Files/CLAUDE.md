# CLAUDE.md — SB Daymaker

`Status: v9 canon · last updated 2026-06-21 · supersedes all earlier pre-rename material`

> **What this file is.** The always-loaded context for building **SB Daymaker**. Claude Code reads this at the start of every session. It encodes the product, the constraints, the stack, and the rules of engagement so I don't have to re-explain them each time. **Read this before doing anything.** When a detail here conflicts with your training instincts, this file wins. When this file conflicts with the canonical documents, the documents win (see "Source of truth" below).
>
> **Current build target: v9.1 — a three-section app (Explore · Saved · Discover SB) plus the Plan surface (a single-day planner reached from a dedicated Plan action in the bottom bar).** The Map screen was removed in v9; the My Plan removal is superseded by the v9.1 Plan surface — see §3 ("v9 note"), §9, and `docs/plan-feature/`. Where any older document still shows five tabs, a Map screen, or My Plan, the wireframe v9 and this file supersede it.

---

## 1. What we're building (one paragraph)

SB Daymaker is a **mobile-first daily companion for Santa Barbara, CA** that you open like you check the weather. It answers one question — *"what's worth doing in Santa Barbara today?"* — then helps you **find it, save it, and share it**, with the warmth of a knowing local friend. It is **happenings-first** (the spine is a three-tier cascade of what's actually happening, so the screen is never empty), **tunable** (occasion tags retune the feed), and **frictionless** (no end-user accounts; saving lives on-device with an optional magic-link backup). It is a **two-sided** product: a public installable PWA *and* a private admin cockpit. It must be operable by **one person in ~15 minutes a day** and run on a **~$45/month platform floor**.

**Positioning line:** *Find what's worth doing in Santa Barbara today — find it, save it, share it.*

---

## 2. The load-bearing constraints (never violate without asking me first)

These are settled decisions, not preferences. If a piece of work appears to require breaking one, **stop and flag it** — name the constraint, name the tradeoff, and price the added complexity. Do not quietly work around them.

1. **Solo-operator time budget: ~15 min/day.** Every feature that needs daily human attention is measured against this. If something would blow the budget, it's wrong.
2. **Cost floor: ~$45/month** in platform fees at launch (Vercel Pro ~$20 + Supabase Pro ~$25). Variable costs (mainly Google Places photos) scale with users and are managed by the image resolver + hard billing cap. Don't add paid services without flagging the cost.
3. **Batch AI only — no per-request AI.** All Claude API calls run in the nightly pipeline. The live app is **fully deterministic** — every section (Explore, Saved, Discover SB) renders from pre-computed data. No feature makes an AI call in response to a user tap.
4. **No end-user accounts.** Saves live in `localStorage`. The only stored end-user PII is the user's *own* email (digest opt-in + optional magic-link save-restore), treated as one boundary. No login wall, ever.
5. **Happenings-first, not place-first.** The content spine is the three-tier cascade (dated → recurring → evergreen). The hero is never blank — it falls back to a hand-written evergreen card.
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
| `02b_SBDaymaker_Wireframe.html` | **The interactive prototype — canonical for UI layout and flow.** Three sections (Explore · Saved · Discover SB). | What every screen looks like and how it behaves. This is the visual target and the tiebreaker on any UI question. |
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
| `docs/plan-feature/SBDaymaker_Plan_Build - fresh setup.md` | **The phased build spec for the Plan surface** (v9.1 single-day planner; current canon). | The order to build Plan in; the deterministic slotting engine + UI↔schema mappings + the Option-C setup. Follow it phase by phase. |
| `docs/plan-feature/SBDaymaker_Plan_Mockup - fresh setup.html` | **The visual target for Plan** — six rendered states (current canon). | What every Plan screen looks like; the tiebreaker on any Plan UI/pixel question. |

> **All files, titles, and references read SB Daymaker** (e.g. `sbdaymaker_schema.sql`, `02b_SBDaymaker_Wireframe.html`). The previous brand name appears nowhere in the canon. If you ever encounter it, it's an out-of-date artifact — flag it.

**Precedence when they disagree:** the wireframe v9 wins on any UI/flow question. Then the locked UX decisions + follow-on decisions (in `00_SBDaymaker_Project_Context.md` and Document 6), then Document 5, then the rest. The schema and tokens files are authoritative for their domains.

> **v9 note (current build target — this resolves all stale-surface conflicts):**
> - The app has **three browse tabs (Explore · Saved · Discover SB) + a Plan action in the bottom bar.** No Map tab. (Plan is a create-action — building a day — not a fourth browse destination; see `docs/plan-feature/`.)
> - **Near Me** is an in-view **sort** (by neighborhood), available on Explore and Saved. It is *not* a map. It needs geolocation + a neighborhood lookup, nothing more.
> - **Sharing** is a **view-only saved-list link** (Option A): a friend opens the link, sees the picks, and can save their own copy. Single items or a multi-select batch. No recipient PII is stored.
> - **One Perfect SB Day** is a hand-curated lineup on Explore that seeds the saved list (deterministic; no AI at tap time).
> - **Discover SB** holds two guide groups — **neighborhood** guides and **theme** guides — each surfacing the live happenings scoped to it.
> - **Removed in v9 — do NOT build, even if an older doc describes it:** the Map screen, the My Plan itinerary builder, timed/sequenced plans, the drum-roll time picker, and **`.ics` calendar export.**
> - Where the Product Bible, Business Plan, Audit, or UX Assessment still describe five tabs / a Map screen / My Plan, treat that content as superseded by this note and the wireframe v9.

---

## 4. The stack (boring on purpose — don't add to it)

| Layer | Tech |
|---|---|
| Framework | **Next.js** (App Router) — UI + API routes + server actions + SSR/ISR |
| UI | **React + Tailwind**, tokens from `sbdaymaker_tokens.css` |
| Hosting / edge | **Vercel Pro** (precise cron + Fluid Compute) |
| Database | **Supabase (Postgres)** — free in dev, Pro by launch |
| Admin auth | **Supabase Auth + 2FA** (admin cockpit only — there is no end-user auth) |
| Intelligence | **Claude API** — nightly batch only (tiered: Haiku for blurbs/tagging/parsing, Sonnet for ranking) |
| Location | **Browser Geolocation API** (free, native) + a static neighborhood lookup — powers the Near Me sort. **No map tiles in V1.** |
| Weather | **OpenWeather** |
| Email | **Resend** (the 2×/week edition) |
| Analytics | **Vercel Web Analytics** (cookieless — no consent banner) |
| Scheduling | **Vercel Cron** — one nightly orchestrator + one weekly digest cron |

**Deliberately NOT in the stack:** a separate backend server, Kubernetes, Redis, a queue, microservices, end-user auth, an ORM that fights the schema, **and — as of v9 — Mapbox** (the full map moved entirely to Phase 2; Near Me is a sort, so V1 needs no map SDK or token). If you think we need one of these, flag it — the answer is almost always no.

**Model pinning:** always use exact model IDs, never `"latest"`. Every AI call gets a timeout + one retry + a graceful fallback (skip and flag; the hero falls back to the evergreen card).

---

## 5. House aesthetic (the feel)

**Spanish Colonial Revival meets a daily broadsheet/postcard.** Warm, editorial, local — the voice of a knowing local friend, never corporate, never breathless.

- **Type:** Fraunces (display, used with restraint) · Inter (body + UI) · JetBrains Mono (data/timestamps). Minimum body **16px**; minimum touch target **44×44px**.
- **Color:** Plaster `#F6F1E7` background, Paper `#FCFAF5` cards, Ink `#241C16` text, Pacific `#16586A` links/accents, Terracotta `#C0532E` for large headings/UI. **Always build against the semantic tokens** (`--bg`, `--text`, `--accent`, …) so contrast stays enforced.
- **The accessibility usage rule (don't break this):** small text uses only Ink / Ink-2 / Pacific. Accent colors (Gold, Tile Light, Sage, Terracotta) are for large headings, badges, icons, and fills — **never small text on a light background.** When an accent must carry a small label, use the `-text` darkened variants in the tokens file.
- **Signature element:** the golden-hour hero, where the sun tracks the real time of day. Micro-interactions (heart pop, sun pulse, sheet slide) all honor `prefers-reduced-motion`.

---

## 6. Accessibility (build it in, every component)

WCAG 2.2 AA is a floor we build *to*, not a pass we do at the end. On every component:

- Color contrast follows the token usage rule above (the tokens are pre-checked; respect them and contrast is handled).
- Every interactive element has a visible `:focus-visible` ring (Pacific) and is keyboard-operable.
- The save heart needs `aria-label="Save {title}"` / `"Saved {title}"`.
- Touch targets are ≥44×44px.
- All looping animations (sun pulse, urgency pulse, freshness dot) stop under `prefers-reduced-motion` and show a static state instead.
- Images lazy-load and carry meaningful `alt` text (or `alt=""` if decorative).

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

---

## 9. What's in V1 vs deferred (don't build deferred work)

**V1 (launch) — three sections:**

- **Explore** (the front door): the daily golden-hour hero · the happenings cascade feed (dated → recurring → evergreen) · occasion tags (the Lens) · Today / This Week / This Month horizons · the **Near Me** sort · (**One Perfect SB Day** has moved to the Plan surface as the **"Make My Day"** express button — it is no longer on Explore) · First Looks + New This Week · light Happy Hour (a "last confirmed" list, no live countdowns).
- **Saved**: two-state on-device saves (**want / been**) · the **Near Me** sort · **share** — one item or a multi-select batch → a view-only link a friend opens and can save their own copy · magic-link backup (no account).
- **Discover SB**: the city guides — **neighborhood** guides + **theme** guides, each surfacing the live happenings scoped to it (ISR).
- **Plan** (a create-action in the bottom bar — building a day, **not** a browse destination): a single-day planner — setup (**Make My Day** express + five questions) → a **time-of-day spine** of swappable stops → swap-a-stop (saved spots float to the top) → build-from-saved → save to **Saved › Days** → **view-only share** link. Fully deterministic (hand-authored day-shapes + pre-computed `things`); **no AI at tap time** (same rule as the old One Perfect SB Day). See `docs/plan-feature/`.
- **Plus:** the 2×/week email · the public submission form · the six-surface admin cockpit · the nightly pipeline.

**Phase 2 (committed, sequenced — do NOT build in V1):** web push for installed users · the **full Mapbox map** (clustering, sub-tabs, filter-sync) · live Happy Hour countdowns · the full Spanish-language layer · operator-submitted photos · account-based cross-device sync.

**Removed in v9 (retired — do NOT build):** the Map screen · the drum-roll time picker · `.ics` calendar export. Near Me replaced the Map (as a sort).

**v9.1 — the Plan surface (a single-day planner) supersedes the My Plan removal; see `docs/plan-feature/`.** It revives a deliberately narrower planner — timed/sequenced plans on a time-of-day spine — and stays no-accounts (localStorage), batch-AI-only (deterministic slotting from hand-authored day-shapes + pre-computed `things`), no transactions, no `.ics`, no map. The saved-list share remains; the Plan view-only share rides the same `shared_states` mechanism.

**Never:** in-app ticketing/payment · reviews/ratings · separate Visitor/Local modes · a full account system · AI-written digest *synthesis* (editions assemble pre-approved content only).

If an idea is in the Phase-2, Removed, or Never list, don't build it as a surprise. Flag it and let me decide.

---

*End of CLAUDE.md. Keep this file current as decisions evolve — it's the contract between me and you for every session.*
