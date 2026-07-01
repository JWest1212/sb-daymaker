# SB Daymaker — Plan Spine Must Arrive **DRAFTED** · Reconciliation & Fix

> **What this file is.** The authoritative correction for a behavior that built wrong: tapping **Build my day** currently lands on a **blank spine**. Per our agreed design it must land on an **editable recommended draft** (stops already placed, marked *Suggested*). This file resolves the conflicting docs that caused it and specifies the exact fix.
>
> **Precedence (read this).** On the question of *blank vs drafted spine*, **this file is authoritative.** It **supersedes** the "empty start / no slotting engine" language in `SBDaymaker_Plan_Simplification_Build.md`. It **restates and confirms** `SBDaymaker_Plan_Reshape_Build.md` **R1** (which was the real decision). Where any doc still says the spine starts empty, that line is **void**.
>
> **Operating rules unchanged** (`CLAUDE.md`): no accounts (localStorage only), **batch-AI only — no per-tap Claude call** (`buildDraft` is pure/deterministic; Supabase reads are fine, no AI), tokens only — never hardcode a hex, WCAG 2.2 AA. One phase at a time; **stop, run the dev server, show Jim, wait for approval**, commit with the given message.

---

## 0. The problem & root cause
- **Symptom:** "Build my day" → an empty spine with only `＋ Add a stop` slots.
- **Cause:** three repo docs disagree. The simplification spec says *empty start, "no auto-generated day, no day-shapes, no slotting engine."* The reshape spec (R1) says *a draft seeds the spine.* The ToD spec (P2) describes only `buildDraft`'s **default prior** as a ranking boost. Reading the first + third in isolation yields "ranking only, no seeding" — which is what got built.
- **Resolution:** the reshape (drafted spine) wins. The simplification's empty-start is retired. The distinction below must be made explicit so this never reverts.

---

## 1. The decision (authoritative)
**Tapping "Build my day" runs `buildDraft(...)` and the spine arrives pre-populated with one ranked pick per selected part-of-day**, each marked **Suggested**, fully editable. The user then tweaks: remove, add, **Regenerate**, or **Start blank**. A blank spine is reachable **only** via the explicit **Start blank** action — it is never the landing state when inventory exists.

---

## 2. The distinction that tripped the build — read carefully

Three different things share the word "rank." They are not the same:

| Thing | What it does | Pre-populates stops? |
|---|---|---|
| **`rankCandidates(block, answers, pool, saved)`** | Ranks the candidate list **inside the picker** when the user opens a slot. | **No** — it only orders the picker. |
| **`buildDraft(answers, pool, saved)`** | **Seeds the spine.** Calls `rankCandidates` **once per selected period** and **places the top pick as a Stop** (`fromDraft: true`). | **YES — this is the seeding step.** |
| **`buildDraft`'s `DEFAULT_PRIOR`** | A *sub-detail of `buildDraft`*: a soft category boost used **only when the user picked no vibes**, so the draft isn't all-evergreen. | It's an input to ranking **within** `buildDraft`; it does not replace the seeding. |

**And "no auto-generated day" does NOT mean "no recommended draft."** It means the **old** auto-day stays removed: the **Make My Day** button, the **day-shape pills/selector**, the named multi-shape skeletons, and any **locked, non-editable "magic day."** The recommended draft is a *different thing* and is explicitly wanted, because:
- it's built from the **user's own filter answers** (date · periods · who · vibes · area), not a generic template;
- **every stop is individually removable/replaceable**;
- there are **no named day-shapes** and **no shape selector**;
- **Regenerate** and **Start blank** give the user full control.

> If a future spec line says "empty spine" or "no slotting engine," treat it as stale and follow this file.

---

## Phase 1 — Reconcile the contract (no app code)
Update `CLAUDE.md` (and any in-repo Plan doc header) so the contract is unambiguous:
- Replace any "Plan starts on an empty spine / no slotting engine" wording with: **"Plan lands on an editable *recommended draft* — `buildDraft` seeds one ranked pick per selected part-of-day (saved-first, marked *Suggested*); the user edits, Regenerates, or Starts blank. This is NOT the retired auto-day: no Make My Day button, no day-shape pills, no locked magic day."**
- Add the §2 distinction (rankCandidates vs buildDraft vs default prior) as a short note so no future session collapses them.

**Acceptance:** the contract no longer says the spine starts empty; the draft behavior + the "not the old auto-day" carve-out are written down. Show Jim the diff in plain language.
**Commit:** `docs: reconcile contract — Plan lands on an editable recommended draft (buildDraft seeds it)`

---

## Phase 2 — Make the spine arrive drafted (the actual fix)
**Goal:** "Build my day" pre-populates the spine; the build loop, Regenerate, and Start blank all work.

### Build
1. **`lib/plan/buildDraft.ts`** — ensure it **seeds stops** (not just ranks). Pure/deterministic, reuses `rankCandidates`, uses the **3-block model** (`morning | afternoon | night`, per the live ToD change) and `BLOCK_TO_TOD`. Pseudocode in Appendix A. For each selected period: take the top-ranked candidate not already placed → emit a `Stop { …, fromDraft: true, fromSaved: <bool> }`. If a period has no candidate (thin inventory), **leave that period empty** (its add-slot shows) — never block.
2. **Setup CTA wiring** — `Build my day →` must call `buildDraft(answers, pool, saved)` and route to the spine **seeded with those stops**. (Right now it routes to an empty spine — that's the bug. Fix the handoff so the seeded stops populate `useWorkingDay` / the spine state.) Keep the **≥1 period gate**.
3. **Spine render** — a `fromDraft` stop renders as a normal `SpineStopCard` (heart + remove) **plus a small "Suggested" chip** (tokens only; gold). A stop also from the user's saved list keeps the **♥ Saved** chip. Time chip only when `starts_at` is real. Insertion order; overlaps allowed; each section keeps its trailing `＋ Add a stop`.
4. **Regenerate** — re-runs `buildDraft` **excluding stops currently in the day**, replacing only `fromDraft` stops with the next-best pick per period; **user-added stops are left untouched**.
5. **Start blank** — clears all stops to the empty add-slot-only spine (the preserved from-scratch path), behind a light confirm. (This is the *only* way to reach a blank spine.)
6. **Adding from a slot** — a stop added via the picker is a **user stop** (`fromDraft: false`, no Suggested chip); adding still spawns a fresh trailing slot.

**Do NOT** reintroduce `dayShapes.ts`, a `DayShapeSelector`, day-shape pills, a caption, or a "Make My Day" button. The draft is one ranked pick per section — nothing more.

**Acceptance (must all pass — these are the regression guards):**
- Pick a date, ≥1 period, optional vibe/area → **Build my day** → the spine shows **at least one *Suggested* stop in every selected period that has inventory** (it is **not** all-empty).
- Each seeded stop shows the **Suggested** chip; saved-sourced ones also show **♥ Saved**.
- A timed pick (e.g. a 7:30 show) shows its real time; an untimed pick shows none.
- **Remove** a suggested stop works; **add** via a slot yields a user stop (no Suggested chip) + a new slot.
- **Regenerate** swaps the suggested stops for fresh picks and keeps user-added ones.
- **Start blank** empties the day; that is the only route to a blank spine.
- With selected periods that have inventory, **Build my day never lands on a fully empty spine.**

**Commit:** `fix(plan): Build my day seeds an editable recommended draft (buildDraft), not a blank spine`

---

## Phase 3 — Verify the rest of the chat's updates actually landed
Quick checklist — confirm each to Jim; fix any that silently reverted (specs noted in parentheses). **No rebuild if already correct.**

- [ ] **3-button Time of Day** — Morning (12am–12pm) · Afternoon (12pm–5pm) · Night (5pm–12am); Night maps to `evening`+`late`; **no DB migration**. (ToD spec P1)
- [ ] **Ephemeral working day** — bottom bar is **Share + Clear**, **no Save**; the day persists for *today* only; **no Saved › Days tab**, **no My-plans drawer**. (Reshape R2)
- [ ] **Plan demoted from the nav** — bottom bar is **Explore · Saved · Discover SB** (no Plan tab); planner reached from the **Build your day** card on Explore **and** a **"Build a day from your saved →"** entry atop Saved. (Reshape R3 / ToD P2)
- [ ] **Explore restructure** — live top preserved (header, Find·Save·Share, hero + Today's Pick, Any-vibe, Near Me, **horizon selector**); three sections below it (**Happening {Today/This Week/This Month}** open, **Recurring Weekly** + **Great any time** collapsed); **horizon renames/refills the lead section only**; CTA sits after the lead section. (ToD spec E1/E2)
- [ ] **Time-only-when-real & overlaps-allowed** still hold in the spine. (Simplification core behaviors — still valid)

**Commit (only if fixes were needed):** `fix(plan/explore): reconcile reshape behaviors that regressed`

---

## Appendix A — `buildDraft` (3-block) reference
```ts
// Pure, deterministic. Reuses rankCandidates. No AI. (Supabase reads OK.)
const DEFAULT_PRIOR: Record<Block, OccasionTag[]> = {
  morning:   ['outdoors_active', 'food_drink_spot'],
  afternoon: ['arts_culture', 'shopping_browse', 'food_drink_spot'],
  night:     ['wine_food', 'catch_a_show', 'nightlife'],
};

function buildDraft(answers: PlanAnswers, pool: Thing[], saved: SavedSet): Stop[] {
  const placed = new Set<string>();
  const draft: Stop[] = [];
  for (const block of answers.periods) {                       // 'morning'|'afternoon'|'night'
    const ranked = rankCandidates(block, answers, pool, saved, {
      priorBoost: answers.vibes.length ? null : DEFAULT_PRIOR[block],  // soft boost ONLY when no vibes
      // daypart fit tests intersection with BLOCK_TO_TOD[block]; night = ['evening','late']
    });
    const pick = ranked.find(r => !placed.has(r.thing.id));    // TOP pick → SEED a stop
    if (!pick) continue;                                       // thin inventory: leave block empty
    placed.add(pick.thing.id);
    draft.push({ id: uuid(), block, thingId: pick.thing.id, fromSaved: pick.saved !== null, fromDraft: true });
  }
  return draft;                                                // ← these populate the spine on landing
}
// Regenerate: call again seeding `placed` with the day's current thingIds; replace only fromDraft stops.
```

---

## Appendix B — Why the draft is NOT the retired auto-day (one-liner for the contract)
> Recommended draft = built from the user's own answers, every stop editable/removable, no named day-shapes, Regenerate + Start blank. Retired auto-day = a "Make My Day" button + day-shape pills producing a locked magic day. We keep the former; the latter stays gone.

---

*End of fix spec. Phase 1 (contract) first, then Phase 2 (the seeding fix), then Phase 3 (verify). Stop and show Jim after each.*
