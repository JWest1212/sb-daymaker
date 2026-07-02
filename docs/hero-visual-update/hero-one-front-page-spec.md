# SB Daymaker — Explore Hero: "One Front Page" Build Spec

`Status: approved delta spec · v3 FINAL (final art locked) · 2026-07-02 · derives from Doc 18 + Hero Dimension Audit + approved final composition`
`Place this file at: docs/hero-one-front-page/hero-one-front-page-spec.md`

---

## 0. Read this first (working rules for Claude Code)

1. **Read this entire spec before writing any code.** Then reconcile every file path referenced below against the live repo — component names here are descriptive; the repo is truth for actual paths. If a referenced component doesn't exist where expected, find it, don't create a duplicate.
2. **All items in this spec are settled decisions.** They passed Jim's assessment + mockup gates. Do not re-litigate, simplify away, or "improve" them. If something is technically impossible as written, stop and flag it with the tradeoff priced — don't quietly work around it.
3. **One stop-and-show checkpoint.** Build Phases 1 and 2 completely, then STOP. Start the dev server and tell Jim exactly what URL/screen to look at, at BOTH phone (~390px) and desktop widths. Do not proceed to Phase 3 (it is gated separately — see §5). Never ask Jim to run terminal commands; you run them.
4. **Never hardcode a token-covered value.** Colors, fonts, spacing, radii come from `sbdaymaker_tokens.css` / the Tailwind mirror. The ONLY sanctioned exception is the hero **scene art** (sky gradient stops + skyline SVG fills), which are scene colors, not UI tokens — see §3.4. Do not add them to the token file.
5. **Presentation layer only.** No schema changes. No changes to `lib/explore.ts` ranking/selection logic. No new data fields. The nightly pipeline is untouched by Phases 1–2.
6. **WCAG 2.2 AA is the build floor:** ≥44×44px touch targets, visible `:focus-visible` rings (Pacific), `prefers-reduced-motion` honored on all loops, meaningful `aria-label`s, no accent-colored small text on light backgrounds.
7. When done with the checkpoint, log the canon amendments in §6 to the deltas ledger (`14_SBDaymaker_Build_Deltas.md`).

---

## 1. What this build does (one paragraph)

The Explore page currently runs two "lead stories": the hero's Today's Pick card and a full-width top-banner feature-lead card that opens the "Happening Today" feed. This build makes the hero pick the **sole marquee** (Assessment Options B+A): the feed's top-banner format is retired and Today opens in the standard left-rail card format; the hero card is restored to its full canon dress (context-aware eyebrow, venue + time, CTA line); live condition chips (weather · sunset, with a golden-hour countdown variant) return to the hero; and the hero background is replaced with the approved hand-styled Santa Barbara skyline SVG (Riviera hillside, Mission, Courthouse, wharf, Lil' Toot). Fully deterministic at runtime — zero AI calls, zero new daily ops.

---

## 2. Phase 1 — Hierarchy + hero card re-dress

### 2.1 Retire the top-banner feature lead
- The "Happening Today" feed must open with the **same left-rail `ListCard` format** as every other feed card (108px image flush left, text stacked right, vibe pill on photo, 3-line description — the locked Phase 7 format).
- **Delete** the top-banner/feature-lead template branch entirely. This is a code removal, not a hide-behind-a-flag.
- Verify (do not assume) that the hero pick item is **filtered out of the feed pool** so it never appears twice. The wireframe does this (`todayPool.filter(t => t !== heroMarquee)`); confirm the live code matches. If it doesn't, fix it here.

### 2.2 Restore the hero pick card to canon dress
The card keeps its side-by-side layout (image panel left, editorial body right). Restore four elements per Doc 00 §5.1 / wireframe v9:

1. **Context-aware eyebrow** (replaces the generic "TODAY'S PICK" label in the body). Mapping, first match wins:
   - gray-day weather override → `Gray day move`
   - `type === 'place'` → `Place to be`
   - `free === true` → `Free · Today`
   - `happening_category === 'live_music'` → `Catch a show`
   - `happening_category ∈ {'arts_theater', 'recurring_arts'}` → `Arts & culture`
   - `type === 'happyhour'` → `Happy hour`
   - fallback → `Today's pick`
   - (Amended 2026-07-02: the original draft named wireframe shorthand `cat === 'music' | 'arts' | 'happyhour'`; resolved to the site's true `happening_category`/`type` enums. There is no happy-hour category, so that bucket keys off the thing type.)
   - Small text on the light card: use `--terra-text` (AA-safe variant), never raw terracotta.
2. **Venue + time meta line**: `{venue} · {time}` (e.g. `Alice Keck Park · 4–6 PM`). Never render the bare city name — every item is in Santa Barbara. If time is absent, venue alone. Color: `--pacific`.
3. **CTA line**: `Get tickets ↗` when `buy` is a ticketing handoff (AXS/Ticketmaster), `See details ↗` otherwise. This is a visual affordance inside the card's single tap target — the whole card opens the detail view; do not create a second nested link.
4. **The image-badge pair stays as-is**: the `✨ {tag}` chip top-left and the save heart top-right on the image panel. Heart: `aria-label="Save {title}"` / `"Saved {title}"`, ≥44px hit area, spring pop honoring reduced motion.
- **No blurb in the hero card.** That lock stands (Phase 3 is the only sanctioned exception, and it is gated).
- Evergreen fallback: the never-blank guarantee is untouched — the hand-written evergreen card renders in the same dressed format.

### 2.3 Condition chips (the freshness line)
A row of small translucent chips under the dateline, above the pick card (wireframe `.hero .cond` styling: white text on `rgba(255,255,255,.2)` pills over the sky).
- **Chip 1 — weather**: `{icon} {temp}°` from the OpenWeather data the nightly pipeline already stores. Read the stored value; do NOT add a live API call.
- **Chip 2 — sunset / golden-hour countdown**: computed client-side with pure math (a tiny sunset-calculation utility for SB's fixed lat/lng — deterministic, no network, no AI):
  - If now is within 90 minutes before sunset: `◐ {n} min of gold left` (update per minute; freeze under `prefers-reduced-motion` to the on-load value).
  - Otherwise: `◐ Sunset {h:mm}`.
- **Surf chip: OMIT.** No surf data source exists in the stack. Do not invent or stub data (seed-data rule: enrich real facts, never invent them). Leave the layout able to accept a third chip later.
- Chips are informational, not interactive — no tap targets needed, but text must remain ≥ the wireframe's legible sizing with the text-shadow treatment for contrast over the sky.
- **Migration note (per audit):** the chip row is NET-NEW — the prior stacked pill row was removed in S4-B and conditions currently ride inline on the dateline as ` · 72° · Sunny` (`.sbd-hero__cond-inline`, Hero.tsx:116-118). Remove that inline suffix; the dateline returns to date + daypart only, and conditions live exclusively in the new chip row. Budget the row at ~26px incl. its top margin.

---

## 3. Phase 2 — The signature skyline background

### 3.1 Layer architecture (bottom → top; z-indices are the new values)
1. **Sky gradient** — CSS background on `.sbd-hero`, per daypart class. Unchanged.
2. **Glow layer** — z:0, unchanged.
3. **Skyline SVG** (the asset in §3.5) replaces the current `.sbd-hero__range` art — `position:absolute; bottom:0; left:0; width:100%`, natural aspect height (REMOVE the fixed 120px height), z:1. Fog band stays z:1 beneath the sun.
4. **Sun** — raise from z:0 to **z:2**. The old design had the sun "set behind the city"; the new corridor is open water at the right, so the sun renders in front of the scene. Keep `sunEntry`/`sunPulse` + reduced-motion fallback.
5. **Dateline + chips** — z:3 (was 2).
6. **Pick card** — z:4 (was 3). The `heroCardIn` transform entry is fine as-is (sun/skyline remain children of the hero, so their coordinates stay anchored to the hero, not the card).

### 3.2 SVG sizing & hero dimensions (exact, audit-reconciled)
Ground truth from the Hero Dimension Audit: the app has **no responsive breakpoints by design** — the shell caps at `max-width:480px`, so the hero renders at exactly two widths (390px viewport → 390px full-bleed hero; ≥480px viewport → 480px). **Do not introduce breakpoints.** Preserve the full-bleed negative margins (`margin: 0 -20px`) and keep `overflow:hidden` on the hero.

- SVG root attrs: `viewBox="0 0 380 244"`, `width="100%"`, `preserveAspectRatio="xMidYMax slice"`, `aria-hidden="true"`; placed per §3.1 with **natural aspect height** (≈ hero-width × 0.642 — i.e. ~250px tall at 390, ~308px at 480), pinned to bottom. The hero's `overflow:hidden` crops the transparent upper sky of the SVG box; all drawn art survives the crop at both widths (verified: at min hero height the tallest element, the Courthouse weathervane, sits ~25–60px below the card-zone floor).
- **Raise the hero floor: `min-height: 228px` → `min-height: 352px`.** Derivation with the re-dressed card:
  - Card worst case (2-line title clamp retained): pad 16 + eyebrow 19.2 + title 44 + meta 22.4 + **new CTA row 22.4** + inner gaps 3 ≈ **127px** (current card is 104px; the CTA row is the growth).
  - Stack: hero top-pad 12 + dateline 19.2 + chip row ~26 (incl. margin) + card margin-top 8 + card 127 ≈ **192–198px**.
  - Card-zone reserve: stack ≤ 58% of hero → H ≥ ~342px → **352px** floor for breathing room. Same number at both widths (the 2-line clamp makes card height width-independent).
- **Keep `-webkit-line-clamp: 2` on the title.** This is now a load-bearing decision: it bounds the worst-case card at 127px and keeps the reserve math fixed. Do not loosen it.
- Card width needs no rule (block child fills hero content width: ~350px at 390 / ~440px at 480). Image panel stays 84px wide, body-driven height — unchanged.
- Verify visually at **390px and at any viewport ≥480px** (they are the only two distinct renderings; 768 and 1280 are pixel-identical by design).

### 3.3 Sun corridor (hard rule — replaces the current variant positions)
The sun (52px circle, unchanged size/glow) is constrained to the open-water corridor so no card geometry or building ever occludes it. Replace the current per-variant `left/top` values in `app/components.css:2368-2387` with:
- `.sbd-hero--morning .sbd-hero__sun`  → `left: 70%; top: 58%;`
- `.sbd-hero--afternoon .sbd-hero__sun` → `left: 78%; top: 59%;`
- `.sbd-hero--evening .sbd-hero__sun` → `left: 74%; top: 70%;` (low over the water — the golden-hour money shot)
- `--night` (opacity 0) and `--gray` (opacity 0.22) behaviors unchanged.
- Percentages resolve against the hero padding box (hero is the positioned ancestor — confirmed by audit). With the 352px floor, top:58% lands the sun exactly at the card-zone boundary and top:70% floats it above the wharf deck at both widths.
- Sun pulse keeps its existing reduced-motion static fallback.

### 3.4 Scene colors (sanctioned, non-token)
The SVG uses fixed scene hexes by design ("always golden-hour buildings under a changing sky" — the lit stucco/shadow/roof values do NOT vary by daypart; only the CSS sky gradient changes). These are scene art, same sanction as the existing wireframe sky-gradient hexes. Do not migrate them into `sbdaymaker_tokens.css`. Full scene palette (final art): sea/palms/birds `#0A2E38`, mountains `#2E6577`, hill `#7E8B6B`/`#66755A`, lit stucco `#FAF1DE`, mid stucco `#EBDCC2`, shadow stucco `#C7B096`, roofs `#A34423`/`#E08A5B`/`#C0532E`, window/door openings `#123B49`, Courthouse arch glow `#E3A047`/`#A56F2E`/sandstone `#CBB394`, clock face `#F6F1E7`, Mission stone `#DCCDAF`/`#E3D6BC`/`#C2B292` and tower stone `#EFE4CC`/`#D5C6A8`, Mission pink domes/trim/columns `#E2A08E`/`#C88372`/`#DB9C8A`/`#C86E5A`, Mission door wood `#5A4030`, crosses + wharf timber `#4A3524`, lawn `#6FA05C`/`#7FB268`/tufts `#4E7540`, paseo street `#C9A46C`/ruts `#B08A52`, Lil' Toot `#E0A82E` (matches `--gold` by happy accident) / `#FCFAF5` / `#241C16`.

### 3.5 The production asset
Save verbatim as `public/hero/sb-skyline.svg` (reconcile the directory against how the repo serves static assets; inline as a component only if that's the established pattern for the wireframe's current hero SVG):

```svg
<svg viewBox="0 0 380 244" width="100%" preserveAspectRatio="xMidYMax slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
<path d="M0,166 Q45,147 90,161 Q130,173 170,162 Q205,152 235,174 Q258,188 280,196 L380,202 L380,244 L0,244 Z" fill="#2E6577"/>
<path d="M0,179 Q18,171 42,174 Q58,175 72,182 Q88,174 110,177 Q134,180 150,186 Q168,183 184,186 Q208,192 235,220 L235,244 L0,244 Z" fill="#7E8B6B"/>
<ellipse cx="44" cy="214" rx="24" ry="8" fill="#66755A" opacity="0.45"/>
<ellipse cx="148" cy="210" rx="24" ry="7" fill="#66755A" opacity="0.4"/>
<g>
<rect x="8" y="182" width="2.4" height="1.8" fill="#FAF1DE"/>
<rect x="16" y="177" width="2.4" height="1.8" fill="#FAF1DE"/><rect x="16.4" y="176" width="1.6" height="1" fill="#C0532E"/>
<rect x="28" y="176" width="2.4" height="1.8" fill="#FAF1DE"/>
<rect x="38" y="178" width="2.4" height="1.8" fill="#FAF1DE"/><rect x="38.4" y="177" width="1.6" height="1" fill="#C0532E"/>
<rect x="50" y="178" width="2.4" height="1.8" fill="#FAF1DE"/>
<rect x="60" y="182" width="2.4" height="1.8" fill="#FAF1DE"/><rect x="60.4" y="181" width="1.6" height="1" fill="#C0532E"/>
<rect x="70" y="178" width="2.4" height="1.8" fill="#FAF1DE"/>
<rect x="80" y="177" width="2.4" height="1.8" fill="#FAF1DE"/><rect x="80.4" y="176" width="1.6" height="1" fill="#C0532E"/>
<rect x="92" y="178" width="2.4" height="1.8" fill="#FAF1DE"/>
<rect x="102" y="179" width="2.4" height="1.8" fill="#FAF1DE"/><rect x="102.4" y="178" width="1.6" height="1" fill="#C0532E"/>
<rect x="112" y="180" width="2.4" height="1.8" fill="#FAF1DE"/>
<rect x="122" y="181" width="2.4" height="1.8" fill="#FAF1DE"/><rect x="122.4" y="180" width="1.6" height="1" fill="#C0532E"/>
<rect x="140" y="187" width="2.4" height="1.8" fill="#FAF1DE"/>
<rect x="152" y="185" width="2.4" height="1.8" fill="#FAF1DE"/><rect x="152.4" y="184" width="1.6" height="1" fill="#C0532E"/>
<rect x="164" y="185" width="2.4" height="1.8" fill="#FAF1DE"/>
<rect x="176" y="188" width="2.4" height="1.8" fill="#FAF1DE"/><rect x="176.4" y="187" width="1.6" height="1" fill="#C0532E"/>
<rect x="184" y="190" width="2.4" height="1.8" fill="#FAF1DE"/>
</g>
<g>
<rect x="12" y="188" width="4.5" height="3.2" fill="#FAF1DE"/><path d="M11.2,188 L14.2,185.6 L17.3,188 Z" fill="#A34423"/>
<rect x="24" y="184" width="4.5" height="3.2" fill="#FAF1DE"/><path d="M23.2,184 L26.2,181.6 L29.3,184 Z" fill="#C0532E"/>
<rect x="38" y="186" width="4.5" height="3.2" fill="#FAF1DE"/><path d="M37.2,186 L40.2,183.6 L43.3,186 Z" fill="#A34423"/>
<rect x="52" y="184" width="4.5" height="3.2" fill="#FAF1DE"/><path d="M51.2,184 L54.2,181.6 L57.3,184 Z" fill="#C0532E"/>
<rect x="64" y="188" width="4.5" height="3.2" fill="#FAF1DE"/><path d="M63.2,188 L66.2,185.6 L69.3,188 Z" fill="#A34423"/>
<rect x="142" y="192" width="4.5" height="3.2" fill="#FAF1DE"/><path d="M141.2,192 L144.2,189.6 L147.3,192 Z" fill="#C0532E"/>
<rect x="156" y="190" width="4.5" height="3.2" fill="#FAF1DE"/><path d="M155.2,190 L158.2,187.6 L161.3,190 Z" fill="#A34423"/>
<rect x="170" y="192" width="4.5" height="3.2" fill="#FAF1DE"/><path d="M169.2,192 L172.2,189.6 L175.3,192 Z" fill="#C0532E"/>
</g>
<g>
<rect x="14" y="196" width="6" height="4.4" fill="#FAF1DE"/><path d="M12.8,196 L17,192.8 L21.2,196 Z" fill="#A34423"/>
<rect x="30" y="192" width="6" height="4.4" fill="#FAF1DE"/><path d="M28.8,192 L33,188.8 L37.2,192 Z" fill="#C0532E"/>
<rect x="48" y="196" width="6" height="4.4" fill="#FAF1DE"/><path d="M46.8,196 L51,192.8 L55.2,196 Z" fill="#A34423"/>
<rect x="64" y="194" width="6" height="4.4" fill="#FAF1DE"/><path d="M62.8,194 L67,190.8 L71.2,194 Z" fill="#C0532E"/>
<rect x="10" y="206" width="6.5" height="4.6" fill="#FAF1DE"/><path d="M8.8,206 L13.2,202.6 L17.7,206 Z" fill="#C0532E"/>
<rect x="26" y="202" width="6.5" height="4.6" fill="#FAF1DE"/><path d="M24.8,202 L29.2,198.6 L33.7,202 Z" fill="#A34423"/>
<rect x="42" y="206" width="6.5" height="4.6" fill="#FAF1DE"/><path d="M40.8,206 L45.2,202.6 L49.7,206 Z" fill="#C0532E"/>
<rect x="58" y="204" width="6.5" height="4.6" fill="#FAF1DE"/><path d="M56.8,204 L61.2,200.6 L65.7,204 Z" fill="#A34423"/>
</g>
<path d="M154,154 q4,-4 8,0 q4,-4 8,0" fill="none" stroke="#0A2E38" stroke-width="1.3" stroke-linecap="round"/>
<path d="M258,158 q3.5,-3.5 7,0 q3.5,-3.5 7,0" fill="none" stroke="#0A2E38" stroke-width="1.2" stroke-linecap="round"/>
<rect x="72" y="196" width="58" height="29" fill="#DCCDAF"/>
<path d="M73,204 L129,204 M73,210 L129,210 M73,216 L129,216" stroke="#C2B292" stroke-width="0.5" opacity="0.7"/>
<path d="M88,196 L101,183 L114,196 Z" fill="#E3D6BC"/>
<path d="M87,197 L101,183 L102.8,184.8 L89.8,197 Z" fill="#C86E5A"/>
<path d="M101,183 L115,197 L112.2,197 L99.2,184.8 Z" fill="#C86E5A"/>
<rect x="97.5" y="178" width="7" height="5" fill="#E3D6BC"/>
<rect x="99" y="174.5" width="4" height="3.5" fill="#E3D6BC"/>
<rect x="100.4" y="168.5" width="1.2" height="6" fill="#4A3524"/>
<rect x="98.6" y="169.7" width="4.8" height="1.1" fill="#4A3524"/>
<g fill="#DB9C8A">
<rect x="92.5" y="197" width="1.7" height="25"/>
<rect x="95.7" y="197" width="1.7" height="25"/>
<rect x="98.9" y="197" width="1.7" height="25"/>
<rect x="102.4" y="197" width="1.7" height="25"/>
<rect x="105.6" y="197" width="1.7" height="25"/>
<rect x="108.8" y="197" width="1.7" height="25"/>
</g>
<circle cx="101" cy="203" r="2.7" fill="#123B49"/>
<circle cx="101" cy="203" r="2.7" fill="none" stroke="#C86E5A" stroke-width="0.8"/>
<path d="M97.2,225 L97.2,216.4 Q101,212.6 104.8,216.4 L104.8,225 Z" fill="#DB9C8A"/>
<path d="M98.6,225 L98.6,217.2 Q101,214.8 103.4,217.2 L103.4,225 Z" fill="#5A4030"/>
<rect x="72" y="183" width="7" height="42" fill="#D5C6A8"/>
<rect x="79" y="183" width="11" height="42" fill="#EFE4CC"/>
<path d="M73,206 L89,206 M73,214 L89,214" stroke="#C2B292" stroke-width="0.5" opacity="0.6"/>
<rect x="71.4" y="189.3" width="19.2" height="1.6" fill="#DB9C8A"/>
<rect x="71.4" y="200.3" width="19.2" height="1.6" fill="#DB9C8A"/>
<path d="M77,199.5 L77,193.5 Q81,190.2 85,193.5 L85,199.5 Z" fill="#123B49"/>
<path d="M77,210.5 L77,205 Q81,202 85,205 L85,210.5 Z" fill="#123B49"/>
<path d="M71,183 Q81,171.5 91,183 Z" fill="#E2A08E"/>
<path d="M71,183 Q75,176 81,173.8 L81,177 Q76,179 74,183 Z" fill="#C88372"/>
<path d="M77,175.6 Q77.5,179 76.5,183 M85,175.6 Q84.5,179 85.5,183" stroke="#C88372" stroke-width="0.7" fill="none"/>
<rect x="79" y="168.5" width="4" height="4.5" fill="#EFE4CC"/>
<path d="M78.2,168.5 Q81,166.2 83.8,168.5 Z" fill="#E2A08E"/>
<rect x="80.4" y="162" width="1.2" height="6" fill="#4A3524"/>
<rect x="78.6" y="163.2" width="4.8" height="1.1" fill="#4A3524"/>
<rect x="112" y="183" width="7" height="42" fill="#D5C6A8"/>
<rect x="119" y="183" width="11" height="42" fill="#EFE4CC"/>
<path d="M113,206 L129,206 M113,214 L129,214" stroke="#C2B292" stroke-width="0.5" opacity="0.6"/>
<rect x="111.4" y="189.3" width="19.2" height="1.6" fill="#DB9C8A"/>
<rect x="111.4" y="200.3" width="19.2" height="1.6" fill="#DB9C8A"/>
<path d="M117,199.5 L117,193.5 Q121,190.2 125,193.5 L125,199.5 Z" fill="#123B49"/>
<path d="M117,210.5 L117,205 Q121,202 125,205 L125,210.5 Z" fill="#123B49"/>
<path d="M111,183 Q121,171.5 131,183 Z" fill="#E2A08E"/>
<path d="M111,183 Q115,176 121,173.8 L121,177 Q116,179 114,183 Z" fill="#C88372"/>
<path d="M117,175.6 Q117.5,179 116.5,183 M125,175.6 Q124.5,179 125.5,183" stroke="#C88372" stroke-width="0.7" fill="none"/>
<rect x="119" y="168.5" width="4" height="4.5" fill="#EFE4CC"/>
<path d="M118.2,168.5 Q121,166.2 123.8,168.5 Z" fill="#E2A08E"/>
<rect x="120.4" y="162" width="1.2" height="6" fill="#4A3524"/>
<rect x="118.6" y="163.2" width="4.8" height="1.1" fill="#4A3524"/>
<rect x="136" y="206" width="12" height="19" fill="#C7B096"/>
<rect x="148" y="206" width="12" height="19" fill="#FAF1DE"/>
<path d="M133,208 L148,198 L148,208 Z" fill="#A34423"/>
<path d="M148,198 L163,208 L148,208 Z" fill="#E08A5B"/>
<rect x="141" y="213" width="5" height="6" fill="#123B49"/>
<rect x="152" y="213" width="5" height="6" fill="#123B49"/>
<rect x="163" y="209" width="14" height="16" fill="#C7B096"/>
<rect x="177" y="209" width="14" height="16" fill="#FAF1DE"/>
<path d="M160,211 L177,202 L177,211 Z" fill="#A34423"/>
<path d="M177,202 L194,211 L177,211 Z" fill="#E08A5B"/>
<rect x="169" y="215" width="5" height="5" fill="#123B49"/>
<rect x="181" y="215" width="5" height="5" fill="#123B49"/>
<rect x="190" y="194" width="14" height="31" fill="#EBDCC2"/>
<rect x="189" y="190" width="8" height="4" fill="#A34423"/>
<rect x="197" y="190" width="8" height="4" fill="#E08A5B"/>
<path d="M192,210 L192,204.5 Q194.5,201.5 197,204.5 L197,210 Z" fill="#123B49"/>
<rect x="202" y="162" width="7" height="63" fill="#C7B096"/>
<rect x="209" y="162" width="13" height="63" fill="#FAF1DE"/>
<path d="M198,162 L212,162 L212,154 L203,154 Z" fill="#A34423"/>
<path d="M212,162 L226,162 L221,154 L212,154 Z" fill="#E08A5B"/>
<rect x="211" y="148" width="2" height="6" fill="#A34423"/>
<rect x="208.5" y="149.2" width="7" height="1.2" fill="#A34423"/>
<path d="M206.5,174 L206.5,169 Q209,166 211.5,169 L211.5,174 Z" fill="#123B49"/>
<path d="M213.5,174 L213.5,169 Q216,166 218.5,169 L218.5,174 Z" fill="#123B49"/>
<rect x="203" y="176" width="18" height="1.3" fill="#A34423"/>
<circle cx="212" cy="184" r="5.5" fill="#F6F1E7"/>
<circle cx="212" cy="184" r="5.5" fill="none" stroke="#A34423" stroke-width="1"/>
<path d="M212,184 L212,180.6 M212,184 L214.6,184" fill="none" stroke="#123B49" stroke-width="1.1" stroke-linecap="round"/>
<path d="M218,225 L218,191 L238,178 L258,191 L258,225 Z" fill="#FAF1DE"/>
<path d="M218,225 L218,191 L226,185.8 L226,225 Z" fill="#EBDCC2"/>
<path d="M215,192 L238,177.5 L240.5,179 L218,193.5 Z" fill="#A34423"/>
<path d="M238,177.5 L261,192 L258.5,193.5 L235.5,179 Z" fill="#E08A5B"/>
<path d="M222,201 L222,196.5 Q224,194 226,196.5 L226,201 Z" fill="#123B49"/>
<path d="M229,199 L229,194.5 Q231,192 233,194.5 L233,199 Z" fill="#123B49"/>
<path d="M243,199 L243,194.5 Q245,192 247,194.5 L247,199 Z" fill="#123B49"/>
<path d="M250,201 L250,196.5 Q252,194 254,196.5 L254,201 Z" fill="#123B49"/>
<path d="M226,225 L226,206 Q238,194 250,206 L250,225 Z" fill="#CBB394"/>
<path d="M229.5,225 L229.5,208 Q238,198.5 246.5,208 L246.5,225 Z" fill="#E3A047"/>
<path d="M229.5,225 L229.5,208 Q233,203 238,201.6 L238,204.6 Q234,206 231.5,209 L231.5,225 Z" fill="#A56F2E"/>
<path d="M0,220 L38,218.5 L92,220 L150,218.5 L212,220 L262,219.5 L262,244 L0,244 Z" fill="#6FA05C"/>
<ellipse cx="60" cy="232" rx="30" ry="6" fill="#7FB268" opacity="0.35"/>
<ellipse cx="170" cy="236" rx="36" ry="7" fill="#7FB268" opacity="0.3"/>
<path d="M6,221.4 L246,221.9 Q257,222.4 262,226 L262,229 Q256,225.4 245,224.9 L6,224.4 Z" fill="#C9A46C"/>
<path d="M14,222.9 L240,223.4" stroke="#B08A52" stroke-width="0.5" stroke-dasharray="6 5" fill="none"/>
<g stroke="#4E7540" stroke-width="0.7" fill="none" stroke-linecap="round">
<path d="M16,232 l1,-3 M17.6,232 l0,-3.2 M19.2,232 l-1,-3"/>
<path d="M48,236 l1,-3 M49.6,236 l0,-3.2 M51.2,236 l-1,-3"/>
<path d="M84,231 l1,-3 M85.6,231 l0,-3.2 M87.2,231 l-1,-3"/>
<path d="M120,235 l1,-3 M121.6,235 l0,-3.2 M123.2,235 l-1,-3"/>
<path d="M150,230 l1,-3 M151.6,230 l0,-3.2 M153.2,230 l-1,-3"/>
<path d="M180,236 l1,-3 M181.6,236 l0,-3.2 M183.2,236 l-1,-3"/>
<path d="M210,231 l1,-3 M211.6,231 l0,-3.2 M213.2,231 l-1,-3"/>
<path d="M240,235 l1,-3 M241.6,235 l0,-3.2 M243.2,235 l-1,-3"/>
</g>
<path d="M28,219 C30,209 27,202 32,191" fill="none" stroke="#0A2E38" stroke-width="2.8" stroke-linecap="round"/>
<g fill="none" stroke="#0A2E38" stroke-width="2.2" stroke-linecap="round">
<path d="M32,191 q-11,-7 -19,-3"/>
<path d="M32,191 q-9,-11 -16,-11"/>
<path d="M32,191 q-2,-12 6,-16"/>
<path d="M32,191 q9,-9 16,-8"/>
<path d="M32,191 q11,-3 17,3"/>
<path d="M32,191 q8,2 12,8"/>
</g>
<path d="M52,219 C53,211 51,206 54,199" fill="none" stroke="#0A2E38" stroke-width="2.2" stroke-linecap="round"/>
<g fill="none" stroke="#0A2E38" stroke-width="1.8" stroke-linecap="round">
<path d="M54,199 q-9,-6 -14,-3"/>
<path d="M54,199 q-3,-9 3,-11"/>
<path d="M54,199 q8,-6 13,-4"/>
<path d="M54,199 q8,0 12,5"/>
</g>
<path d="M252,219 C253,212 251,207 254,201" fill="none" stroke="#0A2E38" stroke-width="2" stroke-linecap="round"/>
<g fill="none" stroke="#0A2E38" stroke-width="1.7" stroke-linecap="round">
<path d="M254,201 q-8,-5 -13,-3"/>
<path d="M254,201 q-3,-8 4,-10"/>
<path d="M254,201 q8,-5 12,-4"/>
<path d="M254,201 q7,1 10,5"/>
</g>
<rect x="252" y="226" width="128" height="4" fill="#4A3524"/>
<g fill="#4A3524">
<rect x="262" y="230" width="3" height="9"/>
<rect x="281" y="230" width="3" height="9"/>
<rect x="300" y="230" width="3" height="9"/>
<rect x="319" y="230" width="3" height="9"/>
<rect x="338" y="230" width="3" height="9"/>
<rect x="357" y="230" width="3" height="9"/>
<rect x="374" y="230" width="3" height="9"/>
</g>
<path d="M294,226 L294,215 L310,207.5 L326,215 L326,226 Z" fill="#EBDCC2"/>
<path d="M310,207.5 L326,215 L326,226 L310,226 Z" fill="#FAF1DE"/>
<path d="M291,216.5 L310,206 L329,216.5 L325.5,216.5 L310,208 L294.5,216.5 Z" fill="#A34423"/>
<rect x="307" y="219" width="6" height="7" fill="#123B49"/>
<path d="M358,226 L358,217 L366,210.5 L374,217 L374,226 Z" fill="#EBDCC2"/>
<path d="M366,210.5 L374,217 L374,226 L366,226 Z" fill="#FAF1DE"/>
<path d="M355,218 L366,209 L377,218 L374.5,218 L366,211 L357.5,218 Z" fill="#A34423"/>
<rect x="252" y="238.5" width="128" height="5.5" fill="#0A2E38"/>
<path d="M246,233 q5,-4 10,0" fill="none" stroke="#0A2E38" stroke-width="1.4" stroke-linecap="round"/>
<rect x="288.5" y="231" width="8" height="5.2" fill="#FCFAF5"/>
<rect x="289.7" y="232.2" width="2.3" height="2.4" fill="#123B49"/>
<rect x="293" y="232.2" width="2.3" height="2.4" fill="#123B49"/>
<rect x="295.4" y="228.6" width="2.2" height="3.2" fill="#FCFAF5"/>
<rect x="295.4" y="228" width="2.2" height="1.1" fill="#C0532E"/>
<rect x="297.5" y="232.4" width="8.5" height="1.3" fill="#FCFAF5"/>
<rect x="298" y="233.7" width="1" height="2.8" fill="#FCFAF5"/>
<rect x="304.5" y="233.7" width="1" height="2.8" fill="#FCFAF5"/>
<path d="M284.5,233.6 Q285.2,234.5 288,234.5 L308,234.5 L307,239.3 Q299,241.7 290.5,239.3 Q286,237.4 284.5,233.6 Z" fill="#E0A82E"/>
<path d="M285.5,235.4 L307.3,235.4" stroke="#241C16" stroke-width="0.9"/>
<path d="M286.4,237 q1.5,1.3 3,0.7" stroke="#241C16" stroke-width="0.55" fill="none" stroke-linecap="round"/>
<path d="M288,242.8 q5.5,2 11,0.5" fill="none" stroke="#E0A82E" stroke-width="0.9" stroke-linecap="round" opacity="0.65"/>
</svg>
```

**Important:** the SVG deliberately contains **no sky rectangle and no sun** — the CSS gradient and the existing animated sun element supply those (layer order in §3.1). Baked lighting choices (Courthouse arch glow, lit-stucco/stone shading) stay golden-hour in all dayparts by decision.

**Final-art contents, for the record (do not simplify any of these away):** blue mountain range; sage Riviera hill with ~30 hillside homes in three density bands (detailed low, cottages mid, specks near the crest); the Mission at full fidelity (stone facade with coursing lines, six pink columns, rose window, arched wood door in pink surround, pink-trimmed pediment with stepped parapet + cross, twin stone towers with pink cornice bands, stacked belfry arches, pink ribbed domes, lantern cupolas + crosses); two tile-roofed mid-block buildings; the Courthouse (clock tower with belfry arches, balcony line, weathervane, gabled facade, arched window row, sandstone grand arch with glow); three dark palms; fresh-lawn foreground with sun patches and grass tufts; small tan paseo street with wheel ruts running along the buildings and curving to meet the wharf; dark-brown wharf with a wide mid-pier stucco building and a small hut at the far end; and Lil' Toot (yellow hull, rub rail, bow smile, wheelhouse, red-capped funnel, aft canopy, gold ripple) in the water below. The tallest element remains the Courthouse weathervane (y=148) — the §3.2 reserve math is unchanged by the final art.

---

## 4. Checkpoint (the single hard stop)

After Phases 1–2, STOP and show Jim, at 390px AND at ≥480px (the shell cap — the only two distinct renderings):
1. Explore/Today with a Tier-1 pick: dressed hero card (eyebrow, venue · time, CTA), chips rendering real weather + sunset, skyline behind, sun in corridor, feed opening in left-rail format with no banner and no duplicate of the hero item.
2. The golden-hour countdown state (fake the clock locally to demo it; remove the fake before finishing).
3. The gray-day state: gray gradient + `Gray day move` eyebrow, skyline unchanged.
4. The evergreen-fallback state.
5. Reduced-motion ON: no sun pulse, countdown static.
6. Console clean; Lighthouse a11y pass on the Explore route.

## 4b. Audit reconciliation checklist (all resolved above — listed so nothing is missed)
| Audit finding | Resolution in this spec |
|---|---|
| No breakpoints; shell caps at 480px | Do not add breakpoints; verify at 390 + ≥480 only (§3.2) |
| `min-height: 228px` too low for the reserve | Raise to **352px** (§3.2 derivation) |
| Title `-webkit-line-clamp: 2` | KEEP — bounds worst-case card at 127px (§3.2) |
| No CTA row exists | Added by §2.2; it is the card's only height growth (+~22px) |
| Conditions inline on dateline (S4-B) | Removed; chip row is net-new (§2.3) |
| Sun z:0 renders behind skyline z:1 | Sun raised to z:2 — corridor is open water, sun in front of scene (§3.1) |
| Sun variant positions (16–46% / 16–44%) | Replaced with corridor values (§3.3) |
| `overflow:hidden` clips skyline | Kept — it performs the intended sky crop; SVG gets natural height, fixed 120px removed (§3.1–3.2) |
| Full-bleed negative margins | Preserved verbatim (§3.2) |
| `heroCardIn` transform entry | Kept — safe, sun/skyline anchor to hero not card (§3.1) |
| Image panel 84px, body-driven height | Unchanged — code is truth; canon's 96px note superseded (log in ledger) |

## 5. Phase 3 — GATED, do not build yet: The Editor's Line
One first-person aside under the pick card (batch-drafted nightly, approved/skippable in Daily Approval; no line renders if skipped). **Requires Jim's explicit go after the checkpoint** plus a nightly-pipeline and cockpit change and a narrow amendment to the "no blurb in hero" lock. If Jim approves, request the separate delta spec — do not improvise it from this paragraph.

## 6. Canon amendments to log in `14_SBDaymaker_Build_Deltas.md`
1. **Reversed:** Phase 7 lock "top-banner feature lead retained for the Today opening card" → Today opens in left-rail format; hero pick is the sole marquee. (Doc 18, Option B.)
2. **Restored:** hero pick card canon dress (eyebrow / venue+time / CTA / condition chips) — build drift corrected, not a new decision.
3. **Added:** signature skyline SVG (`sb-skyline.svg`, final art v3: faithful Mission, lawn + paseo foreground, dense Riviera, Lil' Toot easter egg) extends the CLAUDE.md §5 signature element; scene hexes sanctioned as non-token scene art (full list in §3.4); sun corridor + card-zone rules per §3.2–3.3.
4. **Superseded:** canon's 96px hero-card image panel → the built 84px body-driven panel stands (audit; code is truth on this dimension). Hero `min-height` canon value updated 228 → 352.
5. **Deferred, on the record:** Editor's Line (Phase 3, gated) · Shifting Pick (revisit post-"Did You Make It?") · full Masthead layout (declined; countdown chip shipped instead).
