# First-Run Tutorial — Current Frontend Surface Spec

> **Purpose.** A code-accurate map of the *live* SB Daymaker frontend, written to design a first-visit
> coach-mark / onboarding overlay. **Code is truth.** Where the running code diverges from `CLAUDE.md`
> or `02b_SBDaymaker_Wireframe.html`, the divergence is flagged with **⚠ delta**.
>
> Read-only survey — nothing here was changed. Generated 2026-07-03 against `main` @ `caa7302`.

## Table of contents

1. [App shell & navigation](#1-app-shell--navigation)
2. [Per-section surface inventory (+ first-visit state)](#2-per-section-surface-inventory)
3. [Interactive affordance inventory (coach-mark targets)](#3-interactive-affordance-inventory)
4. [First-visit detection & state](#4-first-visit-detection--state)
5. [Reusable UI infrastructure](#5-reusable-ui-infrastructure)
6. [Tokens & primitives](#6-tokens--primitives)
7. [Analytics](#7-analytics)
8. [Constraint check for the tutorial](#8-constraint-check-for-the-tutorial)
9. [Anchor gaps to fix before building](#9-anchor-gaps-to-fix-before-building)

---

## 1. App shell & navigation

### The frame

Three browse sections live under the Next.js route group `app/(app)/`, which supplies the shared shell
in [app/(app)/layout.tsx](../../app/(app)/layout.tsx):

```
.sbd-shell
 ├─ <a href="#main" class="sbd-skip">Skip to content</a>
 ├─ <BrandHeader/>            ← sticky brand chrome
 ├─ <main id="main" class="sbd-shell__main"> {children} </main>
 └─ <BottomNav/>             ← fixed bottom tab bar
```

- **`.sbd-shell` is hard-capped at `max-width: 480px`** ([app/components.css:1033](../../app/components.css#L1033)) — the app is
  a phone-width column even on desktop. Tablet/desktop layouts are deferred to Phase 2.

### How sections switch — **client-routed pages, not tab state**

Navigation is real Next.js routing via `<Link>`, not in-memory tab state. [BottomNav.tsx:89](../../components/app/BottomNav.tsx#L89)
reads `usePathname()` and marks the active tab.

| Label | Route | Page component | Active rule |
|---|---|---|---|
| **Explore** | `/` | [app/(app)/page.tsx](../../app/(app)/page.tsx) → `ExploreClient` | `pathname === "/"` |
| **Saved** | `/saved` | [app/(app)/saved/page.tsx](../../app/(app)/saved/page.tsx) → `SavedClient` | `pathname.startsWith("/saved")` |
| **Discover SB** | `/discover` | [app/(app)/discover/page.tsx](../../app/(app)/discover/page.tsx) | `pathname.startsWith("/discover")` |

Tab order is `Explore · Saved · Discover SB`, defined in the `TABS` array at [BottomNav.tsx:79](../../components/app/BottomNav.tsx#L79).
Each tab is an icon+label cell (`.sbd-nav__btn`); Saved shows a count badge (`.sbd-nav__badge`) when `counts.total > 0`.

> **⚠ delta — a Plan icon exists in code but is NOT a tab.** `BottomNav` defines a fourth `plan` SVG icon
> ([BottomNav.tsx:57](../../components/app/BottomNav.tsx#L57)) but the `TABS` array only lists three. Plan is reached by CTA
> (see §2), consistent with CLAUDE.md §9. The icon is dormant.

### Global chrome present on every browse screen

- **`BrandHeader`** ([components/BrandHeader.tsx](../../components/BrandHeader.tsx)) — sticky "Golden Hour" header: a mark
  (`.sbd-brandhdr__mark` with animated `.sbd-brandhdr__sun`/`.sbd-brandhdr__glint`), the "Santa Barbara / Daymaker"
  wordmark linking to `/`, and a decorative `.sbd-brandhdr__horizon` band. This is the **actual** header — see delta below.
- **`BottomNav`** — the fixed three-tab bar (`.sbd-nav`, z-index 60).

> **⚠ delta — `components/app/AppHeader.tsx` is dead code.** It renders `.sbd-header` ("SB Daymaker /
> Santa Barbara, daily") but is imported by **no** JSX; the shell uses `BrandHeader` instead. Don't attach
> a coach mark to `AppHeader`. (The Plan surface uses its own `PlanHeader` = `.sbd-header .sbd-plan-header`.)

Routes **outside** the `(app)` shell (no brand header / bottom nav): `/plan`, `/thing/[id]`, `/discover/[id]`,
`/s/[token]` (shared list), `/p/[token]` (shared plan), `/submit`, `/confirm`, `/unsubscribe`, `/offline`,
and everything under `/admin` + `/cockpit`. The tutorial should scope itself to the `(app)` shell.

---

## 2. Per-section surface inventory

Render order top→bottom, with the first-visit / zero-state noted for each.

### 2A. Explore (`/` → `ExploreClient`)

State lives in [ExploreClient.tsx](../../components/explore/ExploreClient.tsx). **First-visit defaults:**
`horizon = "today"` (L42), `lens = null` / "Any vibe" (L41), `zone = null` / "Anywhere" (L43), Tune sheet closed (L44).

| # | Surface | Purpose | Source | First-visit state |
|---|---|---|---|---|
| 1 | **Golden-hour Hero** | Full-bleed sky + weather + top "pick" card; sun tracks time of day | [Hero.tsx](../../components/explore/Hero.tsx) | Renders immediately; sky variant from real clock/weather; shows one hero pick if the feed has ranked content, else no pick card |
| 2 | **Condition chips** | Weather (icon+temp) + sunset / "min of gold left" | [ConditionChips.tsx](../../components/explore/ConditionChips.tsx) | Shown inside hero sky |
| 3 | **Control row** | Horizon segmented control + Tune button | [ControlRow.tsx](../../components/explore/ControlRow.tsx) | Horizon = "Today"; Tune shows no active-filter dot |
| 4 | **Cascade feed — Lead (Tier 1)** | "Happening Today/This Week/This Month" — layout swaps by horizon (list / day-rail / rock-grid) | [CascadeFeed.tsx](../../components/explore/CascadeFeed.tsx) | Today list cards |
| 5 | **"Build your day" CTA** | Link to `/plan` (Today horizon only) | [CascadeFeed.tsx:171](../../components/explore/CascadeFeed.tsx#L171) | Visible on Today |
| 6 | **Tier 2 — "Every week"** | Recurring events, collapsible | CascadeFeed.tsx:186 | **Collapsed** by default |
| 7 | **Tier 3 — "Anytime in SB"** | Evergreen venues, collapsible | CascadeFeed.tsx:221 | **Collapsed** by default |
| 8 | **Empty state** | "Nothing matches that combination…" + reset | CascadeFeed.tsx:137 | Only if all three tiers empty for the filter combo |
| 9 | **Email signup + Submit footer** | Digest opt-in; "submit a happening" link | [EmailSignup.tsx](../../components/signup/EmailSignup.tsx) | Always at feed foot |

> **⚠ delta — One Perfect SB Day is not rendered anywhere.** `OnePerfectDayCard` ([components/explore/OnePerfectDayCard.tsx](../../components/explore/OnePerfectDayCard.tsx))
> exists but is imported by **no** component (orphaned). CLAUDE.md §9 says OPD moved to Plan as a "Make My Day"
> button — but `grep` finds **no "Make My Day" in the Plan code either**. So OPD/"Make My Day" is currently
> **absent from the live UI**; a tutorial must not point at it.

> **⚠ delta — "Lens" and "Near Me" are merged into one Tune sheet on Explore.** The wireframe treats the Lens
> (occasion tags) and Near Me (neighborhood sort) as separate surfaces. Live Explore folds both into a single
> **TuneSheet** ("Vibe & location") opened by the Tune button. `LensSheet.tsx` exists but is **dead code**
> (imported nowhere). `NearMeSheet.tsx` is used **only on Saved**, not Explore.

### 2B. Saved (`/saved` → `SavedClient`)

Source: [SavedClient.tsx](../../components/saved/SavedClient.tsx). **This is empty on first visit — the most important
onboarding surface.**

**First-visit empty state** (`counts.total === 0`, [SavedClient.tsx:221](../../components/saved/SavedClient.tsx#L221)):

```
EmptyState  icon "❤️"
  title:   "Your saved list"
  message: "Nothing saved yet. Tap the heart on anything you love and it'll
            live right here — on this device, no account needed."
```

Renders `<EmptyState>` ([components/ui/EmptyState.tsx](../../components/ui/EmptyState.tsx), `.sbd-empty`). **Nothing else renders** — no
toggle, no Near Me, no Build-a-day, no share, no restore. All of those are gated on having saves.

Once saves exist, render order is: status line → Want/Been toggle (+ Near Me at ≥4) → C2 "Did you make it?"
prompt (Want tab) → MemoryRecap (Been tab) → grouped saved cards → Build-a-day / Share-my-list / Restore stack.

### 2C. Discover SB (`/discover`)

Source: [app/(app)/discover/page.tsx](../../app/(app)/discover/page.tsx). Two guide groups, each a `.sbd-disc__head` + a list of
`GuideCard`s: **"By neighborhood"** (Know the city block by block) then **"By theme"** (Ways to spend a day).

**First-visit state:** if no guides are published, a single `EmptyState` ("Guides are on the way…",
[discover/page.tsx:16](../../app/(app)/discover/page.tsx#L16)). Otherwise the two guide rails render (server-rendered/ISR, no client state).

> **No passport / stamp / "been there" completion UI exists anywhere.** Confirmed absent from `discover/page.tsx`,
> `discover/[id]/page.tsx`, and `GuideCard.tsx`. (The "stamp" class in `admin/review` and `shortStamp` date helper
> are unrelated.) If the tutorial promises a collectible/passport mechanic, that feature does not yet exist.

### 2D. Plan (`/plan` — CTA-reached, outside the shell)

Entered from **"Build your day"** on Explore and **"Build a day from your saved →"** on Saved (both `href="/plan"`).
[PlanSetup.tsx](../../components/plan/PlanSetup.tsx) asks When / Where / Time-of-day (+ fine-tune Who / Vibe), then
[PlanResults.tsx](../../components/plan/PlanResults.tsx) shows the editable day spine with a Share + Clear go-bar.

> **⚠ delta — several Plan components are dead code:** `DayShapeSelector`, `MyPlansDrawer`, `SaveNameSheet`,
> `SwapSheet`, `PinPickerSheet` are imported by nothing live. (`DayShapeSelector` absence matches CLAUDE.md's
> "no day-shape pills" rule.) Not tutorial targets.

---

## 3. Interactive affordance inventory

The critical section — every element a coach mark might attach to, with its **stable anchor**. Anchors are
quoted from code. "⚠ NO STABLE ANCHOR" = one must be added before targeting.

> **Repo-wide reality:** the public app uses **almost no `data-*` attributes** — the only ones are two
> `data-tooltip` (on `SaveHeart` and `SavedCard`). Coach marks must therefore target **classNames + aria-\***,
> or we add `data-tour="…"` hooks. IDs that exist: `#main`, `#explore-tier2`, `#explore-tier3`,
> `#plan-when-label`, `#plan-finetune-panel`, `#sbd-plan-name`.

### 3A. The golden-hour hero

| Element | What | Anchor | File |
|---|---|---|---|
| Hero container | Sky + pick | `class="sbd-hero sbd-hero--{variant}"` (variant = morning/afternoon/evening/night/gray) | [Hero.tsx:49](../../components/explore/Hero.tsx#L49) |
| **Sun orb** | The signature tracking sun | `class="sbd-hero__sun"` `aria-hidden` | Hero.tsx:54 |
| Skyline | SB silhouette SVG | `class="sbd-hero__range"` | Hero.tsx:68 |
| Date/daypart | "Good morning" etc. | `class="sbd-hero__date"` › `.sbd-hero__daypart` | Hero.tsx:76 |
| Hero pick card | Featured happening | `class="sbd-hero__pick"` (title link → `/thing/{id}`) | Hero.tsx:84 |
| Hero pick heart | Save the pick | `class="sbd-heart sbd-heart--overlay"` + `aria-pressed` + `aria-label="Save {title}"` | via `SaveHeart` |

### 3B. Save / heart control (the core "save" gesture)

One shared component, [SaveHeart.tsx:53](../../components/ui/SaveHeart.tsx#L53). **This is how a save happens** — tap the heart →
`useSaves().toggle(id)` → writes `localStorage["sbd.saves.v1"]` as state `"want"`.

- Anchor: `class="sbd-heart"` (or `sbd-heart--overlay`), `aria-pressed={saved}`,
  **`aria-label="Save {title}" / "Saved {title}"`**, `data-tooltip` (optional).
- Rendered on: the hero pick; every feed card via **`CardActions`** ([CardActions.tsx:26](../../components/ui/CardActions.tsx#L26),
  `class="sbd-cardact__btn"`, save + share pair); the detail page uses **`DetailSaveButton`** (a text `Button`,
  variant `primary/secondary`) — **⚠ this one has no distinct class/id/aria hook** beyond the `Button` base.

### 3C. want → been toggle (how "been" is marked)

Two paths, both writing `setState(id, "been")` in [SavesProvider.tsx](../../components/saves/SavesProvider.tsx):

1. **Per-card "Mark been" button** on Saved: `class="sbd-savedcard__act sbd-savedcard__act--been"`,
   `aria-pressed={state === "been"}`, `aria-label="Mark {title} as been"` ([SavedCard.tsx:85](../../components/saved/SavedCard.tsx#L85)).
2. **Want/Been tabs** at top of Saved: `role="tablist" aria-label="Saved state"`; tabs
   `.sbd-saved-toggle__btn--want` / `--been`, `role="tab"`, `aria-selected` ([SavedToggle.tsx](../../components/saved/SavedToggle.tsx)).
   These *filter the view*; the "C2" prompt (`class="sbd-c2"`, "Did you make it to {title}?" with a `.sbd-c2__yes`
   button) is what flips state to been from the Want tab.

State lives entirely in `SavesProvider` (React context + `localStorage["sbd.saves.v1"]`), map of `id → "want"|"been"`.

### 3D. Horizon toggle (Today / This Week / This Month)

`SegmentedControl` in the control row: container `role="tablist" aria-label="Time horizon"`; each button
`role="tab" .sbd-seg__btn` with `aria-selected` and (for week/month) `aria-label="This Week"/"This Month"`.
Values `"today" | "week" | "month"` ([ControlRow.tsx:27](../../components/explore/ControlRow.tsx#L27)).

### 3E. Occasion tags / Lens + Near Me (the Tune sheet)

Tune button in control row: `class="sbd-ctrl__tune"`, `aria-haspopup="dialog"`, `aria-expanded={tuneOpen}`
([ControlRow.tsx:38](../../components/explore/ControlRow.tsx#L38)). Opens `TuneSheet` (a `BottomSheet`, `aria-label="Tune your day"`):

| Control | Anchor | File |
|---|---|---|
| "Any vibe" clear | `class="sbd-tune-any"` (`is-active` when lens=null) | [TuneSheet.tsx:46](../../components/explore/TuneSheet.tsx#L46) |
| Occasion tiles (6) | `class="sbd-tune-opt"` (identify by `.sbd-tune-opt__label` text — **no per-tile id**) | TuneSheet.tsx:54 |
| "Use my location" | `class="sbd-near-locate"` (geolocation) | TuneSheet.tsx:75 |
| Zone options (15 + Anywhere) | `class="sbd-near-opt"` | TuneSheet.tsx:91 |
| "Show results" | `class="sbd-tune-submit"` | TuneSheet.tsx:112 |

### 3F. Near Me sort (Saved only)

Separate control: `<button class="sbd-ctrl__near">` "Near Me" ([SavedClient.tsx:246](../../components/saved/SavedClient.tsx#L246)), shown only at
≥4 in-view items; opens `NearMeSheet`. (On Explore, Near Me is inside Tune — see §2A delta.)

### 3G. Happenings cascade cards

| Variant | When | Anchor | File |
|---|---|---|---|
| Hero pick | top-ranked | `.sbd-hero__pick` | Hero.tsx:84 |
| **List card** | Today + Tier 2/3 | `.sbd-card.sbd-card--interactive.sbd-listcard` (title link → `/thing/{id}`) | [Card.tsx:134](../../components/ui/Card.tsx#L134) |
| Day-rail card | This Week | list cards under `.sbd-daygroup` / `.sbd-dayhead` | [LeadDayRail.tsx](../../components/explore/LeadDayRail.tsx) |
| **Rock tile** | This Month | `.sbd-rock` (grid), "See N more" = `.sbd-rock-more` | [RockTile.tsx:22](../../components/explore/RockTile.tsx#L22) |
| Section header (collapsible) | Tier 2/3 | `.sbd-sh2--coll`, `aria-expanded`, `aria-controls="explore-tier2"`/`"explore-tier3"` | [SectionHeader.tsx](../../components/ui/SectionHeader.tsx) |

### 3H. Share

- **Card/detail share:** `CardActions` share button `class="sbd-cardact__btn"` `aria-label="Share {title}"`
  (shares single item; **same class as the save button** — distinguish by aria-label).
- **Saved multi-select share:** "Share my list" entry `class="sbd-share-list-btn"` → select mode → sticky
  `ShareBar` (`role="group" aria-label="Share selected"`, `.sbd-sharebar__share`) ([ShareBar.tsx](../../components/saved/ShareBar.tsx)).
  Uses `navigator.share()` w/ clipboard fallback ([share.ts](../../components/saved/share.ts)).
- **Plan share:** go-bar `class="sbd-btn sbd-btn--primary sbd-plan-gobar__share"` ([PlanResults.tsx:188](../../components/plan/PlanResults.tsx#L188)).

### 3I. Plan CTAs & spine

| Element | Anchor | File |
|---|---|---|
| "Build your day" (Explore) | `class="sbd-build-cta"` `aria-label="Build your day"` `href="/plan"` | [CascadeFeed.tsx:171](../../components/explore/CascadeFeed.tsx#L171) |
| "Build a day from your saved" | `class="sbd-build-cta"` `aria-label="Build a day from your saved"` | [SavedClient.tsx:370](../../components/saved/SavedClient.tsx#L370) |
| When control | `SegmentedControl aria-label="When are you out?"` | PlanSetup.tsx:105 |
| Time-of-day / vibe buttons | `.sbd-qbtn` w/ `aria-pressed` inside `role="group"` groups | PlanSetup.tsx |
| Build CTA | `.sbd-btn.sbd-btn--primary.sbd-btn--block` `disabled={!canBuild}` | PlanSetup.tsx:247 |
| Day spine / add-stop | `.sbd-spine`, `.sbd-section`, `.sbd-addslot` (`aria-label="Add a stop…"`) | [ItinerarySpine.tsx](../../components/plan/ItinerarySpine.tsx) |

### 3J. Discover SB

Guide cards: `<Link class="sbd-guidecard sbd-guidecard--{theme|hood}">` → `/discover/{id}` ([GuideCard.tsx:8](../../components/discover/GuideCard.tsx#L8));
group headers `.sbd-disc__head` / `.sbd-disc__title`. Guide detail has a numbered `.sbd-guide__stops` list and a
"What's on right now" live section. **No passport/stamp affordance to teach.**

---

## 4. First-visit detection & state

### localStorage / sessionStorage keys (all of them)

| Key | Storage | Shape | Purpose | Written by |
|---|---|---|---|---|
| `sbd.saves.v1` | local | `{ [thingId]: "want" \| "been" }` | The user's saves (the whole save system) | [SavesProvider.tsx:16](../../components/saves/SavesProvider.tsx#L16) |
| `sbd.itineraries.v1` | local | array of saved single-day plans | Plan surface persistence | [ItinerariesProvider.tsx:19](../../components/plan/ItinerariesProvider.tsx#L19) |
| `sbd_c2_dismissed` | local | `string[]` of thing IDs | Which "Did you make it?" prompts were dismissed | [SavedClient.tsx:39](../../components/saved/SavedClient.tsx#L39) |
| `sbd.open-plan` | **session** | one serialized plan | Hand-off of a saved plan into `/plan` | [SavedDays.tsx:19](../../components/saved/SavedDays.tsx#L19) |

### Is there any existing first-run / onboarding / splash code?

**No.** A repo-wide grep for `onboard / first-run / firstVisit / welcome / intro / tutorial / coachmark /
splash / hasSeen / seenBefore` finds nothing in the app (only `guide.intro` content and an email
`onboarding@resend.dev` from address). **The tutorial is greenfield** — no flag, no gate, no scrim to extend.

### How to reliably detect "first visit" (no accounts, localStorage only)

- There is **no dedicated flag today** — one must be introduced (e.g. `sbd.tour.v1 = "seen" | dismissed-step`).
- A pragmatic "brand-new user" heuristic already available: **`useSaves().hydrated === true && counts.total === 0`
  and no `sbd.itineraries.v1`** ⇒ almost certainly a first-timer. But this conflates "new" with "cleared their
  saves," so pair it with an explicit `sbd.tour.*` flag as the source of truth.
- **Hydration timing matters:** `SavesProvider` intentionally renders `{}` on the server and first client paint,
  then reads localStorage in `useEffect` and flips `hydrated` ([SavesProvider.tsx:39](../../components/saves/SavesProvider.tsx#L39)). **Gate the tutorial
  on `hydrated` to avoid flashing it before saves load** (and to avoid an SSR mismatch).
- **PWA display-mode:** the manifest sets `display: "standalone"` ([app/manifest.ts](../../app/manifest.ts)) and a service worker
  registers in prod ([ServiceWorkerRegister.tsx](../../components/pwa/ServiceWorkerRegister.tsx), cache `sbd-v3`), but there is **no**
  `matchMedia("(display-mode: standalone)")` or `beforeinstallprompt` handling in the client — so "did they
  install?" is **not** currently detectable in code. Add it if the tour wants to behave differently for installed users.

---

## 5. Reusable UI infrastructure

### The one overlay primitive: `BottomSheet`

[components/ui/BottomSheet.tsx](../../components/ui/BottomSheet.tsx) — the **only** modal/overlay component. API: `{ open, onClose, title?, kicker?,
children }`. It already handles everything a tutorial modal needs:

- **Focus trap** (Tab cycling) + moves focus into the panel on open ([BottomSheet.tsx:38-59](../../components/ui/BottomSheet.tsx#L38)).
- **Escape-to-close** (keydown listener, L32) and **scrim-click close** (L70).
- **Body scroll lock** (`document.body.style.overflow = "hidden"`, L30, restored on close).
- **Reduced-motion:** slide animation zeroes out via the global `--dur-*` → 0ms (see §6).
- Renders `.sbd-scrim` (backdrop, **z-index 120**) + `.sbd-sheet` (`role="dialog" aria-modal="true"`, **z-index 121**).

**There is no toast/tooltip/popover/drawer/dialog primitive.** (Saved rolls its own inline `.sbd-toast`
`role="status" aria-live="polite"` at [SavedClient.tsx:420](../../components/saved/SavedClient.tsx#L420); `data-tooltip` is CSS-only on two buttons.)
A coach-mark spotlight/tooltip is **new UI** to build — but it can **reuse BottomSheet's focus-trap / Escape /
scroll-lock pattern** rather than reinventing it.

### Focus, reduced-motion, breakpoints

- **`:focus-visible`** — one shared rule: `outline: 2px solid var(--pacific); outline-offset: 2px;` applied to a
  long selector list ([app/components.css:8](../../app/components.css#L8)). Bottom nav uses a gold ring instead. Any new tutorial control
  must opt into this (add its class to the list or match the pattern).
- **`prefers-reduced-motion`** — global: the media query zeroes `--dur-fast/base/slow` to `0ms`
  ([sbdaymaker_tokens.css:135](../../Core%20Project%20Files/sbdaymaker_tokens.css#L135)); loop animations (sun pulse, freshness dots) must also switch to a static
  state (CascadeFeed/ConditionChips check `matchMedia` directly). **A tutorial must honor this** — no animated
  spotlight sweep under reduce.
- **Breakpoints** — effectively **none in play**: the app is a fixed `max-width: 480px` column. At ~390px it's the
  native target; at ~1280px it's the same 480px column centered. So a tour designed for 390px works at 1280px
  unchanged — **but** the spotlight math should anchor to the `.sbd-shell` column, not the viewport.

---

## 6. Tokens & primitives

**Source of truth:** [Core Project Files/sbdaymaker_tokens.css](../../Core%20Project%20Files/sbdaymaker_tokens.css) (mirrored app-wide via `app/globals.css`). Never hardcode —
CLAUDE.md §8.

**Color (semantic):** `--bg` (#F6F1E7 plaster) · `--surface` (#FCFAF5 paper) · `--text` (#241C16 ink) ·
`--text-muted` (#4A4038) · `--text-link`/`--pacific` (#16586A) · `--accent`/`--terracotta` (#C0532E) ·
`--border`/`--line` (#D8CDB8) · accent fills `--gold` #E0A82E, `--sage` #7E8B6B. **Accessibility rule:** small text
uses only ink / ink-2 / pacific; for a small label on an accent use the `-text` variants (`--gold-text`,
`--terra-text`, `--sage-text`).

**Type:** Fraunces (display) / Inter (body+UI) / JetBrains Mono (data). Scale `--text-xs`…`--text-3xl`
(0.75→2.441rem); **body min 16px** (`--text-base`). **Touch target `--tap-min: 44px`.**

**Space:** `--space-1`…`--space-16` (4→64px). **Radius:** `--radius-sm` 7 · `--radius-md` 12 · `--radius-lg` 16 ·
`--radius-pill` 999. **Shadow:** `--shadow-card`, `--shadow-sheet`.

**Motion:** `--ease-out` cubic-bezier(0.16,1,0.3,1) · `--ease-spring` (0.34,1.56,0.64,1) · durations
`--dur-fast` 140 / `--dur-base` 240 / `--dur-slow` 520 / `--dur-pulse` 2400ms (all → 0 under reduce).

**z-index ladder** (build the tutorial **above 121**): stretch-links 0–1 · card actions 2–3 · sticky section
headers 18 · header 40 · bottom nav 60 · scrim **120** · bottom sheet **121**. → **Use ~130 for a tutorial scrim,
~131 for its callout/spotlight** so it sits over the sheet and nav.

**Primitives to build on:** `Button` (`variant: cta|primary|secondary`, `block`, `.sbd-btn`) · `Chip`
(`aria-pressed` toggle) · `SegmentedControl` (tablist) · `EmptyState` (`.sbd-empty`) · `Pill`/`Tag` ·
`SBIcon` (heart/share/sparkle/pin/sun/sliders/chevron/reset icon set) · `PickCard`/`ListCard` · `Skeleton`.
All exported from [components/ui/index.ts](../../components/ui/index.ts).

---

## 7. Analytics

> **⚠ delta — nothing is instrumented today.** CLAUDE.md §4 lists Vercel Web Analytics, but there is **no
> `@vercel/analytics` (or `@vercel/speed-insights`) dependency, no `<Analytics/>` mount, and no custom
> `track()` calls** anywhere in the app. Grep for `analytics|Analytics|track(|gtag|plausible|posthog` → nil.

Implication: **there is no existing event bus for tutorial start/step/complete to piggyback on.** If the tour
needs telemetry, the analytics layer must be added first (mount `@vercel/analytics/react` in the root layout and
fire `track("tour_*")` custom events — cookieless, consistent with the "no consent banner" stance in §4).

---

## 8. Constraint check for the tutorial

Building an overlay tour does **not** force breaking any of the eight load-bearing constraints, provided:

- **Batch-AI-only / no per-request AI (§2.3):** ✅ the tour is static/pre-authored copy; make **zero** live AI
  calls. Coach-mark text must be hand-written, not generated at tap time.
- **No end-user accounts / saves in localStorage (§2.4):** ✅ store tour progress in a `sbd.tour.*` localStorage
  key alongside `sbd.saves.v1`. Do **not** introduce a server record or new PII.
- **WCAG 2.2 AA floor (§6):** the tour **inherits** the obligations — honor `prefers-reduced-motion`, provide
  the `:focus-visible` pacific ring, keep 44px targets, trap focus and support Escape (reuse BottomSheet's
  pattern), and give the scrim/callout proper `role="dialog"`/`aria-modal` + `aria-live` step announcements.
- **Deterministic live app (§2.5, §2.3):** the tour reads existing DOM/state only; it must not depend on content
  that may be absent on first visit (e.g. don't assume a hero pick exists — the pick card is conditional).

---

## 9. Anchor gaps to fix before building

Elements a coach-mark tour would likely target that **lack a reliably unique anchor** today. Recommend adding a
`data-tour="…"` attribute to each (the app has essentially no `data-*` convention, so this stays clean):

| Target | Problem | Suggested hook |
|---|---|---|
| **Golden-hour hero** | `.sbd-hero--{variant}` class changes with time of day; no stable id | `data-tour="hero"` on the hero container |
| **Sun orb** (signature) | `.sbd-hero__sun` is `aria-hidden` decorative — fine to target by class, but brittle | `data-tour="hero-sun"` |
| **Save heart** (teaching "save") | `.sbd-heart` repeats on every card; only the aria-label (per-title) differs | `data-tour="save-heart"` on the hero pick's heart (the one canonical teachable instance) |
| **Card save vs. share** | `CardActions` renders both as `.sbd-cardact__btn`; distinguishable only by aria-label | `data-tour="card-save"` / `data-tour="card-share"` |
| **Detail-page save** | `DetailSaveButton` is a bare `Button` with no class/id/aria hook | add `data-tour="detail-save"` + an `aria-label` |
| **Occasion tiles** | `.sbd-tune-opt` repeats; only inner label text differs | `data-tour="lens-tile"` on the group, target first tile |
| **Condition chips** | weather vs. sunset both `.sbd-hero__chip`, indistinguishable | add `data-tour` or a modifier class per chip |
| **One Perfect / "Make My Day"** | **does not render at all** (see §2A) — cannot be targeted until built | (feature must ship first) |
| **Discover passport/stamp** | **does not exist** — cannot be targeted until built | (feature must ship first) |
| **Empty Saved state** | good anchor exists (`.sbd-empty` inside `/saved`) but it's the *only* thing on the page for a new user | `data-tour="saved-empty"` for precision |

**Anchors that are already solid** (no work needed): horizon toggle (`role="tablist" aria-label="Time horizon"`),
Tune button (`.sbd-ctrl__tune` + `aria-expanded`), Tier 2/3 toggles (`aria-controls="explore-tier2/3"`), the
Want/Been tablist (`aria-label="Saved state"`), both Build-a-day CTAs (`.sbd-build-cta` + distinct aria-labels),
bottom-nav tabs (`.sbd-nav__btn` + `aria-current`), `#main`.
