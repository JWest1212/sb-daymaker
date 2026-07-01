# SB Daymaker — Explore Lead Breakout · Claude Code Build Spec

**Status:** ready for build · base = live Explore audit (2026-06-29) · companion mockup = `16_SBDaymaker_Explore_Horizon_Lead_Breakout.html`

---

## 0. What this build does (read first)

The Explore tab stays exactly as it ships. The **only** change is that the dated **lead section (Tier 1)** — the single horizon-dependent block on the page — renders a different card layout per horizon:

- **Today** → editorial `PickCard` stack. **Already live. Do not change it.**
- **This Week** → a **day-by-day rail** (date column + item rows), grouped by SB-local day.
- **This Month** → **big-rock tiles** (full-bleed image, gold date pill), ordered **soonest → furthest**, showing the **first 8** with an **expand-only "See more this month →"** button revealing the rest.

Everything else on Explore is untouched: the job strip, the hero, the control row, the "Build your day" CTA, the collapsible **Recurring Weekly** (Tier 2) and **Great any time** (Tier 3) sections, the footer, and both sheets. Tiers 2 and 3 are timeless and identical across horizons — they are not part of this build.

This is a **presentation-only** change. No ranking, filtering, schema, or data-pipeline work.

---

## 1. Hard constraints (do not violate)

- **Do not touch** `cascade()`, `withinHorizon()`, or `filterByLens()` in `lib/explore.ts`. The lead's data query is identical in all three horizons; only the rendered layout differs.
- **Trust rule:** the lead must never read `sponsor_id` or `is_featured` for selection or ordering. (Schema enforces this intent — see the comment at `things` ~line 94.)
- **No per-request AI.** This is static rendering of already-ranked data.
- **WCAG 2.2 AA floor.** New interactive elements (the rock tiles, the "See more" button) need accessible names, visible focus, ≥44px targets, and must respect `prefers-reduced-motion`.
- **Never hardcode a color, font, or spacing value.** Pull from `sbdaymaker_tokens.css` and mirror the existing Explore card rules (`.sbd-pick`, `.sbd-listcard`). If a token seems missing, flag it — don't invent one.
- **No new schema fields.** Derive everything the tiles need from existing `Thing` data + existing `derive.ts` helpers (details in Phase 2).
- **Expand-only.** The "See more" button reveals the rest and disappears. There is **no** "Show less" collapse. This was decided — do not add a collapse.
- **Near Me on Month stays chronological.** Month sorts strictly by date; `nearMeSort` zone-bubbling is intentionally **not** applied to the Month lead. It still applies on Today and This Week. Do not wire `nearMeSort` into the Month lead.

---

## 2. Source-of-truth files (live repo)

Work against the **real repo and real code**, not the wireframe. The paths/line numbers below are from the 2026-06-29 audit; if the live code has drifted, **locate by component/function name and trust the live code** — then note the drift in your phase summary.

| Area | File | What's there |
|---|---|---|
| Feed + lead render | `components/explore/CascadeFeed.tsx` | Tier partition by `happening_tier`; lead = `.sbd-sh--static` + `PickCard`; Tier 2/3 collapsible `ListCard`; `HORIZON_LABEL` (~line 20); existing `tier2Open` / `tier3Open` `useState` |
| Page state | `components/explore/ExploreClient.tsx` | `cascade` + `filterByLens` + `nearMeSort` `useMemo` (~40–50); `feed = ordered.slice(1)`; passes `horizon` to `CascadeFeed` |
| Cards | `components/ui/Card.tsx` | `PickCard` (~35–101), `ListCard` (~107–169) — the link + overlay-heart pattern to mirror |
| Card helpers | `components/explore/derive.ts` | `cardTone`, `cardTag`, `cardPlace`, `cardFacts`, `cardBlurb` |
| Explore utils | `lib/explore.ts` | `cascade`, `withinHorizon`, `filterByLens`, `nearMeSort` (do not modify these three) |
| Heart | `components/ui/SaveHeart.tsx` | `<SaveHeart overlay>` — reuse as-is |
| CSS | `app/components.css` | Explore block (~2080–2750). Add new rules in that block. |
| Tokens | `sbdaymaker_tokens.css` | Color / type / spacing source of truth |

---

## 3. What to leave untouched (explicit)

Do **not** edit, refactor, or "improve" any of these as part of this build:

- The hero (`Hero.tsx`) and its weather/ToD logic.
- The control row (`ControlRow.tsx`), horizon segment, Lens or Near Me buttons/sheets.
- The "Build your day" CTA (`.sbd-build-cta`).
- The Tier 2 ("Recurring Weekly") and Tier 3 ("Great any time") sections — including their collapse behavior.
- The footer, email signup, submit link, trust note.
- The **Today** lead (`PickCard` stack) — it is the reference, kept as-is.
- `cascade`, `withinHorizon`, `filterByLens`, the schema, the pipeline.

---

## 4. Build phases

Four phases. **Finish one, run the dev server, verify, summarize what changed + what to test, then stop and wait for my go-ahead.** Do not run multiple phases without checking in. A blank screen is a JS runtime error (check variable scoping relative to `return`), not CSS.

---

### Phase 1 — Extract `LeadSection` (pure refactor, zero visual change)

**Goal:** Isolate the single switch point before changing any layout. Pull the current Tier-1 lead rendering out of `CascadeFeed` into one `LeadSection` that switches on `horizon` — with **all three branches initially returning the existing `PickCard` behavior**. The screen must look pixel-identical on all three horizons after this phase.

**Current:** in `CascadeFeed.tsx`, the lead (Tier 1) renders inline: the `.sbd-sh--static` header + `tier1.map(... PickCard ...)`.

**Changes:**
1. Add a `LeadSection` component (same file is fine) that receives `{ tier1, horizon, ...the props the cards already need }` and renders the **sticky lead header exactly as now** (`📅 HORIZON_LABEL[horizon]` + count badge) followed by a horizon switch:
```tsx
function LeadSection({ tier1, horizon, ...rest }) {
  // header unchanged: 📅 HORIZON_LABEL[horizon] + count badge
  if (horizon === 'today') return tier1.map(t => <PickCard key={t.id} t={t} {...rest} />); // live
  if (horizon === 'week')  return tier1.map(t => <PickCard key={t.id} t={t} {...rest} />); // TEMP: same as today
  return tier1.map(t => <PickCard key={t.id} t={t} {...rest} />);                          // TEMP: same as today
}
```
2. Replace the inline lead block in `CascadeFeed` with `<LeadSection .../>`.
3. Leave Build CTA + Tier 2 + Tier 3 + empty-state exactly where they are.

**Acceptance tests:**
- Today, This Week, This Month each render **identically to before** (same cards, same header, same order). This is a no-op visually.
- Empty state (all tiers empty) still shows the single `🔍` block unchanged.
- No console errors; tier badges still correct.

**Commit:** `refactor(explore): extract horizon-aware LeadSection (no visual change)`

---

### Phase 2 — Month lead → big-rock tiles + "See more" (the main visible change)

**Goal:** Wire the Month branch to a `RockGrid` of big-rock tiles, ordered soonest → furthest, first 8 shown, expand-only reveal.

**New CSS** (add to the Explore block in `app/components.css`, using tokens — mirror the radius/shadow/scale of `.sbd-pick`):
- `.sbd-rock` — full-bleed tile: relative, `overflow:hidden`, rounded, `min-height` ~130px, column, justify-end, image via `background-size:cover; background-position:center`, subtle shadow, pointer.
- `.sbd-rock__ov` — absolute inset gradient `linear-gradient(180deg, transparent 30%, rgba(0,0,0,.64))` for text legibility.
- `.sbd-rock__c` — relative content pad, white text.
- `.sbd-rock__when` — gold date pill: `background: var(--gold); color: var(--ink)`, small bold, rounded.
- `.sbd-rock__ttl` (Fraunces, ~19px/600), `.sbd-rock__vn` (~10.5px, .9 opacity), `.sbd-rock__nt` (~11px).
- `.sbd-rock-more` — full-width button: **≥44px tall**, paper background, `1.5px solid var(--line)`, text `var(--text-link)`/pacific, weight 700, centered, rounded; `:focus-visible` ring; honors `prefers-reduced-motion`.

**New helpers** (`lib/explore.ts` or a small `format.ts` — do NOT touch the three protected functions):
- `byDateAsc(items)` → returns items sorted by `starts_at` ascending. (Explicit, so the requirement holds regardless of `cascade` internals.)
- `formatWhen(starts_at, ends_at)` → `"Jul 4"` for single-day; `"Jul 17–18"` for multi-day; same-day or null `ends_at` collapses to one date.

**New components** (`components/explore/`):
- `RockTile` — a tile mirroring `PickCard`'s **link + overlay-heart pattern** (do not nest the `SaveHeart` button inside the `<a>` in an invalid way; copy how `PickCard` does it). Fields:
  - image: `t.photo_url` → if absent, the gold gradient fallback used elsewhere.
  - `.sbd-rock__when`: `formatWhen(t.starts_at, t.ends_at)`.
  - `.sbd-rock__ttl`: `t.title` (links to `/thing/${t.id}`).
  - `.sbd-rock__vn`: `cardPlace(t)` (reuse derive helper).
  - `.sbd-rock__nt`: `cardBlurb(t)` clamped to **1 line**. **If blank, omit the note line entirely** (no empty slot).
  - `<SaveHeart overlay ...>` top-right.
- `RockGrid` — wraps the sort + cap + reveal:
```tsx
function RockGrid({ items, expanded, onExpand }) {
  const rocks = byDateAsc(items);            // soonest first
  const shown = expanded ? rocks : rocks.slice(0, 8);
  return (
    <>
      {shown.map(t => <RockTile key={t.id} t={t} />)}
      {!expanded && rocks.length > 8 && (
        <button
          className="sbd-rock-more"
          onClick={onExpand}
          aria-label={`See ${rocks.length - 8} more events this month`}
        >
          See {rocks.length - 8} more this month →
        </button>
      )}
    </>
  );
}
```

**Wire-up in `CascadeFeed`:**
- Add `const [monthExpanded, setMonthExpanded] = useState(false)`.
- Reset on horizon change: `useEffect(() => setMonthExpanded(false), [horizon])` so leaving and returning to Month starts collapsed.
- Month branch of `LeadSection`:
```tsx
if (horizon === 'month')
  return <RockGrid items={tier1} expanded={monthExpanded} onExpand={() => setMonthExpanded(true)} />;
```
- **Do not** pass `tier1` through `nearMeSort` for Month. (Today/Week keep whatever they do now.)

**Acceptance tests:**
- Month lead shows full-bleed rock tiles, **soonest start first** (verify a Jul 2 item sits above a Jul 17 item).
- With >8 dated month items, exactly **8** render, then a "See N more this month →" button; tapping it reveals the rest and the button disappears. There is **no** collapse control.
- With ≤8 items, no button appears.
- Switching to another horizon and back to Month re-collapses to 8.
- A tile with no photo shows the gold gradient; a tile with no blurb omits the note line (no empty gap).
- Heart works on each tile and does not trigger navigation.
- Header still reads `📅 Happening This Month` + count.
- Button is keyboard-focusable with a visible ring, ≥44px tall; reduced-motion users get no animated reveal.

**Commit:** `feat(explore): month lead as big-rock tiles, soonest-first, 8 + see-more (expand-only)`

---

### Phase 3 — This Week lead → day-by-day rail

**Goal:** Wire the Week branch to a day-grouped rail of the same Tier-1 items.

**New helper** (`lib/explore.ts` or `format.ts`):
- `groupByDay(items, tz = SB_TZ)` → `[{ dayLabel, dateNum, items }]` grouped by SB-local calendar day, **day order ascending**, items within a day in their incoming order.

**New CSS** (mirror `.sbd-listcard` scale; tokens only):
- `.sbd-leadday` — row: flex, gap, bottom margin.
- `.sbd-leadday__dd` — fixed-width date column: `.w` weekday (small, terracotta) + `.n` day number (Fraunces ~23px).
- `.sbd-leadday__items` — column of rows.
- `.sbd-leadday__it` — white row card: `1px solid var(--line)`, rounded, padding, flex space-between, pointer; `.nm` (Fraunces) + `.m` (venue · price); inline `<SaveHeart>` (non-overlay) at the end; whole row links to `/thing/${t.id}` (mirror the existing row-link pattern; keep the heart's click isolated).

**New component** (`components/explore/`):
- `LeadDayRail({ items })`:
```tsx
function LeadDayRail({ items }) {
  return groupByDay(items).map(({ dayLabel, dateNum, items }) => (
    <div className="sbd-leadday" key={dayLabel + dateNum}>
      <div className="sbd-leadday__dd"><div className="w">{dayLabel}</div><div className="n">{dateNum}</div></div>
      <div className="sbd-leadday__items">
        {nearMeSort(items).map(t => <LeadDayRow key={t.id} t={t} />)}
      </div>
    </div>
  ));
}
```
- `nearMeSort` **is** applied within each day for Week (matches the original rule — proximity sorts inside a day, day order preserved).

**Wire-up:** Week branch of `LeadSection`:
```tsx
if (horizon === 'week') return <LeadDayRail items={tier1} />;
```

**Acceptance tests:**
- Week lead groups Tier-1 items by SB-local day, days ascending, with a date column beside each day's stacked rows.
- With Near Me active, items reorder **within** a day; day order is unchanged.
- Each row links to its detail; inline heart works and doesn't navigate.
- Header still reads `📅 Happening This Week` + count.
- Today and Month leads unchanged by this phase.

**Commit:** `feat(explore): week lead as day-by-day rail grouped by SB-local day`

---

### Phase 4 — A11y + degradation pass (final)

**Goal:** Verify the floor and the edges across all three leads; no new features.

**Checks / fixes:**
- Focus order and visible focus on rock tiles, the "See more" button, and day-row links/hearts.
- All interactive targets ≥44px; hearts retain their accessible `Save {title}` / `Saved {title}` names.
- `prefers-reduced-motion`: the "See more" reveal and any tile hover transitions are reduced/removed.
- Color: gold pill on dark imagery and the `.sbd-rock-more` text both clear AA (use the AA-safe token variants if any small text fails on light).
- Degradation: missing `photo_url` → gradient; missing `cardBlurb` → no note line; single-day vs multi-day `formatWhen`; a Week day with one item; a Month with exactly 8 (no button) and exactly 9 (button shows "1").
- Confirm Tier 2 / Tier 3 / Build CTA / hero / controls / footer are byte-for-byte unchanged in the diff.

**Acceptance tests:**
- Keyboard-only pass through Explore on all three horizons works cleanly.
- Lighthouse/axe (or your usual check) shows no new AA violations on Explore.
- `git diff` touches only: `CascadeFeed.tsx`, `Card.tsx` (if `PickCard` pattern was referenced — ideally untouched), the new `RockTile`/`RockGrid`/`LeadDayRail`/`LeadDayRow` files, the new helper(s), and `app/components.css`. Nothing else.

**Commit:** `chore(explore): a11y + graceful-degradation pass for lead breakout`

---

## 5. Done-when

All four phases merged; Explore on Today is visually identical to pre-build; This Week shows the day rail; This Month shows soonest-first rock tiles capped at 8 with an expand-only "See more"; Tiers 2/3, the CTA, hero, controls, and footer are untouched; the AA floor holds. The companion mockup `16_SBDaymaker_Explore_Horizon_Lead_Breakout.html` is the visual reference for all three.

## 6. Open data note (flag, don't guess)

`RockTile`'s date pill needs `starts_at` (events always have it per schema) and optionally `ends_at` for ranges. If `ends_at` isn't populated on multi-day month events, `formatWhen` should fall back to the single start date rather than show a broken range — and you should flag which month events lack `ends_at` so I can decide whether to backfill. Do not invent a `note` field; the note line reuses `cardBlurb` and is omitted when empty.
