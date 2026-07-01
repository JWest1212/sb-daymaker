# SB Daymaker — Saved Page Update · Build Spec

`Status: build delta · 2026-06-29 · target = live production Saved page (sbdaymaker.com)`
`Owner: Jim · Implementer: Claude Code · Design system: v9 (sbdaymaker_tokens.css)`

---

## 0. How to use this document

This is a **self-contained delta spec** for updating the **live** Saved page. It restates the locked constraints so they cannot be reopened mid-session. Build exactly what is described; if any part conflicts with another project doc, **the live code is truth and this spec is the contract** — flag the conflict, do not silently follow a stale doc.

**Before writing any code:**
1. Locate the live Saved page in the actual codebase (Next.js App Router / React / Tailwind). It is **not** the vanilla `renderSaved()` from `02b_SBDaymaker_Wireframe.html` — that wireframe is reference only. Grep for the Saved route/component, the saved-state store (localStorage-backed `saved` set + `want`/`been` state map), and the card component.
2. Confirm the **current** DOM/order from code, not from this doc's description, before moving anything.
3. Read `sbdaymaker_tokens.css` and build against the semantic tokens (no raw hex).

This spec changes **only the Saved page**. It does **not** touch Explore, Discover SB, detail screens, the global header, or the bottom nav.

---

## 1. Locked constraints (do not violate, do not reopen)

- **Three-section app shape** — Explore · Saved · Discover SB. No fourth tab. No new routes.
- **No end-user accounts.** Saves live in `localStorage`; the only sync is the passwordless magic-link save-restore. Do not add auth, login, or a users table.
- **No in-app transactions.** Ticketing/maps always hand off externally. SB Daymaker never transacts.
- **No UGC / reviews / ratings / social graph.**
- **Batch AI only — no per-request Claude API calls.** Every string added in this spec is **deterministic / templated**. Do not call any model at render time.
- **Solo-operator ceiling.** Nothing here may add daily curation work.
- **WCAG 2.2 AA floor.** Every interactive control ≥ **44×44px** target. Body text ≥ 16px where it is body copy; small UI labels follow the token scale. Honor `prefers-reduced-motion`. Visible focus rings.
- **Trust rule.** Ranker never reads sponsor status. (Not in scope here, but never break it.)
- **No My Plan / itinerary builder.** The "Build a day" CTA already exists and is **packaging, not an itinerary builder** — we are **relocating its existing visual only**. Do not redesign it, do not add timed slots / durations / sequencing / travel math.
- **Design system:** Fraunces (display), Inter (body/UI), JetBrains Mono (data/timestamps); plaster / ink / pacific / tile / gold / sage / line palette per `sbdaymaker_tokens.css`. Use AA-safe text variants (`--gold-text`, `--sage-text`, `--terra-text`) whenever an accent carries small text on light.

**CSS naming convention:** `sbd-saved__{element}--{modifier}`, active states use `.is-active`.

---

## 2. What stays exactly as-is (do NOT touch)

These are confirmed from the live production screenshots and must remain pixel-intact:

1. **Global site header** — the `SB Daymaker` wordmark + `SANTA BARBARA, DAILY` eyebrow with the teal "S" logo tile. Untouched.
2. **Bottom navigation bar** — `Explore · Saved · Discover SB` with the saved-count badge on the heart. Untouched.
3. **The "Build a day" CTA visual** — the warm cream-gradient card with the gold sun-square icon, the Fraunces "Build a day" heading, the "Your saved spots, shaped into a plan." subline, and the terracotta arrow. **Keep its exact current styling.** We move its DOM position only (see §4.B1). Do not alter its appearance or behavior.
4. **The card content block** — thumbnail, category tag pill, and title treatment stay. (Only the *action row* changes — see §4.Card.)
5. **The empty state** ("Nothing saved yet" + heart hint + restore link) — untouched.
6. **Want / Been toggle** styling — untouched (it gains a status line beneath it, see B3).

---

## 3. Net change summary (seven changes)

| ID | Change | Type |
|----|--------|------|
| B1 | Relocate Build a day + Share to bottom; remove top Share pill; fix action hierarchy | Move / restructure |
| A1 | Progressive controls — hide Near Me below 4 saves | Conditional render |
| B3 | Templated editorial status line beneath Want/Been toggle | New (deterministic) |
| C2 | Proactive "Did you make it?" prompt for the most recent past-dated want item | New |
| C3 | Been acknowledgment — micro-reward + count on any flip to "been" | New |
| C4 | Gate + restyle the existing backup form (show at ≥ 5 saves) | Refine existing |
| Card | Simplify card action row: card-tap→detail, drop ⓘ, demote "been" | Refine existing |

---

## 4. Per-change specification

### B1 — Relocate CTAs & fix action hierarchy

**Current (live):** `Share` sits as a pill in the top control row beside `Near Me`; `Build a day` sits at the **top** of the page under the header.

**Target:**
- **Remove** the `Share` pill from the top control row. (Near Me may remain there, subject to A1.)
- **Move** the `Build a day` CTA from the top of the page to the **bottom**, after the last saved card. Keep its exact current visual.
- **Bottom stack order**, after the last card, in this order:
  1. **Build a day** (existing visual, relocated)
  2. **Share my list** — full-width secondary button, pacific outline (`--pacific` border + text, white fill), label `↗ Share my list`. This is the surviving share entry point and opens the existing select-and-share flow.
  3. **Back up your saves** (the C4 block — only renders when gated condition met)
- The top control row now contains at most **Near Me** (and only when A1's condition is met). If Near Me is hidden, the row collapses entirely — no empty spacer.

**Acceptance:**
- No `Share` control in the top row.
- `Build a day` appears once, at the bottom, visually identical to today.
- Bottom order is Build a day → Share my list → Back up.
- The per-card share affordance (↗ on each card) is unaffected.

---

### A1 — Progressive controls (hide Near Me below 4 saves)

**Rule:** Let `n` = number of items in the **currently displayed list** (active Want/Been tab, after any type filtering). 
- If `n < 4`: **do not render** the Near Me control.
- If `n ≥ 4`: render Near Me as today.

**Notes:**
- Use the displayed-list count, not lifetime saves, so the control appears exactly when sorting becomes useful.
- When hidden, the row must not leave vertical whitespace. If Near Me is the only top control (it is, post-B1), the entire control row is omitted at `n < 4`.
- No animation required on first appearance, but a simple fade is acceptable (respect `prefers-reduced-motion`).

**Acceptance:** With 3 or fewer items in view, Near Me is absent and no gap remains; at 4+, it returns.

---

### B3 — Editorial status line (templated, deterministic)

**Placement:** Directly **beneath the Want/Been toggle**, above the first group header / C2 prompt.

**Content:** A single Fraunces line + optional muted subline, assembled from counts. **No AI.** Examples:

- Want tab, with weekend items:
  `Five spots on your list` *(Fraunces, --ink)*
  `Two happening this weekend · kept on your phone, no account` *(Inter, --ink-2)*
- Want tab, no weekend items:
  `Five spots on your list`
  `Kept on your phone, no account`
- Singular:
  `One spot on your list`
- Been tab:
  `Five places you've made it to`
  `Your Santa Barbara so far`

**Logic definitions (deterministic):**
- **Spot count** = number of items in the active tab's list (post type-filter), spelled out for 1–9, numeric for 10+.
- **"happening this weekend"** = count of want-tab items whose `starts_at` falls within the upcoming Sat 00:00 → Sun 23:59 (local SB time, America/Los_Angeles). If 0, omit that clause and fall back to the "kept on your phone" subline.
- Recompute on tab switch and on any save/unsave/flip.

**Constraints:** Templated string assembly only. Never generate per-request. Must render correctly at counts 1, 2, many, and on both tabs. Do not render on the empty state (the empty state owns that case).

**Acceptance:** Line reflects live counts, switches sensibly between tabs, handles singular/plural, and the weekend clause appears only when ≥1 weekend item exists.

---

### C2 — Proactive "Did you make it?" prompt

**Goal:** Close the been-loop automatically by surfacing the single most relevant past-dated intention, instead of relying on the user to hunt for it. This is the keystone input-loop closer.

**Coexistence with PAST EVENTS:** Keep the existing **PAST EVENTS** group exactly as it is (the standing list of past-dated saves with per-card "mark as been"). C2 **adds** a single proactive prompt on top of that; it does not replace the group.

**Placement:** Below the B3 status line, above the first standard group header.

**Trigger:** Render only when there is **≥1 want-tab item with `starts_at` in the past** (already passed). Select the **most recent** such item (largest past `starts_at`).

**Content:**
- Eyebrow (templated relative day): `Last night` / `This past weekend` / `Earlier this week` (derive from how far back `starts_at` is; fall back to `Recently`).
- Prompt (Fraunces): `Did you make it to {title}?`
- Small thumbnail of the item (reuse its image).
- Two buttons (each ≥ 44px tall):
  - `✓ Yes, I went` → flips the item to **been** (fires C3 acknowledgment), removes the prompt.
  - `Not this time` → dismisses the prompt for this session; item stays `want`. Do **not** delete it.
- After either action, if another past-dated want item remains, the prompt may advance to the next most recent one; otherwise it disappears.

**Behavior rules:**
- One prompt at a time (never a stack).
- Dismissible and non-nagging: once "Not this time" is chosen for an item, do not re-surface that same item in the prompt again (persist a lightweight per-item "prompt-dismissed" flag in localStorage). It still appears in PAST EVENTS.
- Visual: bordered card, `--gold` accent border, paper fill, consistent with the design system. No urgency styling.

**Acceptance:** Prompt appears only with a past-dated want item, shows the most recent, both actions behave as specified, dismissed items don't reappear in the prompt, and PAST EVENTS remains intact.

---

### C3 — Been acknowledgment (input-side micro-reward only)

**Goal:** Pay the user a small immediate reward for the input behavior the memory moat depends on. **This is a count + animation only.** It is explicitly **NOT** Recap, a My-SB card, Memory Lane, or any Cluster-A reflection feature — those stay deferred. If this grows past a count, it has crossed the line.

**Trigger:** Any flip of an item to **been** — from a card, from the C2 prompt, or from PAST EVENTS "mark as been."

**Behavior:**
- Show a brief acknowledgment (toast or inline banner, dismissing after ~2.5s or on tap):
  - A small ✓ stamp/pop animation (`--ease-spring`, ~`--dur-base`).
  - Templated line: `Nice — that's {beenCount} SB spots you've made it to.`
  - Optional muted subline: `Quietly building your Santa Barbara.`
- `{beenCount}` = total items currently in the `been` state, computed at flip time.
- Use `--forest` as the accent (success/been color), white text.

**Constraints:**
- Count only. No history, no streak, no list, no per-item reflection.
- `prefers-reduced-motion`: skip the pop; show the static acknowledgment briefly.
- Do not block the UI; non-modal.

**Acceptance:** Flipping to been (via any of the three entry points) shows the acknowledgment with the correct live been count, animates within motion rules, and auto-dismisses.

---

### C4 — Gate + restyle the backup nudge

**Current (live):** A dashed-border "Back up your saves" block with body copy, an inline `you@example.com` field, and a teal `Email me a link to restore` button — always visible at the bottom.

**Target:**
- **Keep the inline email field + button** (the existing magic-link restore flow — do not change its behavior or endpoint).
- **Gate visibility:** only render the block when **total saves (want + been) ≥ 5**. Below 5, omit it entirely.
- **Restyle the copy** to a "worth protecting" framing:
  - Heading (Fraunces): `You've built a real list — back it up`
  - Body (Inter, --ink-2): `Saves live on this phone. Email yourself a link so they survive a cleared browser or a new device — no account, no password.`
  - Keep the field placeholder and button label as-is (`you@example.com`, `Email me a link to restore`).
- Position: bottom of the stack, after Share my list (per B1).

**Acceptance:** Hidden below 5 total saves; visible at ≥5 with the new copy; field + button still perform the existing restore action.

---

### Card — Simplify the action row

**Goal:** Reduce per-card chrome and fix the card-level hierarchy inversion (today "Mark as been" is the loudest control on every card, though it's the least-used action). Applies to all saved cards (want, been, and PAST EVENTS cards).

**Current (live) per-card action row:** `[ ✓ Mark as been ] [ ⓘ ] [ ↗ ] [ ✕ ]` — a large bordered "been" button plus three icon buttons.

**Target:**
1. **Card body is tappable → opens the item detail screen.** This absorbs the `ⓘ` info action.
2. **Remove the dedicated `ⓘ` info button.**
3. **Demote "Mark as been"** from the large bordered button to a quiet control of equal visual weight to the others.
4. **Final action cluster** — a single right-aligned row of three quiet, equal-weight controls:
   - **Been flip:** `✓ Been` on want-state cards / `↩ Want to go` on been-state cards (preserve the existing two-state flip semantics).
   - **Share this:** `↗`
   - **Remove:** `✕`
5. Each control is a ≥ 44×44px target with a visible focus ring and an `aria-label` (e.g. `Mark {title} as been`, `Share {title}`, `Remove {title} from saved`).
6. The card-body tap and the action controls must not collide — controls call `stopPropagation` so tapping them does not also open detail.

**Notes:**
- Do not add directions/tickets/time pills or restore venue·price here — that is B2 (out of scope for this build).
- Keep the thumbnail, category tag pill, and title exactly as they look today.
- Content (image, tag, title) should now visually outweigh the action cluster.

**Acceptance:** Cards have a calm right-aligned `✓ Been · ↗ · ✕` cluster, no ⓘ button, the body opens detail, controls don't trigger the body tap, the been flip preserves two-state semantics, and all targets meet AA.

---

## 5. Final page order (top → bottom)

1. Global header (untouched)
2. Want / Been toggle (untouched)
3. **B3 status line** (new)
4. **C2 "Did you make it?" prompt** (new, conditional)
5. Near Me control row (**A1**: only at ≥4 in-view; **Share pill removed** per B1)
6. Group headers + cards (cards use the simplified action row)
   - includes the existing **PAST EVENTS** group (untouched, retains per-card mark-as-been)
7. **Build a day** CTA (relocated, existing visual)
8. **Share my list** secondary button
9. **Back up your saves** (**C4**: only at ≥5 total saves, restyled copy)
10. Bottom nav (untouched)

---

## 6. Deterministic logic reference (all client-side, no AI)

- `savedCountTotal` = size of saved set (want + been).
- `listCount` = items in the active tab after type filtering (drives A1 threshold of 4 and the B3 spot count).
- `beenCount` = items in `been` state (drives B3 been-tab line and C3 count).
- `weekendCount` = want items with `starts_at` in upcoming Sat–Sun, America/Los_Angeles.
- `pastWantItems` = want items with `starts_at < now`, sorted desc; `pastWantItems[0]` feeds C2.
- `promptDismissed[itemId]` = localStorage flag set on C2 "Not this time".

Recompute on mount, tab switch, and any save / unsave / state-flip.

---

## 7. Accessibility checklist (WCAG 2.2 AA)

- [ ] Every new/changed interactive control ≥ 44×44px.
- [ ] Visible `:focus-visible` ring (`--pacific`) on all controls.
- [ ] `aria-label`s on icon-only card controls and the heart/been flips.
- [ ] C2 prompt and C3 acknowledgment are reachable and dismissible by keyboard.
- [ ] C3 pop and any A1 fade respect `prefers-reduced-motion`.
- [ ] Accent-on-light small text uses AA-safe variants (`--gold-text`, `--sage-text`, `--terra-text`).
- [ ] Status line and acknowledgment are announced politely (aria-live="polite") without trapping focus.

---

## 8. QA / acceptance scenarios

1. **0 saves:** empty state only; no status line, no C2, no Near Me, no Build a day/Share/Back-up block.
2. **3 saves, none past-dated:** status line shows; no Near Me (A1); no C2; Build a day + Share present; no Back-up (C4 <5).
3. **5 saves, one past-dated want:** status line with/without weekend clause as data dictates; Near Me visible; C2 prompt shows the most recent past item; Back-up block visible.
4. **Flip an item to been (card):** C3 acknowledgment fires with correct count; item moves to Been tab.
5. **C2 "Yes, I went":** item flips to been, C3 fires, prompt advances or disappears.
6. **C2 "Not this time":** prompt dismisses, item stays in want and in PAST EVENTS, and does not reappear in the prompt.
7. **Card tap vs. control tap:** tapping body opens detail; tapping ✓/↗/✕ does not open detail.
8. **Build a day:** identical appearance to pre-change; now at the bottom above Share.
9. **prefers-reduced-motion on:** no pops/animations; static acknowledgment still appears.
10. **Header + nav:** unchanged in markup and appearance.

---

## 9. Out of scope (do not build in this pass)

- B2 act-ready cards (time pills, inline Directions/Tickets, venue·price restoration).
- A2 today-first pinned strip, A3 collapsible groups, C1 "make a day from your saves" packaging card (the existing Build-a-day CTA stays as the only planning entry).
- Any Cluster-A reflection feature (Recap, My-SB card, Memory Lane, Regular status). C3 is the input-side count only.
- Any change to Explore, Discover SB, detail, header, or nav.

If any of the above seems necessary to complete a task above, **stop and flag it** rather than building it.

---

*End of spec. Derive current state from live code; this document is the contract for what changes.*
