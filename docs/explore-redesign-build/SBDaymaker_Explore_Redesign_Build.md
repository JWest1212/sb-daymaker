# SB Daymaker — Explore Redesign Build Spec

**Type:** Delta build spec (implementation) · **Target:** Claude Code · **Scope:** Explore section only
**Derived from:** Doc 14 (Explore current-state) + Doc 17 (design review) + `sbdaymaker_tokens.css` (v9 canon)
**Date:** 2026-06-30 · **Status:** approved for build

---

## 0. How to use this document

This spec implements **every** recommendation in the approved design review (Doc 17), at pixel level. It is organized into **five phases with hard-stop checkpoints**. Work one phase at a time, in order. After each phase: **STOP, report exactly what changed, and wait for visual approval before starting the next phase.** Do not batch phases.

**Precedence:** `CLAUDE.md` is the contract; the live code is truth. Where any older doc conflicts with this spec, this spec wins for the Explore section. Where this spec conflicts with `sbdaymaker_tokens.css`, the tokens win (flag the conflict, don't invent a value).

**This is a presentation-layer change.** Do not modify the database schema, Supabase queries, the ingestion pipeline, the ranker/cascade ordering logic, or any AI/batch process. The two permitted data-adjacent edits are (a) adding a `text` color field to the occasion constant, and (b) renaming two client state variables. Both are called out explicitly below.

---

## 1. Non-negotiable constraints (do not violate; do not reopen)

- **Hero is OUT OF SCOPE.** Do not edit `components/explore/Hero.tsx` or any `.sbd-hero*` CSS. The hero may *import* the new shared primitives (icon, action cluster) later, but in this build leave its current markup and behavior untouched. If the hero currently renders `SaveHeart`, leave that usage as-is.
- **WCAG 2.2 AA floor:** every interactive control has a ≥44×44px tap target; visible `:focus-visible` ring is `3px solid var(--pacific)` offset 2px; all information conveyed by color is also conveyed by text/shape; all looping/entry motion is disabled under `prefers-reduced-motion: reduce`.
- **Tokens only.** No hardcoded hex except the *one* new token defined in §3.6 (`--gold-nav-active`) and the documented overlay-scrim rgba values in §3.3. If you need a color that has no token, STOP and flag it.
- **No new nav tab.** Bottom nav stays exactly three tabs (Explore / Saved / Discover SB).
- **No per-request AI, no accounts, no transactions.** Saves remain `localStorage` (`sbd.saves.v1`). Email signup remains magic-link via `/api/subscribe`.
- **Ranker never reads sponsor status.** Do not add any sponsor/priority signal.
- **Solo-operator ceiling (~15 min/day):** any feature that would require recurring manual copywriting is forbidden unless it is templated/rule-driven. This applies specifically to the lead "dek" in §7 A5 — it must be a pure function of `(horizon, count)`, never hand-authored per day.
- **Preserve all existing behavior:** horizon filtering (`withinHorizon` + `nowMs`), lens filtering, Near Me stable sort, save/share, magic-link signup. Refactors must be behavior-preserving except where this spec explicitly changes behavior.

---

## 2. Global "do NOT" list

1. Do not touch the hero.
2. Do not change `lib/explore.ts` sort logic (`cascade`, `withinHorizon`, `nearMeSort`, `filterByLens`, `groupByDay`) — only *consume* it.
3. Do not change Supabase queries or `lib/things.ts` `BASE_COLS`.
4. Do not add a 4th nav item, sponsor field, per-request AI call, or user account.
5. Do not introduce a CSS/JS storage API in artifacts (N/A here — this is the real app; `localStorage` is fine).
6. Do not invent colors, fonts, radii, or spacing values outside the token scale.
7. Do not hand-write daily editorial copy.
8. Do not reopen decisions this spec has made (they are marked **DECIDED**). If something is genuinely ambiguous, STOP and ask.

---

## 3. Shared foundations (build these FIRST, in Phase 1)

These primitives are consumed by every later phase. Build and smoke-test them before wiring anything.

### 3.1 Token reference (already in `sbdaymaker_tokens.css` — use, don't redefine)

| Purpose | Token | Value |
|---|---|---|
| Background | `--plaster` | #F6F1E7 |
| Secondary surface / track | `--plaster-2` | #EFE7D8 |
| Card surface | `--paper` / `--surface` | #FCFAF5 |
| Primary text | `--ink` | #241C16 |
| Secondary text | `--ink-2` | #4A4038 |
| Interactive / links / active | `--pacific` | #16586A |
| Deep teal | `--pacific-dark` | #0E3C49 |
| Headings / CTA / date eyebrow | `--terracotta` | #C0532E |
| AA-safe terracotta text | `--terra-text` | #9E3F20 |
| Gold (brand/hero/free only) | `--gold` | #E0A82E |
| AA-safe gold text | `--gold-text` | #7A5E13 |
| Sage | `--sage` | #7E8B6B |
| AA-safe sage text | `--sage-text` | #566049 |
| Hairline | `--line` | #D8CDB8 |
| Occasion accents | `--purple` #9C6B9E · `--forest` #3E7C5A | |
| Radius | `--radius-sm/md/lg/pill` | 7 / 12 / 16 / 999px |
| Card shadow | `--shadow-card` | (defined) |
| Type | `--text-xs/sm/base/lg/xl` | 12 / 14 / **16 floor** / 20 / 25px |
| Space (4px scale) | `--space-1…16` | 4,8,12,16,20,24,32,40,48,64 |
| Motion | `--dur-fast/base`, `--ease-out`, `--ease-spring` | (defined; zeroed under reduced-motion) |

**Type-floor rule (DECIDED):** primary body copy never below `--text-base` (16). Card blurbs/meta are *secondary* text and use `--text-sm` (14) as their floor. Eyebrows/pill labels are captions and may use `--text-xs` (12); pill label text must be ≥10px. Nothing below 10px anywhere.

### 3.2 New component — `components/ui/SBIcon.tsx` (A4)

A single inline-SVG line-icon set replacing all emoji. Props: `name`, `size` (default 20), `strokeWidth` (default 1.8), `className`. All icons: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `aria-hidden="true"` (icons are always decorative; the label carries meaning).

Path data (DECIDED — use exactly):

| name | paths |
|---|---|
| `heart` | `<path d="M12 21s-7-4.5-9.5-8.5C.5 8.5 3 5 6.5 5 9 5 12 8 12 8s3-3 5.5-3C21 5 23.5 8.5 21.5 12.5 19 16.5 12 21 12 21Z"/>` |
| `share` | `<path d="M7 17 17 7M17 7H9M17 7v8"/>` |
| `sparkle` | `<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z"/>` |
| `pin` | `<path d="M12 21c4-4.5 7-7.6 7-11a7 7 0 1 0-14 0c0 3.4 3 6.5 7 11Z"/><circle cx="12" cy="10" r="2.4"/>` |
| `sliders` | `<path d="M4 6h16M7 12h10M10 18h4"/>` |
| `sun` | `<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>` |
| `reset` | `<path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v4h4"/>` |
| `chevron` | `<path d="M9 6l6 6-6 6"/>` |

`heart` supports a filled state: when saved, render with `fill="var(--terracotta)"` and `stroke="var(--terracotta)"`.

### 3.3 New component — `components/ui/CardActions.tsx` (A2)

One save+share cluster used by **every** card type. Replaces the ad-hoc dark-circle-vs-inline-outline treatments.

**Props:** `id`, `title`, `url`, `onImage: boolean`.

**Behavior (preserve existing):** heart calls `useSaves()` toggle; share calls `shareUrl(url, title)` from `components/saved/share.ts`. Do not change those.

**Markup:** a flex row, `gap: var(--space-2)` (8px). Two buttons, each:
- Tap target **44×44px** (`min-width/height:44px`), centered contents.
- Visible circle **36px** (`.sbd-cardact__btn` inner), `border-radius:50%`.
- Glyph **18px** via `SBIcon` (`strokeWidth:2`).

**Two contexts (DECIDED):**
- `onImage={true}`: circle background is a **guaranteed radial scrim** so contrast holds over any photo:
  `background: radial-gradient(circle, rgba(20,30,35,.55), rgba(20,30,35,.25) 70%, transparent);`
  glyph color `#fff`. Position: absolute, `top:9px; right:9px; z-index:3`.
- `onImage={false}`: no background. Glyph `stroke: var(--ink-2)`; heart when saved → `var(--terracotta)` filled. Sits in the card's right-aligned actions column, vertically centered.

**States:** heart saved → filled terracotta + pop animation `scale 1→1.25→1` over `--dur-base` `--ease-spring`. Share → no toggle state.

**a11y:** heart `aria-label={saved ? "Saved "+title : "Save "+title}` `aria-pressed={saved}`; share `aria-label={"Share "+title}`. Both `:focus-visible` ring per §1. Pop animation disabled under reduced-motion.

CSS class root: `.sbd-cardact`, `.sbd-cardact__btn`, `--on-image` modifier.

### 3.4 New component — `components/ui/Pill.tsx` (A3, A6)

Exports three primitives. **Gold is removed from the tag system entirely** (see §3.5 mapping).

1. **`<Pill occasion={key} />`** — occasion label pill.
   - Fill = the occasion's color token; text = the occasion's `text` color (see §3.5). **Never** accent-color text on light — always a fill with `--paper` or `--ink` text.
   - Geometry: `padding:3px 8px; border-radius:var(--radius-pill); font-family:var(--font-body); font-size:10px; font-weight:800; letter-spacing:.03em; text-transform:uppercase;`
   - Used top-left on media cards/tiles (`position:absolute; top:9px; left:9px; z-index:2`) or inline on rows.
2. **`<DateEyebrow onImage?>`** — the date, as **data** (mono), not a pill.
   - `font-family:var(--font-mono); font-size:var(--text-xs) /*12*/; font-weight:700; letter-spacing:.1em; text-transform:uppercase;`
   - Color: light context `var(--terra-text)`; `onImage` → `#fff` with `text-shadow:0 1px 3px rgba(0,0,0,.5)` and opacity .95.
   - Content comes from existing `formatWhen()`/event-time derivation. Example rendered strings: `TUE · 12 PM`, `JUN 30`, `JUL 17–18`.
3. **`<PlacePill neighborhood />`** — location chip on media.
   - `background:rgba(20,30,35,.6); backdrop-filter:blur(3px); color:#fff; font-weight:600; padding:3px 8px; border-radius:var(--radius-pill); font-size:11px;`
   - Prefix with `SBIcon name="pin" size={11}` (**not** the 📍 emoji). Position bottom-left of media where used.

CSS roots: `.sbd-pill`, `.sbd-pill--{occasion}`, `.sbd-eyebrow-date`, `.sbd-placepill`.

### 3.5 Occasion color + text map — edit `lib/occasions.ts` (A3, A6)

Add an explicit `text` field to each entry in `OCCASION_BY_KEY` so pill fills always pair with a legal text color. **Remove all emoji `icon` values from occasion rendering paths** (keep the field if other code reads it, but do not render it in Explore). Mapping (DECIDED):

| key | label | fill token | `text` |
|---|---|---|---|
| `date_night` | Date Night | `--terracotta` | `--paper` |
| `family_day` | Family Day | `--sage` | `--paper` |
| `nightlife` | Nightlife | `--ink` | `--paper` |
| `catch_a_show` | Catch a Show | `--pacific` | `--paper` |
| `arts_culture` | Arts & Culture | `--purple` | `--paper` |
| `outdoors_active` | Outdoors & Active | `--forest` | `--paper` |
| `wine_food` | Wine & Food | `--pacific-dark` | `--paper` |
| `free_sb` | Free in SB | `--gold` | `--ink` |
| `hosting_visitors` | Hosting Visitors | `--pacific` | `--paper` |
| `solo` | Solo | `--ink-2` | `--paper` |

> `free_sb` legitimately keeps gold as its occasion color (ink text). This is the **only** gold-as-tag usage that survives, and it is the "free/golden" semantic, not decoration.

### 3.6 Token addition — `sbdaymaker_tokens.css` (B8)

Add one token for the nav active label (the existing gold fails 4.5:1 as small text on pacific):

```css
--gold-nav-active: #F5C95B;  /* AA-safe active label on --pacific; verify ≥4.5:1 before ship */
```

Keep the nav *icon* and the *pip* on `--gold` (they're large/graphical). Only the small active **label text** uses `--gold-nav-active`. Verify contrast in a checker before shipping.

### 3.7 CSS utilities to add — `app/components.css` (A8, A9)

- **Spacing rhythm (DECIDED):** section top margin `--space-8` (32); section-header block → first item `--space-4` (16); feed item → item `--space-4` (16); page horizontal gutter `--space-4` (16). Apply uniformly across all three horizons.
- **Column rule** (`.sbd-sh__rule`): `width:40px; height:2px; background:var(--terracotta); border-radius:2px; margin-top:6px;`
- **Reveal** (`.sbd-reveal` / `.is-in`): `opacity:0; transform:translateY(12px); transition:opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);` `.is-in` → `opacity:1; transform:none;`. **Under `@media (prefers-reduced-motion: reduce)`: force `opacity:1; transform:none; transition:none;`** and do not run the observer.

**Checkpoint 1 (STOP):** Confirm the four primitives build with no type errors and render in isolation (a scratch route or Storybook-style page is fine, then remove). Verify: icons render, `CardActions` shows scrim over a bright test image, `Pill` fills use legal text colors, `DateEyebrow` is mono. **Report and wait.**

---

## 4. PHASE 2 — Card family (render-first cluster 1)

Implements **A1, A2, A3, A6, A7** across all four card treatments. This is the keystone; everything downstream inherits it. Architectures still differ by horizon — only the *chrome* is unified.

### 4.1 Feature card — `components/ui/Card.tsx` `PickCard` (Today lead + reused chrome)

| Property | Value |
|---|---|
| Radius | `--radius-lg` (16) |
| Shadow | `--shadow-card` |
| Surface | `--surface` |
| Media band height | 140px |
| Body padding | `16px 20px 20px` (`--space-4 --space-5 --space-5`) |
| Occasion pill | top-left, `<Pill occasion>` — **remove the gold lock**; use occasion color |
| Actions | `<CardActions onImage>` top-right (scrim) |
| Date | `<DateEyebrow>` as body eyebrow **above** title, `margin-bottom:4px` |
| Title | Fraunces `--text-xl` (25) / 700 / `line-height:1.1`, 2-line clamp, stretch-link to `/thing/{id}` |
| Blurb | Inter `--text-sm` (14) / `--ink-2` / `line-height:1.4`, 2-line clamp |

Keep the stretch-link (`sbd-stretch`) and `cardBlurb()`/`cardTag()` derivations. Replace the old gold `sbd-pick__tag` with `<Pill>`. Replace the inline share glyph + `SaveHeart` with `<CardActions onImage>`.

### 4.2 Row card — `components/ui/Card.tsx` `ListCard` (Today briefs + Tier-2/3 + Week rows share this chrome)

| Property | Value |
|---|---|
| Radius | `--radius-lg` (16) |
| Shadow | `--shadow-card` |
| Layout | flex, `gap:11px`, `align-items:center`, padding `11px 12px` |
| Thumbnail | 52px square, `--radius-md` (12); shown only if `photo_url` present, else omitted (text row) |
| Occasion pill | inline micro `<Pill>` (occasion color) — **remove** the old place/free/else color logic in `cardTagColor()` for this card; occasion color is the single rule |
| Date | `<DateEyebrow>` (mono) as the meta line |
| Title | Fraunces `--text-lg` (20) / 600 / `line-height:1.12`, 2-line clamp, stretch-link |
| Actions | `<CardActions>` (no `onImage`) in right column, vertically centered |

> `cardTagColor()` (place=pacific / free=sage / else=terracotta) is **retired** — occasion color from `<Pill>` replaces it. If other surfaces use `cardTagColor`, leave it there but stop calling it from Explore cards.

### 4.3 Rock tile — `components/explore/RockTile.tsx` (Month)

Keep the full-bleed image tile and the 8-at-a-time expand-only behavior. Apply unified chrome:

| Property | Value |
|---|---|
| Height | 120px min |
| Radius | `--radius-lg` (16), `--shadow-card` |
| Overlay | keep bottom scrim gradient |
| Date | `<DateEyebrow onImage>` in content area **above** title (replaces the gold date pill) |
| Title | Fraunces `--text-lg` (20) / 700 / white / `line-height:1.1` / text-shadow |
| Blurb | Inter `--text-sm` (14) / white .92 / 1-line clamp / text-shadow — **fix from ~11px** |
| Neighborhood micro-line | **Removed** (`~0.656rem` line deleted); fold into the eyebrow only if it fits: `JUN 30 · MONTECITO`, else date only |
| Actions | `<CardActions onImage>` top-right cluster (scrim) |

`byDateAsc()` sort, the 8-cap, and `formatWhen()` are unchanged.

### 4.4 Week day-rail chrome — `components/explore/LeadDayRail.tsx` (chrome only; layout tweaks in Phase 4)

Swap each row's bespoke markup for the §4.2 row-card chrome + `<CardActions>` + `<DateEyebrow>`. (Date-column narrowing and optional thumbnails are Phase 4, B4.) Keep `groupByDay()` grouping unchanged.

### 4.5 Gold de-overload verification (A6)

After 4.1–4.4, gold must appear **only** as: the brand mark "S", nav active icon/pip, the hero (untouched), and the `free_sb` occasion pill. Grep the Explore CSS/components for `--gold` and confirm no other usage. The Build CTA recolor (also gold→terracotta) lands in Phase 4 §7 B5 — note it here so the audit expects it.

**Acceptance (Phase 2):**
- All four card types share radius 16, `--shadow-card`, `<Pill>`, `<CardActions>`, and the two-title-size rule (25 feature / 20 everything else).
- No text below its floor (blurbs ≥14, eyebrows ≥12, pill labels ≥10).
- Dates render as mono eyebrows; no gold date pill remains.
- Chess-tile-style share icon is legible on bright images (scrim present).
- Occasion pills use occasion colors with legal text colors.

**Checkpoint 2 (STOP):** This is render-first **cluster 1**. Show Today (feature + briefs), This Week (rail), This Month (tiles) rendered. **Report and wait.**

---

## 5. PHASE 3 — Chrome cluster (render-first cluster 2)

Implements **A4 (headers), A5 (counts/dek), A8 (spacing), B2 (control row), B3 (Tune sheet)**.

### 5.1 New component — `components/ui/SectionHeader.tsx` (A4, A5)

Replaces the emoji `.sbd-sh` headers. Two modes:

**`mode="lead"`** (the Tier-1 "Happening …" header):
- No icon, no emoji. Label Fraunces `--text-xl` (25) / 700.
- `<div class="sbd-sh__rule">` column rule directly under the label.
- Optional `dek` (see below) Fraunces *italic* `--text-sm` (14) `--ink-2`, `margin-top:6px`.
- **No count.**

**`mode="collapsible"`** (Tier-2 / Tier-3):
- No emoji. Label Fraunces `--text-lg` (20) / 700.
- Count: mono numeral `--text-xs` (12) `--ink-2` weight 500 (**not** the old gray pill badge).
- `SBIcon name="chevron"` `--ink-2`, rotates 90° when open, 0° when closed (chevron points right when collapsed).
- Row is the toggle button: `min-height:44px`, `aria-expanded`, `aria-controls`, hairline `border-bottom:1px solid var(--line)`.

**Lead dek (A5) — TEMPLATED ONLY (DECIDED):** implement `deriveLeadDek(horizon, count): string | null` as a pure function. Ship it **behind a flag defaulting to off** if you're unsure — label-only is an acceptable v1. Rule-driven examples (no daily authoring):
```
today:  count===0 ? null : count<=4 ? "A quieter day — worth a look." : "Plenty on today."
week:   "The week ahead in Santa Barbara."
month:  "The month worth building a day around."
```
Never fetch, never call AI, never store hand-written strings.

### 5.2 Control row — `components/explore/ControlRow.tsx` (B2)

Collapse two rows → **one row**:
- `SegmentedControl` (Today / This Week / This Month), `flex:1` — the primary control.
- One `Tune` button (`.sbd-ctrl__tune`): `height:44px; border:1.5px solid var(--line); background:var(--surface); border-radius:var(--radius-pill); padding:0 14px; font:700 13px var(--font-body); color:var(--ink);` with `SBIcon name="sliders" size={15}` (`stroke:var(--pacific)`) + label "Tune".
- Row: `display:flex; gap:var(--space-3) (12); align-items:center;`
- **Active state:** when `lens !== null || zone !== null`, add `.is-active` → `border-color:var(--pacific)` and append a small pacific count dot showing the number of active filters (1 or 2). `aria-haspopup="dialog"`, `aria-expanded={tuneOpen}`.
- **Remove** the separate "Any vibe" and "Near Me" buttons from this component.

### 5.3 New component — `components/explore/TuneSheet.tsx` (B3)

Merge `LensSheet` + `NearMeSheet` into one `BottomSheet`. Kicker "Tune your day"; title "Vibe & location".

**Section 1 — Vibe:**
- Full-width "Any vibe — show everything" button, active (`.is-active`) when `lens === null`.
- Grid of the 10 occasions. Each tile: a rounded square (`--radius-md`) **filled with the occasion color** (from §3.5), `aria-hidden` on the color block, occasion **label below** in `--text-sm` (14). **No emoji.** Active tile → `.is-active` (2px `--pacific` ring). (Custom per-occasion glyphs are a future enhancement; color-fill + label is the v1.)
- Selecting an occasion sets `lens` (exclusive) **and keeps the sheet open** (because location is also here). "Any vibe" sets `lens = null`.

**Section 2 — Location:**
- "Use my location" button → `navigator.geolocation.getCurrentPosition()` 8s timeout; label "Finding you…" while locating; on success `nearestZone(lat,lng)` sets `zone`; on denial show note "No location — no problem. Pick a neighborhood instead." Preserve all existing NearMeSheet logic verbatim.
- Zone list (7): Funk Zone, Downtown / State St., The Waterfront, Montecito, The Mesa, Goleta, Anywhere in SB. Active zone `.is-active`. Setting a zone keeps the sheet open.

**Footer:** one full-width primary button "Show results" (`.btn-primary`, pacific fill, paper text) that closes the sheet. Backdrop tap and Esc also close. `aria-modal="true"`, focus trapped, slide `--dur-base --ease-out` (respect reduced-motion).

**ExploreClient state change (DECIDED):** replace `lensOpen` and `nearOpen` with a single `tuneOpen` boolean. Keep `lens`, `horizon`, `zone` exactly as-is (same types, same feed pipeline). Remove imports/usages of `LensSheet` and `NearMeSheet` (you may delete those two files; if you keep them, they must be unimported).

### 5.4 Apply spacing rhythm (A8)

Apply §3.7 rhythm to the feed: control row → first section header `--space-6` (24); section → section `--space-8` (32); header block → first item `--space-4` (16); item → item `--space-4` (16); gutter `--space-4` (16). Remove any per-horizon gap overrides so all three share the rhythm.

**Acceptance (Phase 3):** no emoji anywhere on Explore; lead header = serif + column rule (+ optional templated dek, no count); Tier headers = serif + mono count + chevron; one control row with horizon leading and a single Tune button; Tune sheet merges vibe + location and applies live; spacing rhythm uniform across horizons.

**Checkpoint 3 (STOP):** render-first **cluster 2**. Show the control row, the open Tune sheet, and the restyled section headers on all three horizons. **Report and wait.**

---

## 6. PHASE 4 — Lead layout behavior + CTA

Implements **B4 (Today lead+briefs, Week date column + thumbs, empty state) and B5 (CTA)**.

### 6.1 Today — "lead + briefs" — `components/explore/CascadeFeed.tsx` `TodayLead`

- **First** Tier-1 item → §4.1 **feature `PickCard`** (image band 140px, 25px title).
- **Remaining** Tier-1 items → §4.2 **row cards** (`ListCard` chrome), stacked with `--space-4` gaps.
- Retire the "all items as full PickCards" stack and the `cardTone(i)` mod-3 tinting for the briefs (tone may remain on the single feature card only). Row thumbnails follow §4.2 (shown only if `photo_url`).

### 6.2 Week — date column + optional thumbnails — `components/explore/LeadDayRail.tsx`

- Date column width **44px**, **left-aligned** (was ~36px with wide dead space): weekday abbrev in `--terra-text` mono `--text-xs`, date number Fraunces `--text-lg` (20) / 700. Show the date only on the **first row of each day group** (already the pattern); reduce the empty-column width on subsequent rows so content reclaims the space.
- Rows use §4.2 chrome. Add the optional 52px thumbnail **gated on `photo_url`** (gradient fallback if absent — many civic items have no photo; never show a broken/empty image slot).

### 6.3 Empty state — `components/explore/CascadeFeed.tsx` + `components/explore/EmptyState.tsx`

Replace the emoji `🔍` empty state with:
- `SBIcon` (use `sparkle` or `reset`, size 28, `--sage`), centered.
- Message `--ink-2`: "Nothing matches that combination. Try a wider time or a different vibe."
- **Action button** (new): `.btn-secondary` (pacific outline) labeled **"Show everything"** → clears filters: `setLens(null); setZone(null);` (keep `horizon`). Keeps the dashed-border container.

### 6.4 Build CTA — `components/explore/CascadeFeed.tsx` (B5, A6)

- **Recolor gold → terracotta:** `background:var(--terracotta)`; title `#fff` Fraunces `--text-lg` (20)/700; sub `rgba(255,255,255,.85)` `--text-sm`; icon block `background:rgba(255,255,255,.16)` with `SBIcon name="sun" size={22}` `#fff`; arrow `#fff`. Radius `--radius-lg`. (This is a token-approved large-text terracotta+paper pairing.)
- **Today-only placement:** wrap the CTA in `{horizon === "today" && ( … )}`. Do not render it on Week/Month.
- Link target `/plan` unchanged. Copy unchanged: "Build your day" / "Tell us the shape — we'll draft it, you tweak it."

**Acceptance (Phase 4):** Today shows one feature card then compact briefs; Week reclaims the dead date-column space and shows thumbnails where photos exist; empty state has a working "Show everything" reset; Build CTA is terracotta and appears only on Today.

**Checkpoint 4 (STOP):** Show Today (lead+briefs + terracotta CTA), Week (tightened rail + thumbs), and a forced empty state. **Report and wait.**

---

## 7. PHASE 5 — Remaining surfaces + motion polish

Implements **B1 (job strip), B6 (Tier), B7 (footer), B8 (nav), A9 (motion)**.

### 7.1 Job strip — remove — `components/explore/ExploreClient.tsx` (B1)
Delete the `.sbd-job-strip` block (the "Find it · Save it · Share it" markup, ~lines 55–66) and its CSS. (DECIDED: dropped, not restyled — the masthead already carries the tagline.)

### 7.2 Tier collapsibles — `components/explore/CascadeFeed.tsx` (B6)
- Use the §5.1 `SectionHeader mode="collapsible"` (no emoji, mono count, chevron).
- **Copy (DECIDED):** Tier-2 label → **"Every week"** (was "Happening this day each week"); Tier-3 → **"Anytime in SB"** (was "Great any day").
- **Reset on horizon change:** add `useEffect(() => { setTier2Open(false); setTier3Open(false); }, [horizon])`. Default collapsed unchanged. (`monthShownCount` reset already exists.)
- Inner items use §4.2 row-card chrome.

### 7.3 Footer — `components/explore/ExploreClient.tsx` (B7)
- Add `margin-top:var(--space-8)` above `EmailSignup` so the footer separates from the feed.
- Order (DECIDED): **EmailSignup → trust line → submit link.** (Trust line "No accounts, no login wall. Saves live on your device." moves directly beneath the signup as reassurance; submit link last.)
- Keep the signup card weight (email capture is a real goal); no restyle beyond spacing/order.

### 7.4 Bottom nav — `components/app/BottomNav.tsx` (B8)
- Apply `--gold-nav-active` (§3.6) to the **active label text only**. Keep the active icon and the 3px gold pip on `--gold`.
- Verify the active label clears 4.5:1 on `--pacific`. Do not touch tab count, order, icons, or the Saved count badge.

### 7.5 Motion — `app/components.css` + feed (A9)
- **Column rule:** already added under lead headers (§5.1).
- **Reveal stagger:** apply `.sbd-reveal` to feed items; add `.is-in` on scroll-in via a single `IntersectionObserver` (threshold ~0.08), unobserve after firing. Optional index-based `transition-delay` capped at ~6 steps. **Do not run the observer under `prefers-reduced-motion`** — items render fully visible. No looping animations anywhere.

**Acceptance (Phase 5):** no job strip; Tier headers read "Every week" / "Anytime in SB" with mono counts and reset-on-horizon; footer separated with trust line under signup; nav active label passes AA; feed cards fade in once (and don't under reduced-motion).

**Checkpoint 5 (STOP):** Show the full Explore scroll on all three horizons. **Report.**

---

## 8. Global acceptance checklist (verify before final sign-off)

**Design language**
- [ ] A1 — All card types share radius 16, `--shadow-card`, `<Pill>`, `<CardActions>`; two title sizes only (25/20).
- [ ] A2 — One action cluster; scrim guaranteed on image contexts; chess-tile-style bug gone; 44px targets.
- [ ] A3 — Occasion pills use occasion colors (legal text); dates are mono eyebrows; place pill uses pin icon.
- [ ] A4 — Zero emoji on Explore; custom icons on lens/near/tune/CTA; section headers icon-free.
- [ ] A5 — Lead header: serif + column rule (+ optional templated dek), no count. Tier: mono count.
- [ ] A6 — Gold appears only as brand mark, nav active, hero, and `free_sb` pill. Grep-clean.
- [ ] A7 — Nothing below floor (body 16 / secondary 14 / eyebrow 12 / pill label 10).
- [ ] A8 — Uniform spacing rhythm across horizons.
- [ ] A9 — Column rule + one-time reveal; reduced-motion disables all entry/loop motion.

**Surfaces**
- [ ] B1 — Job strip removed.
- [ ] B2 — One control row; horizon leads; single Tune button with active state.
- [ ] B3 — Merged Tune sheet (vibe + location), live-apply, "Show results" closes; 10 occasions + 7 zones preserved.
- [ ] B4 — Today lead+briefs; Week tightened + optional thumbs; empty state has "Show everything" reset.
- [ ] B5 — Build CTA terracotta, Today-only, `/plan`.
- [ ] B6 — Tier copy "Every week"/"Anytime in SB"; mono counts; reset on horizon change.
- [ ] B7 — Footer spacing + trust-under-signup order.
- [ ] B8 — Nav active label AA-safe; three tabs intact.

**Constraints**
- [ ] Hero untouched.
- [ ] No schema/query/ranker/ingestion/AI changes.
- [ ] Tokens only (one new token `--gold-nav-active`; documented scrim rgba).
- [ ] `localStorage` saves + magic-link signup preserved.
- [ ] WCAG 2.2 AA: targets, focus-visible, color-plus-shape, reduced-motion.
- [ ] Three-tab nav; no sponsor signal.

---

## 9. File-change index (quick reference)

**Create**
- `components/ui/SBIcon.tsx`
- `components/ui/CardActions.tsx`
- `components/ui/Pill.tsx`
- `components/ui/SectionHeader.tsx`
- `components/explore/TuneSheet.tsx`
- `components/explore/EmptyState.tsx`

**Modify**
- `components/ui/Card.tsx` (PickCard feature, ListCard row)
- `components/explore/RockTile.tsx`
- `components/explore/LeadDayRail.tsx`
- `components/explore/CascadeFeed.tsx` (Today lead+briefs, CTA, Tier copy/reset, empty state, spacing, reveal)
- `components/explore/ControlRow.tsx` (one row + Tune)
- `components/explore/ExploreClient.tsx` (remove job strip, `tuneOpen` state, footer order/spacing)
- `components/app/BottomNav.tsx` (active label token)
- `lib/occasions.ts` (add `text` field; stop rendering emoji)
- `sbdaymaker_tokens.css` (add `--gold-nav-active`)
- `app/components.css` (all new/updated CSS)

**Deprecate (remove usage; deletion optional)**
- `components/explore/LensSheet.tsx`
- `components/explore/NearMeSheet.tsx`

**Do not touch**
- `components/explore/Hero.tsx` and `.sbd-hero*` CSS
- `lib/explore.ts` sort logic, `lib/things.ts` queries, Supabase, ingestion, ranker

---

*End of build spec. Work phase-by-phase; STOP at every checkpoint and wait for visual approval. If any instruction is ambiguous or conflicts with the live code, stop and ask rather than guessing.*
