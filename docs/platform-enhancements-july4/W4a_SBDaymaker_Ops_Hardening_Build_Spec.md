# W4a Build Spec — Ops Hardening

`Doc W4a · for Claude Code, with clearly marked JIM-DOES-THIS steps · schedule anytime after Wave 1 · written against commit caa7302 + Docs 18/19`

---

## What this is

Six hardenings that remove compounding operational risk: the disaster-recovery hole in the migrations tree, missing RLS on seven tables, silent-source blindness, no dead-man's switch on the nightly, 86 stale past-dated rows, and closure detection that has never run. None is user-visible; all get worse with time.

**Special rule for this wave:** several items involve SQL against the hosted database. Per the project's standing practice, **DDL against the hosted DB is a human act** — Claude Code writes and verifies the SQL; **Jim applies it in the Supabase dashboard SQL Editor.** Every such block below is marked `▶ JIM RUNS THIS`. Data-only updates (DML) and file/workflow changes are Claude Code's to execute directly.

## §0 · Ground rules

1. Read `CLAUDE.md` (v10) first; reconcile every path/claim against the live repo — this spec was written at `caa7302` and earlier waves have landed since.
2. Phases in order, stop-and-show after each. Doc 14 entries at close.
3. Fail-soft discipline: every new pipeline step must be wrapped so it can never sink the nightly run (match the restock/closures pattern in `run.ts`).
4. No new paid services. The dead-man's switch uses a free healthchecks.io check.
5. **Out of scope:** everything in W4b (deletions, pipeline retirement, middleware); rate limiting; anything user-facing.

---

## PHASE W4a.1 — Migrations consolidation (the disaster-recovery hole)

**The problem:** `supabase/migrations/` cannot rebuild the live DB. `phase7.sql` (adds `things.local_note`, the `submit_thing`/`subscribe_email`/`confirm_subscription`/`unsubscribe` RPCs) and `shared_states_rpc.sql` (the four shared-state RPCs) were hand-run at the repo root. A fresh replay would be missing a column and **all eight public RPCs** — the entire public door to submissions, subscriptions, shares, and restore.

**Claude Code does:**
1. Create two dated migration files under `supabase/migrations/` reproducing those objects **idempotently**: `alter table … add column if not exists`, `create or replace function`, `create index if not exists`, guarded enum additions. Content must byte-match the live objects' behavior — derive from the root files, cross-check against the platform snapshot's Doc 03 §1.21, and verify function signatures against the live DB via read-only introspection.
2. Move the originals: relocate `phase7.sql` and `shared_states_rpc.sql` into a `supabase/applied-by-hand/` archive folder with a README line each ("superseded by migration YYYYMMDD_…; retained for provenance"). Delete nothing.
3. Prove replayability the safe way: run the *new* migration files against a **local scratch Postgres** (spin one up in the container) on top of the base contract + existing migrations, and diff the resulting schema (tables/columns/functions) against the live shape from the snapshot. **Do not run them against the hosted DB** — they're idempotent, but the point of this phase is the tree, not the live DB (which already has the objects).
4. Add one paragraph to CLAUDE.md §8 (or the ops doc if one exists): *"Every hand-run SQL statement gets a same-day migration twin in `supabase/migrations/`."*

**▶ JIM DOES THIS (dashboard, ~5 min):** Supabase dashboard → Database → Backups: confirm the Pro-plan backup schedule is active and note the PITR window. Report what you see back to the session (Claude Code records it in the stop-and-show; it cannot see your dashboard).

**Acceptance:** scratch-DB replay diff clean; archive folder + README in place; `git status` shows only the intended moves/additions.

## PHASE W4a.2 — RLS on the seven migration-added tables

**The problem:** `source_runs`, `ingest_drops`, `image_spend`, `image_cache`, `restock_directives`, `hero_pins`, `thing_edits` were created without `enable row level security` — protected only by absence-of-grant, inconsistent with the base contract's explicit-RLS posture.

**Claude Code does:** write `supabase/migrations/YYYYMMDD_enable_rls_ops_tables.sql` — `alter table … enable row level security;` for each of the seven, **no policies added** (service-role bypasses RLS; these tables have no public consumers — verify that claim by grepping the app for any anon-client read of these tables before finalizing; `hero_pins` is read via `getAdminSupabase` in `heroServer.ts` — confirm).

**▶ JIM RUNS THIS:** the seven `ALTER TABLE` statements, pasted by Claude Code into the stop-and-show as a copy-ready block, in the Supabase SQL Editor. Then tell the session "done."

**Claude Code then verifies:** the live site still renders (Explore/Saved/Discover/thing pages — anon reads unaffected), the cockpit still loads (service-role reads unaffected), and the nightly's tables are still writable by the worker (a dry-run `ingest:dry` plus one read-probe per table via service role).

## PHASE W4a.3 — Silent-source detection

**The problem:** a quietly-broken adapter (e.g., an SPA returning `[]`) shows 🟢 with `0 fetched` — indistinguishable from "healthy but empty."

**Claude Code does:**
1. A pure helper (suggest `ingest/health.ts`): given a source's recent `source_runs` (last ~10), classify `ok | down | SILENT` where SILENT = last **3** consecutive runs fetched 0 while the trailing-10 average before them was > 0. Unit-test the boundaries (a source that has *always* fetched 0 — like a registry stub — is `ok`, not silent).
2. Wire it into both surfaces: `rollupSources` (`lib/reviewServer.ts`) so the cockpit Source Health strip shows a distinct SILENT state (amber, labeled "gone quiet", tokens only, aria-label carries the meaning), and `ingest/digest.ts` so the nightly ops email lists silent sources in their own line ("⚠️ gone quiet: lobero (3 runs, was averaging 12)").
3. This needs per-source history: `loadCockpitData`/digest currently take the latest run — extend the query to the last N runs per source (one query, group client-side; keep it cheap).

**Acceptance:** unit tests green; simulate a silent source in fixtures and show both surfaces flagging it; an always-zero registry source stays green.

## PHASE W4a.4 — Dead-man's switch + failure notifications

**The problem:** if the GitHub Action never fires, nothing anywhere notices; if it hard-fails, the red X reaches no inbox.

**▶ JIM DOES THIS first (~5 min):** (a) create a free check at healthchecks.io named "SB Daymaker nightly," schedule = daily, grace = 6h; copy its ping URL; add it as GitHub Action secret `HEALTHCHECK_PING_URL`. (b) GitHub → your repo → Settings → Notifications (and your personal GitHub notification settings): ensure failed-workflow emails are on. Tell the session when both are done.

**Claude Code does:** at the very end of a successful live `main()` in `ingest/run.ts`, `fetch(process.env.HEALTHCHECK_PING_URL)` — wrapped in try/catch, skipped if unset, skipped in DRY mode, never able to fail the run. Add the env name to the workflow's env block. One line in the workflow README/comment explaining the check. (Healthchecks then emails Jim whenever a day passes without a ping — covering both "Action never ran" and "run died before completing.")

**Acceptance:** dry run does NOT ping; a live-mode local invocation (or a manual `workflow_dispatch`) pings and the check shows green; Jim confirms the healthchecks dashboard received it.

## PHASE W4a.5 — Past-event archival sweep (with the memory-moat guard)

**The problem:** 86+ past-dated Tier-1 rows sit in `published`, bloating the catalog, the ISR pool, and every payload.

**The trap this spec exists to prevent:** the Saved pool = published things, and `SavedClient`'s ghost-save cleanup **deletes** any saved id absent from the pool. A naive archival sweep would therefore silently erase users' *been* history — destroying the memory moat the product is built on. The sweep and the guard ship together or not at all.

**Claude Code does, in this order:**
1. **The guard first** (`components/saved/SavedClient.tsx` ghost-cleanup effect): change it to purge only ids whose state is `"want"`. `"been"` entries are **never** auto-removed — even if the thing has left the pool, the key/value stays in `sbd.saves.v1` (it's the user's memory; a future server-side been-snapshot design — flagged in Doc W5 — will make it renderable again). Verify Been-view rendering tolerates a been id with no matching pool thing (it's filtered out of visible lists by the pool join — confirm no crash, counts still correct or deliberately pool-scoped; state which at stop-and-show).
2. **The sweep** in `ingest/run.ts` (after LAND, before digest, own try/catch): archive `things` where `happening_tier=1 AND type='event' AND status='published' AND starts_at < now − 45 days`. **45-day grace, not 2** — chosen so the Saved "Did you make it?" flow and recent memories keep their data for a generous window while the bulk of stale rows still clears. One `audit_log` summary row (`action:'archive_sweep'`, payload count) + the count folded into the digest email.
3. Run it once (manual dispatch) and report how many of the 86+ cleared (those older than 45 days) vs. remain in grace.

**Acceptance:** guard unit-tested via the pure ghost-cleanup logic (extract it if inline); a fixture proves been-ids survive pool removal and want-ids are purged; sweep executed with counts reported; digest shows the new line; W1.1's saved-view tests still green.

## PHASE W4a.6 — Weekly closures run

**The problem:** `CHECK_CLOSURES` is read by `ingest/adapters/googlePlaces.ts` and set by nothing — permanent-closure detection has never executed; evergreen Tier-3 rot goes undetected (the Foursquare failure mode).

**Claude Code does:** in `.github/workflows/ingest.yml`, add a step before the run that enables closures on Sundays only:

```yaml
- name: Enable weekly closure check (Sundays)
  run: if [ "$(date -u +%u)" = "7" ]; then echo "CHECK_CLOSURES=1" >> "$GITHUB_ENV"; fi
```

plus a `check_closures` boolean `workflow_dispatch` input for manual runs. Confirm the shared `image_spend` cap logic still governs closure calls (it does at snapshot — `detectClosures` charges the same monthly counter; keep it that way and note in the digest when closure calls consumed budget). Default `CLOSURE_MAX_PER_RUN` (80) stands.

**▶ JIM DOES THIS:** nothing — but be aware the Sunday run may now archive permanently-closed places; the digest will report each one, and archival is reversible from the catalog.

**Acceptance:** workflow YAML valid (actionlint or a dispatch dry pass); a manual dispatch with `check_closures=true` runs the path (0 archived is a fine result); digest line present; `image_spend` movement, if any, reported.

---

## Wave close-out

Doc 14 entries for all six phases (the 45-day grace decision and the been-preservation guard get their own explicit entries — they're policy, not just code). Final full verification: tests, build, `ingest:dry`, live-site click-through. Summary for Jim in plain terms: what now alerts you, what now can't be lost, what got cleaned.

*End of Doc W4a.*
