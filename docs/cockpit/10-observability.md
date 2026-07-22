# Section 11 - Error Handling, Logging, and Observability

## 11.1 Where server-side errors actually go

Console only. There is no error-monitoring service anywhere in the repo (no Sentry/Bugsnag/etc. in package.json or code; stated, not omitted). Patterns, with call sites:

- Logged then degraded: lib/reviewServer.ts line 229 (`console.error("[cockpit] merged-rows read failed:", error.message)`) and line 278 (`console.error("[cockpit] queue read failed:", ...)`) - the queue renders empty/partial instead of failing. lib/imagesServer.ts line 89 `console.warn("[images] photo_ack filter unavailable (run the 20260711_images_desk migration): ...")`.
- Swallowed to empty 200s: API-07 (catalog list), API-40 (images list), API-54 (venues list), API-58 (queue) return empty payloads on DB failure or missing service key; the screen then looks legitimately empty. This is the "logs as healthy" class: a misconfigured SUPABASE_SECRET_KEY renders a convincing zero-work cockpit with no visible error anywhere (loadCockpitData() returns all-empty when getAdminSupabase() is null, reviewServer.ts lines 248-250).
- Returned as JSON errors: most mutation routes return `{ error: message }` with 4xx/5xx, surfaced (or not) by each screen's toast handling.
- Never checked at all: audit_log inserts across every route (fire-and-forget); thing_tags/thing_edits secondary writes after a successful publish (API-56 entry in 07-api-backend.md).

## 11.2 Audit logging of operator actions

audit_log (entity_type, entity_id, action, actor, payload, created_at) receives actor "founder" rows for: approve (API-56), reject (API-59), update/edit (API-60), hero_eligible (API-31), weight (API-55), photo apply (API-05), redraft_queued (API-06), venue photo approve/remove/reorder, plus worker-side auto_publish/auto_hold. NOT audited: venue create/edit/match/detach/ack, sweep triage assignments, dictionary adds, rhythm and source CRUD, edition edits/decisions, hero pins, flag resolve/dismiss [verified by the per-route table lists in 07-api-backend.md]. There is NO viewer for audit_log in the Cockpit; reading it means the Supabase SQL editor. Its only in-app consumer is the "Time reclaimed" metrics counting three action types since 2026-07-16 (reviewServer.ts lines 185-216).

## 11.3 Proactive alerting vs pull-only discovery

Pushed (all email, all originating outside the interactive app):

- The nightly ingest digest email from the GitHub Action worker: queue/drop/source summary each morning (the operational doc's "Check the summary email"; sent by the worker, out of app scope).
- /api/cron/heartbeat (daily): emails DIGEST_TO "SB Daymaker, nightly ingest did not run" when no source_runs row landed in 30 hours - the only dead-man's-switch. If DIGEST_TO or RESEND_API_KEY is unset, the alert silently does not send (lib/email.ts returns false, no throw; heartbeat ignores the return).
- Edition sends themselves (Resend) - their absence is a signal only if the operator notices.

Everything else is pull-only: source below-baseline states (SCR-02/03 badges), restock directive failures (status pill in a sidebar), image backlog growth, open flags (no badge on the Flags tab), pending edition state, queue depth (badge on Queue tab only), stale hero pins. Nothing emails or pushes for any of those; every problem is discovered by opening the Cockpit and looking at the right tab.

Failure modes that log as healthy (the priority list for any redesign):

1. Fire-and-forget publishes/rejects (SCR-01): `post()` never reads the response (ReviewQueue.tsx lines 49-55); a 500 on approve still toasts "Published". Recovery signal: the card silently reappears next visit.
2. Empty-200 list routes (11.1) make outages look like empty queues.
3. Heartbeat with missing DIGEST_TO: the watcher runs, detects the miss, and alerts no one.
4. Flags resolve/dismiss failure shows nothing at all (CMP-26 lines 23-35).
5. A "Run now" restock that dispatches successfully but whose GitHub run fails: directive stays "running"/"queued" with whatever run_note the worker last wrote; no link to the run, no timeout logic visible in scope [INFERRED: worker-side handling not visible in app code].

## 11.4 What the operator sees when each critical path fails

| Path | Failure surface |
|---|---|
| Approve / reject / bulk-approve (SCR-01) | NOTHING - optimistic removal + success toast regardless; see item 1 above |
| Edit-and-approve (SCR-01) | same as approve (the edits ride the same fire-and-forget POST) |
| Catalog edit (SCR-06) | toast `res?.error ?? "Edit failed"`; sheet stays open with the draft intact |
| Catalog delete (SCR-06) | toast "Delete failed"; row stays |
| Photo apply (SCR-06/SCR-10) | toast "Couldn't apply that photo" / route error text; Undo only offered on success |
| Hero pin (SCR-07) | toast "Pin failed" / "Clear failed"; picker closes anyway (setPicker(null) precedes the check, HeroPlanView.tsx lines 26-40) |
| Edition save/decision (SCR-08) | toast "Save failed"/"Update failed"; approve-past-window failure toasts "Approved, but the send failed: {reason}" |
| Weight nudge | optimistic value reverts + toast "Weight change failed, reverted" |
| Flags resolve/dismiss (SCR-11) | none exists in code |
| Login (SCR-12) | raw Supabase error line under the form |
