# SB Daymaker — Wave "Next" Build Spec

**Audience:** Claude Code (agentic, running inside the SB Daymaker repo in VS Code).
**Author hand-off:** Jim (solo operator).
**Status:** Approved decisions, ready to implement. Build in numbered phases; each phase has explicit acceptance tests Jim verifies in-browser before the next phase.

---

## 0 — OPERATING MODE (read first): you are driving for a non‑technical founder

The person running this build (Jim) is a **non‑technical solo founder**. He will not use the terminal, run git commands, start servers, or read code. **You handle 100% of the technical mechanics yourself.** His entire job is: paste a request, glance at the live preview, and say "looks good" or describe what's off in plain words.

You must:
- **Set up the workspace yourself.** Create the `wave-next` git branch, install dependencies if needed, and start the dev/preview server. Then tell Jim the exact web address to open (e.g., `http://localhost:3000`) and what to click. Do not ask him to do any of this.
- **Never ask Jim to run a command.** If something needs the terminal, you run it.
- **Save (commit) work yourself** when Jim confirms a phase looks right — use the commit message listed in each phase. Don't make him type git.
- **Explain in plain language.** When you finish a phase, don't paste diffs or test logs. In one short paragraph, say what changed and exactly what to look at on screen (e.g., "Open your preview and look at the bar across the bottom — it should now be teal with gold icons").
- **Drive the sequence yourself, pausing after each phase.** Once Jim gives the go‑ahead, work through the phases in order on your own — implement a phase, tell him in plain words what to look at, and wait for his OK before starting the next. **Do not make him paste a separate request for each phase**; he'll simply say "looks good, next" or describe what's off. Do only one phase at a time. One surface at a time.
- **Reassure on safety:** each phase is its own commit, so anything can be undone cleanly.
- If the spec leaves something ambiguous, ask Jim **one** plain‑language question with simple options — not a technical discussion.

Everything below this section is technical detail **for you**. Jim follows a separate, much simpler click‑by‑click guide; keep your replies to him at that level.

---

## 0a. How to use this document

This is the authoritative spec for this wave. Implement phases **in order**. After each phase:
1. Run the dev server, hard-refresh, and verify against the **Acceptance tests** for that phase.
2. Commit with the stated message.
3. Stop and let Jim eyeball it before continuing (his stated working style: review one surface at a time).

**Canonical reference for current markup/classes:** the prototype `02b_SBDaymaker_Wireframe.html` (Doc 2b, v9) is the source of truth for the component language — class names, structure, and the exact strings quoted in this spec come from it. The production app is Next.js (App Router) + React + Tailwind on Supabase/Vercel. **The class names and render-function names in this spec are the prototype's; in the production repo the same components may live in `.tsx`/JSX with the same or mapped class names.** Your first job each phase is to locate the production equivalent (grep for the class name, the string literal, or the design token), then apply the change there. Doc 05 governs if any conflict arises.

**Hard constraints (do not violate — these are locked, non-negotiable):**
- Solo-operator ceiling ~15 min/day curation. No change may add recurring daily manual work.
- Platform cost envelope ~$45–95/mo. **No new paid services** in this wave.
- Batch AI only (Claude API). No per-request AI calls.
- No end-user accounts (localStorage + magic-link restore only).
- No in-app transactions. No user-generated reviews or social graph.
- WCAG 2.2 AA floor.
- Ranker never reads sponsor status (trust rule).
- Locked three-section shape: **Explore · Saved · Discover SB**. Do **not** add a fourth nav section.
- Design tokens (do not invent new hex; use these): `plaster #F6F1E7`, `plaster2 #EFE7D8`, `ink #241C16`, `ink2 #4A4038`, `pacific #16586A`, `pacificDk #0E3C49`, `tile/terra #C0532E`, `gold #E0A82E`, `sage #7E8B6B`, `line #D8CDB8`, `forest #3E7C5A`, `purple #9C6B9E`. Type: Fraunces (display) / Inter (UI) / JetBrains Mono (data).
- Approved tagline: **"Santa Barbara, daily."** Approved job line: **"Find it. Save it. Share it."**

---

## 0a. ⚠️ Open items Jim must confirm (read before starting)

These do not block Phases 1–6, but resolve them before Phase 9 (and ideally before starting):

1. **LB‑1 depends on been‑data; ML‑1 was deferred.** The "Your Santa Barbara" recap (Phase 9) is computed entirely from items marked **"been."** Been‑marking already exists in the app (the want/been flip on saved cards), but the accumulation prompt ("Did You Make It?", ML‑1) and the onboarding seed (First Footprint) were **not** selected this wave. **Consequence:** for most users the recap will render mostly empty for a while. This is acceptable only if Phase 9 ships a strong, non‑sad empty/low state (specified below). **Decision needed:** (a) proceed with the empty‑state as specified [default], or (b) add the tiny "First Footprint" onboarding seed now (≈30 min, low risk) so the recap starts non‑empty. Tell me which.

2. **ML‑3 ("Happening today") needs dated inventory.** The dated, exact‑time events section is only as good as the pipeline's supply of Tier‑1/Tier‑2 dated events for *today*. On thin days it must degrade gracefully (spec includes the empty state). **Confirm:** the ingestion pipeline currently yields ≥1–2 dated events with exact start times on a typical day; if not, the section will often show only the divider + evergreen, which is fine but worth knowing.

3. **Time‑of‑day source.** The prototype exposes a manual AM/Noon/PM toggle (`data-tod`). Production should **derive** time‑of‑day from the user's local clock (morning/afternoon/evening) and the weather flag (gray). The new hero (Phase 2) must look correct across all four states. Confirm production derives this automatically (no user toggle).

4. **Explicitly deferred this wave (NOT forgotten — do not implement):** QW‑1 (Editor's Note), QW‑6 (trust stamp reposition), ML‑1 (Did You Make It? + companions), ML‑4 (imagery waterfall), ML‑5 (The One Line), LB‑2 (full Spanish Colonial form), LB‑3 (editor byline), LB‑4 (weather banner), LB‑5 (SB Postcard). Leave all existing related code as‑is.

---

## Phase summary & sequencing

| Phase | Change | Decision | Touches | Risk |
|---|---|---|---|---|
| 1 | Tagline + job strip (QW‑3) | Option B | Header | Low |
| 2 | Hero: compact + SB skyline (S4‑B + H2) | B / H2 | Hero | Med |
| 3 | Bottom nav: pacific + custom icons + spacing (S1‑B, S2‑B, S3‑mod) | B / B / modified | Nav | Med |
| 4 | Type floor + contrast + a11y (QW‑5) | Option A | Global | Low |
| 5 | List‑card label fix (QW‑2) | Option A | `lcHTML` | Low |
| 6 | Saved been/share action row (QW‑4) | Option A | `svCardHTML` | Low |
| 7 | Happenings spine (ML‑3) | Option A | `renderHome` | Med (data) |
| 8 | Filter consolidation (ML‑2) | **Option B** | `controlsHTML` + sheet | Med |
| 9 | Memory recap (LB‑1) | Option A | `renderSaved` | Med (data) |
| 10 | Sticky section headers (S5) | Option B | `.sh` / scroll container | Low |
| 11 | Condensing header on scroll (S6) | Option A | Header + scroll listener | Med |
| 12 | QA sweep + a11y audit | — | All | — |

Sequencing logic: chrome that several changes share (header, hero, nav) is rebuilt first so later phases inherit the new sizing; QW‑5 (type) runs after the hero/nav rebuilds so it only mops up the remaining components; sticky + condensing header run last because they interact with scroll behavior established earlier.

---

## Phase 1 — Tagline + job strip (QW‑3, Option B)

**Goal:** Standardize the masthead tagline to "Santa Barbara, daily" everywhere, and surface the job line "Find it · Save it · Share it" as a thin strip directly under the header on the main Explore screen.

**Current state (prototype `headerHTML`, ~line 827):**
```js
function headerHTML(nm,tg,back){
  const left=back
    ?`<button class="icon-btn" onclick="APP.go('${back}')" style="font-size:20px;">‹</button><div><div class="nm">${nm}</div>${tg?`<div class="tg">${tg}</div>`:''}</div>`
    :`<div class="m">S</div><div><div class="nm">${nm}</div>${tg?`<div class="tg">${tg}</div>`:''}</div>`;
  return `<div class="hdr"><div class="lg">${left}</div></div>`;
}
```
The Explore header is already called as `headerHTML('Explore','Santa Barbara, daily')`. **Note:** the *live production site* currently renders the tagline as "Santa Barbara, **today**" — that is the actual bug to fix. Grep the production code for `Santa Barbara, today` and any other tagline literal and replace with `Santa Barbara, daily`. Also check `<title>`, OpenGraph/meta description, and any PWA manifest `name`/`description`.

**Changes:**

1. **Tagline literal → "Santa Barbara, daily"** everywhere it appears (header, `<title>`, meta/OG description, manifest). Grep: `grep -rn "Santa Barbara, today" .` and fix each. Confirm the header on Explore reads "Santa Barbara, daily".

2. **Add the job strip** — a thin, non‑interactive row under the header, **Explore screen only** (not on Saved/Discover/detail/back headers). Insert it between `headerHTML(...)` and `heroHTML(...)` in `renderHome`'s return, or render it as the first child of the scroll body. Markup:
```html
<div class="job-strip">
  <span class="js-find">Find it</span><span class="js-dot">·</span>
  <span class="js-save">Save it</span><span class="js-dot">·</span>
  <span class="js-share">Share it</span>
</div>
```
CSS (add to stylesheet / Tailwind layer):
```css
.job-strip{display:flex;gap:6px;justify-content:center;align-items:center;
  padding:2px 18px 0;background:var(--plaster);}
.job-strip span{font-size:9.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;}
.job-strip .js-find{color:var(--tile);}
.job-strip .js-save{color:var(--pacific);}
.job-strip .js-share{color:var(--gold);}
.job-strip .js-dot{color:var(--line);font-weight:700;}
```
The strip sits on `--plaster` so it reads as part of the masthead, above the hero.

**Acceptance tests:**
- Explore header tagline reads exactly "Santa Barbara, daily"; no remaining "Santa Barbara, today" anywhere (grep returns nothing).
- The three‑word job strip appears once, centered, directly under the header on Explore only.
- Browser tab title and link‑preview description say "daily," not "today."
- AA contrast: each job word ≥ 4.5:1 on plaster (gold `#E0A82E` on `#F6F1E7` is borderline — if it fails, darken `js-share` to `--gold-text #7A5E13`).

**Commit:** `feat(header): standardize tagline to "Santa Barbara, daily" + surface job strip (QW-3)`

---

## Phase 2 — Hero: compact + SB skyline (S4 Option B + Hero H2)

**Goal:** Two coordinated changes to the hero, done together because they share markup: (a) **compact** the hero so two real happenings sit above the fold (fold conditions into the date line, reduce height), and (b) **replace the generic mountain `hero-range`** with the unmistakable **SB skyline silhouette** (Mission twin towers, lone palm, Courthouse El Mirador clock tower, stepped red‑tile rooftops, Stearns Wharf), preserving the golden‑hour time‑of‑day system and the gray‑day marine‑layer state.

**Current state:**
- CSS `.hero{...min-height:200px;}` and `.hero.morning/afternoon/evening/gray` gradients (keep the gradients).
- `.hero-range` SVG (the generic double‑mountain path) — **this is what we replace.**
- `heroHTML()` (~line 602) renders `.hero`, the range SVG, `.hero-sky` (date + `.cond` pills), and the `.hero-pick-card`.

### 2a. Compact the hero (S4‑B)

- CSS: change `.hero{min-height:200px;padding:14px 18px 0;}` → `min-height:150px;padding:12px 18px 0;`.
- Fold conditions into the date line. In `heroHTML`, replace the separate `<div class="date">` + `<div class="cond">${condPills}</div>` with a single compact line. Keep the conditions data but render inline:
```js
// was: <div class="date">Thursday, June 19</div><div class="cond">${condPills}</div>
const condInline = conds().slice(0,2).join(' · ');   // keep it to ~2 facts
// render:
`<div class="date">${dateLabel}${condInline?` · ${condInline}`:''}</div>`
```
Use the real date label (production already computes this; prototype hardcodes "Thursday, June 19"). Drop the `.cond` pill row on the main hero (the pills were the height hog). If you prefer to keep one weather pill, keep a single one — but the date+conditions should be **one line**, not two stacked blocks.
- Reduce the gap above the pick card. The pick card currently floats low; with the shorter hero it should sit ~8–12px below the date line. If the card uses a top margin/spacer, tighten it.

### 2b. Replace the range with the SB skyline (H2)

Replace the entire `<svg class="hero-range">…</svg>` block in `heroHTML` with the skyline SVG below. Keep `class="hero-range"` so existing positioning CSS (`position:absolute;bottom:0;left:0;width:100%;`) still applies — but **bump its height**: change `.hero-range{height:66px;}` → `height:74px;` (the architecture needs a little more vertical room than the old hills).

**Skyline SVG (paste verbatim, replacing the old range svg):**
```html
<svg class="hero-range" viewBox="0 0 600 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <!-- soft foothills behind the city -->
  <path d="M0,170 L0,104 Q120,70 260,90 Q400,110 520,82 L600,96 L600,170 Z" fill="#16586A" opacity=".5"/>
  <g fill="#0E3C49">
    <!-- Mission: facade + twin bell towers -->
    <rect x="70" y="112" width="124" height="58"/>
    <rect x="78" y="80" width="26" height="90"/><polygon points="78,80 104,80 91,64"/>
    <rect x="160" y="80" width="26" height="90"/><polygon points="160,80 186,80 173,64"/>
    <polygon points="120,112 144,112 132,96"/>
    <!-- lone palm -->
    <rect x="214" y="62" width="5" height="108"/>
    <path d="M216,62 Q198,52 188,58 M216,62 Q200,46 196,40 M216,62 Q230,48 240,44 M216,62 Q236,52 248,58 M216,62 Q216,44 214,38"
          stroke="#0E3C49" stroke-width="3" fill="none" stroke-linecap="round"/>
    <!-- Courthouse El Mirador clock tower -->
    <rect x="250" y="58" width="34" height="112"/>
    <rect x="256" y="44" width="22" height="16" rx="2"/>
    <path d="M256,44 Q267,28 278,44 Z"/>
    <rect x="265" y="26" width="4" height="10"/>
    <rect x="262" y="64" width="10" height="11" fill="#16586A"/>
    <!-- stepped red-tile-roof buildings -->
    <rect x="312" y="120" width="46" height="50"/><polygon points="312,120 358,120 335,104"/>
    <rect x="362" y="112" width="54" height="58"/><polygon points="362,112 416,112 389,95"/>
    <rect x="420" y="126" width="44" height="44"/><polygon points="420,126 464,126 442,112"/>
    <!-- Stearns Wharf -->
    <rect x="470" y="132" width="130" height="7"/>
    <rect x="486" y="139" width="4" height="31"/><rect x="512" y="139" width="4" height="31"/>
    <rect x="538" y="139" width="4" height="31"/><rect x="564" y="139" width="4" height="31"/>
    <rect x="590" y="139" width="4" height="31"/>
  </g>
</svg>
```

**Time‑of‑day handling (important — keep the signature system):**
- The **sky gradient** stays driven by `heroClass()` → `.hero.morning/afternoon/evening/gray` (unchanged). The skyline silhouette sits in front of whatever sky is active.
- For **gray (marine‑layer) days**, do two things: (1) set the silhouette fills to a desaturated slate so it reads as fog‑muted, and (2) add a fog band rising from behind the silhouette. Implement by conditionally adding a `gray` modifier on the range and a fog element:
```css
/* silhouette recolor on gray days */
.hero.gray .hero-range path[fill="#16586A"]{fill:#3a444e;}
.hero.gray .hero-range g[fill="#0E3C49"]{fill:#2b333b;}
/* fog band */
.hero-fog{position:absolute;left:0;right:0;bottom:18px;height:48px;
  background:linear-gradient(180deg,rgba(220,224,228,0),rgba(220,224,228,.85) 70%);
  z-index:1;pointer-events:none;display:none;}
.hero.gray .hero-fog{display:block;}
```
(The attribute selectors are a convenience for the prototype; in production, prefer adding explicit classes like `.sky-fill` / `.bldg-fill` to the SVG nodes and toggling colors via a `.hero--gray` class. Functionally identical.)
Add `<div class="hero-fog"></div>` inside `.hero`, after the SVG, before `.hero-sky`.
- Keep the existing `.sun` / `.cloud` logic (`sunPos()` / gray→cloud). The sun should render **behind** the pick card and **in front of** the sky but is fine over the silhouette.
- Verify the date/conditions text and the pick card both still clear AA contrast over each of the four skies (they sit high in the hero where the sky is darkest/most saturated — should be fine; the silhouette is low).

**Acceptance tests:**
- The generic double‑mountain range is gone; the SB skyline (recognizable Mission towers, palm, clock tower, roofline, wharf pilings) renders along the hero bottom.
- Hero is visibly shorter; on a 390×844 viewport, the hero + at least the first content item (or the first happening from Phase 7) are visible without scrolling.
- Conditions are a single inline line with the date, not a stacked pill row.
- Cycle all four time‑of‑day states (morning/afternoon/evening/gray): sky gradient still changes; on gray, the silhouette desaturates and a fog band appears over the lower skyline.
- No text fails AA over any sky state.
- `prefers-reduced-motion`: the sun pulse animation respects it (wrap the `sunPulse` animation in a `@media (prefers-reduced-motion: no-preference)` guard if not already).

**Commit:** `feat(hero): compact layout + SB skyline silhouette w/ time-of-day + marine-layer (S4-B, H2)`

---

## Phase 3 — Bottom nav: pacific bg + custom icons + spacing (S1‑B, S2‑B, S3‑modified)

**Goal:** Rebuild the bottom nav: (a) **Pacific deep‑teal background** with a gold active tab, (b) **custom line icons** (sun‑over‑mountain / heart / compass) replacing the emoji, and (c) **spacing per Jim's note** — more room **above** the icons and between the page content and the bar, *without* adding much padding **below** the labels.

**Current state:**
- `#nav{position:absolute;bottom:0;left:0;right:0;height:56px;display:flex;border-top:1px solid var(--line);background:rgba(246,241,231,.96);backdrop-filter:blur(10px);z-index:60;}`
- `.nav-btn{...color:#9a8f80;padding-top:7px;}` / `.nav-btn.on{color:var(--pacific);}` / `.nav-btn .i{font-size:17px;}` / `.nav-btn .l{font-size:8.5px;}`
- `.nav-badge{...background:var(--tile);...}`
- `navHTML()` renders three `nav-btn`s with emoji `🌅 / ❤️ / 🧭`.

**Changes:**

### 3a. Background + active state (S1‑B)
```css
#nav{position:absolute;bottom:0;left:0;right:0;
  display:flex;background:var(--pacific);          /* was plaster */
  border-top:none;                                  /* the color is the divider now */
  z-index:60;
  /* spacing per S3 (see 3c) */
  height:54px;                                      /* was 56 */
  padding-top:8px;                                  /* MORE room above icons */
  padding-bottom:max(4px, env(safe-area-inset-bottom)); /* minimal below; honor home indicator only as needed */
}
.nav-btn{flex:1;border:none;background:none;display:flex;flex-direction:column;
  align-items:center;justify-content:flex-start;gap:3px;
  color:rgba(255,255,255,.62);                       /* inactive on teal */
  cursor:pointer;position:relative;padding-top:0;}   /* top space now lives on #nav */
.nav-btn.on{color:var(--gold);}                       /* active = gold */
.nav-btn .l{font-size:11px;font-weight:600;}          /* QW-5 floor: was 8.5 → 11 */
/* gold active indicator pip at the very top edge of the bar */
.nav-btn.on::before{content:"";position:absolute;top:-8px;left:50%;transform:translateX(-50%);
  width:22px;height:3px;border-radius:0 0 3px 3px;background:var(--gold);}
.nav-badge{position:absolute;top:-4px;right:calc(50% - 16px);
  background:var(--gold);color:var(--ink);          /* badge readable on teal */
  font-size:8px;font-weight:700;min-width:15px;height:15px;border-radius:8px;
  display:grid;place-items:center;padding:0 4px;}
```

### 3b. Custom line icons (S2‑B)
Replace the emoji in `navHTML` with inline SVGs. Stroke color is `currentColor` so it inherits the active/inactive color automatically. Add an `.ico` class.
```css
.nav-btn .ico{width:22px;height:22px;display:block;}   /* slightly larger than the 17px emoji */
```
New `navHTML`:
```js
function navHTML(){
  const ICON = {
    home: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="3.2"/><path d="M3 19 L9 12 L13 16 L17 11 L21 19 Z"/></svg>`,
    saved: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/></svg>`,
    guides:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9 L11 11 L9 15 L13 13 Z"/></svg>`,
  };
  const items=[['home','Explore'],['saved','Saved'],['guides','Discover SB']];
  return items.map(([k,l])=>{
    const on=(k===S.screen)||(k==='home'&&['submit'].includes(S.screen));
    const badge=k==='saved'&&S.saved.size?`<span class="nav-badge">${S.saved.size}</span>`:'';
    return `<button class="nav-btn ${on?'on':''}" onclick="APP.go('${k}')" aria-label="${l}" aria-current="${on?'page':'false'}">${ICON[k]}<span class="l">${l}</span>${badge}</button>`;
  }).join('');
}
```
(The `home` icon is the sun‑over‑mountain mark; it ties to the brand and to the hero. `saved` = heart line; `guides` = compass.)

### 3c. Spacing (S3 — modified per Jim)
Jim's note: *more space above the icons and at the bottom of the page content; less concerned with padding below the labels; just slightly more above.* Implement as:
- **Above the icons:** `#nav { padding-top: 8px; }` (done in 3a) — icons no longer hug the top edge of the bar.
- **Below the labels:** keep minimal — `padding-bottom: max(4px, env(safe-area-inset-bottom))`. This adds nothing on devices without a home indicator and only the necessary inset on those that have one. (We are intentionally **not** adding the larger 60px roomy bottom from the original S3‑B.)
- **Between page content and the bar:** ensure the scroll content clears the nav. Find the existing bottom spacer (prototype uses `<div class="scroll-pad"></div>`; grep for `scroll-pad` / any `padding-bottom` on the main scroll container). Set it so the last item has clear breathing room above the bar:
```css
.scroll-pad{height:72px;}     /* was likely ~64; raise so content doesn't crowd the 54px bar + a gap */
```
If production uses a `padding-bottom` on the scroll container instead of a spacer div, set that to `calc(54px + 18px + env(safe-area-inset-bottom))` (bar height + gap + inset).

**Acceptance tests:**
- Bottom bar is Pacific teal across **all three screens** (Explore, Saved, Discover SB) and on the detail/guide/submit sub‑screens.
- Active tab icon **and** label are gold, with a small gold pip at the top edge of the bar; inactive are translucent white.
- Icons are the custom line set (no emoji); they're crisp and identical regardless of OS.
- Labels are 11px (up from 8.5px) and legible (AA: gold/white on pacific both pass).
- Icons sit a touch lower from the top of the bar (visible breathing room above them); there is **not** a large empty band below the labels.
- The last list item on a long scroll has clear space above the bar (not jammed against it).
- The Saved badge is gold‑on‑ink and readable on the teal bar.
- Keyboard focus ring is visible on each tab; `aria-current="page"` is set on the active tab.

**Commit:** `feat(nav): pacific bar + custom line icons + spacing tune (S1-B, S2-B, S3)`

---

## Phase 4 — Type floor + contrast + a11y (QW‑5, Option A)

**Goal:** Raise sub‑legible type to an 11px floor, fix low‑contrast meta, and give icon‑only controls accessible names. (Nav labels and hero date were already lifted in Phases 2–3; this phase mops up the rest and audits globally.)

**Specific fixes:**
1. **List‑card meta `.lc .m`** and any `.sub`/meta currently in `--sage` on `--plaster`/white: darken to `--ink2 #4A4038` (sage on plaster fails AA for small text). Keep `--pacific` metas as‑is (they pass).
2. **Minimum font size 11px** for any persistent UI text. Grep the stylesheet for `font-size:8` / `font-size:9` / `font-size:10` and lift each persistent‑text instance to **11px** (decorative micro‑labels like a tag eyebrow may stay 10px if they're not body‑critical, but nothing essential below 11). Notable: `.lc .bl` (blurb) if 9px → 11px; `.hero-pick-meta` if <11 → 11; `.rcard .sub` → 11.
3. **Heart toggles** (`heartBtn`, `.heart`, `.inline-heart`, `.rheart`): add `aria-label` and `aria-pressed`. State must not be conveyed by emoji/color alone (WCAG 1.4.1).
```js
function heartBtn(id,overlayStyle){
  const on=S.saved.has(id);
  const lbl = on ? 'Saved — tap to remove' : 'Save';
  const cls = overlayStyle ? 'heart' : 'inline-heart';
  return `<button class="${cls}" id="hb_${id}" aria-label="${lbl}" aria-pressed="${on}"
    onclick="event.stopPropagation();APP.toggleSave('${id}')">${on?'❤️':'🤍'}</button>`;
}
```
4. **Touch targets:** confirm all icon‑only buttons (hearts, share) are ≥24×24 CSS px (WCAG 2.5.8); bump any that aren't. (The been/share buttons get fixed in Phase 6.)

**Acceptance tests:**
- No persistent UI text renders below 11px (spot‑check hero date, card meta/blurb, nav labels, rail subtitles).
- Card meta passes AA (use a contrast checker on `--ink2` over white/plaster ≥ 4.5:1).
- Every heart button exposes an accessible name and pressed state to a screen reader / the accessibility inspector.
- No icon‑only control smaller than 24×24.

**Commit:** `a11y(type): 11px floor, AA meta contrast, accessible heart toggles (QW-5)`

---

## Phase 5 — List‑card label fix (QW‑2, Option A)

**Goal:** Stop rendering raw lowercase persona ids as the category badge; map to a fixed, capitalized, color‑coded label (solid pill).

**Current bug (`lcHTML`, ~line 700):**
```js
const c=t.free?'#7E8B6B':t.type==='place'?'#16586A':'#C0532E';
const label=t.type==='place'?'Place':t.free?'Free':t.personas[0];   // ← raw lowercase id leaks
```

**Fix:** Introduce a category→label map and resolve the label from the item's primary category (`t.cat`), with sensible fallbacks. Keep the solid colored pill (Option A).
```js
const CAT_LABEL = {
  music:'Live Music', arts:'Arts & Culture', date:'Date Night',
  outdoors:'Outdoors', family:'Family', food:'Food & Drink',
  wine_food:'Food & Drink', nightlife:'Nightlife', happyhour:'Happy Hour',
  free:'Free', wellness:'Wellness', market:'Markets', film:'Film',
  theatre:'Theatre', solo:'Solo', hosting:'Hosting', wine:'Wine'
};
function catLabel(t){
  if(t.type==='place') return 'Place';
  if(t.free) return t.cat && CAT_LABEL[t.cat] && t.cat!=='free' ? `Free · ${CAT_LABEL[t.cat]}` : 'Free';
  const key = t.cat || (t.personas && t.personas[0]);
  return CAT_LABEL[key] || (key ? key.charAt(0).toUpperCase()+key.slice(1).replace('_',' ') : 'Event');
}
// in lcHTML:
const label = catLabel(t);
```
Color rule stays: `c = t.free ? sage : t.type==='place' ? pacific : tile`. (Optionally map color by category later; not required this wave.) Pill stays solid (`color:#fff` on the colored background). Ensure white‑on‑color passes AA — `--gold` background would fail with white text, but the pill colors here (sage/pacific/tile) all pass.

**Apply the same `catLabel` anywhere a raw `personas[0]` or unmapped category could surface** (grep `personas[0]`).

**Acceptance tests:**
- No card shows a lowercase id (e.g., "music", "date", "arts") as a badge anywhere in the app.
- Labels are capitalized, human ("Live Music", "Date Night", "Arts & Culture"), and color‑coded; free items read "Free" or "Free · {Category}".
- White pill text passes AA on each pill color used.

**Commit:** `fix(cards): map category to fixed label, kill raw persona-id badge (QW-2)`

---

## Phase 6 — Saved been/share action row (QW‑4, Option A)

**Goal:** Replace the cramped corner pills on saved cards with a clear, full‑width action row whose primary "Mark as been" button is ≥44px tall (the load‑bearing memory‑moat tap), plus an accessible share button.

**Current (`svCardHTML`, ~line 851):** the normal‑mode card wraps `lcHTML(t)` and absolutely‑positions a 28px share circle (top‑right) and a ~16px flip pill (bottom‑right). Replace these corner controls with a row beneath the card.

**New normal‑mode markup:**
```js
// NORMAL MODE — open detail; full-width action row (want/been + share)
return `<div class="sv-card">
  ${lcHTML(t)}
  <div class="sv-actions">
    <button class="sv-been ${st==='been'?'is-been':''}" aria-pressed="${st==='been'}"
      onclick="event.stopPropagation();APP.flipSaveState('${t.id}')">${flipLabel}</button>
    <button class="sv-share" aria-label="Share this"
      onclick="event.stopPropagation();APP.shareSingle('${t.id}')">↗</button>
  </div>
</div>`;
```
CSS:
```css
.sv-card{background:#fff;border:1px solid var(--line);border-radius:13px;overflow:hidden;margin:0 18px 9px;}
.sv-card .lc{margin:0;border:none;border-radius:0;}          /* lc sits flush inside the wrapper */
.sv-actions{display:flex;gap:8px;padding:9px 11px;border-top:1px solid var(--line);}
.sv-been{flex:1;min-height:44px;border-radius:10px;border:1.5px solid var(--sage);
  background:#fff;color:var(--sage);font-size:12px;font-weight:700;cursor:pointer;
  font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;}
.sv-been.is-been{background:var(--sage);color:#fff;}
.sv-share{min-height:44px;width:48px;flex-shrink:0;border-radius:10px;border:1.5px solid var(--line);
  background:#fff;color:var(--pacific);font-size:15px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;}
```
Notes:
- `lcHTML` already includes its own inline heart; that's fine — the heart (save/unsave) and the been flip are different actions. Keep the heart in the card body; the action row adds been + share.
- Remove the old absolutely‑positioned share circle and flip pill from `svCardHTML` entirely.
- **Select mode** (`S.sv.selectMode`) is unchanged — leave that branch as‑is.

**Acceptance tests:**
- On Saved, each card shows a full‑width action row under it: a "✓ Mark as been" (or "↩ Want to go" when already been) button ≥44px tall, and a share button ≥44px tall.
- Tapping "Mark as been" flips the state and the button reflects it (filled sage = been).
- No tiny corner pills remain.
- Both buttons have accessible names; the been button exposes `aria-pressed`.
- Targets pass WCAG 2.5.8 (≥44px here, well over the 24px floor).

**Commit:** `feat(saved): full-width been/share action row, 44px targets (QW-4)`

---

## Phase 7 — Happenings spine (ML‑3, Option A) — *structural*

**Goal:** On Explore → **Today**, lead with 2–3 **date‑forward** happenings (time‑rail cards) before the evergreen "always worth it" list, so the daily promise is visible. (Today horizon only; This Week / This Month unchanged.)

**Current (`renderHome`, Today branch):** after the hero/controls, the body is `perfectDayCardHTML() + railHTML() + (rest ? restHdr + rest.map(lcHTML)) + …`. The "rest" is the evergreen/also‑happening list. There is no dedicated dated‑events section at the top of the body.

**Change:** Insert a **"Happening today"** section as the first body block on the Today horizon, populated by dated events for today that have an exact start time, rendered as time‑rail cards. Demote the existing evergreen list under an honest divider.

1. **Select dated events for today.** Use the existing today pool but filter to dated events with a usable time:
```js
// dated, exact-time events happening today (Tier-1/2), excluding the hero pick to avoid dupes
const datedToday = todayPool
  .filter(t => t.type==='event' && t.horizon==='today' && t.time && t !== heroMarquee)
  .slice(0, 3);
```
(Adjust the time field name to whatever production uses for an exact start time. If an event lacks an exact time, exclude it from this section — do **not** fabricate a time.)

2. **Render time‑rail cards.** Add a renderer:
```js
function evCardHTML(t){
  // derive a short label + time, e.g. "TODAY" / "TONIGHT" + "5:00 PM"
  const when = t.whenLabel || 'Today';           // 'Today' | 'Tonight' | day label
  const time = t.time || '';
  return `<div class="ev" onclick="APP.openDetail('${t.id}')">
    <div class="ev-when"><span class="lab">${when}</span><span class="time">${time}</span></div>
    <div class="ev-b">
      <div class="ev-cat">${catLabel(t)}</div>
      <div class="ev-nm">${t.title}</div>
      <div class="ev-mt">${t.venue}${t.price?` · ${t.price}`:''}</div>
    </div>
    ${heartBtn(t.id,false)}
  </div>`;
}
```
CSS:
```css
.ev{display:flex;margin:0 18px 9px;background:#fff;border-radius:13px;overflow:hidden;
  border:1px solid var(--line);align-items:stretch;cursor:pointer;}
.ev .ev-when{flex-shrink:0;width:60px;background:linear-gradient(160deg,var(--tile),#a8431f);
  color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:9px 4px;text-align:center;}
.ev .ev-when .lab{font-size:8px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;opacity:.9;}
.ev .ev-when .time{font-family:'Fraunces',serif;font-size:13px;font-weight:700;line-height:1;margin-top:3px;}
.ev .ev-b{padding:9px 11px;flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;}
.ev .ev-cat{font-size:8px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--pacific);}
.ev .ev-nm{font-family:'Fraunces',serif;font-size:13px;font-weight:600;line-height:1.1;margin-top:1px;}
.ev .ev-mt{font-size:11px;color:var(--ink2);margin-top:2px;}        /* 11px floor */
.ever-divider{margin:14px 18px 6px;font-size:11px;font-weight:700;letter-spacing:.6px;
  text-transform:uppercase;color:var(--sage);text-align:center;}
```

3. **Assemble the Today body.** Insert the section above the evergreen list, and relabel the evergreen header as a divider:
```js
const happeningBlock = datedToday.length
  ? `<div class="sh"><div class="k">📅 Happening today</div><div class="t">On in the next few hours</div></div>`
    + datedToday.map(evCardHTML).join('')
    + (rest.length ? `<div class="ever-divider">— or, always worth it —</div>` : '')
  : '';   // thin day → no dated block; evergreen list stands alone with its normal header

body = perfectDayCardHTML()
  + railHTML()
  + happeningBlock
  + (rest.length ? (datedToday.length ? '' : restHdr) + rest.map(lcHTML).join('') : '')
  + newThisWeekHTML() + hhTeaser() + planBannerHTML() + emailSignupHTML()
  + trustNoteHTML() + submitBtnHTML() + '<div class="scroll-pad"></div>';
```
(When there are dated events, the evergreen list sits under the "— or, always worth it —" divider instead of its own "Also happening" header, to avoid two headers. When there are none, keep the existing `restHdr`.)

**Empty/thin‑day behavior:** if `datedToday.length === 0`, show **no** dated section (not an empty box) and let the evergreen list render normally. This is the graceful degrade for quiet days (see Open Item #2).

**Acceptance tests:**
- On a day with dated events, Explore → Today shows a "📅 Happening today" section with up to 3 time‑rail cards (time forward: rail shows label + time), **above** the evergreen list, separated by the "— or, always worth it —" divider.
- The hero pick is not duplicated in the dated list.
- On a day with no dated events, no empty section appears; the evergreen list shows with its normal header.
- Time‑rail cards open the detail sheet on tap; the heart works.
- This Week / This Month horizons are unchanged.

**Commit:** `feat(explore): date-forward "Happening today" spine above evergreen (ML-3)`

---

## Phase 8 — Filter consolidation (ML‑2, **Option B**) — *structural-ish*

**Goal:** Collapse the two overlapping filter systems into **one unified filter sheet** opened from a single control. Per Jim's explicit choice of **Option B** (not the recommended A): replace the separate Lens + Refine buttons with one "Filter & vibe" entry that opens a sheet containing **both** the vibe (occasion/lens) and the hard filters, with duplicate members removed (one "Free", and no "Tonight" chip — "Tonight" lives only in the Today horizon).

**Current (`controlsHTML`, ~line 635):** renders `.hseg` (Today/This Week/This Month) + a `.ctrl-row` with `.ctrl-lens` (opens `lens` sheet), Near Me, and `.ctrl-filter` (opens `filter` sheet). Two separate sheets: `openSheet('lens')` and `openSheet('filter')`.

**Changes:**

1. **Single combined control.** Replace the `.ctrl-lens` + `.ctrl-filter` buttons in `.ctrl-row` with one combined button (keep Near Me as its own button). Show a summary of active selections on the button face.
```js
function controlsHTML(){
  const horizons=[['today','Today'],['week','This Week'],['month','This Month']];
  const hasLens = S.lens!=='all';
  const hasFilters = S.filters.size>0;
  const L = persona(S.lens);
  // summarize current state on the button
  const bits=[];
  if(hasLens) bits.push(L.name);
  if(hasFilters) bits.push(`${S.filters.size} filter${S.filters.size>1?'s':''}`);
  const summary = bits.length ? bits.join(' · ') : 'Filter & vibe';
  const activeCount = (hasLens?1:0)+S.filters.size;
  return `<div class="controls" id="controls">
    <div class="hseg">${horizons.map(([k,l])=>`<button class="${S.horizon===k?'on':''}" onclick="APP.setHorizon('${k}')">${l}</button>`).join('')}</div>
    <div class="ctrl-row">
      <button class="ctrl-combined ${activeCount?'has-sel':''}" onclick="APP.openSheet('refine')">
        <span class="cc-icon">✦</span>
        <span class="cc-text">${summary}</span>
        ${activeCount?`<span class="cc-count">${activeCount}</span>`:''}
        <span class="cc-chevron">▾</span>
      </button>
      ${nearMeBtnHTML()}
    </div>
  </div>`;
}
```
CSS (reuse `.ctrl-lens` look):
```css
.ctrl-combined{flex:1;display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:22px;
  border:1.5px solid var(--line);background:#fff;cursor:pointer;min-width:0;font-family:'Inter',sans-serif;}
.ctrl-combined.has-sel{border-color:var(--pacific);}
.ctrl-combined .cc-icon{font-size:15px;flex-shrink:0;line-height:1;}
.ctrl-combined .cc-text{flex:1;min-width:0;text-align:left;font-size:11px;font-weight:700;color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ctrl-combined .cc-count{background:var(--pacific);color:#fff;font-size:10px;font-weight:700;
  min-width:18px;height:18px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;}
.ctrl-combined .cc-chevron{font-size:10px;color:var(--pacific);font-weight:700;flex-shrink:0;}
```

2. **Unified `refine` sheet.** Create a single sheet (reuse the existing sheet/overlay machinery; add a `'refine'` case to `openSheet`) with two stacked groups:
   - **"What are you up for?" (vibe / lens)** — the 11 occasion personas as single‑select chips. Selecting one sets `S.lens`; selecting again / "Any vibe" clears it.
   - **"Filters" (hard constraints)** — the constraint chips (multi‑select) writing to `S.filters`. **Remove duplicates:** ensure **"Free"** appears once here (not also as a lens), and **remove "Tonight"** entirely (it duplicates the Today horizon).
   - A footer with "Clear all" and "Show results (N)".
   Sheet body sketch:
```html
<div class="sheet-h">What are you up for?</div>
<div class="chip-wrap">
  <!-- PERSONAS as single-select; include an "Any vibe" reset chip -->
</div>
<div class="sheet-h">Filters</div>
<div class="chip-wrap">
  <!-- LENS_CHIPS minus "Tonight"; "Free" included exactly once -->
</div>
<div class="sheet-foot">
  <button class="sheet-clear" onclick="APP.clearRefine()">Clear all</button>
  <button class="sheet-apply" onclick="APP.applyRefine()">Show results</button>
</div>
```

3. **De‑duplicate the data.** In `LENS_CHIPS` / the filter definitions, remove the **Tonight** chip. Ensure **Free** exists only as a filter chip. If "Free" is also a persona in `PERSONAS`, keep the persona out of the vibe list **or** clearly make them the same toggle — but it must not appear twice in the unified sheet.

4. **Remove the now‑dead `lens` and `filter` sheet entry points** (or alias both to `'refine'`). Keep the underlying `S.lens` / `S.filters` state and the `pass()` filtering logic unchanged — only the entry UI consolidates.

**Acceptance tests:**
- The controls row shows the horizon segs + **one** "Filter & vibe" button (with a live summary + count when active) + Near Me. No separate Lens and Refine buttons.
- Tapping it opens one sheet with a vibe group (single‑select occasions) and a filters group (multi‑select constraints).
- "Free" appears exactly once (in Filters); there is no "Tonight" chip anywhere.
- Selecting a vibe and/or filters updates results identically to the old two‑control behavior (the `pass()` results match).
- "Clear all" resets both lens and filters; "Show results" closes the sheet.
- Sheet is keyboard navigable; focus trapped while open; Escape closes.

**Commit:** `feat(filters): unify lens + refine into one sheet, de-dupe Free/Tonight (ML-2 option B)`

---

## Phase 9 — Memory recap (LB‑1, Option A) — *structural; see Open Item #1*

**Goal:** Add a "Your Santa Barbara" recap card at the top of the Saved → **Been** view, derived from been‑data: been count, neighborhoods explored (with progress toward the full set), and a short "memory lane" of recent beens. **Must ship with a strong empty/low state** because been‑data may be sparse (ML‑1 deferred).

**Where:** `renderSaved` — when the state filter is **"been"** (the Been tab), render the recap card above the been list. Do **not** show it on the Want tab.

**Data it reads (all from existing client state — no new infra):**
```js
const beenItems = THINGS.filter(t => S.saved.has(t.id) && (S.savedState[t.id]==='been'));
const beenCount = beenItems.length;
const hoods = [...new Set(beenItems.map(t => t.area).filter(Boolean))];
const TOTAL_HOODS = 11;                       // locked neighborhood count (10/11 seeded; use the canonical total)
const recent = beenItems.slice(-2).reverse(); // last couple, for memory lane (use a real timestamp if available)
```
(If a been timestamp exists, sort `recent` by it; otherwise insertion order is fine for now.)

**Markup (recap card):**
```js
function recapCardHTML(beenCount, hoods, recent){
  if(beenCount === 0){
    // EMPTY/LOW STATE — inviting, not sad
    return `<div class="recap recap--empty">
      <div class="rk">Your Santa Barbara</div>
      <div class="rt">Your map starts here.</div>
      <p class="rp">Mark a place you've been and we'll quietly start remembering the SB you're building — privately, on this device.</p>
    </div>`;
  }
  const pct = Math.min(100, Math.round((hoods.length/ /*TOTAL_HOODS*/ 11)*100));
  const chips = hoods.slice(0,5).map(h=>`<span class="chip done">${h}</span>`).join('');
  const lane = recent.map(t=>`<div class="tl"><span class="dot"></span><div><div class="tln">${t.title}</div><div class="tld">${t.area||''}</div></div></div>`).join('');
  return `<div class="recap">
    <div class="rk">Your Santa Barbara</div>
    <div class="rt">You're building a real SB.</div>
    <div class="big"><span class="n">${beenCount}</span><span class="nl">spot${beenCount>1?'s':''} you've made it to</span></div>
    <div class="hoods">${chips}</div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="barl">${hoods.length} of ${11} neighborhoods explored</div>
    ${recent.length?`<div class="lane-h">Lately</div>${lane}`:''}
  </div>`;
}
```
CSS:
```css
.recap{margin:0 18px 12px;border-radius:16px;overflow:hidden;color:#fff;
  background:linear-gradient(140deg,#0E3C49,#16586A 55%,#2d7d8f);padding:16px 16px 17px;}
.recap .rk{font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gold);}
.recap .rt{font-family:'Fraunces',serif;font-size:19px;font-weight:600;line-height:1.08;margin:4px 0 2px;}
.recap .big{display:flex;align-items:baseline;gap:6px;margin:11px 0 3px;}
.recap .big .n{font-family:'Fraunces',serif;font-size:34px;font-weight:600;line-height:1;color:var(--gold);}
.recap .big .nl{font-size:11px;opacity:.9;}
.recap .hoods{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px;}
.recap .chip{font-size:11px;font-weight:700;padding:3px 9px;border-radius:11px;background:rgba(255,255,255,.16);}
.recap .chip.done{background:var(--gold);color:var(--ink);}
.recap .bar{height:6px;border-radius:4px;background:rgba(255,255,255,.18);margin-top:12px;overflow:hidden;}
.recap .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--tile));}
.recap .barl{font-size:11px;opacity:.85;margin-top:5px;}
.recap .lane-h{font-size:9px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:rgba(255,255,255,.7);margin:12px 0 4px;}
.recap .tl{display:flex;gap:8px;align-items:flex-start;padding:4px 0;}
.recap .tl .dot{width:7px;height:7px;border-radius:50%;background:var(--gold);margin-top:5px;flex-shrink:0;}
.recap .tl .tln{font-family:'Fraunces',serif;font-size:13px;font-weight:600;}
.recap .tl .tld{font-size:11px;opacity:.8;}
.recap--empty .rp{font-size:13px;line-height:1.5;color:rgba(255,255,255,.9);margin:8px 0 0;}
```
Render in `renderSaved` only when the Been tab is active, before the been list:
```js
if((S.sv.stateFilter||'want')==='been'){
  body += recapCardHTML(beenCount, hoods, recent);
}
```

**Acceptance tests:**
- Saved → **Been** shows the "Your Santa Barbara" recap card at the top; Saved → Want does **not**.
- With ≥1 been: card shows the count, neighborhood chips, a progress bar (X of 11), and a short "Lately" list.
- With **0** beens: card shows the inviting empty state (not numbers, not a sad zero) — "Your map starts here."
- Singular/plural grammar is correct ("1 spot" vs "12 spots").
- No new network calls; everything derives from existing client state.
- The locked three‑section nav is untouched (this lives inside Saved, not a new tab).

**Commit:** `feat(saved): "Your Santa Barbara" memory recap on Been tab + empty state (LB-1)`

---

## Phase 10 — Sticky section headers (S5, Option B)

**Goal:** As the user scrolls Explore, the current section header ("📅 Happening today", "— or, always worth it —" / "Also happening", "Near you", etc.) pins to the top of the scroll area until the next section pushes it up, so the user always knows which layer they're in. This also makes the three‑tier cascade legible.

**Implementation (CSS‑only `position:sticky`):**
- The section header element is `.sh` (and the `.ever-divider` from Phase 7). Make them sticky within the scroll container.
- **Prerequisite:** the scroll **container** must allow sticky — it must be the scroller (have `overflow-y:auto`) and **not** clip sticky with `overflow:hidden` on an ancestor between the sticky element and the scroller. Verify the Explore list scroller. The header/hero/controls may themselves be sticky already (`.hdr` is `position:sticky;top:0`, `.controls` is `sticky;top:60px`); section headers should pin **below** the controls.
```css
.sh{position:sticky;top:0;z-index:18;
  background:rgba(246,241,231,.97);backdrop-filter:blur(6px);
  /* keep the existing inner type; add a subtle divider so it reads as pinned */
  box-shadow:0 4px 12px rgba(20,30,40,.06);}
.sh .k{ /* unchanged */ }
.sh .t{ /* unchanged */ }
.ever-divider{position:sticky;top:0;z-index:18;background:rgba(246,241,231,.97);backdrop-filter:blur(6px);padding-top:8px;padding-bottom:6px;}
```
- **Coordinate the `top` offset with sticky chrome.** If the header + controls are sticky and occupy the top, set the section header's `top` to sit just under them (e.g., `top: var(--stuck-offset)`), or — simpler and matching the mock — have section headers pin to `top:0` of the **scroll content** area (the area below the controls), which works if the scroll container starts below the controls. Pick whichever matches the production layout; the **felt behavior** must be: scrolling within a section keeps that section's label pinned; reaching the next section swaps the label.
- Keep the pinned bar compact (don't let it grow tall when pinned). The `.t` (Fraunces subtitle) can remain; if it feels heavy when pinned, you may hide `.t` in the pinned state and keep only `.k` — optional polish.

**Acceptance tests:**
- Scroll Explore through a long list: the current section's header stays visible at the top of the list area; when the next section reaches the top, its header replaces the previous one.
- Pinned headers have a subtle backdrop/shadow so they're legible over scrolling cards.
- No layout jump or z‑index conflict with the (already sticky) app header and controls.
- Works on iOS Safari and Chrome (test `position:sticky` with the actual overflow ancestor).

**Commit:** `feat(explore): sticky section headers for scroll context (S5)`

---

## Phase 11 — Condensing header on scroll (S6, Option A)

**Goal:** The full app header (logo + tagline + job strip) condenses to a slim title bar (logo mark + "Explore" + a tiny weather chip) once the user scrolls past the hero, freeing vertical space while keeping orientation. Restores to full when scrolled back to top.

**Implementation (needs a scroll signal — React):**
- Add a sentinel or a scroll listener. Cleanest: an `IntersectionObserver` on a 1px sentinel placed at the top of the scroll content (just under the header). When the sentinel leaves the viewport (user scrolled down), add `is-condensed` to the header; when it returns, remove it.
- React sketch:
```jsx
const headerRef = useRef(null);
const sentinelRef = useRef(null);
useEffect(() => {
  const el = sentinelRef.current; if(!el) return;
  const io = new IntersectionObserver(
    ([entry]) => headerRef.current?.classList.toggle('is-condensed', !entry.isIntersecting),
    { root: scrollRootRef.current, threshold: 0 }
  );
  io.observe(el);
  return () => io.disconnect();
}, []);
```
Place `<div ref={sentinelRef} style={{height:1}} />` as the first element in the scroll content, with the header (`ref={headerRef}`) sticky above it.
- CSS for the condensed state:
```css
.hdr{transition:padding .2s ease, box-shadow .2s ease;}
.hdr.is-condensed{padding:9px 18px 8px;box-shadow:0 4px 12px rgba(20,30,40,.06);border-bottom:1px solid var(--line);}
.hdr.is-condensed .lg .tg{display:none;}             /* hide tagline when condensed */
.hdr.is-condensed + .job-strip{display:none;}        /* hide the job strip when condensed */
.hdr .hdr-weather{display:none;font-size:11px;font-weight:700;color:var(--sage);margin-left:auto;}
.hdr.is-condensed .hdr-weather{display:block;}        /* show tiny weather chip when condensed */
```
Add the tiny weather node to the header right side: `<span class="hdr-weather">${shortWeather}</span>` (e.g., "71° · ☀️"), hidden unless condensed.
- Respect `prefers-reduced-motion` (the transition is subtle; fine to keep, but no large motion).

**Acceptance tests:**
- At the top, the full header (logo + "Santa Barbara, daily" + job strip) is visible.
- After scrolling past the hero, the header condenses to a slim bar (mark + "Explore" + tiny weather chip); the tagline and job strip hide.
- Scrolling back to top restores the full header.
- No flicker/jank at the threshold; the sticky section headers (Phase 10) still pin correctly under the condensed header.
- Works with the address‑bar show/hide on mobile Safari (test).

**Commit:** `feat(header): condense-on-scroll with weather chip (S6)`

---

## Phase 12 — QA sweep & accessibility audit

Run across **all three sections** and the detail/guide/submit sub‑screens, at 360×640, 390×844, and a tablet width:

- **Contrast:** every text/background pair ≥ 4.5:1 (normal) / 3:1 (large). Re‑check: job strip words on plaster, nav gold/white on pacific, card meta `--ink2`, recap text on the teal gradient, time‑rail card meta.
- **Targets:** all interactive controls ≥24×24 (hearts, share, chips, sheet items); primary been button ≥44px.
- **Keyboard:** visible focus on every control; sheets trap focus and close on Escape; tab order is logical.
- **Screen reader:** nav tabs announce name + current; hearts announce save state; been button announces pressed state; the hero skyline SVG is `aria-hidden="true"` (decorative).
- **Reduced motion:** sun pulse and any transitions respect `prefers-reduced-motion`.
- **Time‑of‑day:** hero correct in morning/afternoon/evening/gray; skyline desaturates + fog on gray.
- **Regression:** Want/Been tabs, Near Me, horizon switching, detail open/close, share flow, email signup, and the (deferred) features left untouched all still work.
- **Grep guards:** `grep -rn "Santa Barbara, today"` → empty; `grep -rn "personas\[0\]"` → only inside the new `catLabel` fallback, never rendered raw; no remaining `font-size:8` on persistent text.

**Commit:** `chore(qa): wave-next accessibility + regression sweep`

---

## Appendix A — Decision ledger (this wave)

| Item | Decision |
|---|---|
| QW‑1 Editor's Note | **Deferred** |
| QW‑2 label fix | Build · Option A (solid pills) |
| QW‑3 tagline | Build · Option B (daily + job strip) |
| QW‑4 been/share targets | Build · Option A (action row) |
| QW‑5 type floor | Build · Option A |
| QW‑6 trust stamp | **Deferred** |
| ML‑1 Did You Make It? (+companions) | **Deferred** |
| ML‑2 filters | Build · **Option B** (unified sheet) |
| ML‑3 happenings spine | Build · Option A (time‑rail + divider) |
| ML‑4 imagery | **Deferred** |
| ML‑5 The One Line | **Deferred** |
| LB‑1 memory recap | Build · Option A (recap on Been) |
| LB‑2 / LB‑3 / LB‑4 / LB‑5 | **Deferred** |
| S1 nav background | Build · Option B (pacific) |
| S2 nav icons | Build · Option B (custom line set) |
| S3 nav spacing | Build · **Modified** (more above icons + content gap; minimal below) |
| S4 hero proportions | Build · Option B (compact) |
| S5 sticky headers | Build · Option B (sticky) |
| S6 header extras | Build · Option A (condensing header) |
| Hero art | Build · **H2** (SB skyline, time‑of‑day + marine layer) |

## Appendix B — Cross‑references & interactions

- **Custom nav icons (S2)** also satisfy the icon half of the deferred LB‑2; if LB‑2 is revisited later, reuse this icon set.
- **Compact hero (S4) + skyline (H2)** are one phase (shared markup).
- **QW‑5 type floor** is applied progressively: nav labels (Phase 3) and hero date (Phase 2) already use 11px; Phase 4 mops up cards/meta/a11y.
- **ML‑3 (Phase 7) and LB‑1 (Phase 9)** both depend on data (dated events; been‑marks). Both ship with explicit empty states.
- **S5 sticky (Phase 10) + S6 condensing header (Phase 11)** share the top‑of‑scroll region — build sticky first, then the condensing header, and re‑verify their `top` offsets together.
- **`catLabel()` (Phase 5)** is reused by the time‑rail cards (Phase 7) — define it before Phase 7 needs it.

## Appendix C — Suggested branch / commit flow

```
git checkout -b wave-next
# Phase 1 → commit → Jim verifies
# Phase 2 → commit → Jim verifies
# … through Phase 12
# open PR "Wave Next: hero, nav, happenings spine, memory recap, shell polish"
```
Keep each phase a separate commit so Jim can review/curate one surface at a time and revert any single change cleanly.
