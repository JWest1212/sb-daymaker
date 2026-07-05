# 05 · Constraints & Quality Audit (as-built)

> **READ-ONLY AUDIT.** This file records findings only. Nothing in the repo was
> modified to produce it. Where the code drifts from `Core Project Files/CLAUDE.md`,
> the drift is flagged; **code is treated as truth**.

| Field | Value |
| --- | --- |
| Repo | `sb-daymaker` |
| Branch | `main` |
| Commit | `caa73028f1fb2bde2f3a50a62a999417ec3e5c65` (`caa7302`) |
| Snapshot date | 2026-07-03 |
| Next.js | 16.2.9 (Turbopack) |
| React | 19.2.4 |
| `@anthropic-ai/sdk` | ^0.105.0 (present in deps) |
| `next build` | **SUCCEEDED** (see §3) |

Legend: **PASS** = constraint upheld in code · **VIOLATION** = code contradicts the
constraint · **CAN'T-VERIFY** = requires runtime/infra evidence not in the repo ·
**DRIFT** = weaker than the spec claim but not a hard breach.

---

## 1 · The Eight Load-Bearing Constraints

### C1 — Solo-operator, ~15 min/day human attention → **PASS (structural)**
The whole moderation surface is one keyboard-driven cockpit (`app/admin/review/`,
`app/cockpit/`) plus automated workers. Admin actions are auth-gated
(`app/cockpit/actions.ts:9` `requireUser()`; `getServerSupabase().auth.getUser()`).
No evidence of a workflow that demands continuous attention. Can't measure the
literal "15 min" from source, but nothing structurally contradicts it.

### C2 — Cost floor ~$45/mo + variable Google photo cost capped → **PASS**
Image resolver enforces free-first + a hard monthly billing cap:
- `ingest/images.ts:19` — `const CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1400); // ~$10 at $0.007/call`
- Waterfall order `owned → pexels → wikimedia → google` (`ingest/images.ts:47`); Google
  (paid) is step 3, gated on `place_id` + counter-under-cap; branded placeholder is the
  final fallback (`ingest/images.ts:5-12`).
- Keys referenced by NAME only: `PEXELS_API_KEY`, `GOOGLE_PLACES_KEY`,
  `IMAGE_MONTHLY_CALL_CAP` (`ingest/images.ts:19-21`).
- Per-place `image_cache` means a resolved place is never re-paid (`ingest/images.ts:5`).

The literal $45/mo platform floor is an infra/billing fact, not verifiable from source →
that portion is **CAN'T-VERIFY**, but the variable-cost guard is present and correct.

### C3 — BATCH AI ONLY; live app fully deterministic → **PASS, with a nuance to note**
Grep `anthropic|claude-|messages.create` across `app lib components` returns exactly
**two** Anthropic import sites and one `messages.create`:
- `lib/enrich.ts:1` `import Anthropic` · `:80` `client.messages.create(` · `:81`
  `model: "claude-haiku-4-5"`.
- `ingest/enrich.ts` — the live batch path: `model: MODEL` (`:170`), `const MODEL =
  'claude-haiku-4-5'` (`:19`), `tool_choice` forced to `enrich_batch` (`:173-174`).

**Reachability trace of the SDK from a request handler:**
- `lib/enrich.ts` → imported by `lib/pipeline.ts:2` (`runNightly`).
- `lib/pipeline.ts` → imported by **`app/cockpit/actions.ts:7`** — a `"use server"`
  server action `runPipeline()` (`actions.ts:41-45`) that calls `runNightly()`.

So an AI-invoking code path **is** reachable from a server action. **However** it is:
1. **Admin-only** — `runPipeline` calls `requireUser()` first (`actions.ts:42`); it is
   not on any end-user surface.
2. **Manual/batch** — it runs the whole nightly gather→enrich, not a per-request AI call.
3. **Legacy/duplicated** — the retired nightly pipeline. The public cron endpoint
   `app/api/cron/nightly/route.ts` is now a **deprecated no-op** returning
   `{ok:false, deprecated:true, moved_to:"GitHub Action worker (ingest/run.ts)"}`
   (`route.ts:10-16`); the real ingestion moved to `ingest/run.ts` (GitHub Action).

**Verdict: PASS.** No AI call is reachable from any *public/end-user* request handler.
The one reachable path is an authenticated admin batch trigger, which is what the
constraint intends. **Note for the operator:** `lib/enrich.ts` + `lib/pipeline.ts` are
the *old* duplicate pipeline still wired into the cockpit `runPipeline` action even
though ingestion officially moved to `ingest/run.ts` (see §5 duplication). Two live
copies of the enrich logic (`lib/enrich.ts` and `ingest/enrich.ts`) is a drift risk.

The public Explore path is deterministic: `components/explore/ExploreClient.tsx`
(`ordered` memo, `lib/explore.ts` `cascade`/`withinHorizon`/`nearMeSort`) contains no
AI call and no network fetch beyond weather.

### C4 — No end-user accounts; saves in localStorage; only stored end-user PII = own email → **PASS**
- Saves: `components/saves/SavesProvider.tsx` — `localStorage` key `sbd.saves.v1`
  (`:16`, `:41-56`). Plans: `components/plan/ItinerariesProvider.tsx:19` key
  `sbd.itineraries.v1`. C2 dismissals: `sbd_c2_dismissed` (`SavedClient.tsx:41-47`).
  All device-local; no account.
- The only server-persisted end-user PII is the digest email, via double-opt-in:
  `app/api/subscribe/route.ts` → `sb.rpc("subscribe_email", { p_email })`
  (`route.ts:22`), and magic-link restore `lib/shares.ts:28-34` (`p_email`).
- No phone/name/address collection found. No other localStorage PII (only the three
  app keys above). **PASS.**

### C5 — Happenings-first; hero never blank (falls back to hand-written evergreen) → **DRIFT / partial VIOLATION**
Happenings-first: **PASS** — `cascade()` sorts strictly by `happening_tier` then
`starts_at` (`lib/explore.ts:24-32`); Tier 1 dated events lead.

Hero-never-blank: **partial VIOLATION.** Hero selection is
`ExploreClient.tsx:55-61`: pinned pin if in-view, else `ordered[0] ?? null`. When a
lens/horizon/zone filter empties `ordered`, `hero` becomes `null`, and
`components/explore/Hero.tsx:83` renders the pick block as `{pick ? (…) : null}` — i.e.
**no hand-written evergreen fallback**. The greeting + skyline chrome still render, but
the marquee content simply disappears. The spec's promised evergreen fallback does not
exist in code; the "never blank" guarantee is only as strong as "there is at least one
in-view thing." Flag: `Hero.tsx:83-110`, `ExploreClient.tsx:60`.

### C6 — No in-app transactions (ticketing hands off) → **PASS (spot-check)**
No payment/checkout/Stripe code found in the app surfaces; detail CTAs are outbound
links (`heroCta`, `components/explore/derive.ts`). No transaction handlers present.
(Not exhaustively grepped for every provider — treated as spot-check PASS.)

### C7 — WCAG 2.2 AA is the build floor → **MOSTLY PASS, gaps noted (see §2)**
Tokens carry documented contrast ratios (e.g. `--ink` 14.9:1, `--pacific` 7.1:1 in
`app/sbdaymaker_tokens.css:15-18`); `prefers-reduced-motion` honored in 13 CSS blocks;
66 `focus-visible` rules in `app/components.css`. Specific gaps in §2.

### C8 — THE TRUST RULE: ranker never reads sponsor status / `is_featured` → **PASS**
Grepped every ranking surface:
- `lib/explore.ts` `cascade` / `nearMeSort` / `withinHorizon` — sort keys are
  `happening_tier`, `starts_at`, `zone` only (`:24-98`). **No** `is_featured` / `sponsor`
  / `priority` read.
- `lib/plan/rankCandidates.ts` — grep for `is_featured|sponsor|priority|is_sponsored`
  returns **NONE**.
- `lib/heroServer.ts` — the LIVE hero override reads `hero_pins` only, explicitly
  "never `is_featured`/`sponsor_id`" (`:109`), fail-soft to the ranker
  (`getLiveHeroPinId`, `:117-131`). A founder pin is *explicit allowed curation*, not a
  sponsor signal.
- `ExploreClient.tsx:52-54` comment: "The pin reads no sponsor status."

The only two files that even mention `sponsor`/`is_featured` do so in comments asserting
the ranker does NOT read them (`heroServer.ts:109`, `ExploreClient.tsx:54`,
`HeroPlanView.tsx:49`). **PASS — the ranker is sponsor-blind.**

### C-extra — Hardcoded hex / font literals bypassing tokens
Grep `#[0-9a-f]{3,8}` in `app|components` `*.css *.tsx`, excluding `var(--…)`:
**45 raw matches total**, but the overwhelming majority are the token *definitions*
themselves (`app/sbdaymaker_tokens.css`, ~40 lines — **EXPECTED**, that's the source of
truth). True offenders outside token/globals files:

| File:line | Value | Note |
| --- | --- | --- |
| `app/components.css:211` | `background: #2F6248;` | **Real token bypass** — "darkened forest" active `been` color, not a token. Comment at `:209` even documents it. Should be a `--…` var. |
| `app/opengraph-image.tsx:18,21,24,27` | `#F6F1E7`, `#16586A`, `#C0532E`, `#4A4038` | OG image (Satori) — Edge/Satori can't read CSS vars, so hardcoding is defensible, but values silently duplicate tokens and will drift if the palette changes. |
| `app/layout.tsx:64` | `themeColor: "#F6F1E7"` | PWA `themeColor` metadata — must be a literal string (can't be a var); acceptable but duplicates `--plaster`. |
| `#fff` / `#000` occurrences in `app/components.css` (~8, e.g. `:2734,2760,2770,4942,4982,4994`) | white/black on filled buttons | Minor; pure white/black, low drift risk. |

**Font literals** (non-token): `font-family: Georgia, serif;` at
`app/components.css:707, 825, 1975` — three hardcoded serif stacks that should reference
a token (there is no `--font-serif` token defined). `app/admin/review/cockpit.css:11`
uses `font-family: inherit` (fine). **Net: 1 clear color-token bypass
(`components.css:211`) + 3 hardcoded serif font stacks are the genuine violations;**
the rest are expected token defs or unavoidable metadata/OG literals.

---

## 2 · Accessibility Spot-Check (main screens)

Screens reviewed: Explore (`ExploreClient`, `Hero`, `CascadeFeed`), Saved
(`SavedClient`, `SavedCard`, `SavedToggle`), Discover/Plan, cards, sheets.

**Good:**
- Decorative images correctly `alt=""` + often `aria-hidden`: `Hero.tsx:70-73`
  (skyline `alt="" aria-hidden`), `Card.tsx:145-149`, `SavedCard.tsx:49/72`,
  `SavedClient.tsx:281` (all card thumbs `alt=""`). Every raw `<img>` flagged by grep
  turned out to have `alt` on a following line — **no missing-alt found.**
- Action buttons have descriptive `aria-label`s incl. the item title:
  `SavedCard.tsx:87` `aria-label={… `Mark ${thing.title} as been`}`, `:104` Share, `:113`
  Remove.
- `SavedToggle` uses `role="tablist"` + `role="tab"` + `aria-selected`
  (`SavedToggle.tsx:22-45`).
- Live regions: `aria-live="polite"` on status line (`SavedClient.tsx:262`) and the
  been-ack toast (`role="status" aria-live="polite"`, near `:420`).
- Touch targets: `--tap-min` token used; explicit `min-height: 44px` at
  `components.css:168,1283`, `48px` add-stop slot `:2040`, hit-area extension comments
  `:711,1962`. Toggle/`been` controls appear to meet 44px.
- Reduced motion honored in 13 blocks (`tokens.css:140`, `components.css:220,1844,…`).

**Gaps / flags:**
1. **Hero "pick" CTA text may be icon/label-thin** — hero heart uses `SaveHeart`
   (`Hero.tsx:89-95`); verify `SaveHeart` exposes an `aria-label`/pressed state (it
   takes `title` but confirm it renders an accessible name).
2. **SavedCard Share (`↗`) / Remove (`✕`) rely on `data-tooltip`** for sighted hover
   text (`SavedCard.tsx:104,113`) but do carry `aria-label` — OK for SR, but the glyph
   `✕`/`↗`/`✓` icons are `aria-hidden`-adjacent; confirm the visible glyph isn't the
   only affordance for low-vision users at small sizes.
3. **C2 prompt buttons** ("✓ Yes, I went" / "Not this time", `SavedClient.tsx:285-300`)
   have text labels — good — but the prompt card itself is not a landmark/region and has
   no heading; SR users get it inline with no announced context change.
4. **`been` active color `#2F6248`** (`components.css:211`) is documented as ~6:1 AA in
   the comment, but because it is hardcoded (not a token with a tracked ratio) it can
   silently drift below AA on future palette edits.
5. **Group-dot colors** are inline `style={{ background: g.dot }}`
   (`SavedClient.tsx:322`, `:394` uses `var(--ink-2)`) — decorative, `role="presentation"`
   is applied to the rule but the dot itself has no `aria-hidden`; minor.
6. **Focus management on sheets** — `BottomSheet`, `NearMeSheet`, `TuneSheet`,
   `ShareBar` are client components; audit did not confirm focus-trap / focus-return on
   open/close. Flag for manual keyboard testing (WCAG 2.2 2.4.11/2.4.3).
7. **Contrast of chips/eyebrows** on tinted media backgrounds (`sbd-media--gold`,
   hero pick over baked skyline) not measured; verify text-on-image contrast.

Overall: strong ARIA/alt hygiene; the open risks are **sheet focus handling** and the
**hardcoded `been` color** slipping AA.

---

## 3 · `next build` Result & Route Table

`npx next build` — **SUCCEEDED.** Compiled in ~2.0s, TypeScript clean in ~2.6s, 14/14
static pages generated. No errors, no type failures.

> **Important caveat:** Next 16 / Turbopack's build output for this project prints a
> **Revalidate / Expire** table, **not** the classic "First Load JS (kB) per route"
> column. So a per-route bundle-size table is **not available from the build output** in
> this repo/version — reporting it would be fabrication. What the build does emit:

```
Route (app)                    Revalidate  Expire
┌ ƒ /                          (dynamic)
├ ○ /_not-found
├ ƒ /admin/catalog · coverage · heroes · review
├ ƒ /api/admin/* (catalog, catalog/delete, catalog/edit, coverage, coverage/cell,
│                 hero-eligible, hero-pins, restock, restock/list)
├ ƒ /api/cron/nightly · /api/cron/reaper
├ ƒ /api/review/{approve,image-fetch,queue,reject,update}
├ ƒ /api/subscribe
├ ƒ /cockpit          ○ /cockpit/login
├ ƒ /confirm
├ ○ /discover  (10m/1y)      ├ ƒ /discover/[id]
├ ○ /manifest.webmanifest    ├ ○ /offline    ├ ○ /opengraph-image
├ ƒ /p/[token]
├ ○ /plan   (10m/1y)
├ ƒ /r/[token]               ├ ○ /robots.txt
├ ƒ /s/[token]
├ ○ /saved  (10m/1y)
├ ○ /sitemap.xml             ├ ○ /submit
├ ƒ /thing/[id]              └ ƒ /unsubscribe
ƒ Proxy (Middleware)
○ (Static) prerendered · ƒ (Dynamic) server-rendered on demand
```

**Client-component load (`"use client"`):** 48 files under `app|components`. The public
Explore/Saved/Plan trees are heavily client-side (`ExploreClient`, `SavedClient`,
`PlanClient`, all sheets, both providers). This is appropriate — they own localStorage
saves, geolocation, and interactive sheets, which need the client. **Potential
server-component candidates** worth a second look (mostly presentational, little/no
state): `components/ui/SectionHeader.tsx`, `components/plan/PlanHeader.tsx`,
`components/saved/SavedToggle.tsx` (pure props → could be RSC if not passed callbacks
across an RSC boundary). Not urgent; no oversized-bundle evidence available from this
build output.

---

## 4 · TODO / FIXME / HACK Inventory

Grep `TODO|FIXME|HACK|XXX|@ts-ignore|@ts-expect-error` across `app components lib ingest`
(`.ts`/`.tsx`): **zero matches.** The codebase carries no in-source TODO/FIXME/HACK
markers, no `@ts-ignore`, and no `@ts-expect-error`. Clean on this axis.

(Deferred work is instead tracked in the user's memory notes — e.g. Cockpit v2 "Run now"
deferred pending `GITHUB_DISPATCH_TOKEN` — not in code comments.)

---

## 5 · Duplication, Dead Code, Inconsistent Patterns, Missing States

**Duplication / dead code:**
1. **`components/saved/MemoryRecap 2.tsx`** — a stray duplicate of `MemoryRecap.tsx`
   (note the literal `" 2"` in the filename, a Finder/editor copy artifact). Dead file;
   `SavedClient.tsx:19` imports the canonical `./MemoryRecap`. Should be deleted.
2. **Two live enrich implementations:** `lib/enrich.ts` (+ `lib/pipeline.ts`,
   `runNightly`) is the *retired* nightly pipeline, still wired into the cockpit server
   action `runPipeline` (`app/cockpit/actions.ts:7,43`), while `ingest/enrich.ts` +
   `ingest/run.ts` is the *current* GitHub-Action worker. Two copies of the batch-AI
   enrich prompt/model risk drifting apart. `app/api/cron/nightly/route.ts` is already a
   deprecated no-op acknowledging the split (`:5-9`). Consolidate or remove the legacy
   path.
3. **Duplicated palette values** across `opengraph-image.tsx`, `layout.tsx`, and
   `components.css:211` re-state token hexes by hand (see §1 C-extra) — a soft
   duplication that will drift.

**Inconsistent patterns:**
- `viewItems`/`beenItems`/`mainItems`/`pastItems` memos in `SavedClient.tsx` all use
  `// eslint-disable-next-line react-hooks/exhaustive-deps` and deliberately omit the
  `state`/`saves` dependency (`SavedClient.tsx:86-114`). This is the root of the
  been-marking regression (see §6) and is an anti-pattern that recurs 4× in one file.

**Missing / thin error & empty states:**
- Empty states exist and are used in 8 files (`EmptyState`): Saved 0-total
  (`SavedClient.tsx:222`), want-empty (`:307`), CascadeFeed clear-filters, etc. Good.
- **Hero has no empty/fallback content** when the view is filtered to nothing
  (`Hero.tsx:83` → renders nothing). This is both the C5 drift and a missing-state bug.
- **`makeLinkAndShare` / `createSharedList` failure** shows a toast ("Couldn't create a
  link", `SavedClient.tsx`) — good — but network errors on `subscribe`
  (`app/api/subscribe/route.ts:24,26`) surface only a generic `"subscribe failed"` 500;
  the client `EmailSignup` should be checked for how it renders that.
- Ghost-save cleanup effect (`SavedClient.tsx:75-83`) silently `remove()`s saves when
  `things.length` is in `(0, 1000)` — an unusual guard (`>= 1000` skips cleanup) that
  could **wrongly purge** saves if the data pool is ever partially loaded; flag as
  fragile (`SavedClient.tsx:76`).

---

## 6 · The Been-Marking Implementation — End-to-End Trace & Known Regression

**State model.** `SaveState = "want" | "been"` stored in one map in
`SavesProvider.tsx` (`sbd.saves.v1`). `setState(id, s)` writes a value
(`SavesProvider.tsx:66-68`); `toggle` only cycles none↔want; `remove` deletes.
`counts` derives `want`/`been` by scanning values (`:98-100`). `ids` = `Object.keys(saves)`.

**Write path (want → been).** Three entry points, all funnel through
`SavedClient.handleSetState` (`SavedClient.tsx:157-163`):
1. Per-card "✓ Mark been" button → `SavedCard.tsx:88-92`
   `onSetState(state === "been" ? "want" : "been")` → `SavedClient` `onSetState={(s)=>handleSetState(t.id,s)}` (`:335`, `:410`).
2. C2 "Did you make it?" prompt → "✓ Yes, I went" → `handleSetState(c2Item.id,"been")`
   then `dismissC2` (`SavedClient.tsx:288-292`).
3. `handleSetState` calls `setState(id,newState)` and, on a fresh flip to `been`, fires
   the ack toast `setBeenAck(counts.been + 1)` (`:159-162`).

**Read path.** The Want/Been toggle (`SavedToggle`) drives `stateFilter`
(`SavedClient.tsx:52`, `:238-243`). The visible list is `viewItems`:
```
const viewItems = useMemo(() => {
  const inView = things.filter(
    (t) => savedSet.has(t.id) && (state(t.id) ?? "want") === stateFilter,
  );
  return nearMeSort(inView, zone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [things, savedSet, stateFilter, zone]);        // ← SavedClient.tsx:84-89
```

### THE KNOWN REGRESSION — exact location & mechanism

**File:line:** `components/saved/SavedClient.tsx:84-89` (and the sibling memos at
`:96-114` for `mainItems`/`pastItems`, and `beenItems` at `:116-125`).

**Mechanism — stale memo on a value-only flip:**
1. `viewItems` reads the current state via `state(t.id)` (a closure over the provider's
   `saves` map) **inside the memo body**, but its **dependency array is
   `[things, savedSet, stateFilter, zone]`** — with `state`/`saves` **deliberately
   excluded** via the `eslint-disable exhaustive-deps` on `:88`.
2. `savedSet = new Set(ids)` where `ids = Object.keys(saves)` (`SavesProvider.tsx:96`).
   When a user flips a save **want → been**, only the *value* changes — **the set of
   keys is identical.** `ids` therefore does not change membership, and `savedSet`'s
   `useMemo(() => new Set(ids), [ids])` (`SavedClient.tsx:73`) recomputes to an equal set
   but is compared by React only via the `ids` array identity.
3. Because none of `things`, `savedSet`, `stateFilter`, `zone` are considered "changed"
   by the memo (the flip touched none of them), **`viewItems` returns the previously
   cached array.** The just-marked-"been" item **stays visible in the "Want to go"
   filter** (and does not appear when the user switches to "Been" until some *other*
   dependency changes and forces a recompute).
4. The counts chip and the ack toast **do** update (they read `counts` directly from the
   provider, `SavedToggle` gets `wantCount`/`beenCount` live), so the user sees the Been
   count increment while the item paradoxically remains under "Want" — a classic
   stale-view regression. The same defect afflicts `mainItems`/`pastItems` (`:96-114`,
   deps `[viewItems, splitPast]`) and `beenItems` (`:116-125`, deps `[things, ids]` — and
   `ids` again does not change on a value-only flip, so the Memory recap / Been list can
   lag too).

**Root cause in one sentence:** the Saved-view memos derive from save **values** but
depend only on save **keys** (`ids`/`savedSet`) — so a `want→been` flip, which mutates a
value without adding/removing a key, does not invalidate the memo, and the list renders
stale. The `eslint-disable-next-line react-hooks/exhaustive-deps` comments on
`SavedClient.tsx:88, 100, 106, 113, 123` are precisely what suppress the warning that
would have caught this.

*(Not fixed — audit only. The fix would be to include a value-sensitive dependency, e.g.
the raw `saves` map or `asMap()`/a version counter, in these memos' dep arrays.)*

---

## 7 · Operator Surprises vs. the Spec Docs

1. **No analytics are installed — despite the spec implying usage instrumentation.**
   Grep for `@vercel/analytics | track( | gtag | plausible | posthog | mixpanel` across
   `app lib components`: **zero matches.** `package.json` contains **no** analytics /
   PostHog / Plausible / Sentry dependency at all. If CLAUDE.md §4 claims analytics or
   event tracking, **it is not wired** — the operator will get **no usage/error
   telemetry** in production. This is the single biggest "looks done, isn't" surprise.
2. **The nightly cron endpoint is a no-op stub.** `app/api/cron/nightly/route.ts`
   returns `{deprecated:true}` and does nothing — anyone assuming the in-app cron still
   runs ingestion is wrong; ingestion lives in the **GitHub Action worker**
   (`ingest/run.ts`), outside Vercel. Two enrich codebases coexist (§5).
3. **Hero can go content-blank under filtering**, contradicting the "hero never blank /
   evergreen fallback" promise (§1 C5, §5). There is no hand-written evergreen asset in
   code.
4. **A stray duplicate file** `components/saved/MemoryRecap 2.tsx` is committed
   (§5) — harmless but a code-hygiene smell an operator wouldn't expect.
5. **Been-marking is subtly broken** (§6) — the feature *appears* implemented and
   passes a glance, but the view goes stale on flip. An operator demoing "Mark been"
   would see the item stubbornly stay under "Want."
6. **Ghost-save purge guard** (`SavedClient.tsx:76`, `things.length >= 1000` skip) is an
   unexplained magic number that could delete a user's saves if the data pool loads
   partially.
7. **`@anthropic-ai/sdk` is a runtime dependency**, and the SDK *is* import-reachable
   from an authenticated server action (`runPipeline`). It is admin-gated and batch (so
   not a §C3 violation), but an operator scanning the dep tree for "no per-request AI"
   should know the SDK ships in the deployed bundle graph, not only in the worker.

---

### Audit summary (top-line)

- **7 of 8 constraints PASS**; C5 (hero-never-blank) is a **partial VIOLATION / drift**;
  C3 passes with an important *nuance* (admin-gated batch AI is reachable from a server
  action, and a legacy duplicate AI pipeline still exists).
- **Trust rule (C8) is solid** — the ranker is verifiably sponsor-blind.
- **`next build` succeeds**; no per-route First-Load-JS table exists in Next 16/Turbopack
  output for this repo.
- **Most serious findings:** (1) the **been-marking stale-memo regression** at
  `SavedClient.tsx:84-89`; (2) **no analytics/telemetry installed** despite spec
  expectations; (3) **hero content can go blank** with no evergreen fallback
  (`Hero.tsx:83`, `ExploreClient.tsx:60`).
