# 14 — SB Daymaker: Explore Current-State Specification

`Derived from production source code · June 2026 · Read-only audit — no code was changed`

---

## Preamble

This document captures the Explore section **as it exists in the live codebase**, not as it was designed or intended. Where code and canon conflict, code is reported here; the conflict is flagged in §4 (Divergence Ledger). All file paths are relative to the repo root.

---

## §1 — Component Render Tree

The Explore route is at `app/(app)/page.tsx` inside the `(app)` route group. That group's layout (`app/(app)/layout.tsx`) supplies the shell, header, and bottom nav.

### Render order (DOM/top-to-bottom)

```
AppLayout                       [server] app/(app)/layout.tsx:1-21
  ├── <a href="#main">          Skip-to-content link (accessibility)
  ├── AppHeader                 [server] components/app/AppHeader.tsx:1-16
  │     Renders: Pacific square mark "S" + wordmark "SB Daymaker" + tagline
  │     "Santa Barbara, daily" (uppercase small-caps style via .sbd-header__tag)
  ├── <main id="main">          Shell main — receives page children
  │   └── ExplorePage           [server, force-dynamic] app/(app)/page.tsx:1-23
  │         Fetches getPublishedThings() + getWeather() in parallel; derives
  │         getTimeOfDay() and getDateLabel() on the server; passes nowMs.
  │         Renders ExploreClient with all data as props.
  │       └── ExploreClient     [client] components/explore/ExploreClient.tsx:1-119
  │             Owns: lens, horizon, zone, lensOpen, nearOpen state.
  │             ├── .sbd-job-strip                 Job strip "Find it · Save it · Share it"
  │             ├── Hero                            components/explore/Hero.tsx:1-152
  │             │     ├── .sbd-hero__glow           Warm horizon radial glow
  │             │     ├── .sbd-hero__sun            Animated sun disk (positioned by TOD)
  │             │     ├── .sbd-hero__cloud          Blurred cloud shape (bad-weather only)
  │             │     ├── <svg .sbd-hero__range>    SB skyline silhouette (inline SVG)
  │             │     ├── .sbd-hero__fog            Fog band (gray-day only)
  │             │     ├── .sbd-hero__sky            Date + inline weather conditions
  │             │     └── .sbd-hero__pick           Pick card (if hero item exists)
  │             │           ├── .sbd-hero__pick-img   84px photo or gold gradient
  │             │           │   └── SaveHeart (overlay)
  │             │           └── .sbd-hero__pick-body  Eyebrow / title / meta
  │             │                 └── <Link href="/thing/{id}"> (sbd-stretch)
  │             ├── .sbd-explore__body
  │             │   ├── ControlRow                  components/explore/ControlRow.tsx:1-65
  │             │   │     ├── .sbd-ctrl__horizon → SegmentedControl (Today/This Week/This Month)
  │             │   │     ├── .sbd-ctrl__lens       Lens/vibe button → opens LensSheet
  │             │   │     └── .sbd-ctrl__near       Near Me button → opens NearMeSheet
  │             │   ├── CascadeFeed                 components/explore/CascadeFeed.tsx:1-252
  │             │   │     ├── LeadSection            [Today] TodayLead → PickCard stack
  │             │   │     │                          [Week]  LeadDayRail (grouped by day)
  │             │   │     │                          [Month] RockGrid (image tiles, 8-at-a-time)
  │             │   │     ├── .sbd-build-cta         "Build your day" CTA link → /plan
  │             │   │     ├── Tier-2 collapsible section  "Happening this day each week"
  │             │   │     │     └── ListCard × n
  │             │   │     └── Tier-3 collapsible section  "Great any day"
  │             │   │           └── ListCard × n
  │             │   └── <footer .sbd-foot>
  │             │         ├── EmailSignup            components/signup/EmailSignup.tsx
  │             │         ├── <Link href="/submit">  "＋ Submit an event or business"
  │             │         └── <p> trust line          "No accounts, no login wall..."
  │             ├── LensSheet                        components/explore/LensSheet.tsx
  │             │     (portal-style BottomSheet, conditionally rendered when lensOpen)
  │             └── NearMeSheet                      components/explore/NearMeSheet.tsx
  │                   (portal-style BottomSheet, conditionally rendered when nearOpen)
  └── BottomNav                 [client] components/app/BottomNav.tsx:1-117
        Three tabs: Explore (/) · Saved (/saved) · Discover SB (/discover)
        No Plan tab — plan is reached via in-page CTA only.
```

**Server vs client boundary:**
- `ExplorePage` is a server component (`force-dynamic`; no ISR/cache). It runs on every request, fetches DB data and weather, then passes everything as serialised props.
- `ExploreClient` and every Explore sub-component that uses `useState`/`useEffect`/`useSaves` are client components.
- `AppHeader` and `AppLayout` are server components; `BottomNav` is client (uses `usePathname` and `useSaves`).
- Weather fetch inside `getWeather()` uses `next: { revalidate: 1800 }` (30-minute ISR at the HTTP layer for OpenWeather), but the page itself is `force-dynamic`, so the weather data is at most 30 min stale while the content list is always fresh.

---

## §2 — Surface Specifications

### 2.1 App Header / Masthead

**File:** `components/app/AppHeader.tsx:1-16`  
**CSS:** `.sbd-header`, `.sbd-header__mark`, `.sbd-header__name`, `.sbd-header__tag`  
**Component type:** Server

Renders a sticky (`position: sticky; top: 0; z-index: 40`) horizontal bar containing:
- Left: 30×30px Pacific-filled square with gold Fraunces "S" (the brand mark)
- Right of mark: stacked wordmark "SB Daymaker" (Fraunces semi, `--text-lg`) over tagline "Santa Barbara, daily" (uppercase, letter-spaced, `--sage-text`, `--text-xs`)

**No condensing-on-scroll behavior exists.** The header height is fixed; there is no JS or IntersectionObserver that shrinks it. (Canon wireframe shows condensing; see §4.)

**Padding:** honors `env(safe-area-inset-top)` on notched phones. Background is `--bg` (Plaster), creating a natural bleed with the page background.

**Shared dependency:** Used identically on Saved and Discover SB pages.

---

### 2.2 Job Strip

**File:** `components/explore/ExploreClient.tsx:55-66`  
**CSS:** `.sbd-job-strip`, `.sbd-job-strip__find`, `.sbd-job-strip__save`, `.sbd-job-strip__share`, `.sbd-job-strip__dot`

Renders a centred single-row micro-label strip immediately below the header and above the Hero. Not present on Saved or Discover SB — Explore only (code comment: "QW-3: thin job-line strip under the masthead, Explore screen only").

**Exact copy:** `Find it · Save it · Share it`  
- "Find it" — `--terra-text` (AA-safe terracotta variant)
- "Save it" — `--pacific`
- "Share it" — `--gold-text` (AA-safe gold variant)
- Dots (·) — `--line` color; `aria-hidden="true"`
- Font: 10px, weight 800, uppercase, Inter

**Interactions:** None. Static decorative element.  
**Data source:** None.

---

### 2.3 Golden-Hour Hero

**File:** `components/explore/Hero.tsx:1-152`  
**CSS:** `.sbd-hero`, `.sbd-hero--{morning|afternoon|evening|night|gray}`, and subelements  
**Component type:** Server-rendered shell, client-hydrated only via SaveHeart button

#### 2.3.1 Time-of-day variant derivation

`getTimeOfDay()` in `lib/weather.ts:10-18` reads the current hour in `America/Los_Angeles` and returns one of four buckets:

| Bucket | Hours (SB local) |
|--------|-----------------|
| `morning` | 05:00–10:59 |
| `afternoon` | 11:00–16:59 |
| `evening` | 17:00–20:59 |
| `night` | 21:00–04:59 |

The `variant()` function in Hero (`Hero.tsx:14-20`) overrides the TOD variant to `"gray"` when `weather.isClear === false` **and** the condition string contains "cloud", "rain", or "fog". This is the only weather-driven change.

**Greeting labels (TOD_LABEL, line 7-12):**
- morning → "Good morning"
- afternoon → "Good afternoon"
- evening → "Golden hour"
- night → "After dark"

*(These labels are defined but only used as a fallback when weather is null — see §2.3.2.)*

#### 2.3.2 Sky gradient per variant

Five sky gradient classes, applied as `sbd-hero--{v}` on `<section>`:

- **morning:** Pacific → lightened Pacific → Plaster (blues-to-pale)
- **afternoon:** Pacific → lighter Pacific → sage-mix (sky-to-haze)
- **evening:** Pacific dark → Pacific → tile-light → gold (sunset warm)
- **night:** Ink → Pacific dark → Pacific (deep dark to teal)
- **gray:** Ink-2 → lighter ink-2 → `--line` (desaturated marine layer)

#### 2.3.3 Inline SVG skyline (`.sbd-hero__range`)

Fixed 600×170 viewBox, `preserveAspectRatio="xMidYMax slice"`, `aria-hidden="true"`, height 120px, positioned absolute at the bottom of the hero.

Silhouette elements (all coded as basic SVG rects/polygons/paths with token fills):
1. Rolling hills / foothills (`sbd-hero__hills` — Pacific fill at 0.5 opacity)
2. Mission Santa Barbara: facade + two bell towers + triangular pediment + central arch
3. Lone palm: trunk rect + 5 palm-frond paths (`sbd-hero__palm`)
4. Courthouse El Mirador clock tower: main shaft, belfry rect, pointed arch, spire rect, lit window (`sbd-hero__window`)
5. Three stepped red-tile-roof buildings (rect + polygon roofline each)
6. Stearns Wharf: horizontal deck rect + 5 pilings

On gray days: hills, buildings, and palm all shift to `--ink-2` fills (desaturated). The fog band (`sbd-hero__fog`) appears as a soft gradient rising from behind the skyline.

#### 2.3.4 Animated sun

`.sbd-hero__sun`: 52×52px radial-gradient disk (gold center → transparent), positioned absolutely and animated with `sunEntry` (0.8s ease-out on load) + `sunPulse` (3s looping glow after 1s delay).

Position by variant (per CSS):
- morning: `left: 16%; top: 40%` (rising, left horizon)
- afternoon: `left: 46%; top: 16%` (overhead center)
- evening: `left: 74%; top: 44%` (setting, right horizon)
- night: `opacity: 0` (hidden)
- gray: `opacity: 0.22` (barely visible behind cloud)

`prefers-reduced-motion`: `sunPulse` and `sunEntry` are referenced in the CSS but no explicit `prefers-reduced-motion` guard appears on the sun animations themselves. The CSS comment at `sbd-hero--gray .sbd-hero__sun` only sets opacity. **Potential WCAG gap — see §5.**

#### 2.3.5 Date and conditions row (`.sbd-hero__sky`)

Renders one compact line: `{dateLabel} · {icon} {tempF}° · {description}` (capped at 2 facts).

- `dateLabel` = e.g. "Monday, June 30" (from `getDateLabel()`, `lib/weather.ts:24-30`, SB timezone)
- If weather is present: `{emoji} {tempF}°` joined with cap'd description (e.g. "☀️ 72° · Clear sky")
- If weather is null: falls back to greeting label (e.g. "Good morning")

Font: JetBrains Mono, `--text-xs`, uppercase, 0.12em letter-spacing, white with text-shadow.

#### 2.3.6 Hero pick card (`.sbd-hero__pick`)

**Source:** `ordered[0]` — the first item after cascade sort → horizon filter → lens filter → Near Me sort (see §3). When `ordered` is empty, `pick` is null and the pick card is not rendered (section still shows skyline and date).

Renders a horizontal card (side-by-side layout):
- Left: 84px photo slot (`.sbd-hero__pick-img`, gold gradient fallback `sbd-media--gold`) with overlay SaveHeart button
- Right body: eyebrow "Today's pick" (terracotta, uppercase), Fraunces title (2-line clamp, links to `/thing/{id}` via `sbd-stretch`), meta `📍 {neighborhood | "Santa Barbara"}`

**Photo:** `pick.photo_url` if present, rendered as `<img alt="" loading="lazy">` (decorative alt — no meaningful alt text on hero pick image; see §5).

**SaveHeart:** `overlay=true`, `aria-label="Save {title}" / "Saved {title}"`, `aria-pressed={saved}`, pop animation. Reads from `useSaves()`.

**No "evergreen fallback card"** is implemented. When `ordered` is empty, the pick is simply absent (`.sbd-hero__pick` block is `null`). Canon says "hero falls back to a hand-written evergreen card" — the Tier-3 evergreen items exist in the feed but there is no specific hero-fallback mechanism that pins one here if the feed is empty.

---

### 2.4 Control Row

**File:** `components/explore/ControlRow.tsx:1-65`  
**CSS:** `.sbd-ctrl`, `.sbd-ctrl__horizon`, `.sbd-ctrl__row`, `.sbd-ctrl__lens`, `.sbd-ctrl__near`

Stacked two-row layout:
1. **Top row:** `SegmentedControl` (Today / This Week / This Month), full width
2. **Bottom row (flex):** Lens/vibe button (flex:1) + Near Me button (shrinks to content)

#### Horizon Segmented Control
`components/ui/SegmentedControl.tsx:1-34`  
Uses `role="tablist"` with `aria-label="Time horizon"`. Each option is a `role="tab"` button with `aria-selected`. Active segment: white background `--surface`, Pacific text `--text-link`, card box-shadow. Inactive: transparent, muted text.

Options: `Today` (`"today"`), `This Week` (`"week"`), `This Month` (`"month"`)

#### Lens / Vibe Button (`.sbd-ctrl__lens`)
- Default state: icon `✦`, text "Any vibe", no border highlight
- Active state (lens selected): `.is-active` class adds `border-color: var(--pacific)`, icon and label switch to selected occasion's icon + label
- Tap → sets `lensOpen = true` → renders LensSheet

#### Near Me Button (`.sbd-ctrl__near`)
- Default: `📍 Near Me`
- Active (zone selected): `.is-active`, `aria-pressed={true}`, text becomes zone label (e.g. "Funk Zone")
- Tap → sets `nearOpen = true` → renders NearMeSheet

---

### 2.5 Lens Sheet (Occasion Tags)

**File:** `components/explore/LensSheet.tsx:1-51`  
**CSS:** `.sbd-lens-any`, `.sbd-lens-grid`, `.sbd-lens-opt`, `.sbd-lens-opt__pic`, `.sbd-lens-opt__label`  
**Wrapper:** `BottomSheet` (`components/ui/BottomSheet.tsx`)

BottomSheet kicker: "Tune the feed" · title: "What are you in the mood for?"

**Structure:**
1. Full-width "Any vibe — show everything" button (`.sbd-lens-any`) — active when `lens === null`
2. Grid of 10 occasion buttons (`.sbd-lens-grid`)

**10 Occasion tags** (from `lib/occasions.ts`):

| Key | Label | Icon | Color token |
|-----|-------|------|-------------|
| `date_night` | Date Night | 🍷 | `--terracotta` |
| `family_day` | Family Day | 👨‍👩‍👧 | `--sage` |
| `nightlife` | Nightlife | 🌃 | `--ink` |
| `catch_a_show` | Catch a Show | 🎭 | `--pacific` |
| `arts_culture` | Arts & Culture | 🎨 | `--purple` |
| `outdoors_active` | Outdoors & Active | ⛰️ | `--forest` |
| `wine_food` | Wine & Food | 🍇 | `--pacific-dark` |
| `free_sb` | Free in SB | 🏷️ | `--gold` |
| `hosting_visitors` | Hosting Visitors | 🧑‍🤝‍🧑 | `--pacific` |
| `solo` | Solo | 🚶 | `--ink-2` |

Each option: square icon area (background = occasion color token, `aria-hidden`), label text below. Active state: `.is-active` class.

**Selection behavior:** selecting any option immediately closes the sheet and sets `lens`. Selecting "Any vibe" sets `lens = null`. Selection is exclusive (one at a time or none). No multi-select.

**Filter logic:** `filterByLens()` in `lib/explore.ts:50-53` — filters `things` array to those where `t.tags.includes(tag)`. `t.tags` comes from `thing_tags` join rows.

**BottomSheet behavior:** scrim + slide-up panel, 86vh max-height, scroll within. Escape closes. Tab focus trapped. `aria-modal="true"`, `aria-label={title}`. `prefers-reduced-motion` respects CSS (no explicit JS guard — animation suppressed via CSS).

---

### 2.6 Near Me Sheet

**File:** `components/explore/NearMeSheet.tsx:1-83`  
**CSS:** `.sbd-near-locate`, `.sbd-near-note`, `.sbd-near-list`, `.sbd-near-opt`  
**Component type:** Client (uses `useState` for geolocation status)

BottomSheet kicker: "Near Me" · title: "Sort by what's closest"

**Structure:**
1. "Use my location" button (`.sbd-near-locate`) — triggers `navigator.geolocation.getCurrentPosition()` with 8s timeout; disabled while "locating"
   - Locating state: label becomes "Finding you…"
   - On success: calls `nearestZone(lat, lng)` → sets zone → closes sheet
   - On denial/error: shows note "No location — no problem. Pick a neighborhood instead." (`sbd-near-note`), manual list remains
2. Instructional note: "Or choose a neighborhood:" (unless denied, then above text)
3. Manual zone list (`.sbd-near-list`):

| Zone key | Label |
|----------|-------|
| `funk` | Funk Zone |
| `downtown` | Downtown / State St. |
| `waterfront` | The Waterfront |
| `montecito` | Montecito |
| `mesa` | The Mesa |
| `goleta` | Goleta |
| *(null)* | Anywhere in SB |

Active zone gets `.is-active` class on its button.

**Sort logic:** `nearMeSort()` in `lib/explore.ts:55-66` — stable sort that bubbles items where `t.nearby_zone === zone` to the top, preserving relative order within each group. Applied after `cascade()`.

---

### 2.7 Cascade Feed

**File:** `components/explore/CascadeFeed.tsx:1-252`  
**CSS:** `.sbd-feed-section`, `.sbd-sh`, `.sbd-sh__icon`, `.sbd-sh__label`, `.sbd-sh__badge`, `.sbd-sh__chev`  
**Component type:** Client

`CascadeFeed` receives `items` (the ordered array starting at index 1, i.e., everything after the hero pick) and `horizon`.

#### 2.7.1 Tier partitioning

Three tiers partitioned directly from `items`:
- **Tier 1** (`happening_tier === 1`): dated/upcoming events
- **Tier 2** (`happening_tier === 2`): recurring weekly happenings
- **Tier 3** (`happening_tier === 3`): evergreen places

If all three tiers are empty (total empty state):
```
EmptyState icon="🔍"
message="Nothing matches that combination right now. Try another vibe or a wider time horizon."
```
(`.sbd-empty` — dashed border, centered text, no action button in this context.)

#### 2.7.2 Lead section (Tier 1) — horizon-dependent layout

Section header (`.sbd-sh.sbd-sh--static`): non-interactive, shows icon + label + count badge.

| Horizon | Header label | Layout |
|---------|-------------|--------|
| today | 📅 "Happening Today" | `TodayLead` → PickCard stack |
| week | 📅 "Happening This Week" | `LeadDayRail` → day-by-day grouped rows |
| month | 📅 "Happening This Month" | `RockGrid` → full-bleed image tiles |

**Today — TodayLead (`CascadeFeed.tsx:39-60`):**  
Renders all Tier-1 items as `PickCard` components in a vertical stack (`.sbd-feed-section__list`). No item cap — all Tier-1 items render. Tone cycles: `cardTone(i)` → `"gold" | "sage" | "pacific"` (repeating mod-3).

**Week — LeadDayRail (`components/explore/LeadDayRail.tsx:62-98`):**  
Groups Tier-1 week items by SB-local calendar day (`groupByDay()` in `lib/explore.ts:113-141`), days ascending. For each day: a fixed 36px date column (weekday abbreviation in terracotta, large date number in Fraunces) + stacked row items. Each row item (`.sbd-leadday__it`): title as stretch link to `/thing/{id}`, meta line (place · facts), SaveHeart + share button (↗) in an actions column. Touch target: row itself is `display: flex` with min-height ≥44px per CSS.

**Month — RockGrid + RockTile (`components/explore/RockTile.tsx:74-117`):**  
`byDateAsc()` sorts Tier-1 items soonest-first. Initial display: 8 items. "See {n} more this month →" button loads next batch of up to 8. No "Show less" — **expand-only**. Each `RockTile` is a full-bleed image article:
- Background: `photo_url` via CSS `background-image`, or gold→terracotta gradient fallback (`.sbd-rock--nophoto`)
- Gradient overlay (`sbd-rock__ov`): dark-bottom scrim
- Content area: gold date pill (`formatWhen()` — "Jul 4" single day, "Jul 17–18" multi-day), Fraunces title (stretch link to `/thing/{id}`), neighborhood (very small, 0.656rem), blurb (single line clamp, 0.688rem)
- Actions: SaveHeart (overlay) + share (↗) button in top-right cluster (z-index:2 above stretch link)

#### 2.7.3 "Build your day" CTA

**Location:** `CascadeFeed.tsx:180-189` — between the Lead section and the Tier-2/3 collapsed sections.  
**Element:** `<Link href="/plan">` with `.sbd-build-cta`  
**Copy:** ☀️ icon · "Build your day" · "Tell us the shape — we'll draft it, you tweak it." · → arrow  
**CSS:** gold-tinted gradient border + background, terracotta shadow, always visible regardless of tier counts.

#### 2.7.4 Tier 2 — Recurring Weekly (collapsible)

Header button (`.sbd-sh`, `aria-expanded`, `aria-controls="explore-tier2"`):
- Icon: 🔁
- Label: "Happening this day each week"
- Badge: item count
- Chevron: rotates 0° when open, −90° when closed

Default: collapsed. On expand: `div#explore-tier2` is rendered with `hidden` removed. Items render as `ListCard` components in `.sbd-feed-section__list--inner`.

**No Tier-2 items are filtered by time-of-day, weather, or any other signal.** The entire Tier-2 set (already lens-filtered and near-sorted from ExploreClient) shows when expanded.

#### 2.7.5 Tier 3 — Evergreen (collapsible)

Header button (`.sbd-sh`, `aria-expanded`, `aria-controls="explore-tier3"`):
- Icon: ⭐
- Label: "Great any day"
- Badge: item count
- Chevron: same rotate behavior

Default: collapsed. Items render as `ListCard`.

#### 2.7.6 Collapsible state reset

Tier-2 and Tier-3 open/close state (`tier2Open`, `tier3Open`) persists across horizon changes — there is no effect that resets them when the horizon changes. Month pagination (`monthShownCount`) does reset to 8 via `useEffect([horizon])` (`CascadeFeed.tsx:120-123`).

---

### 2.8 PickCard (Tier-1 Today card)

**File:** `components/ui/Card.tsx:35-101`  
**CSS:** `.sbd-card`, `.sbd-card--interactive`, `.sbd-pick`, `.sbd-pick__media`, `.sbd-pick__tag`, `.sbd-pick__place`, `.sbd-pick__acts`, `.sbd-pick__share`, `.sbd-pick__body`, `.sbd-pick__title`, `.sbd-pick__blurb`, `.sbd-pick__facts`

Anatomy:
- **Media banner** (height 140px, `sbd-media--{tone}` gradient fallback):
  - Top-left: occasion Tag pill (color: always `"gold"` in PickCard — regardless of `cardTagColor`, which is only used on ListCard)
  - Bottom-left: `📍 {neighborhood}` place pill (dark scrim, white text)
  - Top-right (on article, not media): SaveHeart + share button cluster (`.sbd-pick__acts`, positioned absolute to article so tooltips aren't clipped)
- **Body** (`.sbd-pick__body`, padding 16px 20px 20px):
  - `<h3>` title (Fraunces, `--text-xl`) as stretch link
  - Blurb paragraph (body, muted)
  - Facts row: "Free" | price_band · "Fri 12 PM" (event start) · "21+" — joined by flex gap

**`cardFacts()`** derivation (`derive.ts:57-64`): pushes "Free" if `t.free`, else `t.price_band`; event time if `type === "event" && starts_at`; "21+" if `t.is_21_plus`.

**`cardBlurb()`**: `t.blurb ?? t.reason_to_go ?? ""`  
**`cardTag()`**: first key in `t.tags`, mapped to `OCCASION_BY_KEY[key].label`  
**`cardTone()`**: index mod 3 → gold/sage/pacific

Photo: `<img src={photo} alt="" loading="lazy">` (decorative alt — correct for ambient photos; title/tag provide the accessible name of the card).

**Share interaction:** Calls `shareUrl(url, t.title)` from `components/saved/share.ts`, which uses the browser Web Share API or clipboard fallback. URL format: `{window.location.origin}/thing/{id}`.

**Navigation target:** `/thing/{id}` via stretch link (`<a>` with `::after` pseudo-covering the whole card; see also `sbd-stretch` class in globals.css).

---

### 2.9 ListCard (Tier-2/3 compact card)

**File:** `components/ui/Card.tsx:107-169`  
**CSS:** `.sbd-listcard`, `.sbd-listcard__thumb`, `.sbd-listcard__body`, `.sbd-listcard__title`, `.sbd-listcard__blurb`, `.sbd-listcard__meta`, `.sbd-listcard__acts`

Horizontal layout: 96px thumbnail (left) + body + optional actions column.

- Thumbnail: `sbd-media--{tone}` gradient; photo if available (`alt=""`)
- Micro Tag pill (`sbd-tag--micro`, uppercase): color determined by `cardTagColor()`:
  - `type === "place"` → `"pacific"` (teal)
  - `t.free === true` → `"sage"` (uses `--sage-text` for AA fix)
  - else → `"terracotta"`
- Title: Fraunces `--text-lg`, stretch link
- Blurb: body, muted
- Meta line: `cardFacts(t).join(" · ")` in Pacific (e.g. "Free · Fri 12 PM")
- Actions (right column): SaveHeart + share button (↗)

---

### 2.10 Near Me Sort Behavior

Sort is applied in `ExploreClient.tsx:44-48` via `nearMeSort(cascade(lensed), zone)`:
- When `zone === null`: no sort change (original cascade order maintained)
- When zone is set: items with `t.nearby_zone === zone` bubble to front, preserving relative ordering within "near" and "far" groups
- This is a **stable sort** — equal items maintain input order

The sort applies to the entire ordered array (including the hero pick). So with a zone set, the hero pick card could change to a nearest-zone item even if a higher-tier dated event would otherwise lead.

---

### 2.11 One Perfect SB Day Card

**File:** `components/explore/OnePerfectDayCard.tsx:1-30`  
**CSS:** `.sbd-opd`, `.sbd-opd__overlay`, `.sbd-opd__body`, `.sbd-opd__eyebrow`, `.sbd-opd__title`, `.sbd-opd__sub`

**This component is NOT rendered anywhere in the live Explore flow.** It exists in the codebase but is not imported by `ExploreClient` or `CascadeFeed`. It is also not used on any other page. It is effectively dead code.

When used, its behavior would be: on tap, call `saveMany(ids)` (add all IDs as "want") and `router.push("/saved")`. The `ids` prop would come from `pickPerfectDay()` in `lib/explore.ts:144-159` — a heuristic that picks one Tier-1 event + up to 4 distinct-category places (up to 5 total).

**CLAUDE.md §9 states** that One Perfect SB Day "has moved to the Plan surface as the 'Make My Day' express button — it is no longer on Explore." This aligns with the code (not rendered on Explore), but the component and its supporting `pickPerfectDay()` function remain in the codebase as dead code.

---

### 2.12 Explore Footer

**File:** `components/explore/ExploreClient.tsx:88-97`  
**CSS:** `.sbd-foot`, `.sbd-foot__submit`, `.sbd-foot__trust`

Located at the bottom of `.sbd-explore__body`, below CascadeFeed.

Three items stacked with `gap: var(--space-4)`:
1. **EmailSignup** (`components/signup/EmailSignup.tsx`) — "The weekend, in your inbox" heading, "Two emails a week…" description, email input + "Subscribe" button. On submit: POST to `/api/subscribe`. States: idle / busy / done ("✓ Almost there — check your inbox to confirm.") / already ("✓ You're already subscribed.") / error ("Something went wrong — please try again.")
2. **Submit link** → `/submit`: "＋ Submit an event or business" (`--text-link` color)
3. **Trust line:** "No accounts, no login wall. Saves live on your device." (`--text-sm`, centered, muted)

---

### 2.13 Bottom Navigation

**File:** `components/app/BottomNav.tsx:1-117`  
**CSS:** `.sbd-nav`, `.sbd-nav__btn`, `.sbd-nav__ico`, `.sbd-nav__label`, `.sbd-nav__badge`

Fixed Pacific-background bar at the bottom. Three tabs (TABS constant, line 79-83):

| Tab | href | Icon | Label |
|-----|------|------|-------|
| Explore | `/` | sun-over-mountain SVG | "Explore" |
| Saved | `/saved` | heart SVG | "Saved" |
| Discover SB | `/discover` | compass SVG | "Discover SB" |

Active tab detection: `pathname === "/"` for Explore; `pathname.startsWith(href)` for others. Active tab: brightened gold color + gold pip (3px top border). Inactive: 78% white.

**Save count badge:** Only shown on Saved tab when `counts.total > 0`. Renders as a small gold pill with ink text.

**No Plan tab.** The `plan` icon is defined in ICONS but not used in TABS — TABS has exactly 3 entries.

**Accessibility:** `aria-label="Main"` on `<nav>`. `aria-current="page"` on active tab link. Focus ring: 2px gold outline (visible on Pacific background). Each tab is ≥44px min-height.

---

## §3 — State and Data Flow

### 3.1 Server-side data (per request)

`ExplorePage` (`app/(app)/page.tsx`) fetches in parallel:
1. **`getPublishedThings()`** (`lib/things.ts:91-100`): Supabase query:
   ```sql
   SELECT id, type, title, blurb, blurb_long, reason_to_go,
     happening_tier, happening_category, neighborhood, nearby_zone,
     price_band, free, starts_at, ends_at, buy_url, time_of_day_fit,
     is_21_plus, indoor, photo_url, photo_source,
     thing_tags(tag),
     happy_hour_windows(day_of_week, starts_local, ends_local, deal_text),
     recurring_schedules(category, day_of_week, start_time, end_time, label)
   FROM things
   ORDER BY happening_tier ASC
   ```
   RLS exposes only published rows to the publishable key. Returns `Thing[]`.

2. **`getWeather()`** (`lib/weather.ts:53-74`): Calls OpenWeather API for `SB_LAT=34.4208, SB_LNG=-119.6982` with `next: { revalidate: 1800 }`. Returns `Weather | null`.

3. **`getTimeOfDay()`**: Server-side hour bucket (SB timezone). Stable — no hydration mismatch.
4. **`getDateLabel()`**: Long date string (SB timezone).
5. **`nowMs = Date.now()`**: Passed to client for horizon filtering without re-reading `Date.now()` on client (prevents hydration mismatch in `withinHorizon`).

### 3.2 Client-side reactive state (ExploreClient)

| State | Type | Default | Effect |
|-------|------|---------|--------|
| `lens` | `OccasionKey \| null` | `null` | Filters feed by `thing_tags` |
| `horizon` | `Horizon` | `"today"` | Filters Tier-1 by date; changes CascadeFeed lead layout |
| `zone` | `Zone \| null` | `null` | Sorts feed by `nearby_zone` |
| `lensOpen` | `boolean` | `false` | Controls LensSheet portal |
| `nearOpen` | `boolean` | `false` | Controls NearMeSheet portal |

All state is **in-memory only** — not persisted to localStorage or URL. Navigating away and back resets all filters.

### 3.3 Feed derivation pipeline (runs on every state change via `useMemo`)

```
things (server prop)
  → withinHorizon(t, horizon, nowMs)    — removes past/out-of-range Tier-1
  → filterByLens(inHorizon, lens)       — removes items not tagged with lens
  → cascade(lensed)                     — sort: Tier 1 → 2 → 3, Tier-1 by starts_at
  → nearMeSort(cascaded, zone)          — bubble zone items to top (stable)
  → ordered[0] = hero pick
  → ordered.slice(1) = feed (CascadeFeed items)
```

### 3.4 Saves — localStorage

**Key:** `sbd.saves.v1`  
**Shape:** `Record<string, "want" | "been">`  
**Provider:** `components/saves/SavesProvider.tsx` — wraps root layout (`app/layout.tsx`), shared across all sections.

On mount: reads from `localStorage`, sets `saves` state, sets `hydrated = true`. All SSR/first-render: `saves = {}` (no hydration mismatch). Writes back on every change (if hydrated).

`toggle(id)`: cycles none → `"want"` → none (two-state toggle, not three-state on Explore). `"been"` state is only set via the Saved page's explicit toggle UI.

`isSaved(id)`: returns `Boolean(saves[id])` — true for both "want" and "been".

### 3.5 Time-of-day and weather acquisition

- TOD: computed server-side once per request by `getTimeOfDay()` in `lib/weather.ts`
- Weather: fetched server-side by `getWeather()` with 30-min HTTP cache. Result is `Weather | null` — null if `OPENWEATHER_API_KEY` is not set or fetch fails. Graceful degradation (no banner, no error shown).
- No client-side TOD or weather polling. No per-request AI calls anywhere in the Explore path.

### 3.6 No per-request AI calls

Confirmed: zero Claude API calls, zero LLM calls, zero AI-assisted ranking occur in response to any user action on Explore. All `things` data (blurbs, tags, tier assignments, nearby_zone) is pre-computed and stored in Supabase.

---

## §4 — Divergence Ledger

### 4.1 vs CLAUDE.md / v9 Canon

| # | Canon says | Code does | File/line |
|---|-----------|-----------|-----------|
| D1 | "One Perfect SB Day has moved to the Plan surface as the 'Make My Day' express button — it is no longer on Explore" | Correct — OPD is not rendered on Explore. However, `OnePerfectDayCard.tsx` and `pickPerfectDay()` in `lib/explore.ts:144-159` remain as dead code. | `components/explore/OnePerfectDayCard.tsx`, `lib/explore.ts:144-159` |
| D2 | "First Looks + New This Week" are listed as V1 Explore features in §9 | No `firstlook` card type, no "New This Week" rail, no "First Looks" section exists in the Explore feed. The `ThingType` includes `"firstlook"` in `lib/things.ts:5`, but no UI component uses it. | `lib/things.ts:5`, `components/explore/CascadeFeed.tsx` (absent) |
| D3 | "light Happy Hour (a 'last confirmed' list)" listed as Explore V1 | No Happy Hour section or time-gated rail exists anywhere in Explore. `happy_hour_windows` data is fetched (`lib/things.ts:56`) and stored on `Thing.happyHours` but no Explore component renders it. | `lib/things.ts:53-57`, `components/explore/CascadeFeed.tsx` (absent) |
| D4 | Header condensing-on-scroll ("the masthead") | AppHeader is `position: sticky` but has no scroll-listener, IntersectionObserver, or condensing behavior. Fixed height at all times. | `components/app/AppHeader.tsx`, `app/components.css:953-995` |
| D5 | Hero should "fall back to a hand-written evergreen card" when empty | When `ordered` is empty, `pick` is null and the hero pick block is simply absent. No evergreen fallback mechanism is implemented. | `components/explore/ExploreClient.tsx:50-51`, `components/explore/Hero.tsx:122-149` |
| D6 | `prefers-reduced-motion` should stop all looping animations (§6) | `sunPulse` and `sunEntry` on `.sbd-hero__sun` do not have an explicit `@media (prefers-reduced-motion: reduce)` guard in the CSS. The spine rail guard exists (line 1782-1787) but not for the hero sun. | `app/components.css:2307-2327` |
| D7 | `time_of_day_fit` field on Thing is fetched | The `time_of_day_fit` column is in `BASE_COLS` and on the `Thing` interface, but nothing in the Explore pipeline (cascade, filterByLens, nearMeSort, withinHorizon, or any card renderer) reads or uses it. | `lib/things.ts:39`, `lib/explore.ts` (unused) |

### 4.2 vs 02b_SBDaymaker_Wireframe.html

*(The wireframe is the canonical visual target; divergences here are production drifts.)*

| # | Wireframe shows | Code does | Notes |
|---|----------------|-----------|-------|
| W1 | Header condensing to a slim bar on scroll | Not implemented — header is fixed height | D4 above |
| W2 | "Happening today" time-rail / divider with a current-time marker | No time-rail or time divider exists in CascadeFeed | No code for this exists |
| W3 | First Looks / New This Week horizontal rail | Not implemented | D2 above |
| W4 | Happy Hour rail (time-gated) | Not implemented | D3 above |
| W5 | One Perfect SB Day card on Explore | Not rendered | D1 above; per canon it has moved to Plan |
| W6 | Horizon breakout as separate date-grouped display | Implemented — LeadDayRail for Week, RockGrid for Month. These are new additions beyond the wireframe and represent a correct evolution. | `components/explore/LeadDayRail.tsx`, `components/explore/RockTile.tsx` |

### 4.3 vs Wave Next Build Spec / Explore Horizon Decisions (`docs/explore-time-horizons/`)

| # | Spec says | Code does |
|---|-----------|-----------|
| H1 | Week horizon uses `LeadDayRail` (day-by-day grouped rows) | Implemented correctly |
| H2 | Month horizon uses `RockGrid` (full-bleed tiles, 8-at-a-time, expand-only) | Implemented correctly |
| H3 | Collapsible Tier-2/3 state resets when horizon changes | NOT reset — `tier2Open`/`tier3Open` persists across horizon changes (only `monthShownCount` resets). This may cause UX confusion (expanded Tier-2 on "Today" remains expanded when switching to "Month"). |

### 4.4 Potential Constraint Violations

| # | Constraint | Status |
|---|-----------|--------|
| CV1 | No per-request AI (load-bearing §2.3) | ✅ Not violated |
| CV2 | No end-user accounts (§2.4) | ✅ Not violated — saves are localStorage only |
| CV3 | Trust rule: ranker never reads sponsor status (§2.8) | ✅ Not violated — no sponsor field exists on `Thing` |
| CV4 | Three bottom-nav tabs only (no 4th tab) | ✅ Not violated — exactly 3 tabs in TABS constant |
| CV5 | No hardcoded colors (§8.2) | ⚠️ One hardcoded color found: `.sbd-saved-toggle__btn--been.is-active { background: #2F6248 }` in `app/components.css:212`. This is not the Explore path but is in the shared component CSS. |
| CV6 | WCAG 2.2 AA floor (§2.7 / §6) | ⚠️ `sunPulse` animation lacks `prefers-reduced-motion` guard (D6). Hero pick `<img alt="">` is decorative-empty which is arguably correct but the title link provides the accessible name; acceptable but worth noting. |

---

## §5 — Open Questions / Smells

1. **`time_of_day_fit` is fetched but never used.** `lib/things.ts` includes it in `BASE_COLS` and the `Thing` interface. No Explore (or any other) code reads `t.time_of_day_fit`. If the nightly pipeline is populating this column, it's going nowhere on the frontend. Either the wireframe's "vibe at this time of day" filter was never wired, or it's intentionally deferred.

2. **`firstlook` type is in `ThingType` with no UI.** `lib/things.ts:5` defines `"firstlook"` as a valid type. No component renders first-look items differently from ordinary things, and no "New This Week" or "First Looks" rail exists. This is a CLAUDE.md §9 V1 feature that is documented as planned but not built.

3. **Happy Hour windows are fetched but not rendered.** Every `Thing` carries `happyHours: HappyHourWindow[]` but no Explore component reads it. The data is wired; the surface is absent.

4. **Hero empty state.** When `ordered` is empty (e.g., narrow lens + narrow horizon + no matching things), the hero section renders only the skyline and date row — no pick card, no fallback message. This is silent rather than graceful. The canon requirement for an evergreen-card fallback is not implemented.

5. **Tier-2/3 collapse state persists across horizon changes.** A user who expands "Happening this day each week" on Today horizon will find it still expanded when they switch to This Week, even though the content and context change. Likely benign but unexpected.

6. **Month pagination state resets but the scroll position does not.** When `horizon` changes away from Month and back, `monthShownCount` resets to 8 (correct), but the user's scroll position is not managed. They may return to top unexpectedly.

7. **`sbd-hero__sun` animation not guarded by `prefers-reduced-motion`.** Both `sunEntry` and `sunPulse` run unconditionally. A user with motion sensitivity will see a pulsing sun on every load. CLAUDE.md §6 and §2 (WCAG 2.2 AA) require all looping animations to stop under `prefers-reduced-motion`.

8. **`OnePerfectDayCard` and `pickPerfectDay()` are dead code.** The component file exists and renders correctly if used, but nothing imports it. If OPD is permanently moved to Plan, these should either be removed or relocated.

9. **`TIER_META` constant in `lib/explore.ts:68-72` is defined but never imported by anything.** Not a bug, but dead export.

10. **Hero pick image has no meaningful `alt` text.** `<img alt="" loading="lazy">` in `Hero.tsx:126`. This is arguably correct (the stretch-linked title is the accessible label for the card), but the image adds no context for screen-reader users. Consistent with `PickCard` and `ListCard` behavior (also `alt=""`).

---

*End of specification. Document last updated: 2026-06-30.*
