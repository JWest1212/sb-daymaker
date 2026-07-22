# Section 3 - Design System

## 3.1 Where styling comes from

The cascade, in load order (app/layout.tsx lines 10-12, with the comment "overrides (globals), then the component layer."):

1. app/sbdaymaker_tokens.css - the design-token source of truth (a copy of Core Project Files/sbdaymaker_tokens.css; header: "sbdaymaker_tokens.css - Status: v9 canon · 2026-06-21 · design-system source of truth"). All CSS custom properties on :root.
2. app/globals.css - imports Tailwind v4 (`@import "tailwindcss"`), remaps the font tokens to next/font/google variables, and mirrors seven semantic color tokens into Tailwind's theme via `@theme inline` (colors only).
3. app/components.css - the public-app component layer (mostly out of Cockpit scope).
4. app/admin/review/cockpit.css - the Cockpit's own stylesheet, imported once by app/admin/layout.tsx (line 4: `import "./review/cockpit.css";`). Every rule is scoped under `.sbd-cockpit`. Its header comment: "Ported from Core Project Files/cockpit_wireframe.html, scoped under .sbd-cockpit and driven entirely by the design tokens (no hardcoded hex)." (That claim is 99% true; see the hardcode audit in 3.5.)

The login page (SCR-12) does NOT load cockpit.css; it uses public-app classes (`sbd-public`, `sbd-form`, `sbd-field` from app/components.css) and the shared Button component.

There is no UI/component library. components/ui/* is an in-house set (Button, Tag/Chip, SegmentedControl, BottomSheet, etc., exported via components/ui/index.ts); the Cockpit console itself uses almost none of it (only the legacy login form and the orphaned legacy ReviewCard import from it). The live console is styled entirely by cockpit.css classes on plain JSX elements.

Tailwind note (repeat of Section 2 because it matters): Tailwind is v4 CSS-first, no tailwind.config file exists, and the Cockpit does not use Tailwind utility classes. A restyle proposal written in Tailwind utilities would be a new pattern for this codebase, not an extension of an existing one.

## 3.2 Color tokens (defined in app/sbdaymaker_tokens.css, all on :root)

Brand palette:

| Token | Hex | Comment in source |
|---|---|---|
| --plaster | #F6F1E7 | warm white - primary background |
| --plaster-2 | #EFE7D8 | secondary surface / dividers |
| --paper | #FCFAF5 | cards / raised surfaces |
| --ink | #241C16 | brown-black - primary text (14.9:1) |
| --ink-2 | #4A4038 | secondary text (9.0:1) |
| --pacific | #16586A | teal - links, accents on text (7.1:1) |
| --pacific-dark | #0E3C49 | deep teal - dark surfaces |
| --terracotta | #C0532E | tile - large headings / UI only |
| --tile-light | #E08A5B | fills / borders only - NEVER text on light |
| --gold | #E0A82E | golden hour - fills / icons only on light |
| --sage | #7E8B6B | chaparral - large / UI only |
| --line | #D8CDB8 | hairline rules |
| --purple | #9C6B9E | persona accent - large / UI only |
| --forest | #3E7C5A | persona accent - large / UI only |

AA-safe text variants (small text on light backgrounds): --gold-text #7A5E13, --sage-text #566049, --terra-text #9E3F20, --gold-nav-active #F5C95B.

Semantic aliases: --bg, --surface, --text, --text-muted, --text-link, --border, --accent (mapped to the palette above; the tokens file says "Build against THESE, not raw palette").

Severity tokens (comment: "Severity (admin + status)"): --sev-blocker #B23A2E, --sev-high #C77D1E, --sev-med #9A8A3E, --sev-low #3E7C5A.

RAG heatmap tints (comment: "RAG heatmap tints (Cockpit v2 Coverage) - background fills only; the count text is always Ink (a11y usage rule)"): --rag-red rgba(178,58,46,.15), --rag-red-2 rgba(178,58,46,.28), --rag-amber rgba(199,125,30,.16), --rag-green rgba(62,124,90,.16), --rag-green-2 rgba(62,124,90,.30). These two groups exist specifically FOR the Cockpit.

## 3.3 Typography, spacing, radii, motion, breakpoints

- Fonts: --font-display 'Fraunces' (serif, headlines), --font-body 'Inter', --font-mono 'JetBrains Mono' (comment: "data, code, timestamps"). Loaded via next/font/google in app/layout.tsx and re-pointed in app/globals.css (`--font-display: var(--font-fraunces), Georgia, serif;` etc.).
- Type scale (1.25 ratio): --text-xs 0.75rem, --text-sm 0.875rem, --text-base 1rem, --text-lg 1.25rem, --text-xl 1.563rem, --text-2xl 1.953rem, --text-3xl 2.441rem. Note: cockpit.css mostly does NOT use these scale tokens; it hardcodes rem values per rule (e.g. `.qtitle { font-size: 1.563rem }`, `.blurb { font-size: .92rem }`). The values often match the scale but are written as literals; many Cockpit sizes (.6rem-.92rem) sit BELOW --text-xs, i.e. below the public app's 16px body floor ("Minimum body size is 16px", tokens file line 97). This is a deliberate density choice in the Cockpit [INFERRED], but it means the "type scale" is not actually enforced there.
- Weights: 400/500/600/700/900. Leading: 1.1/1.3/1.6. Touch floor: --tap-min 44px (cockpit.css respects it on primary buttons: `.btn { min-height: 40px }` is slightly under; `.wbtn { min-width: 44px; min-height: 44px }`, `.tab { min-height: 44px }`, `.sweep-chip { min-height: 44px }` comply; several small buttons like `.btn-sm { min-height: 32px }`, `.imgnav` 34px, `.ed-reorder-btn` 22px do not).
- Space: --space-1 4px through --space-16 64px (4px base). cockpit.css uses literal px paddings/gaps rather than these tokens throughout.
- Radii: --radius-sm 7px, --radius-md 12px, --radius-lg 16px, --radius-pill 999px. Used heavily in cockpit.css.
- Shadows: --shadow-card, --shadow-sheet. Motion: --ease-out, --ease-spring, --dur-fast 140ms, --dur-base 240ms, --dur-slow 520ms, --dur-pulse 2400ms. cockpit.css uses var(--ease-out) for card leave transitions and includes its own reduced-motion kill switch: `@media (prefers-reduced-motion: reduce) { .sbd-cockpit * { transition: none !important; animation: none !important; } }` (cockpit.css line 226).
- Breakpoints: the tokens file documents "mobile (base) <600 · tablet 600-1023 · desktop >=1024 · wide >=1280" as reference only. cockpit.css uses its own ad-hoc breakpoints: 900px (two-column layouts collapse to one), 640px (topbar wraps, tab strip scrolls), 620px (review card grid stacks), 560px (catalog row actions wrap, image-option grids), 680px (edition panels), plus one min-width 560px (sweep stat grid). These do not match the documented reference breakpoints.

## 3.4 Cockpit-vs-public divergence (explicit answer)

The Cockpit consumes the SAME token file as the public app; there is no forked palette. cockpit.css introduces no new custom properties. What it does introduce locally:

- Its own component classes (about 250 rules under .sbd-cockpit), independent of the public component layer in app/components.css.
- Many literal rgba() tints derived from palette hexes (e.g. `rgba(22,88,106,.06)` = pacific at 6%, `rgba(224,168,46,.16)` = gold at 16%, `rgba(192,83,46,.13)` = terracotta at 13%, `rgba(36,28,22,.78)` = ink at 78%). These are token-derived but hand-inlined; changing a palette hex would NOT update these tints. There are roughly 40 such literals across cockpit.css.
- Its own breakpoints (see 3.3) and its own focus ring (`.sbd-cockpit :focus-visible { outline: 3px solid var(--pacific); ... }`, cockpit.css line 12).

Two tokens are referenced in cockpit.css that are DEFINED NOWHERE in the repo: `var(--rule)` and `var(--radius-card)` (cockpit.css line 390, `.registry-snippet`). Grep for `--rule:` and `--radius-card:` across app/, components/, and Core Project Files/ returns nothing. The browser treats these as invalid at computed-value time, so the registry snippet's border/radius silently fall back to defaults. (app/components.css line 3021 also uses the undefined --radius-card; same class of bug in the public app.)

## 3.5 Checkable hardcode audit

Command: `grep -rnE '#[0-9a-fA-F]{3,8}\b' app/admin app/cockpit --include="*.tsx" --include="*.css"` plus a px-font-size grep and an inline-style scan.

Hex literals that bypass tokens (the complete list; the project rule is "never hardcode a color"):

| File:line | Value | Context |
|---|---|---|
| app/admin/review/cockpit.css:263 | #C9E0E6 | `.bulkbar .sel` text color on the dark bulk bar |
| app/admin/review/cockpit.css:267 | #C9E0E6 | `.bulkbar .bb.clear` link color on the dark bulk bar |

(A third grep hit, NeighborhoodSweepView.tsx line 65, is the HTML entity `&#10003;` - a checkmark, not a color.)

Pixel font sizes: none (`font-size: NNpx` does not appear in scoped files).

Inline styles: 96 `style={{...}}` occurrences across the scoped .tsx files. Sampling shows they overwhelmingly reference tokens (e.g. `style={{ fontSize: ".78rem", color: "var(--pacific)" }}` in NeighborhoodSweepView.tsx:183, SourcesView.tsx:109, RecurringRhythmsView.tsx:120) or carry layout-only px values (paddings, margins, widths, e.g. ImagesView.tsx:649 `style={{ padding: "6px 16px" }}`). No inline hex colors were found. The volume of inline styles is itself a consistency finding (the same "small teal mono note" style is hand-inlined in at least three view files instead of being a class); see 14-ux-pain-points.md.

Also notable for a restyle: the ~40 hand-inlined rgba() tints in cockpit.css (see 3.4) are the real "hardcoded color" exposure, more than the single #C9E0E6 hex: they encode palette hexes as decimal triples and will drift silently if the palette changes.
