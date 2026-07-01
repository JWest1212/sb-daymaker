# SB Daymaker — Explore Sections + Plan Time-of-Day · Build Spec (v2)

> **What this file is.** A prescriptive runbook for two sets of changes to the **live** app: (A) restructuring the **Explore** feed *below the horizon selector* into three renamed, collapsible tier-sections — with the lead section's label **driven by the horizon selector** — and the "Build a day" CTA repositioned; and (B) collapsing the **Plan** Time-of-Day filter from four periods to three. Modify-in-place.
>
> **v2 change.** Adds the **"preserve the live top"** rule (E1.0) and the **horizon-driven lead-section label** (E1.3), per Jim's screenshot of the live Explore page. Visual source of truth: `docs/.../SBDaymaker_Explore_Mockup-5.html` (re-synced).
>
> **Pairs with / supersedes.** Builds on `SBDaymaker_Plan_Reshape_Build.md` and Mockup-4. Supersedes reshape **R3**'s Explore CTA placement (now below the lead section, E2) and the reshape **Block model** (now 3 values, P1).
>
> **Operating rules unchanged** (`CLAUDE.md`): no accounts, **batch-AI only — no per-tap Claude call**, tokens only — never hardcode a hex, WCAG 2.2 AA. One phase at a time; **stop, run the dev server, show Jim, wait for approval**, commit with the given message.

---

## Quick answer to Jim's question
**The Today / This Week / This Month selector already exists on the live Explore page**, sitting just below the "Any vibe" dropdown / Near Me row and above the feed. The earlier mockup simply omitted it (it was out of sync). **It stays exactly where it is** — this restructure never touches it or anything above it. We only (a) bind the **lead section's label** to it (E1.3) and (b) restructure the feed **below** it.

---

## 0. The changes in brief

**Explore (everything below the horizon selector only)**
1. Split the feed into **three explicit sections by `happening_tier`**: **Happening Today** (Tier 1) · **Recurring Weekly** (Tier 2) · **Great any time** (Tier 3).
2. **Lead section is open**; **Recurring Weekly** and **Great any time** are **collapsed by default**, tap-to-expand.
3. **Build your day** CTA sits **after the lead section, before the two collapsed sections**.
4. **The lead section's label + contents follow the horizon selector:** Today → "Happening Today", This Week → "Happening This Week", This Month → "Happening This Month".

**Plan**
5. **Time of Day → three buttons**: Morning (12am–12pm) · Afternoon (12pm–5pm) · Night (5pm–12am). Map onto the existing `tod` enum with **no migration** (Night = `evening` + `late`).

---

## 1. Decisions locked

| # | Decision | Value |
|---|---|---|
| 1 | Live top | **Preserved untouched** (E1.0) — header, Find·Save·Share line, hero + Today's Pick, Any-vibe dropdown, Near Me, **horizon selector** |
| 2 | Feed shape | Three sections grouped by `happening_tier`, below the horizon selector |
| 3 | Section names | **Happening {Today/This Week/This Month}** (dynamic) · **Recurring Weekly** · **Great any time** |
| 4 | Default collapse | Lead **open**; Recurring + Great any time **collapsed**; tap to toggle |
| 5 | Lead label/contents | **Bound to the horizon selector** (E1.3); Tier 2/3 are **not** horizon-scoped |
| 6 | CTA position | **After** the lead section, **before** the two collapsed sections |
| 7 | Plan Time of Day | **3 buttons** — Morning / Afternoon / Night, ranges below; **no enum migration** |
| 8 | Saved entry | "Build a day from your saved →" entry (reshape R3) stays |

---

## 2. Scope map

| Phase | Action | Touches | Risk |
|---|---|---|---|
| **E1** | Three renamed, collapsible tier-sections **below the horizon selector**; lead label bound to horizon | Explore feed render, section headers | medium |
| **E2** | Reposition "Build a day" CTA below the lead section | Explore layout | low |
| **P1** | 3-button Time of Day + ranges + `tod` mapping | Plan setup, types, `rankCandidates`, `buildDraft` | medium |
| **P2** | Propagate 3-block model + confirm Saved entry | Plan spine, draft prior, Saved entry | low |

---

## Phase E1 — Explore: three tier-sections (below the horizon), horizon-aware lead

### E1.0 — Preserve the live top (do NOT touch)
Everything **above the first tier section is live-site furniture and must not be moved, restyled, or rebuilt.** Specifically, leave intact, in place, exactly as live:
- The header (logo · **SB Daymaker** · *Santa Barbara, daily*).
- The **FIND IT · SAVE IT · SHARE IT** job line.
- The **hero** (golden-hour skyline + date/greeting) **including the overlaid "Today's Pick" card** and its save heart.
- The **"Any vibe ▾" dropdown** and the **"Near Me"** button.
- The **Today / This Week / This Month** horizon selector.

The E1 restructure begins **immediately below the horizon selector**. Do not absorb the hero's "Today's Pick" into the new sections — it remains the hero's featured lead. (If today's hero pick is also a Tier-1 item, keep whatever de-dupe the live feed already does so it isn't listed twice.)

### E1.1 — Three sections grouped by tier
Render, below the horizon selector, in this order:
1. **Lead section** — `happening_tier = 1` (dated). **Open by default. Label is dynamic (E1.3).**
2. **Recurring Weekly** — `happening_tier = 2` (recurring rhythms; unions `recurring_schedules` + `happy_hour_windows`). **Collapsed by default. Fixed label.**
3. **Great any time** — `happening_tier = 3` (evergreen reasons-to-go). **Collapsed by default. Fixed label.**

This **replaces the old lead-and-blend presentation** (Tier-1 leading, 2/3 backfilling one list) with three discrete sections. The hero still leads above them.

### E1.2 — Collapse mechanics
- **Recurring Weekly** and **Great any time** headers are real `<button>`s with `aria-expanded` + `aria-controls`, a **count badge** (e.g. `Recurring Weekly · 8`), and a chevron that rotates on expand. **≥44px**, `:focus-visible`, instant under `prefers-reduced-motion`.
- The **lead section header is not collapsible** (it's the always-on lead) — label + optional count, no chevron.
- **Default each load:** lead open, the other two collapsed. Cross-session persistence is **optional** (`localStorage: sbdm:exploreSections`); flag the choice.
- **Empty tier → hide the whole section** (header included). Tier-3 should essentially always have content.
- If sticky section headers are currently implemented (Wave-Next Phase 10), keep them working with the toggles; **felt behavior wins** — flag if sticky + collapse conflict.

### E1.3 — Horizon drives the lead section (NEW)
The existing **Today / This Week / This Month** selector already time-filters the dated feed. Bind the **lead section** to it:
- **Label:** Today → **"Happening Today"** · This Week → **"Happening This Week"** · This Month → **"Happening This Month"**.
- **Contents:** the lead section shows **Tier-1 dated happenings within the selected window**, using the **existing horizon filter** the selector already drives (reuse it; do not build a new filter). The count badge (if shown) reflects the windowed count.
- **Tier 2 (Recurring Weekly) and Tier 3 (Great any time) are NOT horizon-scoped** — recurring rhythms and evergreen spots are timeless; their labels and contents **do not change** when the horizon changes. (If the live app currently applies the horizon to all tiers, scope it to the lead/Tier-1 section only and **flag** the change.)
- Selecting a horizon should update the lead label + contents without disturbing the collapse state of the other two sections.

**Acceptance:** the live top is byte-for-byte unchanged; below the horizon selector there are three sections in order; the lead is open and renames to Happening Today/This Week/This Month as the selector changes, refilling with that window's dated items; Recurring Weekly & Great any time stay collapsed with fixed labels and don't react to the horizon; empty tiers are hidden; keyboard + reduced-motion clean. Show Jim all three horizons.
**Commit:** `feat(explore): horizon-aware lead section + collapsible Recurring/Evergreen tiers`

---

## Phase E2 — Explore: reposition the "Build a day" CTA
Move the **"Build your day"** CTA (from reshape R3) to render **immediately after the lead section and before Recurring Weekly** — always visible regardless of the lower sections' collapse state or the chosen horizon. Copy/styling unchanged (title **"Build your day"**, sub *"Tell us the shape — we'll draft it, you tweak it."*, gold/terra accent, ≥44px). Tapping routes to `/plan` setup.
**Acceptance:** CTA appears after the lead section, before the two collapsed sections, always visible; tap opens `/plan`.
**Commit:** `feat(explore): place Build-a-day CTA after the lead section`

---

## Phase P1 — Plan: three Time-of-Day categories + ranges + `tod` mapping
*(Unchanged from v1.)*
- **Setup "Which parts of the day?" → three buttons:** **🌅 Morning** (12:00am–12:00pm) · **⛅ Afternoon** (12:00pm–5:00pm) · **🌙 Night** (5:00pm–12:00am). Keep multi-select, the "sets your spine" hint, and the ≥1-selected gate.
- **No schema change.** Add `BLOCK_TO_TOD = { morning:['morning'], afternoon:['afternoon'], night:['evening','late'] }` (Appendix A).
- **`rankCandidates`** tests daypart fit as **intersection** with `BLOCK_TO_TOD[block]`; empty `time_of_day_fit` stays neutral.
- **Timed-event bucketing** by local clock time of `starts_at`: `00:00–11:59 → morning`, `12:00–16:59 → afternoon`, `17:00–23:59 → night`. The time chip still shows the real `starts_at`.

**Acceptance:** three period buttons with right icons/labels; Night surfaces evening/late content; a 7:30pm show buckets to Night, a 1pm tasting to Afternoon; no migration ran; existing `time_of_day_fit` untouched.
**Commit:** `feat(plan): collapse Time of Day to Morning/Afternoon/Night (no schema migration)`

---

## Phase P2 — Plan: propagate the 3-block model + confirm Saved entry
*(Unchanged from v1.)*
- **`lib/plan/types.ts`:** `Block = 'morning' | 'afternoon' | 'night'`; update `PlanAnswers.periods`, `WorkingDay.periods`, `Stop.block`. `Tod` stays the 4-value DB enum, reached via `BLOCK_TO_TOD`.
- **Spine:** up to three sections (Morning 🌅 / Afternoon ⛅ / Night 🌙) from selected periods; keep `--tod-*` rail tokens (map Night to the gold/evening end; flag if a token is missing).
- **`buildDraft` default prior → 3 blocks:** `morning:['outdoors_active','food_drink_spot']` · `afternoon:['arts_culture','shopping_browse','food_drink_spot']` · `night:['wine_food','catch_a_show','nightlife']` (soft boost only when `vibes` empty).
- **Saved entry (confirm):** "Build a day from your saved →" at the top of Saved (Things) routes to `/plan` setup. Add it if reshape R3 hasn't shipped it.

**Acceptance:** 3-period selection → 3-section spine with correct icons; draft fills Night from evening/late content; types compile; Saved shows the build entry and it opens the planner.
**Commit:** `feat(plan): 3-block spine + draft prior; confirm Saved build-a-day entry`

---

## Appendix A — Time-of-Day mapping & bucketing

```ts
type Block = 'morning' | 'afternoon' | 'night';            // UI / spine
type Tod   = 'morning' | 'afternoon' | 'evening' | 'late'; // DB enum — UNCHANGED

const BLOCK_TO_TOD: Record<Block, Tod[]> = {
  morning:   ['morning'],          // 12:00am–12:00pm
  afternoon: ['afternoon'],        // 12:00pm–5:00pm
  night:     ['evening', 'late'],  // 5:00pm–12:00am
};

function blockForStartsAt(startsAtLocal: Date): Block {
  const h = startsAtLocal.getHours();   // venue-local 0–23
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'night';
}
// Daypart fit in rankCandidates: thing fits `block` if time_of_day_fit intersects
// BLOCK_TO_TOD[block]; empty time_of_day_fit = neutral (no penalty).
```

---

## Appendix B — Types deltas
```ts
// lib/plan/types.ts
type Block = 'morning' | 'afternoon' | 'night';   // was morning|afternoon|evening|late
interface PlanAnswers { /* ... */ periods: Block[]; }
interface WorkingDay  { /* ... */ periods: Block[]; stops: Stop[]; }
interface Stop        { /* ... */ block: Block; }
// Tod (4-value) stays the DB enum type; reach it via BLOCK_TO_TOD.
```

---

## Appendix C — Constraint self-check (report before "done")
**Live top untouched** (header, Find·Save·Share, hero + Today's Pick, Any-vibe, Near Me, horizon selector) · no accounts · **no per-tap AI** (cascade + planner deterministic; Supabase reads only) · no transactions · no `.ics` · no map · **tokens only, no hardcoded hex** (chevron, count badge, CTA, Night rail) · **44px** + `:focus-visible` + `aria-expanded`/`aria-controls` on collapsible headers and the CTA · reduced-motion makes collapse + chevron instant · **no DB migration** (`tod` enum unchanged) · the four planner core behaviors still hold.

---

## Appendix D — Calls I made for you (change any before building)
1. **No `tod` enum migration.** UI "Night" aggregates `evening` + `late`; existing tags preserved.
2. **"Recurring Weekly" label vs. content.** Tier-2 includes monthly/biweekly rhythms (First Thursday, Art Walk). The label undersells those — **"On a Rhythm"** or **"Weekly & Monthly"** would read more accurately. Your wording kept as specified; the mockup deliberately shows a 1st-Thursday item under this header so you can judge.
3. **Horizon scoping.** Bound to the **lead/Tier-1 section only**; Tier 2/3 stay timeless. If you want the horizon to also narrow recurring/evergreen, say so.
4. **Lead section not collapsible** (always open). If you'd rather it also collapse, trivial to add.
5. **Collapse persistence** defaults off (reset each load). Tell me if you want last state remembered.

---

*End of spec v2. Build phase by phase; stop and show Jim after each; update `CLAUDE.md` if the Explore section model or Plan Time-of-Day vocabulary is described there.*
