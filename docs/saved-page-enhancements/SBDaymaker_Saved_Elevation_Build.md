# SB Daymaker — Saved Page Visual Elevation · Build Spec

`Status: build delta · 2026-06-29 · target = live production Saved page (sbdaymaker.com)`
`Owner: Jim · Implementer: Claude Code · Design system: v9 (sbdaymaker_tokens.css)`
`Scope: VISUAL TREATMENT ONLY — no new features, no logic/behavior changes`

---

## 0. How to use this document

This is a **self-contained visual delta** applied **on top of** the already-shipped Saved page. It changes the *appearance* of five elements. It does **not** add features, change data, alter routing, or touch any behavior beyond what's stated.

**Before writing code:**
1. The live code is truth. Locate the live Saved component, its Want/Been toggle, the bottom CTA stack, the saved-card component, the group-header element, and the back-up block. Grep — do not assume the wireframe's structure.
2. Read `sbdaymaker_tokens.css`; build against semantic tokens, never raw hex (except the two AA-corrected fills explicitly given below).
3. If any other doc contradicts this spec, flag it — do not follow it.

**CSS naming:** `sbd-saved__{element}--{modifier}`; active states use `.is-active`.

---

## 1. Locked constraints (unchanged — do not violate)

Three-section shape · no accounts (localStorage + magic-link) · no in-app transactions · no UGC/reviews/social graph · batch-AI only, no per-request model calls · solo-operator ceiling · **WCAG 2.2 AA** (≥44×44px targets, ≥4.5:1 text contrast, visible focus, honor `prefers-reduced-motion`) · ranker never reads sponsor status · no My Plan / itinerary builder (Build a day stays packaging only — do not modify it) · design system = Fraunces / Inter / JetBrains Mono + plaster/ink/pacific/tile/gold/sage/line.

---

## 2. Do NOT touch

- Global header (`SB Daymaker / SANTA BARBARA, DAILY` + S logo) — unchanged.
- Bottom nav — unchanged.
- **Build a day CTA** — unchanged in every respect (it is the visual anchor the Share button is tuned against; altering it breaks the hierarchy).
- All shipped Saved features stay intact and only change where this spec says: A1 (Near Me ≥4), B1 (bottom CTA order), B3 (status line), C2 (did-you-make-it prompt), C3 (been acknowledgment), C4 (back-up gated ≥5), card simplification (card-body tap → detail; no ⓘ).
- Card thumbnail, category tag pill, title, and meta line — unchanged (only the action row restyles).
- The two-state want/been semantics, counts, and all logic — unchanged.

---

## 3. Change set (five visual edits)

| ID | Element | Edit |
|----|---------|------|
| T2 | Want/Been toggle | Equal-width halves; active half tints to state color + icon |
| S2 | Share my list button | Solid pacific fill + icon chip; clearly secondary to Build a day |
| C1 | Card action row | Three equal quiet controls (finishes the "been" demotion) |
| G1 | Group headers | Add count chip + hairline rule |
| BK1 | Back-up box | Solid card + pacific accent edge (replace dashed border) |

---

## 4. Specifications

### T2 — Want / Been toggle (symmetrical + engaging)

**Problem:** the two halves are visually lopsided (snug active pill vs. long empty trough).

**Target:**
- One rounded trough (`--plaster-2` background, pill radius, ~5px inner padding) containing **two equal-width** halves (`flex:1` each). Symmetry is structural.
- **Inactive half:** transparent background, `--ink-2` label, a muted count chip.
- **Active half:** filled with the **state color**, white label, soft shadow, and a small leading icon:
  - **Want to go active** → fill `--pacific` (#16586A, white text = 7.1:1 ✓), icon `♥`.
  - **Been active** → fill a **darkened forest** that clears 4.5:1 with white: use **`#2F6248`** (white text ≈ 6:1 ✓). Do **not** use raw `--forest` (#3E7C5A) as a fill behind white text — it fails AA at this size. Icon `✓`.
- **Count chips:** active = translucent-white pill (`rgba(255,255,255,.22)`, white text); inactive = token-tinted (`rgba(22,88,106,.14)` text `--pacific` for want; `rgba(126,139,107,.18)` text `--sage-text` for been).
- Label size 13px bold Inter; each half is a ≥44px-tall tap target with a visible focus ring.

**Behavior:** unchanged — switches the list between want and been. Only the styling changes.

**Acceptance:** halves are equal width; active half is color-filled with icon + white text meeting 4.5:1; inactive is muted; both states (want-active and been-active) look correct; targets ≥44px.

---

### S2 — "Share my list" button (engaging, still secondary)

**Problem:** plain white outline button is dwarfed by the gold Build a day card directly above it.

**Target:**
- Full-width button, solid **pacific gradient** fill `linear-gradient(135deg, var(--pacific), var(--pacific-dark))`, white text, pill/`--radius-lg` corners.
- A small circular **icon chip** on the left: `rgba(255,255,255,.2)` circle containing `↗`, then the label **Share my list** (15px bold).
- A soft shadow, **flatter and shorter than Build a day** so hierarchy is preserved: slightly less vertical padding than the Build a day card and a lighter shadow (`0 8px 20px -10px rgba(22,88,106,.55)`). It should read as a clear **#2** to Build a day's #1.
- Position unchanged: directly below Build a day, above the Back-up box.

**Rationale to preserve:** gold (Build a day) = marquee planning action; teal (Share) = social/secondary. The two brand colors intentionally play off each other. Do not let Share match or exceed Build a day's prominence.

**Behavior:** unchanged — opens the existing select-and-share flow.

**Acceptance:** Share is a solid teal button with an icon chip, visibly engaging yet clearly lighter/shorter than Build a day; white text ≥4.5:1; ≥44px tall.

---

### C1 — Card action row (finish the "been" demotion)

**Problem (regression):** "✓ Been" still renders as a heavy dark-outlined pill while ↗ and ✕ are light icon squares, so "been" remains the loudest control on every card — the exact inversion the prior spec meant to fix.

**Target:** the action row becomes **three equal-weight, quiet controls**, right-aligned:
1. **Been flip** — light icon-label button, transparent background, `--sage-text` color, small leading glyph + short label:
   - want-state card → `✓ Mark been`
   - been-state card → `↩ Want to go`
   (Preserve the two-state flip exactly.)
2. **Share** — icon-only `↗`, `--ink-2`.
3. **Remove** — icon-only `✕`, `--ink-2`.
- All three: transparent fill, `--radius-sm` hover background (`--plaster`), **≥44×44px** target, visible focus ring, and an `aria-label` (`Mark {title} as been`, `Share {title}`, `Remove {title} from saved`).
- **Delete** the heavy outlined-pill styling on the been control. None of the three should out-weigh the others.
- Card-body tap still opens detail; the three controls call `stopPropagation` so they don't also trigger the body tap.

**Applies to:** all saved cards (want, been) and the PAST EVENTS cards' been control, for consistency.

**Acceptance:** the row is a calm, right-aligned trio of equal weight; no dominant pill; flip semantics intact; body-tap→detail still works; controls don't open detail; AA targets + labels present.

---

### G1 — Group headers (count + hairline)

**Target:** keep the existing colored category dot + uppercase Inter label, and add:
- A small **count chip** after the label: item count for that group, `--plaster-2` pill, `--sage-text`, 10px bold.
- A **hairline rule** (`--line`, 1px) filling the remaining row width to the right.

Layout: `● LABEL  (n) ──────────────────────────`

**Acceptance:** each group header shows its count and a hairline; dot + label styling otherwise unchanged; counts reflect live group sizes.

---

### BK1 — Back-up box (solid card + accent edge)

**Problem:** the dashed border reads as utility/system against a warm page.

**Target:**
- Replace the dashed outline with a **solid card**: `--paper`/white fill, 1px `--line` border, `--radius-md`, and a **4px `--pacific` left edge** (`border-left: 4px solid var(--pacific)`).
- Keep everything inside unchanged: the Fraunces heading "You've built a real list — back it up", the body copy, the `you@example.com` field, and the "Email me a link to restore" button.
- **Keep the ≥5-total-saves gate** exactly as shipped. Position unchanged (bottom of stack).

**Acceptance:** solid card with pacific left edge replaces the dashed border; field + button + copy + gate all unchanged.

---

## 5. Final bottom-stack reference (order unchanged)

Build a day (untouched) → **Share my list (S2)** → **Back up your saves (BK1, gated ≥5)** → bottom nav.

---

## 6. QA checklist

- [ ] Toggle halves equal width; want-active = pacific, been-active = #2F6248, both white text ≥4.5:1, icons present.
- [ ] Share is solid teal + icon chip, clearly lighter/shorter than Build a day; Build a day visually unchanged.
- [ ] Card action row = three equal quiet controls; no heavy "been" pill; flip + body-tap→detail both work; aria-labels present.
- [ ] Group headers show count chip + hairline.
- [ ] Back-up box is a solid card with pacific left edge; gate at ≥5 saves intact.
- [ ] All new/changed controls ≥44×44px with visible focus rings.
- [ ] `prefers-reduced-motion` respected (no new looping motion introduced).
- [ ] Header, nav, Build a day, A1/B3/C2/C3/C4 behaviors all unchanged.

---

## 7. Out of scope (do not build)

- Alternative options not selected (T1/T3, S1/S3, C2-overflow, G2, BK2).
- Any feature/logic change, new section, or change to Build a day, Explore, Discover SB, detail, header, or nav.
- B2 act-ready cards (time pills, inline Directions/Tickets, venue·price changes) — not part of this pass.

If completing any edit seems to require something above, stop and flag it.

---

*End of spec. Visual treatment only; live code is truth; this document is the contract for what changes.*
