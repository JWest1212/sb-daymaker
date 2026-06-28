# SB Daymaker — The Plan Surface · Build Spec

> **What this file is.** The full, phase-by-phase runbook for building the **Plan** surface — a single-day planner — into the existing SB Daymaker app. Written for Claude Code. It assumes the v9 app already exists (Explore · Saved · Discover SB) and Wave Next is complete.
>
> **Visual source of truth:** `docs/plan-feature/SBDaymaker_Plan_Mockup.html` — six rendered states. This build must match it. Where this doc and the mockup disagree on a pixel, the mockup wins; where they disagree on *behavior or data*, this doc wins.
>
> **Operating rules unchanged.** Everything in `CLAUDE.md` §6 (a11y), §8 (working rules), and §2 (the load-bearing constraints) still governs. This doc never overrides those — it works inside them. Tokens only, never hardcode a hex (see Appendix A). One phase at a time; stop and show Jim the rendered result after each.

---

## 0. Read before you start

Open and read, in this order:
1. `CLAUDE.md` — the contract.
2. `sbdaymaker_tokens.css` — the design system (mirror into the Tailwind config; never hardcode).
3. `sbdaymaker_schema.sql` — the data contract (esp. `shared_states`, the `tod`, `occasion_tag`, `nearby_zone` enums).
4. `02b_SBDaymaker_Wireframe.html` — the existing app's components, save store, detail screen, share infra. **Reuse these; don't rebuild them.**
5. `docs/plan-feature/SBDaymaker_Plan_Mockup.html` — the visual target for everything below.

---

## 1. ⚠️ The v9 reconciliation (read this — it changes the contract)

The Plan surface **deliberately revives** two things `CLAUDE.md` §9 currently lists under *"Removed in v9 — do NOT build"*: the **My Plan itinerary builder** and **timed/sequenced plans**. This is an **approved, intentional evolution** decided by Jim. It is *not* a return of the full old My Plan — the scope is deliberately narrower and still inside every §2 constraint (see §3 below).

**Phase 0 updates `CLAUDE.md` so the contract is current.** Do Phase 0 first, before any app code. Do not silently build against a contract that says "do not build this" — fix the contract, with Jim's approval, then proceed.

### What the Plan surface still honors (unchanged constraints)
- **No accounts.** Itineraries live in `localStorage`, exactly like saves. (§2.4)
- **Batch-AI only — no per-tap AI.** Days are assembled **deterministically** from already-ingested `things` + **hand-authored day-shape skeletons**. No Claude call happens on any tap. This is the same rule that already governs "One Perfect SB Day." (§2.3)
- **No transactions.** Ticketing still hands off to AXS/Ticketmaster. (§2.6)
- **No `.ics` / calendar export.** Stays retired. The plan is shared as a **view-only link** only. (§9)
- **No map.** The anchor question is a neighborhood picker (a `nearby_zone`), never a map. (§9, stack)
- **PII boundary clean.** The shared-plan link stores **no recipient contact info** — same rule as the saved-list share. (§8.6)
- **WCAG 2.2 AA on every component.** (§6)

### What changes
- **One Perfect SB Day moves.** It is promoted out of Explore into Plan as the flagship **"Make My Day"** button. **Remove the One Perfect SB Day card from Explore** (and its `perfectDay()`-style seed entry point there). Its mechanic — a ready-made day in one tap — lives on in Plan.
- **The app shell gains a fourth bottom-bar element — but not a fourth browse tab.** The three browse *destinations* (Explore · Saved · Discover SB) are untouched. Plan is a **raised create-action button** in the bar (it makes something; it isn't a place you browse). The "three-section" shape is intact in spirit; the bar now carries three tabs + one action.
- **Saved gains a second view: Days.** Saved becomes **Things · Days** (saved spots vs saved itineraries).

---

## 2. What you're building (the whole picture)

A single-day planner reached from the raised **Plan** button, present on every screen.

1. **Setup screen** — a flagship **"Make My Day"** express button (instant ready-made day), then a deliberately light, **hero-first** layout: only the essentials show on landing — **When** (segmented) · **Where** (a picker row) · **Time of day** (multi-select) — with **Who** and the **full vibe set** folded into a **"Fine-tune"** expander. Plus a **"Pin saved spots"** hook and a **"Show me my day"** CTA. A top-right **My plans** drawer lists saved itineraries.
2. **Your day (the spine)** — 2–3 whole-day options as switchable **day-shape** pills, rendered on a **time-of-day spine** (the signature element: a rail that warms teal→gold down the day, one card per time block). Every stop is **swappable** and opens **detail**.
3. **Swap a stop** — a sheet of alternates for one block; the user's **saved spots float to the top** (gold badge), then more ideas; one tap updates the spine.
4. **Build from saved** — the pin hook opens a picker of want-to-go spots; chosen spots are **pinned into their natural time block** and the planner **fills the gaps** around them.
5. **Save & Days** — save the itinerary to `localStorage`; it appears in **Saved › Days** and in the Plan **My plans** drawer (one store).
6. **Share (view-only)** — a locked-down public page: the same spine, cards tappable for detail, **no editing**, with a **"Save this plan"** copy-to-own button. Backed by `shared_states` (`kind='shared_plan'`).

---

## 3. The deterministic engine (no AI at tap time)

This is the heart of "timed plans without breaking the batch-AI rule." Read carefully.

### 3.1 Day-shape skeletons (hand-authored content config)
A small, curated set of day *shapes*. Each is pre-written (a content artifact you ship as a typed config file, `lib/plan/dayShapes.ts`, refreshable seasonally — **not** generated at runtime). Ship these four to start:

- `daymaker` — the default for **Make My Day** (balanced, all-day, anchor-agnostic).
- `coastal` — "Classic Coastal" (Waterfront → Downtown).
- `funk` — "Funk Zone & Wine."
- `arts` — "Arts & State St."

Each skeleton declares, **per block**, the kind of stop to fill it with (a category/`occasion_tag` hint + an optional area hint), plus a caption and a default anchor set. Example shape (illustrative — author the real four against the live `things`):

```ts
{
  id: 'coastal',
  name: 'Classic Coastal',
  caption: 'An easy day along the water and up through the old town.',
  anchorZones: ['waterfront', 'downtown'],
  slots: {
    morning:   { tags: ['outdoors_active'], areaHint: 'waterfront' },
    midday:    { tags: ['wine_food'],       areaHint: 'waterfront' }, // lunch bridge
    afternoon: { tags: ['arts_culture'],    areaHint: 'downtown'   },
    evening:   { tags: ['outdoors_active','wine_food'], areaHint: 'montecito' },
  }
}
```

### 3.2 The slotting function (pure, deterministic)
`lib/plan/buildDay.ts`: `buildDay(answers, dayShape, contentPool, pinned[]) → Stop[]`.

For each **active block** (derived from the user's selected periods — see §3.3):
1. If a **pinned** saved spot belongs in this block, place it (locked, badged `♥ Saved`). Skip to next block.
2. Otherwise pick the best `thing` from `contentPool` where: it matches the skeleton slot's `tags` **and** the user's chosen vibe tags (if any) **and** sits in/near the anchor zone (if not "Anywhere") **and** is available for the chosen date (dated events) or is evergreen.
3. **Rank:** dated event on the chosen date first → then evergreen; prefer anchor-zone match; prefer vibe match; **never repeat a `thing`** already placed in the day; prefer stops geographically near the day's other stops (keep it walkable/short-drive, not zig-zagging).
4. **Always fill — never a blank stop.** If nothing matches, fall back down the skeleton's tag list, then to a hand-written evergreen for that zone. If a block genuinely cannot be filled, **drop the block** rather than show an empty node. (Mirror the "hero is never blank" rule, §2.5.)

`contentPool` is the **already-published, already-blurbed `things`** from Supabase (the nightly pipeline's output). No Claude call here. Blurbs, tags, photos — all pre-computed. This is what keeps Plan deterministic.

**Make My Day** = `buildDay(defaultAnswers, dayShapes.daymaker, pool, [])` with today's date, all periods, no vibe filter, anchor = none. One tap, instant.

### 3.3 The block model (and why the spine shows "Midday")
Canonical blocks: `morning · midday · afternoon · evening · night`.

- The **setup** exposes only **Morning · Afternoon · Evening · Night** as selectable coverage (Midday is intentionally *not* a button).
- **Midday is an auto lunch-bridge:** it is included **only when both Morning and Afternoon are covered**, to seat lunch between them. This is why the mockup spine shows a midday stop from a Morning/Afternoon/Evening selection. It is filled by a `wine_food`/food `thing`.
- The spine renders **one stop per active block**.

> **Important — `tod` vocabulary.** The DB `tod` enum is `morning · afternoon · evening · late`. There is **no "night"** and **no "midday"** in the enum.
> - UI **"Night" → `tod='late'`**.
> - **"Midday"** is a planner-only bridge concept, *not* a stored `tod`; a midday stop is just a food/`wine_food` `thing` seated in the lunch position.

---

## 4. Mappings (UI ↔ schema) — use these exactly

| UI control | Value(s) | Maps to |
|---|---|---|
| **When** (segmented, single) | Today / Tomorrow / Pick a date | a date (drives dated-event availability) |
| **Where** (picker row → sheet, single) | Downtown / Funk Zone / Waterfront / The Mesa / Montecito / Goleta / **Anywhere** | `nearby_zone`: `downtown` / `funk` / `waterfront` / `mesa` / `montecito` / `goleta` / **none** |
| **Time of day** (multi, always visible) | Morning / Afternoon / Evening / Night | `tod`: `morning` / `afternoon` / `evening` / **`late`** (+ midday bridge per §3.3) |
| **Who** (single, in Fine-tune) | Solo / Couple / Family / Friends | soft signal for ranking (e.g. Family ⇒ favor `family_day`-tagged, stroller-OK); not a hard filter |
| **Vibe** (multi, **8**, in Fine-tune) | Outdoors / Wine & Food / Arts & Culture / Date Night / Catch a Show / Nightlife / Showing Visitors / Free SB | `occasion_tag`: `outdoors_active` / `wine_food` / `arts_culture` / `date_night` / `catch_a_show` / `nightlife` / `hosting_visitors` / `free_sb` |

The vibe set is **eight of the ten** `occasion_tag`s. **`solo` and `family_day` are deliberately excluded** because they would duplicate the **Who** selector right above them — keep them out of Vibe to avoid two controls collecting the same signal.

---

## 5. The phases

> For **every** phase: **plan mode first.** Then build only that phase. Then **stop**, run the dev server, tell Jim what changed and exactly what screen/URL to look at, and **wait for his visual approval** before the next phase. Commit with the message given. Never hardcode a hex (Appendix A). a11y is built in per Appendix F, not bolted on at the end.

---

### Phase 0 — Reconcile the contract (`CLAUDE.md`)
**Goal:** the always-loaded contract reflects that Plan is an approved V1 surface, so no future session re-flags it. **No app code in this phase.**

Edit `CLAUDE.md`:
- **§9 "Removed in v9":** remove *"the My Plan itinerary builder · timed/sequenced plans"* from the Removed list. Add a one-line note: *"v9.1 — the **Plan** surface (a single-day planner) supersedes the My Plan removal; see `docs/plan-feature/`. It stays no-accounts, batch-AI-only, no transactions, no `.ics`, no map."*
- **§9 V1 list:** add a **Plan** bullet describing the surface (setup → spine → swap → build-from-saved → save → view-only share).
- **§9 Explore bullet:** change the One Perfect SB Day line to note it now lives in Plan as **"Make My Day."**
- **§3 v9 note:** update the "no Map or My Plan tabs" line to: *"three browse tabs (Explore · Saved · Discover SB) + one raised **Plan** action button. No Map tab."*
- **§4 source-of-truth table:** add `docs/plan-feature/SBDaymaker_Plan_Mockup.html` (visual target for Plan) and `docs/plan-feature/SBDaymaker_Plan_Build.md` (this spec).

**Acceptance:** `CLAUDE.md` no longer forbids the planner; the Plan surface is described in V1; One Perfect SB Day is noted as relocated. Show Jim the diff summary in plain language.
**Commit:** `docs: reconcile v9 contract — Plan surface approved, supersedes My Plan removal`

---

### Phase 1 — The raised Plan button + `/plan` shell
**Goal:** a raised **Plan** action button sits in the bottom bar on every screen and opens an (empty) Plan route. The three browse tabs are unchanged.

- Match the existing nav/routing pattern. Bottom bar becomes **four cells**: Explore · Saved · **Plan (raised)** · Discover SB. The raised button is a circular **terracotta→gold** gradient button, lifted above the bar, carrying the **sun mark** (use the inline SVG from the mockup's `.fab`), label **"Plan"** in the `--terra-text` variant. It must read as "create," not "browse."
- Add the **`/plan`** route (or the equivalent shell view, matching how Explore/Saved/Discover are routed). For now: just the **header** — logo mark + **"Plan"** + tagline *"Build your Santa Barbara day"* + a **My plans** collapsible button (stub, top-right) — and an empty body.
- The Saved tab keeps its count badge behavior.

**Acceptance:** every screen shows the four-cell bar with the raised Plan button; tapping it opens `/plan`; the three browse tabs still work; narrow-viewport/phone check passes; focus ring + 44px target on the Plan button.
**Commit:** `feat(nav): raised Plan action button + /plan route shell`

---

### Phase 2 — Types, itinerary store, day-shapes & the slotting engine
**Goal:** all the non-visual plumbing. No new screen.

- **Types** (`lib/plan/types.ts`): `Itinerary`, `Stop`, `DayShape`, `Block` (`'morning'|'midday'|'afternoon'|'evening'|'night'`), `PlanAnswers`. See Appendix C.
- **Store** (`hooks/useItineraries.ts`): `localStorage`-backed CRUD for itineraries (`list/get/save/update/remove`), same pattern as the existing saves store. Read **want-to-go** items from the existing saved store (do not duplicate it).
- **Day-shapes** (`lib/plan/dayShapes.ts`): the four hand-authored skeletons (§3.1), authored against the **live published `things`**.
- **Slotting engine** (`lib/plan/buildDay.ts`): the pure `buildDay()` from §3.2 + the block model from §3.3 + the mappings from §4. Deterministic; no network, no AI.
- **Tokens:** add the time-of-day spine tokens to `sbdaymaker_tokens.css` + Tailwind (don't hardcode): `--tod-morning:#3D8AA0; --tod-midday:#2D7D8F; --tod-afternoon:#7E8B6B; --tod-evening:#E0A82E; --tod-night:#0E3C49;` (morning/midday are formalized hero-family values; afternoon/evening/night reuse sage/gold/pacific-dark). Flag, don't invent, anything else missing.

**Acceptance:** `buildDay()` returns a sensible filled day for each shape against dev content; pinned-first and "never blank" both hold; itineraries round-trip through `localStorage`; no console errors. (Show Jim a quick console/log demo or a temporary debug print — no UI needed yet.)
**Commit:** `feat(plan): itinerary types, store, day-shapes + deterministic slotting engine`

---

### Phase 3 — Setup screen (Make My Day + essentials + Fine-tune)
**Goal:** the full setup screen, matching mockup **State 1** (the "Option C" hero-first, low-density layout — **not** a five-group form). The mockup is the pixel target: match its layout, spacing, type, and the controls below exactly; translate its hardcoded hex into the existing tokens (don't copy hex — match by token, §8.2). When it renders, put it beside the mockup and reconcile every visible difference before declaring the phase done.

The screen, top to bottom:
- **Make My Day** flagship card (terracotta→gold, sun glyph, *"Short on time?"* eyebrow, one-line subtitle). Tapping it runs `buildDay(default…)` (today, all periods, no vibe filter, anchor = none) and routes to the spine (Phase 4). This is the zero-effort path; everything below is **optional**.
- **"or shape it yourself"** divider.
- **When** — a **segmented control** (single-select): Today · Tomorrow · Pick a date. Default Today. (Not pills — a segmented switch, per the mockup.)
- **Where** — a single **selector row** showing the current value (default *"Anywhere ▾"*) that opens the **neighborhood picker** sheet (`nearby_zone` + Anywhere; reuse the existing anchor/Near-Me zone list). Single-select. (Not inline pills.)
- **Time of day** — directly **beneath Where**, an **always-visible multi-select** row, full-width 4-up: Morning · Afternoon · Evening · Night (**no Midday button** — Midday is the auto lunch-bridge, §3.3). Section label reads exactly **"Time of day."**
- **Saved hook** — *"Have spots saved already? · Pin them into your day →"*. **Render only when want-to-go count > 0.** Opens the build-from-saved picker (Phase 6).
- **Fine-tune (collapsed by default)** — a centered **"＋ Fine-tune your day"** expander. When opened it reveals two groups: **Who** (single, full-width 4-up: Solo · Couple · Family · Friends) and **Vibe** (multi, the **full 8-vibe set** — see §4). Collapsed on landing so the screen stays light.
- **"Show me my day →"** CTA — runs `buildDay(answers…)` and routes to the spine.
- **My plans** drawer button (top-right) — opens the saved-itineraries drawer (wired in Phase 7).

> **Why this shape:** the hero already serves the frictionless path, so the questions are an honest, clearly-optional refinement, not a mandatory form. Only the two inputs that genuinely steer the engine — **When** and **Where** — plus **Time of day** show by default; the soft signals (Who, Vibe) stay folded away. Landing density drops from ~22 buttons to ~4 controls.

**Acceptance:** matches State 1; segmented When clears siblings on select; Where opens the picker and reflects the chosen zone; Time of day multi-select toggles and is always visible beneath Where; Fine-tune expands/collapses and reveals Who (single) + the 8 vibes (multi); saved hook hidden when nothing is saved; both Make My Day and the CTA land on the spine; keyboard + focus + 44px throughout; side-by-side with the mockup reconciled.
**Commit:** `feat(plan): setup screen — Make My Day, essentials, Fine-tune (Option C)`

---

### Phase 4 — The itinerary spine + day-shape selector (the signature)
**Goal:** the results screen, matching mockup **State 3** — the spine is the signature element; get it right.

- **`DayShapeSelector`** — 2–3 day-shape **pills** (horizontal scroll); the active pill's day renders below; switching re-runs `buildDay()` for that shape (keeping the same answers) and updates the caption.
- **`ItinerarySpine`** — a vertical **rail** that warms top→bottom using the tod tokens: `linear-gradient(180deg,var(--tod-morning),var(--tod-midday) 32%,var(--tod-afternoon) 64%,var(--tod-night-or-evening))`. One **node** per block (28–30px circle, block tod-token fill, emoji glyph: morning 🌅 · midday ☀️ · afternoon ⛅ · evening 🌆 · night 🌙).
- **`SpineStopCard`** — thumb (image via the **existing image resolver**, lazy, alt text) + body (block + time label, Fraunces title, area/meta) + a control cluster: **ⓘ** and the save **heart** grouped top-right, the **Swap** pill below them (per the mockup — keeps the title from being squeezed). A `♥ Saved` chip when the stop came from the user's saved list. The whole card body taps through to **detail** (reuse the existing detail screen).
- Time labels: Morning · 9–11 AM / Midday · 12–2 PM / Afternoon · 2–5 PM / Evening · 6–8 PM / Night · 9 PM+.
- Bottom bar: **💾 Save plan** (primary) + **↗ Share** (secondary) — wired in Phases 7–8.
- **Reduced motion:** the rail and nodes are static under `prefers-reduced-motion`.

**Acceptance:** matches State 3; day-shape pills swap the spine; nodes colored by block; ⓘ + heart + Swap present and tappable; card body opens the existing detail; images lazy-load with alt; reduced-motion static. Show Jim all 2–3 shapes.
**Commit:** `feat(plan): itinerary spine + day-shape selector`

---

### Phase 5 — Swap a stop
**Goal:** the swap sheet, matching mockup **State 4**.

- Tapping **Swap** on a stop opens a bottom sheet titled with the block (e.g. *"Afternoon · 2–5 PM"*).
- **"From your saved list"** section first — want-to-go spots valid for this block, each with a gold `♥ Saved` badge; then **"More ideas"** — ranked alternates from `buildDay`'s candidate logic for that slot.
- Each row: tap to **select** (updates the spine + itinerary state, closes sheet); a small **ⓘ** opens detail first (per the mockup). The current stop shows a check.
- Selecting from saved marks the new stop with the `♥ Saved` chip on the spine.

**Acceptance:** matches State 4; saved-first ordering; one-tap select updates the spine and persists; ⓘ opens detail without selecting; current selection checked; 44px hit areas; focus order sane.
**Commit:** `feat(plan): swap-a-stop sheet with saved-first alternates`

---

### Phase 6 — Build from saved (the pin flow)
**Goal:** the picker, matching mockup **State 2**.

- Opened by the setup saved hook. A sheet titled **"Build around your saved"**, drawn from **want-to-go** items.
- Each item shows a **natural-block chip** (e.g. *→ Evening*) derived from its `tod`/category, a multi-select check, and an **ⓘ** for detail.
- **"Build my day around these (n) →"** runs `buildDay(answers, shape, pool, pinned)` with the chosen items as `pinned`; pinned spots land in their natural block (badged), the engine fills the rest; routes to the spine.
- Helper line: *"We'll fill the empty blocks with picks nearby."*

**Acceptance:** matches State 2; multi-select works; ⓘ opens detail; build routes to a spine where pinned spots are present, badged, in-block, and the gaps are filled with nearby picks; respects the user's other answers.
**Commit:** `feat(plan): build-from-saved pin flow`

---

### Phase 7 — Save + Saved › Days + My-plans drawer
**Goal:** itineraries persist and have a home.

- **Save plan** (spine bottom bar) writes the itinerary to `localStorage` via `useItineraries`. Auto-title from the day-shape (e.g. *"Classic Coastal Day"*), editable inline.
- **Saved page gains a `Things · Days` toggle.** **Things** = the existing saved spots view (unchanged). **Days** = saved itineraries, each row a **mini spine preview** (the colored block dots) + title + date + stop count; tap → reopen that itinerary in the spine for editing.
- **My plans drawer** (Plan header, top-right) reads the **same** itinerary store; each row opens its itinerary. Footer note: *"These also live in Saved › Days."* (One store, two entry points — no second source of truth.)

**Acceptance:** save persists across reload; Saved shows Things/Days; Days rows preview + open + edit; the Plan drawer matches Saved › Days; deleting a plan removes it from both.
**Commit:** `feat(saved): Days view + plan persistence + My-plans drawer`

---

### Phase 8 — Share (view-only) + Save this plan
**Goal:** a locked-down public plan link, matching mockup **State 6**.

- **Schema:** add `'shared_plan'` to the `shared_state_kind` enum (migration: `alter type shared_state_kind add value if not exists 'shared_plan';`). This is the **only** DB change in the whole build. Run it as a Supabase migration; do not edit other tables.
- **Share** (spine bottom bar) writes a **denormalized snapshot** to `shared_states` (`kind='shared_plan'`, `email` **NULL**, `payload` = the plan snapshot, Appendix C) and produces a `/p/[token]` URL handed to the **native share sheet** (same pattern as the saved-list share). **No recipient PII** (§8.6).
- **Public route `/p/[token]`** — outside the app shell (no bottom nav). A `--pacific-dark`→`--pacific` header with the wordmark, a **🔒 View-only** chip, the plan title, *"Shared by …"*, date + stop count; then the spine **read-only** (Details › on each card, **no Swap, no edit-heart**); a sticky footer with **"❤️ Save this plan"** (copies the snapshot into the opener's `localStorage` itineraries) and *"Make your own day in SB Daymaker →"*.
- Sliding expiry via the existing `last_accessed_at` reaper — touch it on read.

**Acceptance:** matches State 6; sharing writes one `shared_states` row with no email; `/p/[token]` renders read-only with working Details; "Save this plan" creates an editable copy in the opener's Days; the enum migration is the only schema change; no key/secret in client code.
**Commit:** `feat(plan): view-only shared plan link + Save this plan (shared_states)`

---

### Phase 9 — Detail access, a11y & reduced-motion pass
**Goal:** every "things" card reaches detail the same way, and the whole surface clears AA.

- **Detail access, one rule (per the mockup):** spine cards open on **body tap** *and* carry **ⓘ**; selection cards (picker + swap) carry **ⓘ** (tap-row = pick); shared cards show **Details ›**. Wire all of these to the **existing** detail screen.
- **a11y (Appendix F):** the small ⓘ has a **≥44px hit area** (padding, not visual size) and `aria-label="See details for {title}"`; heart `aria-label="Save {title}"/"Saved {title}"`; Swap `aria-label="Swap {block} stop"`; selection rows expose pressed/selected state; visible `:focus-visible` rings everywhere; multi-selects use `aria-pressed`; the spine rail/nodes are static under `prefers-reduced-motion`; images carry meaningful `alt` (or `alt=""` if decorative); contrast handled by tokens (small text Ink/Ink-2/Pacific only).

**Acceptance:** keyboard-only walk of the entire Plan flow works; every card opens detail; reduced-motion shows static states; an axe/Lighthouse a11y pass is clean (note any deferrals to Jim).
**Commit:** `a11y(plan): detail access wiring, focus, reduced-motion, labels`

---

### Phase 10 — Empty/edge states, fallbacks & final QA
**Goal:** it never dead-ends, and it ships clean.

- **Empty want-to-go:** saved hook hidden (Phase 3); the picker, if reached, shows in-voice empty copy.
- **Thin inventory:** per-slot evergreen fallback (§3.2); never a blank node; drop a block that truly can't fill.
- **Loading:** skeleton placeholders (match the app's existing skeletons) while content/shape resolve — no spinners.
- **Voice:** empty/edge copy in the house voice (a knowing local friend, with the nerve to say "skip it"), never generic.
- **Constraint self-check** before declaring done: no accounts (localStorage only) · no per-tap AI · no transactions · **no `.ics`** · no map · tokens only · PII boundary clean · 44px targets · reduced-motion. Report the check to Jim.
- **Final visual QA** against all six mockup states on a phone-width viewport.

**Acceptance:** every empty/edge path resolves gracefully; the constraint self-check passes and is reported; the six states match the mockup on mobile.
**Commit:** `feat(plan): empty/edge states, fallbacks, final QA`

---

## Appendix A — Tokens (never hardcode)
Mirror `sbdaymaker_tokens.css` into Tailwind; pull every color/font/space/radius from tokens. New tokens this build adds: the five `--tod-*` spine colors (Phase 2). If anything else seems missing, **flag it — don't invent it** (§8.2). The mockup hardcodes hex because it's a standalone prototype; the app must not.

## Appendix B — Setup layout cribsheet (Option C)
Match the mockup's **State 1** exactly. Order: Make My Day → divider → **When** → **Where** → **Time of day** → saved hook → **Fine-tune** (collapsed) → CTA.
- **When**: a **segmented control** (single) — `--plaster-2` track, 3px padding, active segment = white fill + `--pacific` text + soft shadow; min-height 44px.
- **Where**: a single **selector row** (border `1.5px var(--line)`, `--paper` fill, radius 13px, min-height 44px) showing *"Anywhere ▾"*; tap opens the neighborhood picker sheet; single-select.
- **Time of day** (always visible, beneath Where) and **Who** (inside Fine-tune): **full-width 4-up** rows — equal-width columns (`flex:1`), icon-over-label, ~12px label, min-height 44px; selected = `--pacific` fill, white text. Time of day is multi-select; Who is single.
- **Vibe** (inside Fine-tune): wrapping pills, **8 tags** (§4); multi-select; same button base.
- **Section labels** ("When", "Where", "Time of day", "Who's with you", "Vibe"): small uppercase `--sage` eyebrows.
- **Fine-tune**: centered text button *"＋ Fine-tune your day"* with a caret; toggles a panel (`display:none` → block) holding Who + Vibe; collapsed on landing.
- Question button base: `1.5px var(--line)` border, `--paper` fill, `--ink-2` text, radius 13px, **min-height 44px**; selected = `--pacific` fill, white text.
- Make My Day card + spine cards + the ⓘ cluster: copy geometry from the mockup.

## Appendix C — Data shapes
```ts
type Block = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

interface Stop {
  block: Block;
  thingId: string;     // FK into published `things`
  pinned: boolean;     // true if user-pinned from saved
  fromSaved: boolean;  // drives the ♥ Saved chip
}

interface Itinerary {
  id: string;          // local uuid
  title: string;       // auto from day-shape, editable
  dateISO: string;
  blocks: Block[];     // active blocks
  dayShapeId: string;
  stops: Stop[];
  createdAt: string;
  updatedAt: string;
}

interface PlanAnswers {
  dateISO: string;
  periods: ('morning'|'afternoon'|'evening'|'late')[]; // 'late' = UI "Night"
  who: 'solo'|'couple'|'family'|'friends';
  vibes: ('outdoors_active'|'wine_food'|'arts_culture'|'date_night'|'catch_a_show'|'nightlife'|'hosting_visitors'|'free_sb')[]; // 8 vibes; excludes solo & family_day (covered by `who`)
  zone: 'downtown'|'funk'|'waterfront'|'mesa'|'montecito'|'goleta'|null; // null = Anywhere
}

// shared_states.payload when kind='shared_plan' (denormalized snapshot — opener needs no DB join, no user localStorage):
interface SharedPlanPayload {
  title: string;
  dateISO: string;
  stops: Array<{
    block: Block;
    timeLabel: string;          // "Afternoon · 2–5 PM"
    title: string;
    area: string;
    blurb: string;
    category: string;
    thingId: string;            // lets the opener deep-link to the live detail if present
  }>;
}
```

## Appendix D — Slotting (restated)
`buildDay(answers, dayShape, pool, pinned)`: per active block — place a matching pinned spot if any, else rank `pool` by (dated-on-date → evergreen) ∩ slot tags ∩ answer vibes ∩ anchor zone, de-dupe within the day, prefer geographic coherence; always fill or drop. Midday only when morning+afternoon both active. Pure function, no I/O.

## Appendix E — Mappings
See §4. UI "Night" → `tod='late'`; "Midday" is a bridge, not a `tod`; vibe → `occasion_tag`; Where → `nearby_zone` (Anywhere = none).

## Appendix F — a11y checklist (per component)
44px targets (incl. ⓘ hit area) · `:focus-visible` Pacific ring · keyboard operable · `aria-label`s (ⓘ/heart/Swap/select) · `aria-pressed` on multi-selects · static under `prefers-reduced-motion` (rail, nodes, sheet) · meaningful `alt` / `alt=""` · small text Ink/Ink-2/Pacific only.

## Appendix G — Guardrails (do NOT add)
No accounts/login · no per-tap AI · no in-app transactions · **no `.ics`/calendar export** · no map/Mapbox · no new PII (shared link stores none) · no hardcoded hex. If a phase seems to need any of these, **stop and ask Jim** (§8.7).

## Appendix H — Mockup states → phases
State 1 Setup → P3 · State 2 Build-from-saved → P6 · State 3 Your day (spine) → P4 · State 4 Swap → P5 · State 5 My-plans drawer → P7 · State 6 Shared (view-only) → P8. Detail-access affordances across all → P9.

---

*End of build spec. Build it phase by phase; show Jim the rendered result after each; keep `CLAUDE.md` current (Phase 0 already does).*
