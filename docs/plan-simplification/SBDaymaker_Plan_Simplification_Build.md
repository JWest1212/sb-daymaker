# SB Daymaker — Plan Surface · **Simplification Update** (Build Spec)

> **What this file is.** A focused runbook for Claude Code to update the **already-built, live** Plan surface so it stops auto-generating days and instead lets the user **build a single day, one stop at a time**. It is a *modify-in-place* spec, not a from-scratch build.
>
> **Scope discipline.** This doc only describes changes **required by the new approach**. Anything not named here is left exactly as it is in the live app. Do not "improve," refactor, or restyle untouched components.
>
> **Visual source of truth:** `docs/plan-feature/SBDaymaker_Plan_Mockup-3.html` (drop the regenerated mockup there). Where this doc and the mockup disagree on a pixel, the mockup wins; where they disagree on *behavior or data*, this doc wins.
>
> **Supersession.** This update **supersedes** the auto-generation parts of `docs/plan-feature/SBDaymaker_Plan_Build.md` — specifically its Phases 3–6 and the day-shape/slotting engine in §3. Phases 1 (`/plan` shell + nav), 7 (Save · Saved › Days · My-plans drawer), and 8 (Share) survive with only the small deltas called out in §10–§11 below.
>
> **Operating rules unchanged.** Everything in `CLAUDE.md` still governs: no accounts (localStorage only), **batch-AI only — no per-tap Claude call**, no transactions, no `.ics`, no map, **tokens only (never hardcode a hex)**, WCAG 2.2 AA. One phase at a time; **stop and show Jim the rendered result after each phase**, then wait for approval.

---

## 0. The change in one paragraph

Plan currently answers "what should my day be?" *for* the user — a **Make My Day** button and pre-written **day-shapes** assemble a full day they then tweak. We are removing that entirely. Plan now answers "help me **build** my day": the user sets the shape (the existing filters), lands on an **empty time-of-day spine**, and fills each slot from a **picker** that puts their saved spots and best matches first. The recommendation intelligence doesn't disappear — it moves from "author the whole day" to "**rank the picker**," where the user is always the one choosing.

---

## 1. Core behaviors — the four rules that must hold everywhere

These are the heart of the update. Every phase below serves them.

1. **Saved-first picker.** When the picker opens, the user's **saved** spots that fit are surfaced **at the top**, in a visually distinct **♥ From your saved** band, *above* all other suggestions. Saved is the product's moat; it always comes first.
2. **Keep adding, freely.** After the user adds a stop to a time-of-day section, a **fresh empty "Add a stop" slot appears directly beneath it**, so they can keep adding as many stops to that part of the day as they want. A section is always "the stops they've added, then one open slot."
3. **Time only when it's real.** A stop shows a time **only if the underlying `thing` has an actual `starts_at`** (a real, specific start datetime — i.e. a dated Tier‑1 event). Places, evergreen spots, and recurring things show **no time at all**. **Never** fabricate or display a daypart *range* (no "9–11 AM", no "Afternoon · 2–5 PM" on a card). The section header carries the part of day; the card carries a real clock time or nothing.
4. **Overlaps are fine — say nothing.** The user may add two timed stops that overlap, stack many stops in one block, or leave a block empty. **No conflict detection, no warnings, no auto-sorting by time.** Stops render in the **order the user added them**. The spine is a canvas, not a scheduler.

---

## 2. Decisions locked in the design session (apply as written)

- **Picker = prioritized ranking, nothing hard-excluded.** Daypart fit and the user's filters *boost* relevance; saved items pin to the top band; but no candidate is hard-filtered out (your `things.time_of_day_fit` is empty on many evergreen rows, so a hard daypart filter would risk an empty picker).
- **Saved band shows BOTH save states** — *want-to-go* **and** *been*. (Been is still a legitimate "take me back there" signal.)
- **Placed-stop controls = Heart + Remove (×). No Swap.** In a self-built spine, swap is just remove-then-add. (This intentionally drops the live app's "⇄ Swap" on placed stops.)
- **CTA label:** "Show me my day →" becomes **"Build my day →"**.
- **Spine sections = exactly the selected Time-of-Day periods.** No auto "Midday" lunch bridge (that belonged to the slotting engine, which is being removed).

---

## 3. REMOVE (delete the auto-generation paradigm)

Remove the following. If any is imported elsewhere, remove the import and the now-dead call site; **flag to Jim** if a removal touches anything outside the Plan surface.

**Setup screen (`/plan`):**
- The **"Make My Day"** flagship card and its tap handler (the express `buildDay(default…)` entry point).
- The **"OR SHAPE IT YOURSELF"** divider (with Make My Day gone, there's no fork to label).
- The **"Have spots saved already? · Pin them into your day →"** saved hook **and** the **build-from-saved pin flow** it opened (old Build Spec Phase 6). Saved spots now live in the per-slot picker (§8), so this separate entry point is redundant and reintroduces a parallel auto-slotting path we're eliminating.

**Spine / results screen:**
- The **`DayShapeSelector`** component and the **day-shape pills** (Classic Coastal / Funk Zone & Wine / Arts & State St.).
- The italic **day-shape caption**.
- All **auto-fill** behavior: the spine no longer calls the slotting engine, no longer pre-populates stops, and **no longer enforces "never a blank stop."** Empty is the *starting* state now.
- Any **fabricated time/daypart-range labels** on stop cards (see Rule 3).
- The **"⇄ Swap"** control on placed stops (see §2).

**Engine / config modules (delete the files):**
- `lib/plan/buildDay.ts` — the deterministic slotting engine. No longer called anywhere.
- `lib/plan/dayShapes.ts` — the hand-authored day-shape skeletons. No longer referenced.
- The **Midday auto lunch-bridge** logic (lived in the block model around `buildDay`).

> **Keep the `--tod-*` spine tokens.** They still color the rail and nodes (§7). Do not remove them.

---

## 4. REPURPOSE (one component is reused, not rebuilt)

- **The existing Swap bottom sheet → the Add-stop picker.** The swap sheet already does almost exactly what the picker needs: a sheet of candidates with **saved floated to the top**. Rename/retask it (e.g. `AddStopSheet`) and change three things: it's **opened from a blank slot** (not a placed stop), it **adds** a stop to that block (not replaces one), and its ranking follows §8. Reuse its existing list rows, `ⓘ` detail affordance, sheet chrome, focus management, and reduced-motion handling.

---

## 5. KEEP untouched (so Claude Code doesn't wander)

Do **not** modify these — they're correct as live:

- **Screen 1 filters as they exist today:** the segmented **When** control, the **Area** dropdown (`📍 Area → Anywhere ▾`), the **Time of Day** cards, and the **"Fine-tune your day"** disclosure containing **Who** and the full **8-tag Vibe** set (Outdoors, Wine & Food, Arts & Culture, Date Night, Catch a Show, Nightlife, Showing Visitors, Free SB). Only the three setup removals in §3 apply; the filter controls themselves are unchanged.
- **The bottom nav** (flat dark-teal bar, gold **Plan** tab, gold Saved badge), the `/plan` route shell, and the **My plans** drawer button.
- **Save · Saved › Days · My-plans drawer** plumbing (old Phase 7) — except the auto-title note in §9.
- **Share infra** (old Phase 8, `shared_states`, `/p/[token]`) — except the time-rule consequence in §11.
- The **detail screen**, the **image resolver**, the **saves store** (`want-to-go` / `been`), the **itinerary store** (`hooks/useItineraries.ts`), and all **design tokens**.

---

## 6. Screen 1 — Setup changes (precise)

After the §3 removals, the screen is: header → **When** → **Where (Area dropdown)** → **Time of Day** → **Fine-tune** (Who · Vibe) → CTA. (Matches Mockup‑3, Screen 1.)

- **CTA** reads **"Build my day →"**.
- **CTA behavior:** on tap, **navigate to the spine seeded with one empty section per selected Time-of-Day period** — and carry the answers (date, periods, who, vibes, zone) into the spine so the picker can rank with them. **Do not call any slotting engine. Do not pre-fill any stop.** The spine arrives empty.
- **Gate:** the CTA is **disabled until at least one Time-of-Day period is selected**, because that selection *is* the set of spine sections. (If Time of Day is empty, the day has no shape to build.)

---

## 7. Screen 2 — The spine: the build loop (precise)

Matches Mockup‑3, Screen 2.

- **Empty start.** On arrival the spine shows **one section per selected period**, in order (Morning · Afternoon · Evening · Night→`late`). Each section header keeps its **node + `--tod-*` color + emoji** and its **label**. Each section contains **only a single trailing "＋ Add a stop" slot** (dashed, ≥48px, in-voice copy: *"Add your first morning stop"* → after the first, *"Add another stop"*).
- **The loop.** Tapping a slot opens the picker (§8) scoped to that section's part of day. Selecting a candidate **appends it to that section** and the section **re-renders with a fresh trailing slot** beneath the new stop (Rule 2).
- **`SpineStopCard`** (reuse the existing card, with two changes):
  - **Controls = Heart + Remove (×) only.** Heart toggles the save state (existing saves store). **× removes** the stop from the day. **Remove the Swap pill.**
  - **Time display follows Rule 3:** render a time chip **iff** the stop's `thing.starts_at` is set, formatted as a clock time in the venue's local time (e.g. `7:30 PM`). Otherwise render **no time element**. Never render a daypart range.
  - Card body still taps through to the **existing detail screen**; `ⓘ` stays.
- **Order & overlaps (Rule 4):** stops within a section render in **insertion order**. Do **not** sort by time. Do **not** detect or warn on overlapping `starts_at`. Sections may be left empty.
- **Bottom bar:** keep **💾 Save plan** + **↗ Share** from the live app. **Both are disabled until the day has ≥1 stop** (an empty day can't be saved or shared). Their existing behaviors are otherwise unchanged (§9/§11).

---

## 8. The picker (`AddStopSheet`) — ranking + saved-first (precise)

This is where the four rules concentrate. **No Claude call here** — ranking is a pure, deterministic function over already-available published `things` (a normal Supabase read of published rows is fine; AI is not).

**Open context.** The sheet knows (a) the **block** it was opened from (a `tod` value) and (b) the **PlanAnswers** (date, who, vibes, zone). Kicker copy: *"Adding to your {block}."*

**Two bands, saved always on top (Rule 1):**
1. **♥ From your saved** — the user's saved items (**both `want-to-go` and `been`**) that plausibly fit, ranked by the relevance score below. Distinct gold-tinted band, labeled. *(Optionally mark a `been` item with a small "Been" pip so it's recognizable — but still include it.)*
2. **More that fit** — all other published candidates, same ranking, nothing hard-excluded.

**Ranking (prioritized, not filtered).** Score each candidate and sort desc; **never drop** a candidate for failing a single signal:
- **+ daypart fit** — `things.time_of_day_fit` contains the opened block's `tod`. (Empty `time_of_day_fit` is neutral, not a penalty — this is why we don't hard-filter.)
- **+ vibe match** — candidate's `occasion_tag` ∈ the selected vibes (§10).
- **+ who signal** — soft boost from Who (e.g. Family ⇒ favor `family_day`-tagged, not `is_21_plus`; Solo ⇒ `solo`).
- **+ zone match** — candidate `nearby_zone` == selected Area (skip if Anywhere).
- **+ dated-on-date** — a Tier‑1 event whose `starts_at` falls on the chosen date ranks above evergreen.
- De-dupe against stops **already placed in the day** is **optional**; if shown, you may mark them "Added." Do not hard-block re-adding.

**Row contents.** Thumb (existing resolver), title, area + category, and — per Rule 3 — a real `starts_at` clock time **only if present**. A `+` **Add** button and an `ⓘ` detail button (≥44px hit areas).

**Select = add + close + new slot.** Tapping `+` appends the candidate to the opened block's stops, closes the sheet, and the spine shows the new stop with a fresh trailing slot (Rule 2). If it came from the saved band, carry a `fromSaved` flag for the `♥ Saved` chip on the spine.

---

## 9. Types, persistence & auto-title (lib/plan)

Update `lib/plan/types.ts` to drop the auto-generation concepts:

```ts
// Block now mirrors the tod enum exactly — no 'midday' bridge, no separate 'night'.
type Block = 'morning' | 'afternoon' | 'evening' | 'late'; // UI "Night" = 'late'

interface Stop {
  id: string;          // local uuid, stable key
  block: Block;
  thingId: string;     // FK into published `things`
  fromSaved: boolean;  // drives the ♥ Saved chip (true if added from the saved band)
  // NOTE: no time field — time is derived at render from thing.starts_at (Rule 3).
  // NOTE: no 'pinned' — there is no auto-fill to pin against anymore.
}

interface Itinerary {
  id: string;
  title: string;       // auto (see below), editable inline
  dateISO: string;
  blocks: Block[];     // the selected periods = the spine sections
  stops: Stop[];       // insertion order is meaningful (Rule 4); no sorting
  createdAt: string;
  updatedAt: string;
  // REMOVED: dayShapeId (day-shapes are gone)
}

interface PlanAnswers {
  dateISO: string;
  periods: Block[];                 // selected Time-of-Day → spine sections
  who: 'solo' | 'couple' | 'family' | 'friends';
  vibes: OccasionTag[];             // now the full 8-tag set (see §10), not 4
  zone: 'downtown'|'funk'|'waterfront'|'mesa'|'montecito'|'goleta'|null; // null = Anywhere
}
```

- **Store:** `hooks/useItineraries.ts` is reused as-is for CRUD. Stops are user-added; persistence is unchanged in shape aside from the type edits above.
- **Auto-title (day-shapes are gone, so the old "Classic Coastal Day" title source is dead):** default to **`"Your SB Day · {Mon D}"`** (e.g. *"Your SB Day · Jun 28"*), editable inline. If Area ≠ Anywhere you may flavor it as **`"{Area} Day · {Mon D}"`**. Keep it deterministic — no AI.

---

## 10. Mappings (UI ↔ schema) — updated set

| UI control | Value(s) | Maps to |
|---|---|---|
| **When** | Today / Tomorrow / Pick a date | a date (drives dated-event ranking) |
| **Time of Day** (multi) | Morning / Afternoon / Evening / Night | `tod`: `morning`/`afternoon`/`evening`/**`late`** — **and these are the spine sections** |
| **Where** (Area dropdown) | Downtown / Funk Zone / Waterfront / The Mesa / Montecito / Goleta / **Anywhere** | `nearby_zone` (Anywhere = none) |
| **Who** (single) | Solo / Couple / Family / Friends | **soft ranking signal** (Solo⇒`solo`, Family⇒`family_day`; Couple/Friends lean date_night/nightlife) — never a hard filter |
| **Vibe** (multi, **8**) | Outdoors / Wine & Food / Arts & Culture / Date Night / Catch a Show / Nightlife / Showing Visitors / Free SB | `occasion_tag`: `outdoors_active`/`wine_food`/`arts_culture`/`date_night`/`catch_a_show`/`nightlife`/`hosting_visitors`/`free_sb` |

(Vibe now covers 8 of the 10 `occasion_tag`s; `solo` and `family_day` arrive via Who.)

---

## 11. Share view — the time-rule consequence (small but required)

The shared view-only plan (`/p/[token]`) must obey **Rule 3** too. In the `shared_states` payload for a plan:
- **Drop the fabricated `timeLabel` daypart range.** Replace it with the **section/block label** for grouping plus an **optional real `startsAt` clock time, present only when the source `thing` has one.**
- Everything else about Share (no recipient PII, `email` NULL, native share sheet, view-only, "Save this plan" copy-to-own, sliding expiry) is **unchanged**.

> No new enum value is needed for this update; reuse the plan share mechanism exactly as it works in the live app. Only the payload's time fields change.

---

## 12. `CLAUDE.md` reconciliation (do this first, no app code)

Update the contract so future sessions don't re-add the removed pieces:
- In the **Plan** description, replace the "Make My Day · day-shapes · build-from-saved · deterministic slotting" language with the simplified flow: **"Plan is a build-it-yourself single-day spine: set the shape (filters) → fill an empty time-of-day spine from a saved-first picker. No auto-generated day, no day-shapes, no slotting engine."**
- Note that **`lib/plan/buildDay.ts` and `lib/plan/dayShapes.ts` were removed** and must not be reintroduced.
- Note the **four core behaviors** (§1) as the Plan invariants.
- Leave all other `CLAUDE.md` sections untouched.

**Commit:** `docs: reconcile contract — Plan simplified to build-it-yourself spine`

---

## 13. Phased execution (one phase at a time; stop + show Jim after each)

### Phase A — Contract + demolition
Do §12, then the §3 removals: delete `buildDay.ts` + `dayShapes.ts`, remove Make My Day, the OR divider, the saved hook + build-from-saved flow, the `DayShapeSelector` + pills + caption, the Midday bridge, and the Swap control on stops. Strip auto-fill calls. Leave the screens compiling with the filters + an (empty) spine placeholder.
**Acceptance:** app builds; `/plan` setup shows the filters with no Make My Day / divider / saved hook; the spine route renders without day-shapes or auto-fill; no dead imports; nothing outside Plan touched (or flagged if it was).
**Commit:** `refactor(plan): remove auto-generation — Make My Day, day-shapes, slotting engine`

### Phase B — Setup CTA → empty spine
Rename CTA to **"Build my day →"**; wire it to route to the spine **seeded with empty sections from the selected periods**, carrying `PlanAnswers`. Add the **≥1 period** gate.
**Acceptance:** selecting periods + tapping Build lands on an empty spine with exactly those sections; CTA disabled with no period selected; answers reach the spine.
**Commit:** `feat(plan): setup builds an empty spine from selected periods`

### Phase C — The spine build loop + stop card
Render empty sections each with a trailing **Add a stop** slot. Implement add→append→**new trailing slot** (Rule 2). Update `SpineStopCard` to **Heart + Remove (×)**, **real-time-only** display (Rule 3), **insertion order / overlaps-allowed** (Rule 4). Gate **Save plan** + **Share** on ≥1 stop.
**Acceptance:** matches Mockup‑3 Screen 2; adding spawns a new slot; remove works; a timed `thing` shows its real clock time, an untimed one shows none; two overlapping timed stops coexist silently; empty day can't Save/Share.
**Commit:** `feat(plan): build-the-spine loop — add/remove stops, real-time-only, overlaps allowed`

### Phase D — The picker (`AddStopSheet`)
Repurpose the swap sheet (§4) into the slot picker with the **saved-first band (want-to-go + been)** and the **prioritized ranking** of §8. Tap `+` adds + closes + new slot.
**Acceptance:** opening a slot shows ♥ saved (both states) on top, then More that fit; ranking reflects daypart + vibes + who + zone + dated-on-date; nothing hard-excluded; rows show real times only; one tap adds to the right block.
**Commit:** `feat(plan): slot picker with saved-first, prioritized ranking`

### Phase E — Types, titles, share payload, QA
Apply the §9 type edits + auto-title; apply the §11 Share payload time change. Run the constraint self-check (Appendix B) and report it.
**Acceptance:** itineraries round-trip with the new shape; titles read "Your SB Day · {date}"; shared view shows section labels + real times only; constraint self-check passes; final visual QA against Mockup‑3 on phone width.
**Commit:** `feat(plan): type cleanup, auto-title, share time-rule, final QA`

---

## Appendix A — Picker ranking (reference pseudocode)

```ts
// Pure, deterministic, no AI. `pool` = already-published things (Supabase read OK).
function rankCandidates(block: Block, answers: PlanAnswers, pool: Thing[], saved: SavedSet): Ranked[] {
  return pool
    .map(t => {
      let s = 0;
      if (t.time_of_day_fit?.includes(block)) s += 3;          // daypart fit (empty = neutral)
      if (answers.vibes.some(v => t.occasion_tags?.includes(v))) s += 3;
      if (whoBoost(answers.who, t)) s += 1;                    // soft
      if (answers.zone && t.nearby_zone === answers.zone) s += 2;
      if (t.starts_at && sameDate(t.starts_at, answers.dateISO)) s += 2;
      const savedState = saved.stateOf(t.id);                  // 'want_to_go' | 'been' | null
      return { thing: t, score: s, saved: savedState };
    })
    // saved (either state) floats to the top band; within each band, sort by score desc
    .sort((a, b) => bandRank(b.saved) - bandRank(a.saved) || b.score - a.score);
}
// bandRank: saved (want_to_go|been) > null.  Nothing is filtered out.
```

## Appendix B — Constraint self-check (report to Jim before "done")
No accounts (localStorage only) · **no per-tap AI** (picker ranking is pure; only Supabase reads) · no transactions · no `.ics` · no map · **tokens only, no hardcoded hex** · Share stores no recipient PII · **44px** hit areas on the slot button, `+` Add, `ⓘ`, Heart, Remove · `:focus-visible` rings · `aria-label`s (slot = "Add a stop to your {block}", Add = "Add {title}", Remove = "Remove {title}", Heart = "Save/Saved {title}") · reduced-motion static (rail, nodes, sheet) · the **four core behaviors** (§1) all demonstrably hold.

---

*End of update spec. Build phase by phase; show Jim the rendered result after each; keep `CLAUDE.md` current (Phase A does this first).*
