# SB Daymaker — Explore Phase 7 build spec

**Change in one line:** convert the shared `ListCard` from the current thumbnail-with-full-width-description row into a **left-rail card** (tall image flush to the left edge, text stacked to its right), move the **vibe pill onto the photo**, give every card a **3-line description**, and add a **no-photo fallback**. The Today feature lead and the This Week day spine stay as they are.

**Visual reference (share alongside this file):** `SBDaymaker_Explore_Phase7_Mockup.html`. The strip at the top of the mockup shows the four vibe-placement options that were considered; **Option 1 (pill on the photo) is the chosen one** and is what the two full phone screens below it render. Build to the two full screens — the rail card is the element with class `.rc`, the Today feature lead is `.feat`, the This Week day group is `.dg` / `.dh`.

---

## 0. Before you write any code

1. Read this spec in full, then open the mockup and match your output to the two full screens (Today and This Week).
2. Read `CLAUDE.md` for the project contract. **Code is truth; CLAUDE.md is the contract.** Where a spec conflicts with live code, defer to live code and note the difference.
3. **Reconcile the file list in §9 against the actual repo before editing.** It was written from an earlier audit; paths and export names may have drifted. Adapt to the real code — do not invent structure. If anything is genuinely ambiguous or conflicts with live code, STOP and ask.
4. This is one phase. Implement all of §3–§7, then **STOP and show me both a phone width and a desktop width** of Today and This Week before doing anything else. Do not split it; do not proceed past the checkpoint.

---

## 1. Scope & non-negotiables

- **Presentation layer only.** Do **not** change the database schema, Supabase queries, the ranker, any AI/batch code, `lib/things.ts`, or `lib/explore.ts` (`cascade`, `withinHorizon`, `nearMeSort`, `filterByLens`, `groupByDay` are all consumed exactly as-is). The one config addition allowed is a short **pill-label map** in `lib/occasions.ts` (see §4) — that's presentation config, not logic.
- **Hero is out of scope.** Do not touch `Hero.tsx` or any `.sbd-hero*` CSS.
- **Tokens only — no new hex.** Everything uses existing v9 tokens and the existing occasion→color map. No new color tokens are introduced by this phase (the pill-on-photo approach was chosen specifically so we do **not** need per-occasion AA-safe text tokens).
- **Reuse existing primitives.** `CardActions`, `Pill`, `DateEyebrow`, `SBIcon` from the Phase 1 work. No new component files.
- **WCAG 2.2 AA:** every action is a **≥44×44px tap target**; `:focus-visible` ring `3px var(--pacific)`; the pill stays legible on any photo via fill + a guaranteed scrim; the pill always carries its **text label** (color is never the only signal); images carry `alt`; honor `prefers-reduced-motion`; no new looping/entry motion.
- **Shared card = shared blast radius.** `ListCard` is used by **This Week rows, Today briefs, and the recurring/evergreen Tier-2/3 sections**. This change lands on all of them — that is intended (one consistent card). The Month view uses `RockTile`, not `ListCard`, so Month is unaffected.

---

## 2. Decisions (locked — do not reopen)

- **D1 — Left-rail card** is the shared `ListCard`, at all widths. Image on the left running the full card height; text (title, description, meta) stacked to its right.
- **D2 — Vibe pill on the photo.** The occasion pill sits on the image (top-left, over a scrim). The headline is the **first** thing in the text column. This makes the rail card consistent with the Today feature card, which already carries its pill on the image.
- **D3 — Pill uses SHORT labels and never wraps.** `white-space: nowrap`; long occasion names use the short pill-label map in §4 so the pill is always one line.
- **D4 — 3-line description on every rail card**, both screens.
- **D5 — No-photo fallback = vibe-color gradient + small icon.** Never a broken/empty/stretched image box.
- **D6 — Today keeps its feature lead; This Week keeps its day spine.** The feature card (image-top banner) remains the single Today lead and is NOT converted to a rail. The Phase 6 day header + spine on This Week is retained.

---

## 3. Change 1 — `ListCard` → left-rail card

**File:** `components/ui/Card.tsx` (ListCard) · **CSS:** `app/components.css`
**Reference:** the `.rc` card in the mockup's two full screens.

### 3.1 Anatomy

```
.sbd-listcard                         (flex, align-items:stretch, overflow:hidden, radius 16, shadow)
  .sbd-listcard__rail                 (the image, 108px wide, full card height)
    .sbd-listcard__scrim              (top gradient, for pill legibility)
    <Pill occasion .onImage/>         (absolute top-left, short label, nowrap)   ← see §4
    [ no-photo only: .sbd-listcard__fallmark = centered icon ]                    ← see §5
  .sbd-listcard__side                 (flex:1, min-width:0, padding, flex column, min-height 150)
    .sbd-listcard__title              (Fraunces, stretch-link → /thing/{id}, 2-line clamp) ← FIRST, at top
    .sbd-listcard__blurb              (3-line clamp)
    .sbd-listcard__meta               (margin-top:auto → pinned to bottom)
      <DateEyebrow/>                    (left)
      <CardActions onImage={false}/>    (right; heart + share)
```

**Load-bearing structural points — get these exactly right:**
1. The **image is a flex child that stretches to the full card height** (`align-items:stretch` on the card; the rail has no fixed height). The image is prominent because it runs the whole card, not because it's tall in isolation.
2. The **title is the first element in `.side`** — nothing sits above it. The vibe pill is on the photo, not in the text column. Do **not** put a pill/kicker above the title.
3. **Actions live in the bottom `.meta` row beside the date** (carried over from Phase 6), not in the top corner of the text column.
4. The card links to `/thing/{id}` via a **stretch-link on the title**; `CardActions` sit above it (`z-index`) so heart/share remain independently tappable.

### 3.2 Pixel spec (all widths)

| Element | Spec |
|---|---|
| Card | `display:flex; align-items:stretch; overflow:hidden; background:var(--surface); border-radius:var(--radius-lg)` (16); `box-shadow:var(--shadow-card)` |
| `__rail` | `width:108px; flex-shrink:0; background-size:cover; background-position:center; position:relative` — if using `<img>`, `object-fit:cover; width:108px; height:100%` |
| `__scrim` | `position:absolute; top:0; left:0; right:0; height:52px; background:linear-gradient(180deg, rgba(20,28,32,.5), transparent)` |
| `__side` | `flex:1; min-width:0; padding:12px 13px; display:flex; flex-direction:column; min-height:150px` |
| `__title` | Fraunces 700; `font-size:18px; line-height:1.14; letter-spacing:-.01em;` 2-line clamp; stretch-link. (Smaller than the old row title because the column is narrower — keep 18.) |
| `__blurb` | Inter; `font-size:var(--text-sm)` (14); `color:var(--ink-2); line-height:1.42;` **3-line clamp**; `margin-top:6px` |
| `__meta` | `display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:auto; padding-top:8px` |
| `DateEyebrow` | mono `var(--text-xs)` (12); 700; `letter-spacing:.04em; text-transform:uppercase; white-space:nowrap;` `var(--terra-text)` |
| `CardActions` | heart + share; glyph ~18–19px; stroke `var(--ink-2)`; saved heart → `var(--terracotta)` fill; **each ≥44×44 tap target** (padding around the glyph) |

Resulting card height is content-driven, ~155–175px with a 2-line title + 3-line blurb. That's intended — a taller card means a taller (more prominent) image, since the rail stretches to match.

### 3.3 Notes
- Keep the existing `cardFacts()` / `cardBlurb()` / `cardTag()` derivations; only where their output renders moves.
- The rail's left corners are rounded by the card's `overflow:hidden`; its right edge is square where it meets the text. Don't add a separate radius to the image.

---

## 4. Change 2 — vibe pill on the photo (+ short-label map)

**Files:** `components/ui/Card.tsx` (render the `Pill` inside `.sbd-listcard__rail`), `lib/occasions.ts` (add the pill-label map), `app/components.css`.

### 4.1 Placement & style
- Render the existing `Pill` primitive **inside the rail**, `position:absolute; top:9px; left:9px; z-index:2`, above the scrim.
- `max-width: 90px` (rail width 108 − 2×9 inset); `white-space:nowrap` so it is **always one line**.
- Fill = the occasion's color from the existing `lib/occasions.ts` map; text is paper/white, **except `free_sb` = gold fill + ink text** (already defined there). Font ~9.5px, weight 800, `letter-spacing:.03em`, uppercase, `padding:3px 9px`, pill radius.
- The **Today feature card** keeps its pill on its image too (already the case) — same short label. Unify.

### 4.2 Short pill-label map (new, in `lib/occasions.ts`)
Add a `pillLabel` per occasion, used **only** for the pill. Everywhere else (filters, detail pages, the Tune sheet) keeps the full occasion name.

| Occasion key | Pill label |
|---|---|
| `arts_culture` | Arts |
| `outdoors_active` | Outdoors |
| `hosting_visitors` | Hosting |
| `catch_a_show` | Catch a Show |
| `wine_food` | Wine & Food |
| `free_sb` | Free in SB |
| `date_night` | Date Night |
| `family_day` | Family Day |
| `nightlife` | Nightlife |
| `solo` | Solo |

Implementation: `pillLabel` falls back to the full display name when no override is set, so only the three long ones (`arts_culture`, `outdoors_active`, `hosting_visitors`) strictly need an entry — but define all ten explicitly to remove ambiguity.

---

## 5. Change 3 — no-photo fallback

When a thing has no usable `photo_url`, the rail must still look intentional:
- Background = a 2-stop **gradient in the occasion's color** (light → dark of that occasion's hue), not a photo gradient and not a flat gray.
- A **small centered icon** (`SBIcon` — the occasion's glyph, or the app's default mark) at ~85% paper/white opacity.
- The **pill still renders** on top (top-left), same as a photo card.
- Never render a broken `<img>`, an empty box, or a stretched placeholder.

Reference: the "Funk Zone Walk" card in the mockup's This Week screen (pacific gradient + mark + "Place" pill).

---

## 6. Change 4 — Today feature lead (retained)

The Today lead is the existing image-top **feature card** (`PickCard`). It is **NOT** converted to a rail. Confirm only:
- Image-top band with the pill on the image (short label) and the heart/share on a scrim, top-right.
- Mono date eyebrow, Fraunces title, **3-line** blurb (set in Phase 6), pacific time footer.

Note the intentional asymmetry: the **feature card carries its actions on the image**; the **rail card carries its actions in the bottom meta row**. Do not "unify" these — it's deliberate (lead vs. list).

This Week has no feature card; every item there is a rail card.

---

## 7. Change 5 — This Week day spine (retained)

Keep the Phase 6 day header + spine (`LeadDayRail`): per-day `EEEE · MMMM d` header, a terracotta node on a thin `--line` spine, cards grouped by `groupByDay()` (unchanged), 12px within a day, 24px between days.

The rail cards are the day-list items. **Protect the separation between the spine and the image rail:** the spine sits in the group's left padding gutter (`::before` at left 6), the card begins at `padding-left:22`, and the image rail begins at the card's left edge — so there's a clear gap and the two left-edge elements never read as one bar. Verify this visually at the checkpoint.

---

## 8. Acceptance checklist

**Rail card (§3)**
- [ ] Image runs the full card height, flush to the left edge, 108px wide; rounded left corners via card `overflow:hidden`.
- [ ] Title is the first element in the text column (nothing above it), 2-line clamp, stretch-link to `/thing/{id}`.
- [ ] Description is 3 lines, `--ink-2`, directly under the title.
- [ ] Date eyebrow + heart/share sit in a bottom meta row pinned to the card's base; every action ≥44×44 target.
- [ ] Same rail card visibly used by This Week rows, Today briefs, and Tier-2/3.

**Vibe pill (§4)**
- [ ] Pill is on the photo, top-left, over a scrim; legible on light and dark images.
- [ ] Pill is always ONE line (`nowrap`); long occasions use the short labels; "Outdoors", "Arts", "Hosting" fit without wrapping or clipping.
- [ ] `free_sb` pill is gold fill + ink text.

**Fallback (§5)**
- [ ] No-photo cards show an occasion-color gradient + a small centered icon + the pill; never a broken/empty image.

**Today & This Week (§6–7)**
- [ ] Today: feature lead (image-top) first, then rail briefs; feature actions on the image, rail actions in the meta row.
- [ ] This Week: rail cards under the day header + spine; clear gap between the spine and the image rail; days ascending.

**Global**
- [ ] Tokens only; no new hex; hero untouched; `lib/explore.ts` unchanged.
- [ ] `lib/occasions.ts` gains only the `pillLabel` map (no logic change).
- [ ] AA: 44px targets, focus-visible ring, `alt` on images, reduced-motion respected, pill never color-only.
- [ ] Desktop widths of both screens look right (not just phone).

---

## 9. File index — reconcile against the live repo first

- `components/ui/Card.tsx` — `ListCard` → rail layout (§3); render `Pill` inside the rail (§4); no-photo fallback branch (§5). `PickCard` (feature) unchanged except confirm 3-line blurb (§6).
- `app/components.css` — `.sbd-listcard*` rail styles, scrim, pill-on-rail positioning, fallback gradient/icon. (Confirm the actual stylesheet path; may be `app/components.css` or co-located.)
- `lib/occasions.ts` — add the `pillLabel` map (§4). Occasion→color map already exists; do not change it.
- `components/explore/LeadDayRail.tsx` — day header + spine retained (§7); verify it renders the updated rail `ListCard` as its items. Likely no change beyond that.
- **Do not touch:** `Hero.tsx`, `lib/explore.ts`, `lib/things.ts`, `RockTile.tsx` (Month), schema, queries, ranker, AI/batch.

---

## 10. Mockup ↔ spec mapping

`SBDaymaker_Explore_Phase7_Mockup.html`:
- **Top strip ("the four options")** — context only; shows why Option 1 was chosen. Do not build the other three.
- **Today screen** — feature lead (`.feat`) + two rail cards (`.rc`), including an "Outdoors" pill proving the longest short label fits one line.
- **This Week screen** — day spine (`.dg`/`.dh`) with rail cards, including the no-photo fallback card.
- The mockup renders actions at a compact visual size; the **tap target is ≥44px** in the build regardless of the drawn glyph size.
