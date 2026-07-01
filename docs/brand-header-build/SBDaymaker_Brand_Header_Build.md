# SB Daymaker — Global Brand Header ("Golden Hour") · Build Spec

`Status: delta spec · 2026-06-30 · for Claude Code · single feature, self-contained`

> **Precedence.** This spec defers to `CLAUDE.md`, `sbdaymaker_tokens.css`, and the wireframe v9. If anything here conflicts with those, they win — stop and flag it. This doc is a **delta spec**: build exactly what's below, don't re-derive decisions, don't re-open settled questions. Where a value comes from the tokens file, pull it from the token — never hardcode a brand hex.

---

## 1. Goal (one paragraph)

Replace the current per-section top bar (the small "S" tile + section name "Explore / Saved / Discover SB") with **one global brand header** — the "Golden Hour" design — rendered once in the **root layout** so it appears identically across the top of **every page** of the site. It is a sticky bar (`position: sticky; top: 0`) that carries as the user scrolls. It shows the SB Daymaker wordmark with the app's signature golden-hour sun rising over the Pacific as the mark, and a thin sunset-gradient "horizon" hairline beneath it. It is a link to home (Explore). It is **fully deterministic** (no AI, no data fetch) and **AA-compliant**.

---

## 2. Decisions already made — DO NOT re-open

1. **Design = "Golden Hour" (#1).** Not the postcard/gradient band, not the masthead, not any other option. The exact spec is §4.
2. **Global, in the root layout.** One instance, on every page. Not a per-page or per-section component.
3. **The brand wordmark replaces the section title in the top bar.** Section identity now lives **solely in the bottom nav** (which already labels the active tab). Do **not** add the section name back into this header.
4. **No search feature.** The mockups showed a magnifying-glass glyph; that implied a feature that doesn't exist in V1. **Omit the right-side icon.** The right slot stays empty for now (see §7, flagged item B).
5. **Time-of-day sync is a separate, optional Phase 2** (§6). The **required** build is the daytime/static header in §4. Build the sync only if Jim says go.
6. **Detail/back pages:** keep the global brand header at the very top, and add a slim contextual back-row **beneath** it (§5) — the brand header is a constant, back nav is contextual and separate.

---

## 3. Where it goes (architecture)

- Create `components/BrandHeader.tsx` (a plain server component — no client JS needed for the required build).
- Create its styles as `components/brand-header.css` (or the project's equivalent CSS-module/global convention). Use the CSS class convention `sbd-brandhdr__{element}--{modifier}` from the design system.
- **Mount it as the first child of the scrolling app container** in the App Router root layout (`app/layout.tsx`), above `{children}`, so `sticky; top:0` pins it to the top of the scroll context on every route:

```tsx
// app/layout.tsx  (structure only — match the existing container/scroll setup)
<body>
  <div className="sbd-app">          {/* the existing scroll container */}
    <BrandHeader />
    {children}
  </div>
  <BottomNav />                       {/* existing */}
</body>
```

- **Retire the old top bar.** Remove the per-section header title (the "S" tile + section name) from Explore, Saved, and Discover SB so we don't stack two headers. Search the codebase for the old header component / `headerHTML` equivalent and delete its top-level usage.

### Sticky-offset gotcha (must fix)
Any element that stuck *below* the old header assumed the old ~60px height. Introduce one CSS variable and drive offsets from it so they never drift:

```css
:root{ --sbd-header-h: 62px; }        /* rendered height of the brand header, non-notch */
```

Then set the **Explore controls row** (the sticky Today/This Week/This Month + Lens bar) to `top: var(--sbd-header-h);` instead of its current hardcoded `top: 60px`. Verify on Explore that the controls row pins flush under the header with no overlap or gap; nudge `--sbd-header-h` if needed after measuring.

---

## 4. The design (REQUIRED build — daytime/static)

### Structure
```
<header.sbd-brandhdr>            sticky top:0, z-index 40, bg --plaster
  <div.sbd-brandhdr__row>        flex, align center, gap 11px
    <a.sbd-brandhdr__logo href="/" aria-label="SB Daymaker — Explore">
      <span.sbd-brandhdr__mark aria-hidden>   34×34 sun-over-Pacific tile
         <span.__glint/> <span.__sun/>
      <span.sbd-brandhdr__word>
         <span.__eyebrow>Santa Barbara</span>
         <span.__wordmark>Day<b>maker</b></span>
  <div.sbd-brandhdr__horizon aria-hidden/>     3px sunset-gradient hairline
</header>
```

### Component
```tsx
// components/BrandHeader.tsx
import Link from "next/link";
import "./brand-header.css";

export default function BrandHeader() {
  return (
    <header className="sbd-brandhdr">
      <div className="sbd-brandhdr__row">
        <Link href="/" className="sbd-brandhdr__logo" aria-label="SB Daymaker — Explore">
          <span className="sbd-brandhdr__mark" aria-hidden="true">
            <span className="sbd-brandhdr__glint" />
            <span className="sbd-brandhdr__sun" />
          </span>
          <span className="sbd-brandhdr__word">
            <span className="sbd-brandhdr__eyebrow">Santa Barbara</span>
            <span className="sbd-brandhdr__wordmark">Day<b>maker</b></span>
          </span>
        </Link>
      </div>
      <div className="sbd-brandhdr__horizon" aria-hidden="true" />
    </header>
  );
}
```

### Styles
```css
/* components/brand-header.css
   Brand tokens come from sbdaymaker_tokens.css (--plaster, --ink, --pacific, --tile, --gold, --font-display).
   The four --hdr-* values below are DECORATIVE illustration stops for the little sky/sea scene inside
   the mark — they are NOT brand tokens. They mirror the hero's existing sky gradient. See flagged item C. */
.sbd-brandhdr{
  --hdr-sky-hi:#bfe0e6;   /* upper sky */
  --hdr-sky-lo:#7cc0cf;   /* lower sky at the horizon */
  --hdr-suncore:#FFF3D0;  /* sun core */
  position:sticky; top:0; z-index:40;
  background:var(--plaster);
}
.sbd-brandhdr__row{
  display:flex; align-items:center; gap:11px;
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 18px 11px;
}
.sbd-brandhdr__logo{
  display:flex; align-items:center; gap:11px;
  text-decoration:none; color:inherit; border-radius:10px;
}
.sbd-brandhdr__logo:focus-visible{ outline:2px solid var(--pacific); outline-offset:3px; }

.sbd-brandhdr__mark{
  position:relative; width:34px; height:34px; flex-shrink:0; border-radius:10px; overflow:hidden;
  /* sky on top, Pacific below a hard horizon at 47%, sun sitting on the line */
  background:linear-gradient(180deg,
    var(--hdr-sky-hi) 0%, var(--hdr-sky-lo) 46%,
    var(--pacific) 47%, var(--pacific-dark) 100%);
}
.sbd-brandhdr__sun{
  position:absolute; left:50%; bottom:44%; transform:translateX(-50%);
  width:16px; height:16px; border-radius:50%;
  background:radial-gradient(circle, var(--hdr-suncore) 10%, var(--gold) 62%, rgba(224,168,46,0) 74%);
  box-shadow:0 0 14px 3px rgba(224,168,46,.55);
}
.sbd-brandhdr__glint{
  position:absolute; left:0; right:0; bottom:0; height:47%;
  background:linear-gradient(180deg, rgba(255,243,208,.30), transparent);
}
.sbd-brandhdr__word{ display:flex; flex-direction:column; line-height:1; }
.sbd-brandhdr__eyebrow{
  font-family:var(--font-display); font-weight:600; font-size:11px;
  letter-spacing:3.4px; text-transform:uppercase; color:var(--pacific);
}
.sbd-brandhdr__wordmark{
  font-family:var(--font-display); font-weight:700; font-size:22px; letter-spacing:-.6px;
  color:var(--ink); margin-top:3px; line-height:1;
}
.sbd-brandhdr__wordmark b{ color:var(--tile); font-weight:700; }  /* large-text use of terracotta — AA-safe at 22px/700 */

.sbd-brandhdr__horizon{
  height:3px;
  background:linear-gradient(90deg, var(--pacific), var(--gold) 55%, var(--tile));
}

/* signature sun breathes; freeze under reduced motion */
@media (prefers-reduced-motion: no-preference){
  @keyframes sbdBrandhdrSun{ 0%,100%{ filter:brightness(1); } 50%{ filter:brightness(1.12); } }
  .sbd-brandhdr__sun{ animation:sbdBrandhdrSun 3.4s ease-in-out infinite; }
}
```

> **Token note:** if the tokens file names deep teal `--pacific-dark` differently in the running build (some surfaces use `--pacificDk`), use whichever the codebase actually defines. Don't invent a new one.

---

## 5. Detail / sub-pages (back navigation)

The brand header stays at the very top of these pages too. Directly beneath it, render a slim contextual back-row so the user can return:

```
<div.sbd-backrow>
  <button.sbd-backrow__btn>‹ Back</button>   min 44×44 tap target, focus-visible ring --pacific
  <span.sbd-backrow__ctx>{contextual label, e.g. guide name}</span>   optional, --ink2, small
</div>
```
- Background `--plaster`, a `1px solid var(--line)` top divider, `padding: 10px 18px`.
- The back button uses the existing back behavior (router back / the prior `APP.go` target). Keep it text-based ("‹ Back"), not an icon-only control.
- This row is **not** sticky (only the brand header is). If the existing detail screens already have a back affordance, migrate it into this row rather than adding a second one.

---

## 6. OPTIONAL Phase 2 — time-of-day sync (build only on Jim's go)

Ties the header to the hero: the mark's sky/sea + sun and the horizon hairline shift with the time of day. **Reuse the hero's existing time-of-day source — do not add a second clock** (single source of truth; avoids hydration mismatch). Add a modifier class on `.sbd-brandhdr` (`--morning | --afternoon | --evening | --night`) driven by that same value, and layer these overrides:

```css
.sbd-brandhdr--morning   { --hdr-sky-hi:#bfe0e6; --hdr-sky-lo:#8fbfd0; }
.sbd-brandhdr--morning   .sbd-brandhdr__sun{ background:radial-gradient(circle,#FFF6E0 12%,#f4c96a 66%,rgba(244,201,106,0) 78%); }
.sbd-brandhdr--morning   .sbd-brandhdr__horizon{ background:linear-gradient(90deg,var(--pacific),#8fbfd0 45%,#eab98a); }

.sbd-brandhdr--afternoon { /* the default in §4 — no override needed */ }

.sbd-brandhdr--evening   { --hdr-sky-hi:#e9a765; --hdr-sky-lo:#d98a4a; }
.sbd-brandhdr--evening   .sbd-brandhdr__mark{ background:linear-gradient(180deg,#e9a765 0%,#d98a4a 46%,#1b4a5a 47%,var(--pacific-dark) 100%); }
.sbd-brandhdr--evening   .sbd-brandhdr__sun{ background:radial-gradient(circle,#FFE5C0 10%,#f0913f 62%,rgba(240,145,63,0) 76%); }
.sbd-brandhdr--evening   .sbd-brandhdr__horizon{ background:linear-gradient(90deg,var(--pacific),var(--gold) 50%,var(--tile)); }

.sbd-brandhdr--night     .sbd-brandhdr__mark{ background:linear-gradient(180deg,#123141 0%,#0e2b39 46%,#0b1f2b 47%,#06131b 100%); }
.sbd-brandhdr--night     .sbd-brandhdr__sun{ /* moon */ background:radial-gradient(circle,#eef3f7 20%,#c3d2dc 70%,rgba(195,210,220,0) 80%); box-shadow:0 0 10px 2px rgba(200,215,225,.4); }
.sbd-brandhdr--night     .sbd-brandhdr__horizon{ background:linear-gradient(90deg,#123141,#2c6b78 55%,#3a5a66); }
```

If sync is built, `BrandHeader` becomes a client component (`"use client"`) that reads the shared time-of-day value and applies the modifier class, with a safe default (afternoon) on first render.

---

## 7. Flagged decisions (defaults chosen so you're not blocked)

- **A · Wayfinding.** Section name is gone from the top; bottom nav carries it. *Default: accepted (per §2.3).* Change only if Jim wants a section cue back.
- **B · Right slot.** Empty for now. It can later host **one real action** (e.g., digest opt-in / magic-link backup entry), never a fake search. *Default: omit.*
- **C · Illustration colors.** The four `--hdr-*` stops aren't brand tokens; they mirror the hero's sky. *Default: keep scoped to the component.* If Jim wants them promoted into `sbdaymaker_tokens.css` as first-class tokens, that's a one-line follow-up — flag it, don't do it silently.

---

## 8. Accessibility (build-floor, verify each)

- `<header>` is the banner landmark; the logo is a single link with `aria-label="SB Daymaker — Explore"`; the mark, glint, sun, and horizon are `aria-hidden`.
- Text is real text (not an image), so it's readable and scalable.
- Wordmark uses terracotta only at 22px/700 (**large text** → AA at 3:1); eyebrow is Pacific on plaster (7.1:1); "Day" is Ink. No small text on an accent color.
- `:focus-visible` ring (Pacific) on the logo link and the back button; both keyboard-operable; back button ≥44×44.
- Sun glow stops under `prefers-reduced-motion` (static state).
- `env(safe-area-inset-top)` keeps the header clear of the notch when installed as a PWA.

---

## 9. Acceptance checklist (Jim verifies visually)

- [ ] Brand header appears identically at the top of **Explore, Saved, and Discover SB**, and on detail pages.
- [ ] It sticks to the top and carries while scrolling; the Explore controls row pins flush beneath it (no overlap/gap).
- [ ] Old "S" tile + section-name bar is gone everywhere (no double header).
- [ ] Wordmark reads "Santa Barbara / Daymaker" (Day in Ink, maker in Terracotta); sun sits on the Pacific horizon in the mark; 3px sunset hairline underneath.
- [ ] Tapping the logo returns to Explore. Detail pages show a working "‹ Back" row beneath the header.
- [ ] Keyboard focus rings visible; reduced-motion freezes the sun; no console errors; renders on mobile width.

---

## 10. Out of scope — do NOT build

- No search, menu, or notification affordance in the header.
- No time-of-day sync unless §6 is explicitly greenlit.
- No new nav tab, no section title in the header, no changes to the bottom nav or hero.
- No new dependencies. No hardcoded brand hex (tokens only, per CLAUDE.md §8.2).

*Stop after this and show the rendered Explore, Saved, Discover SB, and one detail page for approval before moving on.*
