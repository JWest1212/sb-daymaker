# SB Daymaker — Build Deltas Ledger

Canon amendments recorded as builds diverge from or extend the v9 canon
(`Core Project Files/CLAUDE.md`). Each entry cites the driving spec so canon and
code stay reconcilable. Newest first.

---

## 2026-07-03 — Wave 1 (W1.4): email the save-restore magic link

Source: `docs/wave-1-fixes/W1_SBDaymaker_Wave1_Build_Spec.md` §W1.4. The magic-link
backup now **emails** the restore link instead of only displaying it. New route
`app/api/restore-link/route.ts` (`force-dynamic`) validates `{ email, saves }`
(email contains `@`; `saves` a plain object, ≤500 entries, values exactly
`want|been` → else 400), creates the snapshot via the existing **anon-client**
SECURITY DEFINER RPC (`create_save_restore` — never service-role), then
`sendEmail`s the `/r/{token}` link and returns `{ ok, token, sent }`. `RestorePanel`
POSTs it and branches on `sent`: inbox message + copy fallback, or copy-only when
email is unconfigured. Restore **merge** semantics (`incoming wins`) are unchanged.

**Why:** the half-built backup showed a link to copy but never sent it.

**Accepted, on the record:** this public route (like `/api/subscribe`) can be made
to email an arbitrary address — content is fixed/non-sensitive; **rate limiting is
deferred to Wave 4** (comment in-route). The email/token are **never logged**. When
`RESEND_FROM`/domain verification is absent, `sent:false` degrades to copy-the-link.

---

## 2026-07-03 — Wave 1 (W1.3): Explore correctness — day-aware Tier-2 + hero never-blank

Source: `W1_SBDaymaker_Wave1_Build_Spec.md` §W1.3. Two front-page fixes in
`lib/explore.ts` + `components/explore/` (cascade sort keys untouched; no sponsor
reads). **W1.3a:** on the **Today** horizon only, a Tier-2 (recurring / happy-hour)
thing passes iff a schedule row matches today's **SB weekday** (`sbDayOfWeek`, 0=Sun
per schema, derived from `sbDay` + a UTC-anchored date to dodge DST). Week/Month keep
pass-all; Tier-3 untouched. **W1.3b (constraint C5):** the hero can never go blank —
Layer 1 picks a Tier-3 evergreen from the full pool, deterministically rotated by SB
date (`pickEvergreenFallback`), with a soft "Nothing matches that exactly today" note;
Layer 2 is a hardcoded static card (**"The Courthouse clock tower"** → `/discover`, no
save heart) when the pool has zero evergreens.

**Why:** a Sunday market showed on a Thursday, and a filtered-empty view could blank the marquee.

**Approximation accepted:** `biweekly`/`monthly` frequency is matched as "every
occurrence of that weekday" (a "1st Thursday" item shows every Thursday) — the feed
does **not** expand occurrences (`lib/occurrences.ts`), keeping it cheap/deterministic;
same feed-vs-coverage divergence, noted in-code. Schedule-less Tier-2 passes on Today
(can't prove it's off-day). One minimal token-only CSS rule added (`.sbd-hero__pick-note`).

---

## 2026-07-03 — Wave 1 (W1.2): Vercel Web Analytics + seven custom events

Source: `W1_SBDaymaker_Wave1_Build_Spec.md` §W1.2. Added `@vercel/analytics` (the
wave's only new dependency; installed with `--legacy-peer-deps` — its *optional*
`@sveltejs/kit` peer conflicts with the repo's vite@7, irrelevant to a React app).
`<Analytics />` mounts once in `app/layout.tsx` (cookieless, no consent banner —
matches §4). Exactly **seven** events fire through a typed, throw-safe wrapper
(`lib/analytics.ts`): `save_add`, `save_been`, `share_create`, `share_open`,
`lens_select`, `plan_built`, `subscribe_submit`. Save events fire in `SavesProvider`
(one seam covers every surface), read prior state via a ref so `track` sits **outside**
the updater (no StrictMode double-fire).

**Why:** the app shipped with zero telemetry; WAU is the north star and nothing computed it.

**PII discipline (constraint):** the overload signatures make it a compile error to
pass anything but ids/enums/counts — **no email, token, URL, or free-text** in any
payload. `<Analytics />` stays inert until the Vercel dashboard toggle is enabled
(a human step; not code-detectable).

---

## 2026-07-03 — Wave 1 (W1.1): fix the been-marking stale-memo regression

Source: `W1_SBDaymaker_Wave1_Build_Spec.md` §W1.1. `components/saved/SavedClient.tsx`
derived its lists from save **values** but keyed the memos on save **keys**, so a
`want→been` flip served stale cached arrays (item stayed under "Want"). Restructured
into pure, tested selectors in `lib/savedView.ts` (`filterByState`, `splitPast`,
`beenList`) taking the saves **map** as an explicit argument; `SavesProvider` now
exposes the raw `saves` map; the memos key on it. **All five `exhaustive-deps`
suppressions removed** and the file lints clean with the rule active.

**Why:** the keystone input to the memory moat (been-marking) was broken in production.

New unit suite `lib/savedView.test.ts` encodes the flip as a value-sensitivity contract
(a new-map `want→been` must re-derive) so this class of bug can't silently return. No
behavior change beyond the fix; the C2 card, dismissal, and been-ack toast are untouched.

---

## 2026-07-02 — Explore horizon toggle: de-crowded labels

Shortened the time-range segmented-control labels "This Week" → "Week" and "This Month"
→ "Month" (label-only; horizon keys `today`/`week`/`month` and all filtering unchanged).
Fuller phrasing preserved as per-button `aria-label`s (Label-in-Name). Presentation only.

---

## 2026-07-02 — Explore Hero: "One Front Page" (Phases 1–2)

Source: `docs/hero-visual-update/hero-one-front-page-spec.md` (v3 FINAL). Built and
approved at the spec §4 checkpoint. Amendments per spec §6:

1. **Reversed** — Phase 7 lock "top-banner feature lead retained for the Today
   opening card" → Today now opens in the standard left-rail `ListCard` format;
   the hero pick is the **sole marquee**. (Doc 18, Assessment Option B.)
2. **Restored** — hero pick card canon dress: context-aware eyebrow, venue + time
   meta line, CTA affordance, and the condition-chip freshness row. This corrects
   build drift; it is not a new decision.
3. **Added** — the signature Santa Barbara skyline SVG (`public/hero/sb-skyline.svg`,
   final art v3: faithful Mission, lawn + paseo foreground, dense Riviera hillside,
   Lil' Toot easter egg) extends the CLAUDE.md §5 signature element. Its fixed scene
   hexes are sanctioned as **non-token scene art** (full palette in spec §3.4) and
   must not migrate into `sbdaymaker_tokens.css`. Sun corridor + card-zone reserve
   rules per spec §3.2–3.3.
4. **Superseded** — canon's 96px hero-card image panel → the built **84px**
   body-driven panel stands (Hero Dimension Audit; code is truth on this dimension).
   Hero `min-height` canon value updated **228 → 352px**.

**Deferred, on the record (spec §6.5):** the Editor's Line (Phase 3 — gated, requires
Jim's explicit go + a separate delta spec) · the Shifting Pick (revisit after "Did You
Make It?") · the full Masthead layout (declined; the golden-hour countdown chip shipped
instead).

**Implementation reconciliations (repo is truth for paths):**
- Skyline served as an external `<img>` asset rather than inlined; spec §3.5 sanctioned
  either, and an external asset keeps the baked scene colors fully out of CSS.
- Spec §2.2 eyebrow used wireframe `cat` shorthand (`music`/`arts`/`happyhour`) with no
  literal in the 16-value `happening_category` enum. **Resolved to the site's true enums**
  (Jim's call): "Catch a show" ← `live_music`; "Arts & culture" ← `arts_theater` /
  `recurring_arts`; "Happy hour" ← thing `type === 'happyhour'` (no happy-hour category
  exists). Spec §2.2.1 amended to match.
