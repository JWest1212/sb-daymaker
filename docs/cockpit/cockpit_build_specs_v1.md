# SB Daymaker Cockpit · Build Specs for Claude Code
Version 1.0 · from the approved Phase 3 mockups (r1-r4) · target repo state: commit b9e1b17 or later
Hand one wave at a time to Claude Code. Do not start a wave until the prior wave's final gate is approved by Jim in the browser.

---

## Standing rules for every wave (paste these with each wave)

1. **Stop-and-show gates are hard.** At each gate, stop, summarize what changed and how Jim tests it in the browser, and wait. Never continue past a gate on your own.
2. **Change-safety map governs.** docs/cockpit/11-change-safety.md lists load-bearing behavior per screen. Anything on a load-bearing list keeps its behavior exactly; restyle only. If a task appears to require altering a load-bearing item, stop and flag instead of proceeding.
3. **Live DB is ahead of the repo.** Never assume a column exists or is absent from schema.sql alone (docs/cockpit/06-data-architecture.md 7.2). If a task touches content_flags, enrich_directives, things.no_venue_ack, things.slug, or url_redirects, verify shape by querying, not by reading SQL files.
4. **No DDL is executed by you, ever.** If a change would need DDL, write the additive-only SQL into the wave's notes for Jim to paste into the Supabase SQL editor, and build the code to tolerate the column's absence until he does.
5. **Auth invariant:** there is no middleware. Every new route handler must call getAdminUser() from lib/reviewServer.ts and return 401 JSON when null, exactly like the 60 existing routes. Every new page must live under app/admin/ so the layout gate covers it.
6. **Trust invariants:** never read is_featured or sponsor_id in any ordering or selection; never add any UI that edits starts_at; keep one action = one audit_log verb where auditing exists.
7. **House style:** zero em-dashes anywhere (lint enforces via scripts/check-emdash.mjs), plain dollar signs, WCAG 2.2 AA (44px primary targets, visible focus, keyboard operability, reduced-motion respected).
8. **Design source of truth for visuals:** the approved mockup files Jim attaches (cockpit_mockups_r1.html through r4.html). Reproduce their classes/tokens semantics, not necessarily their exact markup. All colors via tokens or the new tint variables; no new raw hex.
9. **Dead code stays dead:** never modify lib/pipeline.ts, lib/enrich.ts, lib/explore.ts (except reading), LensSheet.tsx, NearMeSheet.tsx.
10. Run the repo's existing checks (lint, check:emdash, build) before declaring any gate ready.

---

# WAVE 1 · Quick wins (nine fixes + one chore)

Nine independent items. Gate after W1-G1 (items 1-5) and W1-G2 (items 6-10). Each item names its files from the cockpit spec.

**1. Venues match cap made honest (QW1).** app/admin/venues/VenuesView.tsx line 612 currently `.slice(0, 40)` with no remainder. Change: header shows the true total ("Matches to review · showing 1-25 of {total}"), paginate client-side at 25/page with a next/prev control (mirror the catcher's existing 40/page pagination pattern in the same file). No API change.

**2. Approve/reject responses read (QW2).** app/admin/review/ReviewQueue.tsx lines 49-55: `post()` ignores the response. Change: read res.ok and body; on failure, toast "Publish failed for {title}, kept in queue" (or Reject equivalent) and splice the card back at its original index using the same mechanism Undo already uses (lines 57-82). Do NOT change COMMIT_MS, the pending Map, beforeunload flush, or keepalive; the only new behavior is post-response handling. beforeunload keepalive posts stay fire-and-forget (page is gone; nothing to show).

**3. Flags feedback (QW3).** app/admin/flags/FlagsView.tsx lines 23-35: failed POST is silent. Add a failure toast ("Couldn't update that flag, try again") and keep the row. Badge comes in Wave 2 with the shell work; skip it here.

**4. Keyboard undo (QW4).** The Undo control in ReviewQueue.tsx (~line 332), ImagesView.tsx (~line 887), CatalogView.tsx (~line 533) is a span with role="button" tabIndex=0 and no key handler. Convert each to a real <button>, and add a U keydown in the two keyboard-mapped screens (ReviewQueue, ImagesView) that triggers the visible toast's undo while it shows. U must respect the existing input-focus guard and must not fire in edit mode text fields.

**5. Token hygiene (QW5).** app/admin/review/cockpit.css lines 263 and 267: replace #C9E0E6 with a defined token-derived value (add `--pacific-mist: color-mix(in srgb, var(--pacific) 25%, var(--paper))` to the cockpit stylesheet's :root scope or use an existing tint). Define the two missing tokens used at line 390: add `--rule: var(--line); --radius-card: var(--radius-md);` where the other custom properties live (note in the gate summary that app/components.css line 3021 has the same --radius-card bug in the public app; fix only if Jim says yes, it is out of cockpit scope).

**W1-G1 STOP.** Show Jim: venues count/pager, a simulated failed approve (temporarily test via devtools offline), flags failure toast, U-key undo, and confirm no visual regressions.

**6. Error and loading boundaries (QW6).** Add app/admin/loading.tsx (simple branded "Loading the cockpit…" on Plaster with the Fraunces wordmark) and app/admin/error.tsx (client component: "Something broke on our side. Reload, and if it persists check Vercel logs." with a Reload button). Both minimal, tokens only.

**7. Logout + hero picker fix (QW7).** Add a "Sign out" control to the topbar area rendered by app/admin/CockpitTabs.tsx or the layout (small, right-aligned; calls a new server action that signs out via the cookie client and redirects to the login page; do NOT reuse app/cockpit/actions.ts). Hero picker: app/admin/heroes/HeroPlanView.tsx lines 26-40 close the picker before the pin result; reorder so failure keeps the picker open with the toast.

**8. Restock visibility (QW8).** app/api/admin/restock/route.ts: after a successful workflow dispatch, include the workflow's runs URL (https://github.com/{GITHUB_REPO}/actions/workflows/{GITHUB_WORKFLOW_FILE}) in the response; CoverageView's directives list renders "view runs ↗" per running/queued directive. Heartbeat: app/api/cron/heartbeat/route.ts ignores sendEmail's boolean; log console.error and include ok:false detail in the response when the alert send fails.

**9. Focus-refresh counts (QW9).** The layout's counts (loadCockpitCounts) are static per navigation. Add a client wrapper that refetches counts on window focus/visibilitychange (new GET endpoint or reuse; any new route follows rule 5) and updates the topbar. Cheap polling is not wanted; focus-refresh only.

**10. Repo-DB reconciliation chore (S9).** Write supabase/migrations/RECONCILE_20260720_documentation.sql containing commented, additive CREATE TABLE / ALTER TABLE statements matching the LIVE shapes of the five drifted objects (query the live DB for exact columns first). Mark the file header clearly: "documentation of already-applied live DDL, do not re-run blindly." No execution.

**W1-G2 STOP.** Show all of wave 1 working; Jim smoke-tests the daily pass end to end.

---

# WAVE 2 · The Today screen and shell badges (S1)

Design source: mockups r1 (Today · Morning Ledger variant + phone) and the badge-equipped shell shown in r1/r2.

**2.1 Server loader.** New lib/todayServer.ts `loadToday()` (service-role) assembling: queue count and overlay count (reuse loadCockpitData's queries or its cheaper count equivalents), latest-run digest numbers (source_runs, ingest_drops), sources below baseline (sourceHealth()), venues matches-to-review true count (venuesServer's proposal query as a count), images backlog count (imagesServer count, respecting photo_ack fallback), open flags count, pending edition summary (status + edition_date + send day), stale or gapped hero days (heroServer), thin coverage cells count (coverage floors), recently-rejected count last 7 days (audit_log action='reject' actor='founder'), and last run timestamp. All reads, no writes; every query must degrade to 0/null without throwing (but unlike the legacy list routes, a thrown Supabase error here should surface, not silently zero: wrap with a single try that sets an `unhealthy: true` flag the UI renders as a visible "Couldn't read some counts" line, honoring the never-lie principle).

**2.2 The screen.** app/admin/today/page.tsx (force-dynamic) rendering the Morning Ledger exactly per mockup: dateline greeting with day/date, the one-sentence night summary, the gold attention band listing at most the two most urgent items (urgency order: edition sending soon > any source down > venue matches above 30 > open flags > thin cells), the ledger rows (Queue, Edition, Venues, Images, Coverage, Flags, Hero plan, Sources) each with dot severity, mono count, one-line story, deep link. Footer: run stamp + "Recently rejected ({n} this week) →" linking to the Queue's panel (Wave 3 target; link to /admin/review until then). Stories are template strings from real numbers; keep them factual, no invented claims.

**2.3 Shell.** app/admin/CockpitTabs.tsx: add "Today" as the first tab (route /admin/today); add count badges per mockup (Queue hot-gold when >0, Edition hot when a draft is pending, numeric badges for Coverage thin cells, Hero gaps, Venues matches, Images backlog, Flags open). Badge data rides the same layout-level fetch as the counts (extend loadCockpitCounts or swap it to loadToday's cheap subset). Preserve the existing active-tab logic and ARIA; while touching it, give the tablist proper arrow-key behavior or drop the tablist roles for plain nav semantics (either resolves the B2 ARIA finding; prefer plain nav, simpler and honest).

**2.4 Landing.** Login success (LoginForm) and the /cockpit redirect now target /admin/today. The Queue remains one click/keystroke away.

**W2-G STOP.** Jim's test: morning-style visit lands on Today, numbers match reality tab by tab, every deep link works, badges visible everywhere, phone layout matches the r1 phone frame.

---

# WAVE 3 · Workflow doors (S2, S6, S7, D6)

**3.1 Recently rejected + restore (S2).** New GET/POST route app/api/admin/rejected/route.ts (auth per rule 5): GET returns the last 14 days of founder rejects (audit_log action='reject' actor='founder' joined to things still status='archived' and merged_into null); POST {id} restores: set status='needs_review', write audit_log action='restore', revalidate nothing (not public-facing). Queue sidebar gains the "Recently rejected" panel per mockup r2 (title, rejected day, reason, Restore button; restored row toasts and disappears; the queue itself picks it up next load). Update the Shortcuts legend line for R: "restorable for 14 days".

**3.2 Edition save-all (S6, D4).** EditionDraftView/PickEditor: lift per-pick dirty state to the view (each PickEditor reports dirty via callback instead of only local `dirty`); render the dark save bar per mockup r3 pinned under the editor listing dirty picks by slot name, with "Save all changes" (sequential PATCHes to API-23 per dirty pick plus chrome PATCH if dirty, then one preview nonce bump) and "Discard all" (reset fields from server state, confirm first via the Wave 4 primitive or window.confirm until then). Per-pick Save buttons remain (they just also clear that pick's dirty flag). Decision card copy: byte-for-byte unchanged. Reorder, swap, AI edit, image editor: untouched.

**3.3 Resumable image runs (S7, D5).** ImagesView bulk loops (auto-free-all lines ~409-439, auto-google-all): persist a run manifest to localStorage under key `sbd-cockpit:imagerun` after each chunk: {kind, filterState, ids: remaining, done, total, startedAt}. Clear on completion. On mount, if a manifest exists and is <7 days old, render the resume banner per mockup r3 ("stopped at {done} of {total}, finished work is saved") with Resume (continue the loop over remaining ids, same chunk sizes 25/8/60, which are load-bearing) and Dismiss (clears manifest). This is operator-browser state; the no-end-user-account rule is untouched. No DDL.

**3.4 Login move (D6).** Create app/admin/login/ housing the login page + form styled per mockup r4 (cockpit tokens, friendly error line replacing the raw Supabase message; log the raw error to console for debugging). The /admin layout must NOT gate this one path: place login OUTSIDE the gated layout via a route group (e.g. app/admin/(auth)/login with its own minimal layout, keeping the gated layout on app/admin/(console)/...) or an explicit pathname check; choose the route-group approach, it is the Next-16 idiomatic one, and verify every existing /admin URL is unchanged. Redirect chain updates: layout gate redirects to /admin/login; app/cockpit/login becomes a redirect to /admin/login; /cockpit still bounces to /admin/today. Then delete the orphans: app/cockpit/ReviewCard.tsx, app/cockpit/actions.ts, app/cockpit/login/LoginForm.tsx + page (after the redirect stub replaces it). lib/pipeline.ts loses its last app-side importer; leave the file itself alone (rule 9), just note it in the gate summary as now fully orphaned.

**W3-G STOP.** Jim's test: reject something and restore it; edit two picks and save-all; start an auto-free run, close the tab mid-run, reopen, resume; sign out, land on /admin/login, sign in, land on Today; old /cockpit/login URL still works via redirect.

---

# WAVE 4 · Consistency spine (S3, S4)

**4.1 The sheet primitive (S3a).** New app/admin/ui/Sheet.tsx per mockup r2: role=dialog, aria-modal, labelled header with "Esc closes" hint and close button, focus trap via lib/useFocusTrap.ts, Escape close, scrim click close, focus restore to opener, footer slot. A small centered Confirm variant replaces window.confirm usages (title, body, confirm/cancel labels, danger styling option). Adopt in this order, one commit each, behavior identical: restock modal (CoverageView), sources sheet, rhythms sheet, hero picker, swap picker, then the two already-trapped sheets (catalog edit, venue detail) swap their scaffolding in last. Escape-close ordering on Coverage (modal before drilldown) is load-bearing; preserve it.

**4.2 Catalog sheet zones (S3b).** Restructure the catalog edit sheet into the LIVE/DRAFT zones per mockup r2: photo picker inside the terracotta "applies to the live site immediately" zone (behavior unchanged: instant apply + Undo, budget note), text fields inside the pacific "saved together" zone, footer dirty counter + Save/Cancel where Cancel's confirm mentions only draft-zone changes. starts_at lock note kept verbatim in the draft zone.

**4.3 Undo policy (S3c).** Single Delete in CatalogView gains post-delete Undo via the archive/unarchive mechanism where reversible (if delete is a hard delete in API-02, switch the single-delete UI to archive semantics matching bulk, and flag in the gate summary; do not change API-02 itself without flagging). All destructive toasts use one visual grammar (the r2 toast: dark pill, gold Undo button, countdown bar, U works where a key map exists).

**4.4 Vocabulary (S3d).** One constants module (app/admin/ui/vocab.ts): tier labels Events/Recurring/Places everywhere (SCR-06's "Tier 1/2/3" pills and SCR-09's T1/T2/T3 badges adopt them); dismissal labels per approved r4: "Skip for now" (render-only), "Never match" (permanent), "Keep motif forever" (permanent, replaces "Leave on motif"/"Looks right as-is" button labels; underlying acks unchanged). Payload values, API contracts, and DB values change zero.

**4.5 cockpit.css consolidation (S4).** Mechanical, in one dedicated commit series: replace the ~40 inlined rgba() tints with the named --tint-* custom properties (define once, values matching current rendering); replace literal font-size rems with scale tokens where they match, and define explicit cockpit density tokens (--text-dense-1: .8125rem etc.) for the deliberate below-floor sizes so nothing is a loose literal; align breakpoints to 600/1024 where visually safe, keeping any that guard real layout breakage (note each kept exception); extract the repeated inline-style patterns (the teal mono note in NeighborhoodSweepView/SourcesView/RecurringRhythmsView at minimum) into classes; bump undersized targets (.btn 40->44, .btn-sm 32->36 with 44px hit-area padding trick, .imgnav 34->44, .ed-reorder-btn 22->36 minimum). Pixel-diff eyeball each screen against pre-change screenshots.

**W4-G STOP** (two sub-gates fine: after 4.1-4.4, after 4.5). Jim's test: open every dialog on every screen, Esc everywhere, tab-cycle trapped, delete-and-undo a catalog row, read the new labels, confirm nothing moved that should not have.

---

# WAVE 5 · The editorial reskin (S5)

Design source: mockups r1-r4 in full. Sequence, one gate per step, Queue last:

**5.1** Shell + Today polish pass (r1): final topbar/tab styling, brand treatment, badge styles.
**5.2** Coverage, Sources, Sweep, Rhythms, Flags (r3 Coverage + r4 small desks; Sweep and Rhythms inherit: Fraunces headers, panel/table/sheet language, no layout invention).
**5.3** Live catalog + Venues (r4): rows, bulk bar, match list, venue cards with pool dots.
**5.4** Edition + Images (r3): panel chrome, pick cards, toolbar, session strip.
**5.5** Login (r4).
**5.6 THE QUEUE (r2), last and hardest-gated.** Field Card browse + edit chrome, sidebar panels, toast. Before touching it, re-read docs/cockpit/11-change-safety.md SCR-01 in full. The keyboard handler, focus guard, commit engine, overlay semantics, registry panel, tag rules, provenance link rule, and prioritize() ordering are behavior-frozen; this step changes classNames, markup structure around them, and CSS only. If any load-bearing element cannot survive the new markup unchanged, stop and flag. After building, verify each: A/R/E/H/B/arrows/U in browse; E-in, ArrowLeft/Right, Esc-keeps-draft, A-commits, R-withheld in edit; overlay card labels and payloads; registry snippet copy button; bulk green; undo splice-back.

**W5 final gate:** Jim runs a full real morning in the redesigned cockpit, then the edition pass. Only after that does Wave 5 merge.

---

## Post-build follow-ups (parked, not in scope)
API-48 Places lookups joining the image_spend ledger (D6 finding); audit-log completeness + in-app viewer (S8); middleware auth consolidation (deliberately rejected, keep the invariant loud); CLAUDE.md canon updates: operator budget 20-30 min, cockpit login at /admin/login, orphan removals, new Today surface (short delta doc per house practice).
