# Wave 1 Build Spec — Stop the Bleeding

`Doc W1 · 2026-07-03 · self-contained Claude Code kickoff · written against commit caa7302 + live-DB snapshot + platform assessment Doc 18`

---

## What this is

Four surgical fixes to the live SB Daymaker platform, identified by a full as-built audit. Each fix repairs a broken promise or removes blindness; none adds features, infrastructure, dependencies (beyond one analytics package), or daily operator load.

| Phase | Fix | Why it's Wave 1 |
|---|---|---|
| **W1.1** | Been-marking stale-memo regression | The keystone input to the memory moat is broken in production |
| **W1.2** | Vercel Web Analytics + 7 custom events | The app ships with zero telemetry; WAU is the north star and nothing computes it |
| **W1.3** | Explore correctness: day-aware Tier-2 on Today + hero never-blank fallback | Two visible trust breaks on the front page (a Sunday market on a Thursday; a hero that can vanish) |
| **W1.4** | Email the save-restore magic link | The magic-link backup is half-built; the link is shown to copy, never sent |

**Work one phase at a time, in order. After each phase: run the verification steps, then STOP and show me what changed and what to test. Do not start the next phase until I say go.**

---

## §0 · Ground rules for this session

1. **Read `CLAUDE.md` first** (repo root / `Core Project Files/`). Its eight load-bearing constraints govern every line here. Where this spec references file paths or line numbers, they were accurate at commit `caa7302` — **reconcile against the live repo before editing** (the working tree had uncommitted changes to `CatalogView.tsx`, `cockpit.css`, `catalog/edit/route.ts`, `lib/catalogServer.ts`, `lib/review.ts` at snapshot time; do not clobber them).
2. **Code is truth.** If the code differs from what this spec describes, investigate before changing; if the difference is material, stop and tell me.
3. **No schema changes.** Wave 1 requires **zero DDL**. If you believe a fix needs a migration, stop and flag it — that's a signal you've drifted from this spec.
4. **Determinism is sacred.** No AI calls anywhere in these changes (constraint C3). No new randomness in ranking — the one "rotation" in W1.3 is seeded by the SB calendar date, which is deterministic per day.
5. **The trust rule is untouchable.** Nothing in this wave touches `cascade()`'s sort keys or reads `is_featured`/`sponsor_id`. If a change would, stop.
6. **Tokens only.** No new hex values, no hardcoded fonts. Any new UI text follows the knowing-local-friend voice: warm, specific, never apologizing vaguely.
7. **Accessibility floor:** any new interactive element gets a visible `:focus-visible` ring, ≥44×44 target, and a meaningful `aria-label`; any new status message uses `aria-live="polite"`; new animation (there shouldn't be any) honors `prefers-reduced-motion`.
8. **PII boundaries:** the only end-user PII that may leave the device is the user's own email in the existing subscribe + save-restore flows. **Analytics events must never carry an email, a token, or free-text user input.**
9. **Run everything yourself** — dev server, tests, build. Never ask Jim to run a command.
10. **Verify before declaring done:** `npm run test` green, `npx next build` clean, dev-server console clean on the touched screens, checked at **~390px and ~1280px** widths.
11. **Ledger:** at the end of the wave, append one entry per phase to `Core Project Files/14_SBDaymaker_Build_Deltas.md` (newest-first format already established there).

**Explicitly OUT of scope for this wave (do not do these even if you notice them):** deleting orphan files, retiring `lib/pipeline.ts`/`lib/enrich.ts`, unifying the two HTML fetchers, the `sbd.itineraries.v1` two-shape collision, RLS on migration-added tables, migration-tree consolidation, the middleware matcher, editorial-weight ranking, tag backfill, image variety, Discover guides, the edition builder, past-event archival, closure detection. All are later waves. Touch nothing beyond the four phases below.

---

## §1 · Human pre-steps (Jim does these; Claude Code just verifies)

Two things only a human with dashboard access can do. **Claude Code: at the start of the session, check whether these are done (see verification notes) and proceed regardless — the code must degrade gracefully either way.**

1. **Enable Web Analytics on the Vercel project.** Vercel dashboard → sbdaymaker project → Analytics tab → Enable. (No code effect if missed — events just won't record; the `<Analytics />` component is inert without it.)
2. **Verify `sbdaymaker.com` as a sending domain in Resend**, then set `RESEND_FROM` to something like `SB Daymaker <hello@sbdaymaker.com>` in **both** Vercel project env vars **and** the GitHub Action secrets (the nightly digest uses it too). Until this is done, `lib/email.ts` falls back to the `onboarding@resend.dev` sandbox sender — W1.4 must work correctly in both states.

---

## PHASE W1.1 — Fix the been-marking regression

### The defect (exact, verified)

`components/saved/SavedClient.tsx`. Five memos derive the visible lists from save **values** but list only save **keys** in their dependency arrays, with `react-hooks/exhaustive-deps` disabled on each:

- `viewItems` (≈`:84-89`): body calls `state(t.id)` (closure over the provider's `saves` map); deps are `[things, savedSet, stateFilter, zone]`.
- `mainItems` / `pastItems` (≈`:96-114`): derive from `viewItems` — inherit the staleness.
- `beenItems` (≈`:116-125`): deps `[things, ids]`.

`savedSet` is `useMemo(() => new Set(ids), [ids])` and `ids = Object.keys(saves)` from `SavesProvider`. A `want→been` flip changes a **value**, not a key: `ids` keeps its membership, none of the listed deps change, and every memo serves its cached array. Result in production: the user taps "✓ Mark been," the Been **count** increments (counts read the provider live), but the item stays pinned under "Want to go," and the Been tab / MemoryRecap lag until an unrelated dep changes. The five `eslint-disable-next-line react-hooks/exhaustive-deps` comments (≈ lines 88, 100, 106, 113, 123) are what suppressed the warning that would have caught this.

### The fix — restructure so staleness is impossible, not just patched

Do this in three steps. The goal is not merely adding a dep; it's making the derivation **pure and testable** so this class of bug can't silently return.

**Step 1 — expose the value-bearing map cleanly.** In `components/saves/SavesProvider.tsx`, the provider already holds the `saves` object in React state (a fresh reference on every change — verify this; if any code path mutates it in place, fix that to immutable updates). Expose the raw map on the context (if `asMap()` already returns it referentially-stable per version, that's fine — but expose the object itself, e.g. `saves`, not a function, so it can sit in dependency arrays directly).

**Step 2 — extract pure selectors.** Create `lib/savedView.ts` with pure functions that take the map as an explicit argument (no closures over context):

```ts
export type SavesMap = Record<string, "want" | "been">;

export function filterByState(things: Thing[], saves: SavesMap, state: "want" | "been"): Thing[]
export function splitPast(items: Thing[], nowMs: number): { current: Thing[]; past: Thing[] }
export function beenList(things: Thing[], saves: SavesMap): Thing[]
```

Move the existing memo-body logic into these verbatim (including the `(state(t.id) ?? "want")` default and the existing past-event predicate) — this is a **restructure, not a behavior change**, except that the output now tracks the map.

**Step 3 — rewire the memos.** In `SavedClient.tsx`, each memo calls the pure selector and lists `saves` (the map) in its deps alongside its other inputs. **Delete all five `eslint-disable` comments.** Confirm `npm run lint` passes with `exhaustive-deps` active on this file. Check the same pattern anywhere else `state(...)` is read inside a memo/callback with keys-only deps (grep the file; also glance at `MemoryRecap.tsx` — it receives `beenItems` as props per the audit, so it should heal automatically, but verify it doesn't independently read provider state inside a stale memo).

**Do not change** the save state machine itself: `toggle` still cycles none↔want; `been` is still set only via `setState`; the C2 "Did you make it?" card, its `sbd_c2_dismissed` persistence, and the been-ack toast all keep their current behavior (they should simply start reflecting reality immediately).

### Tests (required — this is the regression that slipped through)

The repo's vitest setup covers pure functions only (no React Testing Library — **do not add it**; the pure-selector extraction exists precisely so we can test without it). Add `lib/savedView.test.ts`:

1. **The flip scenario (the bug):** given 3 things and `{a:"want", b:"want", c:"been"}`, `filterByState(..., "want")` returns a,b. Flip b to "been" in a **new** map object; assert "want" now returns only a and "been" returns b,c. (This encodes value-sensitivity as a contract.)
2. `filterByState` treats a missing entry as excluded and an explicit `"want"` as want (preserving the `?? "want"` default semantics for saved ids).
3. `splitPast` boundary: a dated event with `starts_at` earlier today vs. later today vs. yesterday, against a fixed `nowMs` (respect the existing SB-day semantics if the current code uses `sbDay`; mirror whatever predicate you moved).
4. `beenList` returns only been-state things present in the pool.

### Acceptance checklist (stop-and-show after these pass)

- [ ] On `/`, save two things. On `/saved`, tap "✓ Mark been" on one → it **disappears from Want immediately** and appears under Been immediately; counts match; ack toast fires once.
- [ ] The C2 "Did you make it?" card's "Yes, I went" does the same, and the card dismisses.
- [ ] MemoryRecap (Been view) includes the new item without a reload.
- [ ] Flip back been→want via the card control → item returns to Want immediately.
- [ ] Zero `eslint-disable`/`exhaustive-deps` suppressions remain in `SavedClient.tsx`; `npm run lint` clean.
- [ ] `npm run test` green including the new suite; `npx next build` clean.
- [ ] Behavior verified at ~390px and ~1280px; console clean.

---

## PHASE W1.2 — Install analytics + the seven events

### Install

- `npm install @vercel/analytics` (the **only** new dependency in this wave).
- In `app/layout.tsx`, render `<Analytics />` (from `@vercel/analytics/react`) once, inside `<body>`, alongside the existing providers. Nothing else in the root layout changes.
- Vercel Web Analytics is cookieless — **no consent banner** is added, matching the low-PII posture. If the dashboard toggle (§1.1) isn't on yet, the component is inert; ship anyway.

### Custom events — exactly these seven, nothing more

Use `track(name, props)` from `@vercel/analytics`. **Props policy:** thing ids (uuids), occasion-tag keys, small enums, and counts are allowed. **Never** an email, a share/restore token, free-text input, or a URL containing a token.

| # | Event name | Fire where | Props |
|---|---|---|---|
| 1 | `save_add` | The save action's single funnel point — find where the heart toggle commits a **new** save (SavesProvider `toggle` entering "want", or the call sites: `SaveHeart` consumers, `DetailSaveButton`, hero heart, `CardActions`). Prefer instrumenting **inside the provider** (`toggle` when result is a fresh "want", `saveMany` once with a count) so every surface is covered by one seam. Do not fire on un-save. | `{ thingId }` (or `{ count }` for `saveMany`) |
| 2 | `save_been` | Provider `setState` when the new state is `"been"` and the previous wasn't | `{ thingId }` |
| 3 | `share_create` | `SavedClient` after `createSharedList` succeeds; `PlanResults` after `createSharedPlan` succeeds; single-card share | `{ kind: "list" \| "plan" \| "single", count }` — **never the token** |
| 4 | `share_open` | Client-side on mount of the shared views (`SharedListView` / `SharedPlanView` — these are client components; a `useEffect` on mount is fine) | `{ kind, count }` — never the token |
| 5 | `lens_select` | `TuneSheet`/`ExploreClient` where the lens is set to a non-null tag | `{ tag }` (occasion key) |
| 6 | `plan_built` | `PlanClient`/`PlanResults` at the moment a draft spine is first produced from the questionnaire | `{ stops }` (count) |
| 7 | `subscribe_submit` | `EmailSignup` on a successful `POST /api/subscribe` (`ok:true`) | `{ status: "pending" \| "already" }` — **no email** |

Implementation notes:
- All fire points are client components already (`"use client"` throughout these trees) — no server-side `track` needed in this wave.
- Wrap calls so a missing/blocked analytics script can never throw into app code (the SDK is already safe, but don't let an import cycle or SSR path touch it — import only in client files).
- Where the provider is the seam (events 1–2), keep the provider free of UI concerns: a two-line `track` call is fine; do not add config plumbing.

### Acceptance checklist (stop-and-show)

- [ ] `<Analytics />` present once in the root layout; no hydration warnings.
- [ ] In dev, perform each of the seven actions and show me the seven `track` calls firing (console/network evidence is fine — dev mode logs debug output).
- [ ] Grep proof that no event payload can contain `email`, `token`, or user free-text.
- [ ] `npx next build` clean; bundle unaffected beyond the analytics package.
- [ ] One-line note in the stop-and-show telling me whether the Vercel dashboard toggle (§1.1) was already on.

---

## PHASE W1.3 — Explore correctness: day-aware Tier-2 + hero never-blank

Two related fixes to the front page. Both live in `lib/explore.ts` + `components/explore/` and change **filtering and fallback**, never the cascade's sort keys.

### W1.3a — Day-aware Tier-2 on the Today horizon

**Current behavior:** `withinHorizon` (lib/explore.ts) returns `true` for every Tier-2/3 item on every horizon. On the live site, a Thursday "Today" view lists the Sunday-only Camino Real farmers market and Wednesday-only Nite Moves under the recurring section.

**Required behavior:** on `horizon === "today"` **only**, a Tier-2 thing passes iff at least one of its `recurring_schedules` rows has `day_of_week === today's SB day-of-week`. Week and Month horizons keep the current pass-all behavior. Tier-3 is untouched on all horizons.

Implementation guidance:
- The schedule rows already ride along: `THINGS_SELECT` (lib/things.ts) joins `recurring_schedules`, and the `Thing` type carries them. **Verify the field name/shape in `lib/things.ts` before writing code.**
- Compute today's day-of-week **in SB time** using the same `sbDay`/America-Los_Angeles convention the file already uses for Tier-1 horizon math — derive the weekday from the SB calendar date, not the browser's local `Date.getDay()` (a late-night user in another timezone must see SB's day). A small helper `sbDayOfWeek(nowMs): number` next to `sbDay` is the right shape.
- **Edge cases, decided now so you don't have to guess:**
  - A Tier-2 thing with **zero** schedule rows: **passes** on Today (we can't prove it's off-day; excluding it risks hiding valid content). Do not invent a schedule.
  - `frequency = biweekly | monthly`: day-of-week match is a deliberate approximation — a "1st Thursday" item will show on every Thursday. **Accept this for V1**; do NOT port the cockpit's `lib/occurrences.ts` expansion into the feed (that math is approximate too, and the feed must stay cheap and deterministic). Leave a one-line code comment noting the approximation, mirroring the existing feed-vs-coverage divergence note.
  - A thing whose only matching schedule has already **ended** today (e.g. a morning-only market viewed at 9 PM): keep it visible for V1 (time-of-day pruning is out of scope; the card copy shows the rhythm).
- **Happy-hour things** (`type='happyhour'`, driven by `happy_hour_windows`, currently 0 rows in the live DB): apply the same day rule against `happy_hour_windows.day_of_week` if the type is tier-2 and windows exist; with zero rows live this is future-proofing — keep it to a few lines.
- Section labels: keep the established tier section titles as-is. Do **not** rename sections in this phase; the day filter alone resolves the mismatch.
- This is a pure change in `lib/explore.ts` — extend the existing `withinHorizon` (or add a sibling `tier2OccursToday`) and cover it with unit tests in the same style as `lib/coverage.test.ts`.

**Tests (vitest, pure):** a Tier-2 thing with a Thursday schedule passes on a Thursday `nowMs` and fails on a Friday `nowMs`; passes on `week` regardless; a schedule-less Tier-2 passes on Today; Tier-1/Tier-3 behavior unchanged (regression assertions); the SB-timezone boundary (a `nowMs` that is Friday 01:00 UTC but Thursday evening in SB counts as Thursday).

### W1.3b — Hero never-blank fallback (constraint C5)

**Current behavior:** `ExploreClient.tsx` hero memo → pinned pick if it survives filters, else `ordered[0] ?? null`; `Hero.tsx:~83` renders `{pick ? (…) : null}`. Filter Today to an empty lens+zone combination and the marquee content vanishes — a direct violation of CLAUDE.md §2.5.

**Required behavior — a two-layer deterministic fallback:**

1. **Layer 1 — evergreen from the pool.** When `ordered` is empty, pick a Tier-3 thing from the **full unfiltered `things` prop** (published pool), deterministically rotated by SB date: sort candidate Tier-3 things by `id` (stable), index by `dayOfYear(sbDate) % candidates.length`. Same user, same day → same fallback; tomorrow → a different one. No AI, no randomness at render.
2. **Layer 2 — hand-written static card.** If the pool contains zero Tier-3 things (or zero things at all — cold DB, fetch failure upstream), render a single hardcoded evergreen hero: title **"The Courthouse clock tower"**, line **"The best free view in town — hand-painted ceilings on the way up, the whole city and the sea at the top."**, CTA linking to `/discover`. Hardcode it as a constant in the component (it's the parachute, not content); use existing card dress and tokens.

Presentation for the Layer-1 fallback state (filters active but nothing matched): render the hero pick as normal, plus a small line above/inside the pick block in the local-friend voice: **"Nothing matches that exactly today — but this is always worth it."** Style with existing tokens/typography (reuse an existing eyebrow/subline class; add a minimal `components.css` rule only if none fits, tokens only). The line must not appear when the hero is a normal ranked/pinned pick.

Interaction with the rest of the page:
- `feed = ordered.filter(t => t.id !== hero.id)` — when the hero is a fallback (not a member of `ordered`), the feed is simply the empty `ordered`, and `CascadeFeed`'s existing clear-filters `EmptyState` shows below. Verify that empty state renders and its clear-filters action works; the combination (fallback hero + inviting empty state) is the designed experience.
- The founder pin path is untouched: a valid pin still wins; a pin filtered out of view still falls through exactly as today, now landing on the fallback instead of null.
- The save heart on a fallback hero works normally (it's a real thing in Layer 1). Layer 2's static card renders **no** save heart (it isn't a DB row) — CTA only.
- Type note: `hero` can no longer be `null` in the common path; adjust types so `Hero`'s `pick` prop reflects reality (Layer 2 may be a distinct minimal shape or a narrow union — keep it simple and typed, no `any`).

**Tests:** pure helper for the deterministic rotation (`pickEvergreenFallback(things, sbDateKey)` in `lib/explore.ts`): same date+pool → same pick; different date → rotates; empty Tier-3 pool → null (signals Layer 2); non-Tier-3 things never selected.

### Acceptance checklist (stop-and-show)

- [ ] On Today, the recurring section shows **only** things with a schedule matching today's SB weekday (plus schedule-less Tier-2); on Week/Month the full recurring set returns.
- [ ] Manual check against the live data: on a Thursday, Camino Real (Sunday) and Nite Moves (Wednesday) are absent from Today and present on Week.
- [ ] Apply a lens+zone combo that empties the view → hero shows an evergreen with the "Nothing matches that exactly" line; feed shows the clear-filters empty state; clearing filters restores the normal hero and the line disappears.
- [ ] Same filters, same day, refresh → same fallback pick (determinism).
- [ ] Normal unfiltered load is pixel-identical to before (no layout shift, no new line).
- [ ] Hero pin still wins when valid (verify via the cockpit hero plan or the existing pinned row).
- [ ] New unit tests green; `npm run test` + `npx next build` clean; ~390px and ~1280px verified; console clean.

---

## PHASE W1.4 — Email the save-restore magic link

### Current behavior

`components/saved/RestorePanel.tsx` (client) calls `createSaveRestore(email, saves)` (lib/shares.ts → RPC `create_save_restore`) and **displays** `${origin}/r/${token}` to copy; its own copy admits emailing "arrives in a later step." `lib/email.ts` (`sendEmail`) exists, is server-only, returns `false` (never throws) when Resend is unconfigured.

### Required behavior

The panel emails the link to the address the user entered, with the on-screen link retained as fallback. Since `sendEmail` needs `RESEND_API_KEY` server-side, introduce one small API route:

**`POST /api/restore-link`** (new file: `app/api/restore-link/route.ts`, `dynamic="force-dynamic"`):
- Body: `{ email: string, saves: Record<string, "want" | "been"> }`.
- Validate: `email` is a string containing `@` (mirror `/api/subscribe`'s posture); `saves` is a plain object with ≤ **500** entries whose values are exactly `"want" | "been"` (reject otherwise, 400) — this bounds payload abuse.
- Server-side, call the existing RPC via the **anon** client (`getSupabase()` — the RPC is SECURITY DEFINER and granted to anon; do **not** use the service-role client for an end-user action).
- Build `link = ${NEXT_PUBLIC_SITE_URL or request origin}/r/${token}`.
- `sendEmail(email, subject, html)` — subject: `Your SB Daymaker saved list`; body: short, in-voice ("Your saves, safe and sound. Open this link on any device to bring them back."), one button-style link, and a plain-URL fallback line. Reuse the inline-HTML style already used by the digest/subscribe emails; tokens-adjacent colors are fine as inline hex **only inside email HTML** (email clients can't read CSS vars — mirror how `/api/subscribe`'s email is built).
- Respond `{ ok: true, token, sent: boolean }` — `sent:false` when Resend is unconfigured/failed. **Never log the email or the token.**

**RestorePanel changes:** submit → POST the new route; on `{sent:true}` show "Check your inbox — we sent your restore link." with the link also shown beneath ("or copy it now"); on `{sent:false}` keep today's copy-the-link experience with a soft line ("Email isn't set up yet — copy your link instead."). Remove the "arrives in a later step" copy and the stale "Phase 7" comment. Status messages use `aria-live="polite"`; error state keeps the local-friend voice.

**PII discipline:** the email goes route → RPC (existing allowed boundary) and to Resend as the recipient; it is not written anywhere new, not logged, not tracked (no analytics event carries it — do **not** add a `restore_link` event in this wave).

**Known accepted exposure (do not "fix" in this wave):** like `/api/subscribe`, this public route can be made to send an email to an arbitrary address. Content is fixed and non-sensitive; rate limiting for both routes is a Wave-4 hardening item. Add a one-line comment in the route pointing at that.

### Acceptance checklist (stop-and-show)

- [ ] With Resend configured (or in whatever state §1.2 is in): panel submit → success message; email arrives with a working `/r/[token]` link (if the domain isn't verified yet, demonstrate the `sent:false` graceful path instead and say so).
- [ ] `/r/[token]` restore still works end-to-end (merge semantics unchanged: incoming wins).
- [ ] Malformed body / >500 saves / bad values → 400; empty email → 400.
- [ ] No email or token appears in any server log line you added.
- [ ] `npx next build` clean; panel verified at ~390px.

---

## §2 · Wave close-out (after W1.4 is approved)

1. Append four entries to `Core Project Files/14_SBDaymaker_Build_Deltas.md` (newest-first), one per phase, each with: what changed, why (one line), and any approximation deliberately accepted (the biweekly/monthly day-match; the fallback's static Layer-2 card; the unratelimited restore route).
2. Full final verification: `npm run lint` (with `exhaustive-deps` live on SavedClient), `npm run test`, `npx next build`, dev-server click-through of Explore → Saved → been-flip → share → restore at ~390px.
3. Deliver a single summary: files touched (grouped by phase), tests added, the two human-step statuses (§1), and anything you observed that belongs in a later wave (note it — don't fix it).

*End of Wave 1 spec.*
