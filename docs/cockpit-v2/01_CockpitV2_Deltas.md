# Cockpit v2 — Phase C0 Deltas & Migration Approval

**Generated:** 2026-07-02 · **Phase:** C0 (recon reconciliation — **no product code**) · **Status:** awaiting Jim's migration approval.
**Inputs reconciled:** `docs/cockpit-v2/SBDaymaker_CockpitV2_Build_Plan.md` (the plan) ⟷ `docs/cockpit-v2/00_CockpitV2_Recon.md` (live code) ⟷ `SBDaymaker_Cockpit_Redesign_Mockup_v1.html` (visual tiebreaker).

> **Rule applied throughout:** where the plan and the live code disagree, **the code wins**; the plan's file paths/patterns are adapted to what exists, and each adaptation is recorded below. The plan's §1 "Locked product decisions" are settled and are **not** re-opened here — this doc only records where the *implementation surface* differs from the plan's assumptions.

---

## 0. The three open questions — resolved (Jim approved recommendations, 2026-07-02)

1. **Coverage Tier-2 math (D2).** There is **no** public-site recurring-occurrence expansion to "reuse" — the live feed never expands `recurring_schedules` (recon §7). **Decision: build a new shared, exact occurrence helper** (`lib/occurrences.ts`, proposed) that both the Coverage route and the Hero-plan candidate logic import. It counts, for each `recurring_schedules` row, the occurrences of its `day_of_week` in the next N days, honoring the migration-added `frequency` (`weekly`/`biweekly`/`monthly`). Tier-1 uses the existing `withinHorizon`/`sbDay` day-keying from `lib/explore.ts`. This is *exact*, not the mockup's `round(N/7)` approximation.
2. **"Run now" GitHub token (D4).** No GitHub token exists anywhere (recon §5). **Decision: introduce a new server-side token at C2b** — a fine-grained GitHub PAT with `actions: write` scope on this repo, stored as a Vercel env var (proposed name `GITHUB_DISPATCH_TOKEN`) and never exposed client-side. The C2 queued-path has **no** such dependency and ships first; C2b adds the token + dispatch call.
3. **Delta-ledger target (D10).** The referenced `14_SBDaymaker_Build_Deltas.md` does **not** exist. **Decision: this file — `docs/cockpit-v2/01_CockpitV2_Deltas.md` — is the delta ledger for the Cockpit v2 build.** End-of-phase deltas append here. We do **not** invent a `14_*` file; existing references to it in the plan are treated as pointing here.

---

## 1. Delta ledger — plan assumption ⟷ live reality ⟷ adaptation

| # | Plan assumption (where) | Live reality (recon) | Adaptation for the build |
|---|---|---|---|
| **A1** | "existing admin auth (recon §1)" gates everything (§0) | Per-route `getAdminUser()` in `lib/reviewServer.ts:26-31`; **no `middleware.ts`**; **no 2FA** (password only) | Every new v2 route calls `getAdminUser()` at top, 401 on null. No middleware to inherit from. 2FA is a launch-hardening gap, **out of scope** here (flagged, not built). |
| **A2** | "Every state change writes `audit_log`" (§0.5) | `audit_log` exists and is already written by approve/reject/edit with shape `{entity_type:'thing', entity_id, action, actor:'founder', payload?}` (recon §2) | **Reuse this exact shape** for all new actions (`hero_toggle`, `hero_pin`, `restock_request`, `edit_submitted`, `edit_applied`). Nothing new to design. |
| **A3** | Coverage cells count Tier-1+Tier-2 by reusing "the site's own cascade expansion" (§1.2, §3 `/api/admin/coverage`) | The site has **no** recurring expansion; Tier-2 rows land `starts_at=null` (gate is Tier-1-only, `ingest/gate.ts:27-28`); occurrences live only in `recurring_schedules` | **Build `lib/occurrences.ts` (new, exact).** Tier-1 via `withinHorizon`/`sbDay`; Tier-2 via day-of-week × `frequency` count. Coverage + Hero-plan candidate logic both import it. (Decision 1.) |
| **A4** | Additive migration; check names/enums don't collide (§2) | `restock_directives`, `hero_pins`, `thing_edits` — **none exist**; enums `restock_scope`/`restock_status` don't exist; `things.id`, `nearby_zone`(6 values), `occasion_tag` all present as assumed (recon §3) | Migration applies **clean, verbatim** (see §3 below). No rename needed. |
| **A5** | Approve accepts `{id, edits?, hero_eligible?}` and applies edits + publishes in **one transaction** (§1.5, §3) | Today approve is **publish-only** `{ids[], photo?}`; edits go through a **separate** `/api/review/update`; **`hero_eligible` has no write path anywhere** (recon §2) | Core C1 work: upgrade `/api/review/approve` to accept an optional `edits` payload + `hero_eligible`, apply-and-publish in one call, keep bulk `ids[]` working. Fold the existing `update` logic (tag upsert, negative-rule `filterTags`, neighborhood validation) into the transaction. |
| **A6** | Queue rows carry tags, zone, `hero_eligible`, photo fields, edit-overlay preview (§3) | Queue already returns `tags` + `photo_options` + photo fields (recon §2); **missing: `nearby_zone` and `hero_eligible`** | Extend `loadCockpitData()`/`QueueRow` (`lib/reviewServer.ts`) to also select `nearby_zone` and `hero_eligible`, plus the `thing_edits` overlay merge + `edit_of` for C3. |
| **A7** | Restock "Run now" dispatches the Action via GitHub REST API; token "recon §5 says whether one exists" (§3, §5.2) | **No GitHub token exists** (recon §5). `workflow_dispatch` **already present** with input plumbing to copy | C2 ships queued-path (no token). C2b adds `GITHUB_DISPATCH_TOKEN` + a `directive_id` input on `ingest.yml` + the dispatch call. (Decision 2.) |
| **A8** | Restock targeted pass passes the directive as a hint; "recon §4 says whether adapters take params" (§5.1) | Adapters take a `DateWindow` only — **no scope/vibe/zone param** (recon §4); 31 adapters | Restock **runs the adapter set and filters candidates post-gate** by proposed tag/zone before landing, stamping `source='restock:{directive_id}'`. Same gate → dedupe → enrich → land path. |
| **A9** | Edition-drafter honors `hero_pins` when drafting date D (§5.3) | **Edition drafting does not exist anywhere** — `editions`/`edition_picks` are schema-only, unpopulated (recon §4, §6) | **We are in the "not built" branch.** Hero-plan tab ships as **pin-intent storage** (`hero_pins` table + API + rail UI). Pin **consumption is not wired** — flagged at C4 as awaiting a future edition-drafter. Build nothing speculative. |
| **A10** | Hero-plan "Auto" tile shows the ranker's projected pick; "if recon §6 found a real ranker function, call that" (§4e) | Hero = `ordered[0]` of the live deterministic pipeline; ranker = `cascade()` + `withinHorizon()` in `lib/explore.ts:21-48`; **trust rule holds** (no sponsor read anywhere) | Hero-plan "Auto" candidate logic **reuses `cascade`/`withinHorizon`** (+ the new `lib/occurrences.ts` for "occurs that day"). Do not fork ranking. `editorial_weight` exists but is unused by the live ranker — leave it unused. |
| **A11** | Preserve the existing keyboard pattern and extend it (§4b) | One `window` keydown handler in `ReviewQueue.tsx:164-187` with input-guard + edit-mode lockout; A/E/R/↑↓/B live; ←/→ cycle images in edit (recon §9) | **Extend this handler in place**: add **H** (hero toggle) and tab-switch keys; preserve the input-guard + edit-lockout structure. Do not re-invent. |
| **A12** | Optimistic remove + Undo; "if no compensating pattern, implement Undo as a 5-second delayed commit" (§4b) | `commitAction` already **is** a delayed-commit-with-Undo (`ReviewQueue.tsx:47-72`, `COMMIT_MS`) | **Reuse/extend the existing delayed-commit.** No compensating route needed. (Say "delayed-commit, already present" in the C1 summary.) |
| **A13** | Cockpit is tokens-only, never hardcode a hex (§0.6, §4) | Cockpit CSS today is 100% tokens (recon §1); but the **mockup's RAG tints (`--rag-red/amber/green`) are NOT in `sbdaymaker_tokens.css`** — only `--sev-*` are | At C2, **add `--rag-*` tint tokens to `sbdaymaker_tokens.css`** (derived from `--sev-*` with alpha), then reference them. Do not inline the rgba() from the mockup. |
| **A14** | Coverage occurrence math (§1.2) | Mockup's `occ()` is an **approximation** (`round(N/7)`, `max(1,round(N/30))`) — illustrative only | Ignore the mockup's `occ()`; the mockup is the **visual** tiebreaker, not the math source. Use exact `lib/occurrences.ts` (A3). |
| **A15** | Worker on Node (plan/doc 11 imply Node 20) | `ingest.yml` pinned **Node 22** (recon §5) | Any new Action step targets Node 22. |
| **A16** | `sbdaymaker_schema.sql` is the data contract (§Contract) | Schema file is **stale** vs `supabase/migrations/**` (missing `source_runs`, `ingest_drops`, `image_*`, `photo_options`, `frequency`, `shared_plan`) (recon §3) | Treat **migrations as DB truth**. The new migration (§3) is written against the applied state, not the schema file. Optional later chore: back-port. Not blocking. |
| **A17** | Coverage vibe dimension mirrors the site's lens (§4c) | Live lens = plain `tags.includes(key)`, **no confidence threshold** at read time (recon §7) | Coverage vibe rows use plain tag membership. No threshold constant. |

**Nothing in this table re-opens a §1 locked decision** — each row is an implementation-surface adaptation only.

---

## 2. Per-phase adaptation notes (concrete paths to use downstream)

- **C1 — Shell + Queue.** New server layout wrapping `app/admin/review` (tabs deep-link to real routes). Upgrade `/api/review/approve` → approve-with-edits + `hero_eligible` (A5), folding `update`'s tag/neighborhood logic into one transaction. New `/api/admin/hero-eligible` (A2 audit). Extend `QueueRow` with `nearby_zone`+`hero_eligible` (A6). Extend the keydown handler with **H** (A11). Reuse `commitAction` for Undo (A12). Provenance pill from `source='restock:{id}'` (A8).
- **C2 — Coverage + queued Restock.** `lib/occurrences.ts` (A3, exact). `/api/admin/coverage` + `/coverage/cell`. Add `--rag-*` tokens (A13). Floor constants in one file (plan §1.3). Restock modal → `/api/admin/restock` writing `restock_directives` (queued). Worker directive-consumption behind a dry-run flag (plan §5.1, filter post-gate per A8).
- **C2b — Run now.** `GITHUB_DISPATCH_TOKEN` (A7, Decision 2) + `directive_id` input on `ingest.yml` + dispatch call in the restock route; prove secret absent from client bundle.
- **C3 — Catalog + `thing_edits`.** `/api/admin/catalog` + `/catalog/edit` (overlay insert). Queue merges pending overlays (A6). Approve-of-overlay applies to live row, marks overlay `applied`.
- **C4 — Hero plan.** `hero_pins` API + 14-day rail; "Auto" candidate logic reuses `cascade`/`withinHorizon`/`lib/occurrences.ts` (A10). **Pin consumption deferred** (A9) — flag it.
- **C5 — Hardening.** Keyboard-only walk, reduced-motion, 390px, empty/error states, audit spot-check.

---

## 3. Schema migration — presented for approval (⚠ do NOT apply until Jim says yes)

**Proposed file:** `supabase/migrations/20260702_cockpit_v2.sql`. Recon §3 confirms **no name/enum collisions** and that `things(id)`, `nearby_zone` (6 values), and `occasion_tag` all exist as the plan assumes. This is the plan's §2 migration **verbatim** (only the filename date is concretized):

```sql
-- 1) Restock directives: founder intent the nightly worker consumes.
create type restock_scope  as enum ('vibe','zone');
create type restock_status as enum ('queued','running','done','failed');

create table if not exists restock_directives (
  id            uuid primary key default gen_random_uuid(),
  scope_kind    restock_scope not null,
  scope_key     text not null,            -- occasion_tag value or nearby_zone value (app-validated against the enum)
  window_days   smallint not null default 30 check (window_days in (7,14,30,45)),
  status        restock_status not null default 'queued',
  requested_at  timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  results_count int,                      -- rows that survived the gate and landed needs_review
  run_note      text                      -- worker diagnostics ('3 landed, 12 dropped: 9 dup, 3 no_start')
);
create index restock_status_idx on restock_directives(status, requested_at desc);

-- 2) Hero pins: founder intent the nightly edition-drafter consults.
--    NOT a parallel hero system — editions/edition_picks remain the "one approved
--    day" artifact; a pin just pre-decides the hero slot for that date.
create table if not exists hero_pins (
  pin_date    date primary key,
  thing_id    uuid not null references things(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- 3) Pending edits of LIVE things: an overlay, so the published row is never
--    destabilized while an edit awaits review.
create table if not exists thing_edits (
  id          uuid primary key default gen_random_uuid(),
  thing_id    uuid not null references things(id) on delete cascade,
  payload     jsonb not null,             -- only the changed fields (title/blurb/blurb_long/tags/photo_*/price_band/time fields)
  status      text not null default 'pending' check (status in ('pending','applied','discarded')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index thing_edits_one_pending on thing_edits(thing_id) where status = 'pending';
```

**Two notes for your call (neither blocks approval):**
- The migration adds **no RLS policies** — consistent with recon §3 (admin/ops tables have no public policies and are reached only via the service-role client). New tables are admin-only by construction. ✅ recommended as-is.
- `hero_pins`/`thing_edits` are pure **intent/overlay** storage (plan §2 rationale). Given A9 (no edition-drafter yet), `hero_pins` will be written and read by the Hero-plan tab but **not yet consumed** by any nightly drafter — exactly the graceful-degradation the plan intends.

---

## 4. STOP — approval gate

**Per build-plan §6 (C0 exit) and your instruction, I am stopping here.** Nothing has been applied and no product code written. To proceed to C1 I need your explicit **yes** on:

1. **Apply the migration above** (`20260702_cockpit_v2.sql`) as written — or tell me what to change.
2. The three resolved decisions in §0 (Coverage helper / GitHub token at C2b / this file as the delta ledger) — already per your "go with recommendations," recorded here for the record.

On your yes, C1 begins (shell + queue upgrade), and I'll stop again at the C1 exit with rendered results at ~390px and ~1280px.
