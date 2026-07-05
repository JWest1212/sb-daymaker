# Welcome Tour — Build Spec (Claude Code)

> **File:** `docs/first-run-tutorial/01_welcome_tour_build_spec.md`
> **Companion:** `docs/first-run-tutorial/00_current_frontend_surface_spec.md` (the code-accurate surface map; all file paths below come from it).
> **Status:** Ready to build. All product decisions are locked.
> **Governs:** a first-visit onboarding carousel, the localStorage gating, a footer replay entry, an empty-Saved replay entry, and two copy alignments. **Frontend only. No schema, no server, no AI.**

---

## 0. TL;DR for the implementer

Build a 3-panel **welcome carousel** that auto-opens once on a user's first visit, reusing the existing `BottomSheet` shell for all overlay behavior. Persist "seen" in `localStorage["sbd.tour.v1"]`, gated on `useSaves().hydrated`. Add **two ways to replay it** (both call one `openTour()`): a quiet link in the Explore footer, and a link inside the empty-Saved state. Finally, make **two small copy edits** to existing native surfaces so they rhyme with the carousel. Nothing else changes.

**Golden rules:** reuse `BottomSheet`; use design tokens (no hardcoded hex in CSS); honor `prefers-reduced-motion`; keep everything in localStorage (no accounts, no network, no AI); WCAG 2.2 AA. **Stop and show at each gate in §17.**

---

## 1. Scope & non-goals

### In scope
1. `TourProvider` — context + first-visit auto-open logic + the `openTour()` replay trigger.
2. `WelcomeTour` — the 3-panel carousel rendered inside a `BottomSheet`.
3. Panel 1's annotated-card **SVG illustration** (verbatim markup in §8.1).
4. Footer **replay link** on Explore (§14).
5. Empty-Saved **replay link** (§13.3).
6. Two **copy alignments**: empty-Saved message and the C2 prompt's supporting line (§13).
7. Tour CSS under `.sbd-tour*` (§10).

### Explicitly NOT in scope (do not build)
- No header icon, no "⋯" menu, no settings screen (rejected alternatives).
- No inline first-save hint / tooltip / spotlight (the rejected "Option B").
- No analytics instrumentation (see §16 — flagged, not built).
- No changes to the ranker, pipeline, cockpit, schema, or any server route.
- No new npm dependencies. Everything uses what's already in the repo.

---

## 2. Locked decisions (do not re-litigate)

| # | Decision |
|---|---|
| D1 | **Shape:** a welcome carousel (not a spotlight/coach-mark tour). |
| D2 | **Panels:** exactly 3, narrative order — *what it is → save (want) → remember (been)*. |
| D3 | **Launch:** auto-open once on a true first visit; skippable at every step. |
| D4 | **Reinforcement = Approach A:** align existing native copy only; **no new floating UI.** |
| D5 | **Replay entry:** a footer link ("How SB Daymaker works") **plus** an empty-Saved link ("New here? See how it works"). Both reopen the same carousel. |
| D6 | **Copy contains zero em dashes** (—). Use commas, periods, or colons. Applies to all new/edited strings. |
| D7 | Panel 1's illustration is the annotated feed-card SVG in §8.1, unchanged. |

---

## 3. Ground rules (must not break)

Pulled from `CLAUDE.md` and the surface spec. Violating any of these is a build failure:

1. **Reuse `BottomSheet`** (`components/ui/BottomSheet.tsx`) for the overlay. It already provides focus-trap, Escape-to-close, scrim-click-close, body-scroll-lock, and `role="dialog" aria-modal`. Do **not** hand-roll a modal.
2. **Design tokens only.** Every color/space/radius/type value in CSS comes from `Core Project Files/sbdaymaker_tokens.css` (mirrored via `app/globals.css`). No raw hex in `.css`. (The inline SVG is the one allowed exception — see §15.)
3. **localStorage only.** No accounts, no server record, no cookie, no PII. New key: `sbd.tour.v1`.
4. **No AI at runtime.** All copy is hand-authored and static. Zero Claude/API calls.
5. **`prefers-reduced-motion` honored** (§11). No animation may be required to use or dismiss the tour.
6. **WCAG 2.2 AA** (§12): visible `:focus-visible` ring (`--pacific`), 44px min tap targets, `aria-live` step announcements, dialog semantics.
7. **Additive & reversible.** New files + small, surgical edits to named files. No refactors.
8. **Gate on hydration.** `SavesProvider` renders `{}` on server + first client paint, then flips `hydrated` in `useEffect`. The tour must not evaluate its open condition until `hydrated === true`, to avoid an SSR/hydration flash. (Surface spec §4.)

---

## 4. Architecture & file changes

### New files

| Path | Purpose |
|---|---|
| `components/tour/TourProvider.tsx` | Context. Holds `open`/`step` state, the first-visit auto-open effect, the `sbd.tour.v1` flag, and `openTour()`. Renders `<WelcomeTour/>`. |
| `components/tour/WelcomeTour.tsx` | The carousel: a `BottomSheet` containing 3 panels + dots + Skip + Back/Next/CTA. |
| `components/tour/useTour.ts` | `export const useTour = () => useContext(TourContext)` (or co-locate in `TourProvider.tsx`). |

### Modified files

| Path | Change | Section |
|---|---|---|
| `app/(app)/layout.tsx` | Mount `<TourProvider>` **inside** whatever provides `useSaves` (i.e. inside `SavesProvider`), wrapping `{children}`. | §5.4 |
| `app/components.css` | Add the `/* ===== WELCOME TOUR ===== */` block (§10). | §10 |
| `components/saved/SavedClient.tsx` | (a) reword empty-state message; (b) add empty-Saved replay link; (c) align C2 supporting line. | §13 |
| `components/explore/CascadeFeed.tsx` **or** the Explore footer component that renders `EmailSignup`/"submit a happening" | Add the footer replay link. | §14 |

> **Before editing**, confirm the exact footer location: search Explore render for the "submit a happening" link (surface spec: `EmailSignup.tsx` + submit link render "at feed foot", inside `CascadeFeed.tsx` around L171+). Put the replay link in that same footer row.

### Data flow

```
app/(app)/layout.tsx
  └─ SavesProvider (existing)
       └─ TourProvider  ← auto-open effect reads useSaves(); exposes openTour()
            ├─ {children}  (Explore / Saved / Discover pages)
            │     ├─ Explore footer → <button onClick={openTour}>   (§14)
            │     └─ Saved empty    → <button onClick={openTour}>   (§13.3)
            └─ <WelcomeTour open step … />   (the BottomSheet carousel)
```

---

## 5. State model & first-visit logic

### 5.1 The flag

- **Key:** `localStorage["sbd.tour.v1"]`
- **Values:** unset (never seen) → `"seen"` (has seen or dismissed). That is the only value it ever holds.
- Namespaced `.v1` so a future redesign can bump to `.v2` and re-introduce the tour intentionally.

### 5.2 Auto-open condition (first visit)

Evaluate **only after `hydrated === true`**, once per mount:

```
shouldAutoOpen =
     hydrated === true
  && localStorage["sbd.tour.v1"] is unset
  && counts.total === 0            // from useSaves() — no wants and no beens
  && localStorage["sbd.itineraries.v1"] is unset   // no saved plans
```

The last two conditions are a **guard for existing users at launch**: someone who already uses the app (has saves or plans) but has no `sbd.tour.v1` flag yet should **not** get the tour shoved at them on the release that ships this feature. They can still find it via the footer link. A genuinely new device satisfies all four.

When `shouldAutoOpen` is true:
1. Set `step = 0`, `open = true`.
2. **Immediately write `localStorage["sbd.tour.v1"] = "seen"`.** Writing on auto-open (not on close) means a mid-tour reload won't re-trigger it.

### 5.3 Replay (`openTour()`)

```
openTour():
  step = 0
  open = true
  // DO NOT touch sbd.tour.v1 — replay must never re-arm the auto-open.
```

Called by the footer link (§14) and the empty-Saved link (§13.3).

### 5.4 Mount

`TourProvider` must sit **inside** `SavesProvider` so `useSaves()` resolves. In `app/(app)/layout.tsx`:

```tsx
// inside the existing shell, inside SavesProvider:
<TourProvider>
  {children}
</TourProvider>
```

`TourProvider` renders `{children}` and, as a sibling, `<WelcomeTour … />`. Because it lives in the `(app)` layout, the tour is available on all three routes and `openTour()` is callable from any of them.

### 5.5 Dismiss

`dismiss()` = `setOpen(false)`. Fired by: Skip, scrim-click, Escape (the last two are handled by `BottomSheet`'s `onClose`), and the Panel-3 CTA. Dismiss never writes the flag (auto-open already wrote it; replay intentionally leaves it).

### 5.6 "Show me today" CTA (Panel 3 primary action)

```
onCta():
  dismiss()
  if (pathname !== '/') router.push('/')   // land them on Explore
```

Use `usePathname()` + `useRouter()` from `next/navigation`.

---

## 6. `TourProvider` spec

```tsx
"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSaves } from "@/components/saves/SavesProvider"; // confirm export name/path
import { WelcomeTour } from "./WelcomeTour";

type TourCtx = { openTour: () => void };
const TourContext = createContext<TourCtx>({ openTour: () => {} });
export const useTour = () => useContext(TourContext);

const TOUR_KEY = "sbd.tour.v1";
const ITIN_KEY = "sbd.itineraries.v1";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { hydrated, counts } = useSaves();     // confirm shape: { hydrated: boolean, counts: { total: number } }
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // First-visit auto-open (runs after hydration)
  useEffect(() => {
    if (!hydrated) return;
    let seen = false, hasItin = false;
    try {
      seen = !!localStorage.getItem(TOUR_KEY);
      hasItin = !!localStorage.getItem(ITIN_KEY);
    } catch { return; }               // storage blocked → never auto-open
    if (!seen && counts.total === 0 && !hasItin) {
      setStep(0);
      setOpen(true);
      try { localStorage.setItem(TOUR_KEY, "seen"); } catch {}
    }
  }, [hydrated, counts.total]);

  const openTour = useCallback(() => { setStep(0); setOpen(true); }, []);
  const dismiss  = useCallback(() => setOpen(false), []);

  return (
    <TourContext.Provider value={{ openTour }}>
      {children}
      <WelcomeTour open={open} step={step} setStep={setStep} onDismiss={dismiss} />
    </TourContext.Provider>
  );
}
```

> Confirm the real `useSaves` export shape against `components/saves/SavesProvider.tsx`. If `counts` isn't exposed, derive "empty" from the saves map size, still gated on `hydrated`.

---

## 7. `WelcomeTour` component spec

**Shell:** render the existing `BottomSheet` with **no `title`/`kicker`** (they're optional per the surface-spec API) and pass the whole carousel as children. This inherits focus-trap, Escape, scrim-click, and scroll-lock for free.

```tsx
<BottomSheet open={open} onClose={onDismiss} aria-label="Welcome to SB Daymaker">
  <div className="sbd-tour" role="group" aria-roledescription="carousel">
    {/* top row: dots + skip */}
    {/* aria-live step announcer (visually hidden) */}
    {/* the 3 panels; only the active one is in the DOM/visible */}
    {/* footer: Back / Next-or-CTA */}
    {/* replay-note on last panel */}
  </div>
</BottomSheet>
```

### 7.1 Structure & behavior

- **State:** `step` (0–2) is controlled by the provider (so re-open resets to 0).
- **Panels:** render all three but show only `step` via `.is-active` (display toggle). Keeps DOM stable; simplest for focus + a11y.
- **Dots:** 3 buttons; the active one has `.is-active` + `aria-current="step"`; each `aria-label="Go to step N of 3"`; tapping sets `step`.
- **Skip:** always visible top-right; `onClick={onDismiss}`; `aria-label="Skip the intro"`.
- **Back:** hidden on step 0 (`visibility:hidden`, keep layout), else visible; decrements `step`.
- **Next / CTA:** steps 0–1 show **"Next"** (advances). Step 2 shows the CTA **"Show me today"** → runs `onCta()` (§5.6). Same button element, swapped label + class + handler by step.
- **Replay note:** only on step 2, below the footer: *"You can replay this anytime from the footer."* (small, muted).
- **Swipe (optional, nice-to-have):** left/right swipe advances/retreats. Not required for AA; keyboard + dots + buttons are the required paths. If added, it must be disabled/instant under reduced motion.
- **aria-live announcer:** a visually-hidden `<p aria-live="polite">` that updates to `"Step {n} of 3: {panel title}"` on step change.

---

## 8. Panels — exact content

Copy is final and em-dash-free. **Do not paraphrase.** Fraunces = display, Inter = body, JetBrains Mono = data/labels (all already loaded app-wide).

### 8.1 Panel 1 — "what it is"

- **Kicker** (`.sbd-tour__kick`, JetBrains Mono, `--terra-text`): `Welcome`
- **Title** (`.sbd-tour__title`, Fraunces 600): `Santa Barbara, daily.`
- **Body** (`.sbd-tour__body`, Inter): `Open it like you check the weather. Here's what one pick looks like:`
- **Illustration:** the annotated feed-card SVG below, verbatim. It is a static illustration (not data-driven). Wrap in a div with `margin:14px 0 2px`. See §15 for the token color-map (convert `fill="#…"` to `fill="var(--…)"` per the map; the two purple gradients and the pill fill may keep literals as noted).

```html
<svg viewBox="0 0 300 172" width="100%" role="img"
     aria-label="A feed card, annotated. The title shows what is happening and where. The meta shows when it is scheduled. The description is a local's take on what is happening.">
  <defs>
    <linearGradient id="sbdTourArtsG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7a4e7c"/><stop offset=".65" stop-color="#9C6B9E"/><stop offset="1" stop-color="#c79ac2"/>
    </linearGradient>
  </defs>

  <!-- section label -->
  <text x="14" y="16" font-family="'JetBrains Mono',monospace" font-size="8" letter-spacing="1.5" fill="var(--ink-2)">HAPPENING TODAY</text>

  <!-- card -->
  <rect x="15" y="33" width="270" height="100" rx="18" fill="var(--ink)" opacity="0.06"/>
  <rect x="14" y="30" width="272" height="100" rx="18" fill="var(--surface)" stroke="var(--line)" stroke-width="1"/>
  <!-- image (left, rounded on the left to match card) -->
  <path d="M32,30 H92 V130 H32 A18,18 0 0 1 14,112 V48 A18,18 0 0 1 32,30 Z" fill="url(#sbdTourArtsG)"/>
  <rect x="28" y="66" width="14" height="28" rx="2" fill="#fff" opacity="0.20" stroke="#fff" stroke-opacity="0.28"/>
  <rect x="50" y="72" width="14" height="28" rx="2" fill="#fff" opacity="0.14" stroke="#fff" stroke-opacity="0.22"/>
  <!-- vibe pill on the image (ARTS) -->
  <rect x="22" y="38" width="44" height="15" rx="7.5" fill="#7A4E7C"/>
  <text x="44" y="48.4" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="6.6" font-weight="700" letter-spacing="1" fill="var(--surface)">ARTS</text>

  <!-- title (what is happening) -->
  <text x="104" y="54" font-family="'Fraunces',serif" font-size="13.5" font-weight="700" fill="var(--ink)">First Thursday</text>
  <text x="104" y="69" font-family="'Fraunces',serif" font-size="13.5" font-weight="700" fill="var(--ink)">Art Walk</text>
  <!-- description (local's take) -->
  <text x="104" y="85" font-family="'Inter',sans-serif" font-size="8" fill="var(--ink-2)">Galleries stay open late and pour free</text>
  <text x="104" y="95" font-family="'Inter',sans-serif" font-size="8" fill="var(--ink-2)">wine. The art is technically the point.</text>
  <!-- meta (when + where) -->
  <text x="104" y="118" font-family="'JetBrains Mono',monospace" font-size="7.5" font-weight="600" letter-spacing="0.6" fill="var(--terra-text)">TONIGHT · 5 PM · FUNK ZONE</text>
  <!-- heart + share icons -->
  <path d="M251,120 C247,116.5 244,114.5 244,111.5 C244,109 246,108 248,109 C249.4,109.7 251,111.6 251,111.6 C251,111.6 252.6,109.7 254,109 C256,108 258,109 258,111.5 C258,114.5 255,116.5 251,120 Z" fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M268,120 L277,111" fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M277,111 l-6,0 M277,111 l0,6" fill="none" stroke="var(--ink)" stroke-width="1.2" stroke-linecap="round"/>

  <!-- ARROW 1 -> title -->
  <text x="170" y="19" font-family="'JetBrains Mono',monospace" font-size="10" font-weight="700" fill="var(--ink)">what's happening</text>
  <path d="M185.6,25.1 L184.2,25.6 L182.8,26.2 L181.3,26.3 L179.8,26.6 L178.5,27.4 L177.1,27.6 L175.6,27.9 L174.4,28.6 L173.1,29.1 L171.6,29.3 L170.4,30.0 L169.2,30.7 L167.8,31.0 L166.6,31.5 L165.5,32.4 L164.3,32.9 L163.0,33.3 L162.0,34.2 L160.9,34.9 L159.7,35.2 L158.7,36.1 L157.8,36.9 L156.6,37.3 L155.6,38.0 L154.8,38.9 L153.7,39.3 L152.3,36.1 L147.1,43.0 L155.7,43.9 L154.3,40.6 L155.5,40.5 L156.5,40.0 L157.7,39.6 L159.0,39.6 L160.1,39.1 L161.2,38.6 L162.5,38.5 L163.8,38.1 L164.9,37.4 L166.2,37.1 L167.5,36.9 L168.6,36.1 L169.8,35.6 L171.2,35.3 L172.4,34.5 L173.6,33.8 L174.9,33.4 L176.2,32.7 L177.3,31.8 L178.7,31.3 L180.0,30.7 L181.1,29.7 L182.4,29.0 L183.8,28.5 L185.0,27.5 L186.2,26.6 Z" fill="var(--ink)" stroke="var(--ink)" stroke-width="0.5" stroke-linejoin="round"/>

  <!-- ARROW 2 -> meta (when) — tip lands under TONIGHT -->
  <text x="14" y="162" font-family="'JetBrains Mono',monospace" font-size="10" font-weight="700" fill="var(--ink)">when it's happening</text>
  <path d="M86.3,150.9 L87.8,150.5 L89.2,149.9 L90.8,149.7 L92.3,149.3 L93.6,148.4 L95.1,147.9 L96.7,147.4 L97.9,146.3 L99.3,145.5 L100.8,144.9 L102.0,143.8 L103.1,142.7 L104.4,141.9 L105.6,140.8 L106.4,139.5 L107.5,138.5 L108.5,137.5 L109.1,136.2 L109.8,135.0 L110.8,134.0 L111.2,132.7 L111.5,131.5 L112.2,130.5 L112.4,129.3 L112.4,128.1 L112.7,127.2 L115.9,128.0 L113.6,120.4 L108.1,126.0 L111.4,126.8 L110.7,127.6 L110.5,128.5 L109.9,129.4 L109.0,130.1 L108.4,131.0 L107.9,132.0 L106.8,132.7 L105.9,133.6 L105.3,134.7 L104.2,135.5 L103.1,136.2 L102.3,137.4 L101.2,138.3 L99.9,139.0 L99.0,140.1 L98.0,141.1 L96.7,141.8 L95.5,142.7 L94.5,143.9 L93.2,144.5 L91.9,145.3 L90.9,146.4 L89.6,147.1 L88.2,147.6 L87.0,148.6 L85.8,149.4 Z" fill="var(--ink)" stroke="var(--ink)" stroke-width="0.5" stroke-linejoin="round"/>

  <!-- ARROW 3 -> description -->
  <text x="160" y="162" font-family="'JetBrains Mono',monospace" font-size="10" font-weight="700" fill="var(--ink)">a local's description</text>
  <path d="M191.0,150.1 L191.3,147.6 L191.4,145.0 L191.8,142.5 L191.9,140.0 L191.4,137.5 L191.2,135.1 L191.0,132.6 L190.1,130.3 L189.4,128.0 L188.8,125.6 L187.8,123.5 L186.5,121.5 L185.7,119.3 L184.5,117.3 L183.0,115.5 L181.9,113.6 L180.7,111.7 L179.1,110.2 L177.7,108.6 L176.6,106.9 L175.0,105.6 L173.5,104.4 L172.4,102.9 L171.1,101.7 L169.6,100.7 L168.5,99.5 L171.2,97.1 L163.0,94.4 L164.8,102.9 L167.5,100.4 L168.3,101.9 L169.5,103.1 L170.5,104.5 L171.3,106.2 L172.5,107.7 L173.8,109.1 L174.7,111.0 L175.8,112.7 L177.2,114.2 L178.1,116.1 L179.1,118.0 L180.5,119.7 L181.5,121.6 L182.2,123.7 L183.4,125.5 L184.5,127.5 L185.1,129.6 L186.0,131.6 L187.0,133.7 L187.4,135.9 L187.9,138.1 L188.7,140.3 L189.0,142.6 L188.9,145.0 L189.3,147.4 L189.4,149.9 Z" fill="var(--ink)" stroke="var(--ink)" stroke-width="0.5" stroke-linejoin="round"/>
</svg>
```

> The three arrow bodies are pre-computed tapered "brush" polygons (calligraphic ink look). Ship them exactly as given. The `#fff` overlays on the image and the two purple values are intentionally literal (illustrative art, not UI chrome).

### 8.2 Panel 2 — "save (want)"

- **Kicker:** `Save`
- **Title:** `Tap the heart.`
- **Body:** `See something good? Save it. It lives **right here on your device**. No account, no login, ever.` (bold on "right here on your device")
- **Illustration** (`.sbd-tour__art--save`): a mini card that mirrors the real feed card, with a **heart-pop** loop on the heart:
  - card: `--surface` bg, `--radius-md`, `--shadow-card`; left image block (terracotta gradient); body with Fraunces title `Trombone Shorty` and mono/pacific meta `SB Bowl · 6:30 PM`.
  - heart badge top-right: `--terracotta` fill, `--surface` glyph, **heart-pop** animation (scale 1 → 1.25 → 1, `--ease-spring`, ~2.6s loop). **Disabled under reduced motion** (static filled heart).

### 8.3 Panel 3 — "remember (been)"

- **Kicker:** `Remember`
- **Title:** `Then mark what you did.`
- **Body:** `Come back and check off the places you made it to. Over time, SB Daymaker **learns your Santa Barbara**.` (bold on "learns your Santa Barbara")
- **Illustration** (`.sbd-tour__art--been`, deep-pacific panel): a `♥ Want` chip → arrow `→` → `✓ Been` chip (the Been chip filled `--sage` with `--ink` text). Static (no animation needed).
- **Primary action:** CTA **"Show me today"** (see §5.6).
- **Replay note** under the footer: `You can replay this anytime from the footer.`

---

## 9. Carousel chrome — exact behavior

| Element | Step 0 | Step 1 | Step 2 |
|---|---|---|---|
| Dots | ●○○ | ○●○ | ○○● |
| Skip (top-right) | shown | shown | shown |
| Back | hidden (layout kept) | shown | shown |
| Primary btn | "Next" → step 1 | "Next" → step 2 | **"Show me today"** → `onCta()` |
| Replay note | — | — | shown |

- Buttons: `min-height: var(--tap-min)` (44px). Primary = pacific pill; CTA (step 2) = terracotta pill (`--accent`), matching the token contract's `.btn-cta` (large text only, which the CTA is). Back = ghost/text pacific.

---

## 10. CSS spec (`app/components.css`)

Add one clearly-commented block. **All values via tokens.** Naming: `sbd-{block}__{element}--{modifier}`, active state `.is-active` (repo convention).

```css
/* ============================= WELCOME TOUR ============================= */
.sbd-tour { display:flex; flex-direction:column; }

/* top row */
.sbd-tour__top   { display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-1); }
.sbd-tour__dots  { display:flex; gap:var(--space-2); }
.sbd-tour__dot   { width:7px; height:7px; border-radius:var(--radius-pill); background:var(--border);
                   border:none; padding:0; transition:all var(--dur-fast) var(--ease-out); }
.sbd-tour__dot.is-active { background:var(--pacific); width:20px; border-radius:4px; }
.sbd-tour__skip  { border:none; background:none; cursor:pointer; padding:var(--space-2);
                   font:600 var(--text-sm)/1 var(--font-body); color:var(--text-muted); min-height:var(--tap-min); }

/* panels */
.sbd-tour__panel { display:none; }
.sbd-tour__panel.is-active { display:block; animation:sbdTourIn var(--dur-base) var(--ease-out); }
.sbd-tour__kick  { font:600 var(--text-xs)/1 var(--font-mono); letter-spacing:1.2px; text-transform:uppercase; color:var(--terra-text); }
.sbd-tour__title { font:600 var(--text-2xl)/var(--leading-tight) var(--font-display); color:var(--text); margin:var(--space-1) 0 var(--space-2); letter-spacing:-.4px; }
.sbd-tour__body  { font:400 var(--text-base)/var(--leading-body) var(--font-body); color:var(--text-muted); max-width:32ch; }
.sbd-tour__body b { color:var(--text); font-weight:var(--weight-semi); }

/* illustration frames */
.sbd-tour__art       { border-radius:var(--radius-md); overflow:hidden; margin-bottom:var(--space-4); }
.sbd-tour__art--save { background:var(--plaster-2); min-height:150px; display:grid; place-items:center; }
.sbd-tour__art--been { background:linear-gradient(160deg, var(--pacific-dark), var(--pacific)); min-height:150px; display:grid; place-items:center; }

/* heart-pop (save panel) */
.sbd-tour__heart { /* … terracotta circle, surface glyph … */ animation:sbdHeartPop var(--dur-pulse) var(--ease-spring) infinite; }

/* footer */
.sbd-tour__foot  { display:flex; align-items:center; justify-content:space-between; margin-top:var(--space-4); gap:var(--space-3); }
.sbd-tour__note  { font:400 var(--text-xs)/1.4 var(--font-body); color:var(--text-muted); text-align:center; margin-top:var(--space-3); }

/* replay entry links (footer + empty-saved) */
.sbd-tour-replay { display:inline-flex; align-items:center; gap:var(--space-1);
  background:none; border:none; cursor:pointer; min-height:var(--tap-min);
  font:600 var(--text-sm)/1 var(--font-body); color:var(--text-link);
  text-decoration:underline; text-underline-offset:2px; }

@keyframes sbdTourIn  { from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }
@keyframes sbdHeartPop{ 0%,88%,100%{transform:scale(1);} 92%{transform:scale(1.25);} }

@media (prefers-reduced-motion: reduce) {
  .sbd-tour__panel.is-active { animation:none; }
  .sbd-tour__heart           { animation:none; }
}
/* =================================================================== */
```

> `--dur-*` already collapse to `0ms` under reduced motion via the token file, so the `BottomSheet` slide is handled globally; the explicit block above additionally kills the panel-in and heart-pop loops.

---

## 11. Reduced motion

Under `prefers-reduced-motion: reduce`:
- `BottomSheet` slide → instant (already handled by token `--dur-*` → 0).
- Panel cross-fade (`sbdTourIn`) → none.
- Heart-pop loop (`sbdHeartPop`) → none; heart shows its static filled end-state.
- If swipe is implemented, no momentum/parallax; instant snap.
- Nothing about dismissing, advancing, or reading the tour may depend on motion.

---

## 12. Accessibility (WCAG 2.2 AA)

- **Dialog:** inherited from `BottomSheet` (`role="dialog" aria-modal="true"`, focus trap, Escape, scrim close, scroll lock). Pass an `aria-label="Welcome to SB Daymaker"`.
- **Focus on open:** `BottomSheet` moves focus into the panel; ensure the first focusable is Skip or the primary button (not a dot).
- **Step announcer:** visually-hidden `aria-live="polite"` region announces `Step {n} of 3: {title}` on change.
- **Dots:** `<button>`s, `aria-label="Go to step {n} of 3"`, active one `aria-current="step"`.
- **Buttons:** Skip = `aria-label="Skip the intro"`; primary/CTA/Back have visible text labels; all ≥ 44px.
- **Focus ring:** every interactive element gets the shared `:focus-visible` pacific ring (add the new classes to the existing focus-visible selector list in `app/components.css`, or match the pattern).
- **SVG:** `role="img"` + the descriptive `aria-label` given in §8.1. Decorative sub-shapes need no labels.
- **Contrast:** all text uses `--ink` / `--ink-2` / `--pacific` / `--terra-text`, each AA-safe on the paper sheet. The ARTS pill uses white on `#7A4E7C` (AA-safe, pre-checked).
- **Replay links:** real `<button>`s, `aria-haspopup="dialog"`.

---

## 13. Approach A — copy alignment (existing surfaces)

Two tiny edits so the live app rhymes with the carousel. **No new components here besides the empty-Saved link in §13.3.**

### 13.1 Empty-Saved message — `components/saved/SavedClient.tsx` (~L221, the `counts.total === 0` branch)

Remove the em dash; keep it warm and identical in meaning.

- **From:** `Nothing saved yet. Tap the heart on anything you love and it'll live right here — on this device, no account needed.`
- **To:** `Nothing saved yet. Tap the heart on anything you love and it'll live right here, on this device, no account needed.`

Title stays `Your saved list`; icon stays the heart.

### 13.2 C2 "Did you make it?" prompt — supporting line (the `.sbd-c2` block in `SavedClient.tsx`)

Keep the question `Did you make it to {title}?`. Set the supporting line to echo Panel 3:

- **To:** `Mark what you did. It's how SB Daymaker learns your Santa Barbara.`

(If a different supporting string exists today, replace it with the above. If none exists, add it as the `.sbd-c2__sub`.) Buttons unchanged (`✓ I went` / `Not yet`, mapping to `setState(id,"been")` / dismiss).

### 13.3 Empty-Saved replay link (the "C" entry)

Inside the empty-state branch, **after** the message, render:

```tsx
<button className="sbd-tour-replay sbd-tour-replay--saved"
        aria-haspopup="dialog"
        onClick={openTour}>
  ↺ New here? See how it works
</button>
```

- Get `openTour` from `useTour()`.
- Use the real replay glyph `↺` (U+21BA) or the app's existing reset/undo icon from `SBIcon` if one exists (surface spec lists a "reset" icon in the set) — prefer the icon component for consistency.
- Only rendered in the empty state (it naturally disappears once the user has saves).

---

## 14. Footer replay entry (the "A" entry)

**Where:** the Explore footer, in the same row as the existing "submit a happening" link (surface spec: rendered at the feed foot in `CascadeFeed.tsx`, near `EmailSignup`). Do **not** put it in the header or a menu.

**Markup:**

```tsx
<button className="sbd-tour-replay sbd-tour-replay--footer"
        aria-haspopup="dialog"
        onClick={openTour}>
  ↺ How SB Daymaker works
</button>
```

- Get `openTour` from `useTour()`.
- Place it beside "Submit a happening" with the existing separator dot pattern (e.g. `Submit a happening · How SB Daymaker works`).
- Label is exactly **"How SB Daymaker works"** (evergreen: serves both first-time skippers and returning refreshers).
- Behavior: opens the carousel at step 0; **never** writes `sbd.tour.v1` (replay must not re-arm auto-open).

---

## 15. SVG color → token map

Convert the Panel-1 SVG fills to `var()` per this map (already applied in §8.1). Inline SVG resolves CSS custom properties, so this keeps the illustration token-compliant.

| Literal in art | Token | Role |
|---|---|---|
| `#241C16` | `var(--ink)` | card shadow, title, icons, arrow ink, arrow labels |
| `#4A4038` | `var(--ink-2)` | "HAPPENING TODAY", description text |
| `#9E3F20` | `var(--terra-text)` | meta line (AA-safe small text) |
| `#FCFAF5` | `var(--surface)` | card fill, pill text |
| `#DED3BE` | `var(--line)` | card border |
| `#2b2119` (old) | `var(--ink)` | arrows/labels (unified with ink) |
| `#7a4e7c / #9C6B9E / #c79ac2` | keep literal | ARTS vibe gradient (illustrative). If the app has an ARTS vibe fallback gradient, match it instead. |
| `#7A4E7C` | keep literal | ARTS pill fill (darkened purple; white text is AA-safe). Reuse the app's vibe-pill component if one exists. |
| `#fff` (image overlays) | keep literal | decorative gallery-frame motif on the image |

---

## 16. Analytics (flagged, not built)

There is **no analytics layer today** (surface spec §7: no `@vercel/analytics`, no `track()`). This spec ships **without** telemetry. If/when you want completion metrics later, the clean hook points are: `tour_auto_open`, `tour_step` (n), `tour_complete` (CTA), `tour_dismiss` (skip/scrim), `tour_replay` (which entry). That's a **separate** task requiring adding `@vercel/analytics/react` to the root layout first — do not add it here.

---

## 17. Acceptance checklist (stop-and-show gates)

Build in this order; **stop and show at each numbered gate.**

**Gate 1 — Carousel shell & panels (no gating yet)**
- [ ] `WelcomeTour` renders inside `BottomSheet`; 3 panels; dots/Skip/Back/Next/CTA all work.
- [ ] Panel 1 SVG renders pixel-accurately at 390px and 1280px widths.
- [ ] Copy matches §8 exactly; zero em dashes anywhere.
- [ ] CTA "Show me today" closes and routes to `/`.
- [ ] Temporarily force-open (e.g. a dev button) to verify; screenshots at both widths.

**Gate 2 — First-visit gating**
- [ ] Fresh state (no `sbd.tour.v1`, no saves, no itineraries) → auto-opens once, after hydration, no flash.
- [ ] Reload mid-tour → does not re-open (flag was written on auto-open).
- [ ] Existing-user sim (has a save OR a plan, no flag) → does **not** auto-open.
- [ ] Storage-blocked/incognito → no crash, no auto-open.

**Gate 3 — Replay entries**
- [ ] Footer link "How SB Daymaker works" reopens at step 0; `sbd.tour.v1` stays `"seen"`.
- [ ] Empty-Saved link "New here? See how it works" reopens the same; disappears once a save exists.

**Gate 4 — Approach A copy**
- [ ] Empty-Saved message reworded (no em dash).
- [ ] C2 supporting line reads "Mark what you did. It's how SB Daymaker learns your Santa Barbara."

**Gate 5 — Motion & a11y**
- [ ] `prefers-reduced-motion`: no slide, no panel fade, no heart-pop; still fully usable.
- [ ] Keyboard: Tab cycles within the sheet, Escape closes, focus ring visible on every control.
- [ ] Screen-reader: dialog announced; step changes announced; SVG has its label.
- [ ] All tap targets ≥ 44px.

---

## 18. Non-obvious decisions & edge cases (so you don't "fix" them)

1. **Flag written on auto-open, not on close** — intentional, prevents re-trigger on mid-tour reload.
2. **The `counts.total === 0 && no itineraries` guard** — protects existing users at launch from an unwanted auto-open. Keep it.
3. **Replay never writes the flag** — a returning user peeking at the tour must not re-arm auto-open.
4. **Panel 3 teaches "been" before the user can do it** — deliberate; it primes the native C2 prompt on their next visit. Do not "simplify" by cutting Panel 3.
5. **Illustration is static** — Panel 1's card is fixed art, not a live feed card. Do not wire it to data.
6. **No header/menu entry** — the two link entries are the whole surface area. Adding more was explicitly rejected.

---

## 19. Definition of done

All five gates pass at 390px and 1280px; tokens-only CSS; em-dash-free copy; reduced-motion and keyboard/SR paths verified; `sbd.tour.v1` behaves per §5; the two replay links and two copy edits are live; no changes outside the files listed in §4.
