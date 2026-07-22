# Section 13 - Operator Workflow and Time-Cost Inventory

Cadence classifications draw on Core Project Files/13_SBDaymaker_Cockpit_Daily_Guide.html ("Fifteen minutes, every morning", the B-then-walk routine) and code evidence (cron schedules, drafter days). That guide is partially STALE vs the code: it says "sign in ... use your founder magic-link login" while the actual login is email+password (CMP-27), and it predates the H (hero) key, the weight nudge, and five of the eight tabs. Where the doc and code disagree, this section describes the code.

## 13.1 Task inventory and cadence

| Task | Screen(s) | Cadence | Evidence |
|---|---|---|---|
| Review queue pass (approve/edit/reject) | SCR-01 | daily | Doc 13: "Fifteen minutes, every morning"; pipeline lands nightly |
| Source-health glance | SCR-01 sidebar / SCR-02 sidebar / SCR-03 | daily glance, deeper triage occasional | digest strip + panels are ambient; [INFERRED] deep triage only when something is red |
| Image backlog work | SCR-10 | every few days, burst-style [INFERRED] | it is a backlog desk with bulk accelerators, not a daily queue |
| Hero planning/pinning | SCR-07 | weekly-ish [INFERRED] | 14-day rail; pins are optional (Auto is the default) |
| Edition draft review | SCR-08 | twice weekly, fixed | drafter runs "Wednesday and Saturday mornings (06:00 PT)" (CMP-19 empty-state copy); sends Thu+Sun 07:00 PT (vercel.json cron 0 14 * * 0,4) |
| Live-catalog fixes (edit/photo/delete/bulk) | SCR-06 | occasional, reactive | reached when something wrong is noticed on the site |
| Restock directives | SCR-02 | occasional | used when a coverage cell is thin |
| Neighborhood sweep + triage | SCR-04 | occasional (after big ingest waves) [INFERRED] | backlog-shaped; self-heals once dictionary grows |
| Venue curation (matches, pools, place_ids, dog list) | SCR-09 | occasional, front-loaded [INFERRED] | pool building is a one-time-per-venue investment |
| Recurring-rhythm registry upkeep | SCR-05 | occasional | fed by registry-snippet cards in SCR-01 |
| Flags triage | SCR-11 | as they arrive (low volume) [INFERRED] | visitor-submitted corrections |
| Sources registry edits (pause/add) | SCR-03 | occasional | "next nightly run picks this up, no deploy needed" |

## 13.2 The daily review pass (the routine that must stay fast)

Path: open /admin/review (or land there from login). One server load. Then:

1. Read the digest strip (queue count, drop count + reasons, any "down" sources). 0 clicks.
2. Press B: bulk-approve every green-chip card in the current view. 1 keystroke for potentially most of the queue.
3. Walk the rest: ArrowDown, then A / R / E per card. In edit mode: type fixes, ArrowLeft/Right to pick a photo, A commits edits + publishes in one press. H flags a hero. Weight nudge and un-merge are mouse-only.
4. Optional sidebar glance: Dropped tonight, Merged events, Source health, Time reclaimed.

Marginal cost per item: one keystroke (A or R) for a clean card; an edit adds focused typing plus one A. N items cost roughly N keystrokes plus reading time; there is no per-item mouse requirement in the core loop.

Keyboard coverage (the full task time-shape): approve, reject, edit-enter/exit, photo cycling, hero flag, bulk-green, and navigation are all keyboard. The flow forces a mouse reach ONLY for: the tier filter pills, the weight nudge (▲▼ buttons), Undo on the toast (span, no key handler), the registry-snippet "Copy snippet" button, un-merge, the dropped-panel links, and "Try fetching a photo". [INFERRED estimate: a typical clean-queue pass stays >90% on the keyboard; a pass that involves weight changes or undos does not.]

Failure recovery on this path is the weakest point: approve/reject POSTs are fire-and-forget (see 09/10); a failed publish shows success. The Undo window is 2.6 seconds, after which the only recovery for a wrong approve is finding the item in SCR-06 and deleting/re-editing it; a wrong reject has NO cockpit recovery at all (rejected = archived; nothing lists archived non-merged things; recovery requires Supabase SQL) - the operator-facing dead end, marked [INFERRED] as to intent.

## 13.3 Per-task current paths (condensed; screens carry full click detail)

- Restock a thin cell (SCR-02): spot red cell -> optional click for drilldown -> ↻ Restock on the row -> choose window + tonight/now -> confirm. 4-5 clicks per directive; strictly per-row (no multi-select). Failure: "Run-now dispatch failed ... Queued for tonight instead." auto-falls back; a queued directive's later success/failure is only visible by re-checking the sidebar list (status pill), nothing notifies.
- Edition pass (SCR-08): read preview iframe -> per-pick tweaks (each field save is its own button press) -> optionally Claude-edit a blurb (type instruction + Enter) -> decision: nothing (it sends anyway) or Hold (the only send-stopper). Editing N picks costs N separate "Save changes" presses; there is no save-all. Failure recovery: everything is re-editable until send; a failed send shows in Archive as failed with reason (loadable), and approving later sends immediately.
- Fix a live item (SCR-06): find via search/filters (350ms debounce) -> Edit sheet -> fields -> Save. Photo swap inside the same sheet is instant-apply with Undo. Bulk path exists for hero/tags/weight/archive/redraft (page-scoped selection only, max one page = pageSize rows at a time). Delete is per-item confirm, no undo (bulk archive HAS undo; single delete does not - an inconsistency worth flagging).
- Images backlog (SCR-10): the intended shape is bulk-first (pool builds -> Auto-free (all) -> Auto-Google -> Keep motif for the tail), then keyboard-walk the residue (arrows + A/W/V/F/G/M). Long bulk runs live in the tab ("keep the tab open") with no resume: closing mid-run abandons the remainder (already-done work persists). Every assignment is revertible only within the session (the strip empties on reload; the underlying photo writes persist and can still be fixed per-item in SCR-06).
- Venue pool build (SCR-09): open venue card -> add place_id (or run the bulk lookup section first) -> fetch free candidates -> approve 3-5 -> done forever for that venue. The place_id bulk lookup is the big time-saver; weak matches need judgment per venue.
- Sweep (SCR-04): Run sweep -> Apply resolved (2 clicks moves every confident item) -> chip-tap the triage residue (1 click each, 50 shown per pass, re-run to page) -> add venue names to the dictionary as they recur.
- Rhythms (SCR-05) and Sources (SCR-03): form CRUD, a few fields per entry; per-item only, low volume.
- Flags (SCR-11): open link (new tab) -> judge -> Resolve/Dismiss. Two clicks + reading. No bulk; silent failure mode noted in SCR-11.

## 13.4 Out-of-cockpit escape hatches (the operator tax)

| Forced exit | When | Gap in the UI |
|---|---|---|
| Supabase SQL editor / dashboard | recovering a wrongly rejected (archived) thing; any audit_log inspection; DDL for new features; editing a stray value on a table no screen covers (e.g. subscribers) | no archived-things list, no audit-log viewer, no subscriber count anywhere in the Cockpit |
| GitHub Actions logs | verifying a restock "Run now" actually ran, or why a nightly ingest failed | directives show queued/running/done/fail + run_note only; no link to the run, no log surface (memory: a fresh GITHUB_DISPATCH_TOKEN was still pending as of 2026-07-02, so "Run now" may fail until env is fixed) |
| Vercel dashboard | cron health (heartbeat/reaper/send-edition), deploy state, env vars | no in-app cron status; the heartbeat EMAILS on missed ingest but nothing surfaces cron misfires of the send itself beyond the Archive's failed row |
| Google Place ID Finder (external site) | venue lacks a place_id and the automatic lookup finds nothing | linked from SCR-09's sheet copy; manual copy-paste of place_id/coords |
| Email client | the morning digest + heartbeat alert are the only push channels | none of their content is reproduced in-app beyond the digest strip |
| Code editor + deploy | adding a source ADAPTER (registry row alone does not fetch), changing chip/floor thresholds, any copy change | by design; sources screen says so explicitly |

## 13.5 Missing affordances observed in code (all [INFERRED] as product judgments, each grounded in a cited absence)

- No undo on single catalog Delete (CatalogView.tsx del(), lines 166-174) while bulk archive gets one (lines 294-322): inconsistent risk envelope for the same operation.
- No recovery path for rejects: /api/review/reject archives; no screen queries status='archived' except the merged panel's merged_into subset (reviewServer.ts loadMergedRows).
- Fire-and-forget publishes (ReviewQueue post(), line 49-55: response ignored) mean the fastest flow has the weakest error reporting.
- No cross-page selection in catalog bulk (deliberate, LC-3 comment) - fine at current scale, a tax if the catalog grows.
- "Matches to review" (SCR-09) silently renders only the first 40 proposals (`.slice(0, 40)`, VenuesView.tsx line 612) with no count of the remainder - work can hide there.
- Restock directives cannot be cancelled from the UI (no delete endpoint is called by CMP-12; API-42's DELETE support, if any, is documented in 07-api-backend.md).
- The topbar counts refresh only on navigation; during a long session the "In queue" number drifts from reality (CMP-01 comment acknowledges this).
- No global "what needs me today" rollup: the operator assembles the morning picture from the digest email + digest strip + per-tab badges (only Coverage has badges); Images/Flags/Venues backlogs are invisible until their tabs are opened. Given the 20-30 minute daily budget goal, this is the largest structural time cost [INFERRED].
