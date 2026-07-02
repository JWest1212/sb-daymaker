# SB Daymaker — Explore Phase 6 Build Spec

**Type:** Delta build spec (implementation) · **Target:** Claude Code · **Scope:** Explore · mobile readability + This Week grouping
**Builds on:** the shipped Explore redesign (Phases 1–5) and `SBDaymaker_Explore_Redesign_Build.md`
**Companion mockup:** `SBDaymaker_Explore_Phase6_Mockups.html` (referenced by anchor throughout — open it alongside this spec)
**Date:** 2026-07-01 · **Status:** approved for build

---

## 0. What this phase does

Three changes, all aimed at making Explore readable and coherent on a phone:

1. **Row card → full-width description ("Option B").** Rework the shared `ListCard` so the thumbnail + occasion pill + title sit in a header row with the actions, and the **description drops below and spans the full card width at 3 lines.** Because `ListCard` is shared, this improves **This Week rows, Today briefs, and Tier-2/3** at once.
2. **This Week → day header + connecting spine.** Replace the cramped left date-column in `LeadDayRail` with a full-width day header ("Wednesday · July 1" + short terracotta rule) and a thin spine tying that day's cards together.
3. **Today feature card → description 2 → 3 lines.** One clamp change on the lead `PickCard`.

**Not in scope (explicitly excluded by decision):** the optional "More today" divider on the Today screen. Do **not** add it.

---

## 1. Decisions already made — confirm at the checkpoint, don't reopen

These are **DECIDED**. They're listed here only so you (and Jim, at the render checkpoint) can see them plainly.

- **D1 — Option B applies at all widths.** The blurb-below-header structure is the single card everywhere (desktop + mobile). The actions sit in a bottom meta row beside the date at all widths. Only **one** thing is gated to `≤480px`: the row title steps 20 → 18. Everything else (structure, thumb 44, full-width blurb, one-line eyebrow, side-by-side actions) is identical at all widths. *Rationale: one maintainable card; the full-width blurb helps desktop too.*
- **D2 — Spine uses a header node only** (one terracotta dot per day header), not a node per card.
- **D3 — Option B flows to Tier-2/3** because they share `ListCard`. That's intended (consistency).

If any of D1–D3 is wrong, it's a small change — but implement them as written unless told otherwise.

---

## 2. Constraints (carried from the main spec — do not violate)

- **Hero is OUT OF SCOPE.** Do not touch `Hero.tsx` or `.sbd-hero*` CSS.
- **Presentation layer only.** No schema/query/ranker/ingestion/AI changes. `groupByDay()` and all of `lib/explore.ts` are consumed **as-is** — do not modify their logic.
- **Tokens only.** No new hex. Use the v9 tokens already in `sbdaymaker_tokens.css`.
- **WCAG 2.2 AA:** every action stays a **≥44×44px tap target**; `:focus-visible` ring `3px var(--pacific)`; color never the sole signal; no new looping/entry motion.
- **No new component files** — reuse the Phase 1 primitives (`CardActions`, `Pill`, `DateEyebrow`, `SBIcon`). This phase edits existing components + CSS only.
- **Preserve behavior:** saves (`localStorage sbd.saves.v1`), share (`shareUrl`), stretch-link to `/thing/{id}`, horizon filtering, lens/near.

---

## 3. Change 1 — Row card, full-width description (Option B)

**File:** `components/ui/Card.tsx` → `ListCard` · **CSS:** `app/components.css`
**Visual + spec reference:** mockup **§A** (`#ref-rowcard`).

### 3.1 New anatomy (replaces the current single-row body)

```
.sbd-listcard                      (surface, radius 16, shadow, padding 12)
  .sbd-listcard__top               (flex, gap 10, align-items:flex-start)
    .sbd-listcard__thumb           (44×44, radius 12) — render ONLY if photo_url; else omit
    .sbd-listcard__head            (flex:1, min-width:0)
      <Pill occasion={firstTag}/>  (margin-bottom 6)
      .sbd-listcard__title         (Fraunces, stretch-link → /thing/{id}, 2-line clamp)
  .sbd-listcard__blurb             (FULL WIDTH — sibling of __top; 3-line clamp; margin-top 8)
  .sbd-listcard__meta              (flex, align-items:center, justify-content:space-between; margin-top 9)
    <DateEyebrow/>                   (mono, bottom-left of the meta row)
    <CardActions … onImage={false}/> (bottom-right; z-index above the stretch-link)
```

**Two structural moves make this card work:**
1. **`__blurb` and the meta row are siblings of `__top`, not children of `__head`** — that's what lets the description use the whole card width instead of the narrow title column.
2. **The actions live in the bottom `__meta` row beside the date — NOT in the top-right corner.** This is deliberate and load-bearing: with the actions out of `__top`, that row's height is just the title, so the description sits directly beneath it (no empty gap), and the title gets the full width beside the thumbnail (no mid-word truncation). Do not put `CardActions` back in `__top`.

### 3.2 Pixel spec (all widths unless noted)

| Element | Spec |
|---|---|
| Card | `background:var(--surface); border-radius:var(--radius-lg); box-shadow:var(--shadow-card); padding:var(--space-3);` |
| `__top` | `display:flex; gap:10px; align-items:flex-start;` — contains only thumb + head (title), so its height = the title |
| `__thumb` | `44×44; border-radius:var(--radius-md); object-fit:cover;` — **rendered only when `photo_url` exists**, otherwise omitted entirely |
| Pill | occasion token fill + legal text (`Pill` primitive); `margin-bottom:6px` |
| `__title` | Fraunces 700; `font-size:var(--text-lg)` (20); `line-height:1.14; letter-spacing:-.01em;` 2-line clamp; stretch-link; **full width beside the thumb** |
| `__blurb` | `Inter; font-size:var(--text-sm)` (14); `color:var(--ink-2); line-height:1.45;` **3-line clamp**; `margin-top:var(--space-2)` (8) |
| `__meta` | `display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:9px;` |
| `DateEyebrow` | mono `var(--text-xs)` (12); 700; `letter-spacing:.04em; text-transform:uppercase; white-space:nowrap;` color `var(--terra-text)`; bottom-left of `__meta` |
| `CardActions` | bottom-right of `__meta`; side-by-side; bare (no scrim); glyph 19px stroke `var(--ink-2)`; saved heart → `var(--terracotta)` fill; **each button ≥44×44 tap target** |

### 3.3 Mobile refinement — `@media (max-width:480px)`

Only **one** thing changes on phones now (the bottom meta row already solved the width problem, so actions no longer need to stack):
- `.sbd-listcard__title { font-size:18px; }`

Everything else — structure, thumb, full-width blurb, the meta row with side-by-side actions — is identical across widths.

### 3.4 Notes
- The 2-line title clamp replaces any mid-word truncation — long "{event} | {venue}" titles wrap to two lines cleanly.
- `cardFacts()`/`cardBlurb()`/`cardTag()` derivations are unchanged; only where their output renders moves.
- This is the shared `ListCard`, so **This Week rows, Today briefs, and Tier-2/3 all inherit it** (intended — D3).

---

## 4. Change 2 — This Week day header + spine

**File:** `components/explore/LeadDayRail.tsx` · **CSS:** `app/components.css`
**Visual + spec reference:** mockup **§B** (`#ref-dayspine`).

### 4.1 Replace the date-column layout

**Remove** the current left column (weekday abbrev + big date number beside each first-of-day row). Replace the whole rail with **day groups** built from the existing `groupByDay()` output (days ascending — unchanged):

```
.sbd-daygroup                      (position:relative; padding-left:22px)
  ::before  (spine)                (position:absolute; left:6px; top:6px; bottom:6px; width:2px; background:var(--line); border-radius:2px)
  .sbd-dayhead                     (position:relative; margin-bottom:var(--space-3) 12)
    ::before (node)                (position:absolute; left:-19px; top:5px; 9×9; border-radius:50%; background:var(--terracotta); box-shadow:0 0 0 3px var(--plaster))
    .sbd-dayhead__label            (mono, var(--text-xs) 12, 700, letter-spacing:.13em, text-transform:uppercase, color:var(--terra-text))
    .sbd-dayhead__rule             (width:26px; height:2px; background:var(--terracotta); border-radius:2px; margin-top:6px; opacity:.55)
  .sbd-daygroup__list              (display:flex; flex-direction:column; gap:var(--space-3) 12)
    <ListCard …/> × n              (the §3 Option B card)
```

- **Between day groups:** `.sbd-daygroup + .sbd-daygroup { margin-top:var(--space-6); }` (24) — bigger than the 12 within-day gap, so each day reads as a unit.
- **Node:** header-node only (D2). The `box-shadow` ring uses `--plaster` so the dot sits cleanly on the page background.

### 4.2 Day label formatting

Format each group's date in **SB local timezone** as `EEEE · MMMM d`, then uppercase — e.g. `WEDNESDAY · JULY 1`. Use the project's existing date-format helper (the same tz utility `getDateLabel()` / `groupByDay()` rely on); do not introduce a new date library or change tz handling.

### 4.3 Applies at all widths
One Week layout. The spine + header render identically on desktop and mobile; the row cards inside follow §3 (including the ≤480px refinements).

---

## 5. Change 3 — Today feature card blurb 2 → 3

**File:** `components/ui/Card.tsx` → `PickCard` (the feature/lead card)
**Visual + spec reference:** mockup **§C** (`#ref-feature`).

- Change the blurb clamp from **2 lines to 3 lines** (`-webkit-line-clamp:3`).
- **Nothing else changes** — image band, occasion pill, `CardActions onImage` scrim, mono date eyebrow, Fraunces `--text-xl` (25) title, and the pacific mono time footer all stay exactly as-is.
- Applies at all widths.

---

## 6. Today screen — assembly (no new work, one prohibition)

**File:** `components/explore/CascadeFeed.tsx` (`TodayLead`)
**Visual reference:** mockup **§E** (`#screen-today`).

- The Today lead already renders the feature `PickCard` (now 3-line, §5) followed by `ListCard` briefs (now Option B, §3). **No structural change is needed here** beyond confirming the briefs use the updated `ListCard`.
- **Do NOT add a "More today" divider / section eyebrow.** (Excluded by decision.)

---

## 7. Acceptance checklist

**Row card (§3)**
- [ ] Description spans full card width at 3 lines, below the thumb+title header row.
- [ ] Actions sit in a bottom meta row beside the date (side-by-side, all widths); every button ≥44×44 target. Top row holds only thumb + title, so there is no empty gap under the title.
- [ ] Title uses full width beside the thumb; long "{event} | {venue}" names wrap to 2 lines instead of truncating. Title 20 desktop / 18 ≤480px.
- [ ] Date eyebrow is one line (nowrap, .04em); no "…10 / AM" wrap.
- [ ] Thumbnail 44×44, rendered only when a photo exists.
- [ ] Same card visibly used by This Week rows, Today briefs, and Tier-2/3.

**This Week (§4)**
- [ ] Old date column gone; each day shows a "WEEKDAY · MONTH D" header + terracotta rule.
- [ ] A thin `--line` spine runs down each day group with a terracotta node at the header.
- [ ] Card gap 12 within a day; 24 between day groups; days ascending.

**Today (§5–6)**
- [ ] Feature card blurb shows 3 lines; everything else unchanged.
- [ ] No "More today" divider present.

**Global**
- [ ] Desktop layout otherwise unchanged; only the title 20→18 step is width-gated (≤480px).
- [ ] Tokens only; hero untouched; `lib/explore.ts` unchanged.
- [ ] AA: 44px targets intact; focus-visible intact; no new looping motion.

---

## 8. File-change index

**Modify**
- `components/ui/Card.tsx` — `ListCard` → Option B anatomy (§3); `PickCard` blurb clamp 2→3 (§5)
- `components/explore/LeadDayRail.tsx` — day header + spine, replacing the date column (§4)
- `components/explore/CascadeFeed.tsx` — verify Today briefs use the updated `ListCard`; ensure no "More today" divider (§6)
- `app/components.css` — new/updated CSS for the Option B card, the day-group/spine, and the `≤480px` block

**Reuse (no change)** — `components/ui/CardActions.tsx`, `Pill.tsx`, `SectionHeader.tsx`, `SBIcon.tsx`, `lib/explore.ts` (`groupByDay`)

**Do not touch** — `Hero.tsx` and `.sbd-hero*`, Supabase queries, `lib/things.ts`, the ranker

---

## 9. Checkpoint

This is a single small phase — build all three changes, then **STOP and show** This Week and Today at phone width **and** desktop width (to confirm D1 didn't regress the approved desktop). Report what changed and wait for approval. If anything here conflicts with the live code, stop and ask rather than guessing.

*End of Phase 6 spec.*
