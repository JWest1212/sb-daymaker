# SB Daymaker — Cockpit v2 Build Plan (Claude Code execution spec)

**Generated:** 2026-07-02 · **Status:** build-ready pending Phase C0 approval gate
**Visual target:** `docs/cockpit-v2/SBDaymaker_Cockpit_Redesign_Mockup_v1.html` (approved interactive mockup)
**Ground truth:** `docs/cockpit-v2/00_CockpitV2_Recon.md` (produced by the recon prompt — **must exist before Phase C1 begins**)
**Contract:** `CLAUDE.md` · `sbdaymaker_schema.sql` · `sbdaymaker_tokens.css` · `11_SBDaymaker_Ingestion_Build_Guide.md`

---

## 0. How to drive this build

- **Read this entire file, then `CLAUDE.md`, then the recon file, before writing any code.** Where this plan and the recon file disagree, **the recon file (i.e., the live code) wins** — adapt the plan's file paths and patterns to what actually exists, and note each adaptation in your phase summary. Where this plan and a canonical doc disagree, flag the doc as stale; do not silently reconcile.
- **One phase at a time (C0 → C5).** At the end of each phase: stop, run the dev server yourself, verify in the browser, and show me the result at **both phone (~390px) and desktop (~1280px) widths**. Tell me in plain terms what you built, what changed, what to click, and what's next. Wait for my go-ahead. Do not ask me to run terminal commands — run everything yourself.
- **The mockup is the visual tiebreaker** for anything UI. Open it, interact with it, and match it. It uses only v9 tokens; so must you. Never hardcode a hex, font, or spacing value.
- **This is the admin cockpit, not the public app.** Everything here sits behind the existing admin auth (recon §1 tells you where that boundary is). Nothing in this build touches the public bundle, `lib/explore.ts`, or any end-user surface, with one narrow exception noted in §6 (the edition drafter reads `hero_pins`).

### Hard invariants (violating any of these is a failed phase)

1. **The trust rule.** Nothing in Cockpit v2 — coverage math, restock, hero plan, catalog — reads or writes `is_featured` or `sponsor_id`, and nothing feeds sponsor status to any ranking path. The hero *pin* is founder curation, which is allowed; the *auto* fallback remains the existing sponsor-blind ranker.
2. **Batch AI only.** Restock never makes a Claude call from a request handler. "Queue for tonight" writes a row. "Run now" dispatches the existing GitHub Action worker. The Next.js app itself never calls the Anthropic API.
3. **Only a human tap publishes.** Ingestion and restock land `status='needs_review'`. The single write path to `status='published'` is the approve route. AI never sets or alters a start time — restock candidates pass the same strict gate.
4. **Additive schema only, behind the C0 approval gate.** No changes to existing tables' columns or enums. New tables only, and only the three specified in §2, and only after I approve the migration at the C0 checkpoint.
5. **Every state change writes `audit_log`** (approve, approve-with-edits, reject, hero toggle, hero pin/unpin, restock request, catalog edit submitted, edit applied). Actor `'founder'` for cockpit actions, `'system'` for worker actions.
6. **WCAG 2.2 AA from the first component:** tokens only, visible `:focus-visible` rings, ≥44×44 targets, keyboard-operable everything, `prefers-reduced-motion` honored, `aria-pressed`/`aria-selected` on toggles and tabs, `aria-label`s matching the mockup's.
7. **Solo-operator budget.** If any part of this plan turns out to require ongoing daily attention beyond the existing 15-minute routine, stop and flag it rather than building it.

---

## 1. What we're building (orientation)

Cockpit v2 turns the single-purpose review page into a four-tab admin surface:

| Tab | Job | Route (adapt to recon §1's conventions) |
|---|---|---|
| **Queue** | Review + one-press approve-with-edits + hero flagging | existing review route, upgraded in place |
| **Coverage** | Vibe × window and Zone × window heatmaps + Restock | `app/admin/coverage/` |
| **Live catalog** | Browse/filter everything published; edit → re-review; hero toggle | `app/admin/catalog/` |
| **Hero plan** | 14-day rail; pin a hero per day; Auto = existing ranker | `app/admin/heroes/` |

All four share the cockpit shell (top bar with queue/dropped/source-down counts, tab strip). Build the shell as a layout so the existing queue page nests into it rather than being rewritten.

### Locked product decisions (settled — do not re-open)

1. Coverage cells count **Tier 1 + Tier 2 occurrences** within each window (7/14/30/45 days, cumulative, from today). Tier 3 appears only as the grey "N evergreen behind it" row annotation — excluded from RAG math.
2. Tier-2 occurrence math is **exact, not approximate**: for each `recurring_schedules` row, occurrences = the count of that `day_of_week` in the next N days. Reuse/extract the site's own cascade expansion logic (recon §7) so cockpit math and site behavior can never disagree.
3. RAG shading is **relative within each column** (33rd/67th percentile across rows) **with an absolute floor applied by default** (7d < 3, 14d < 5, 30d < 8, 45d < 10 ⇒ red regardless of rank). The floor is a checkbox in the UI, on by default; floors live in one constants file.
4. Restock is **queued by default** (a directive row tonight's worker consumes) with a **Run now** override (workflow_dispatch on the existing Action).
5. **Approve = save + publish in one press.** The approve route accepts an optional edits payload and applies it and publishes in a single transaction. There is no separate save step anywhere in the cockpit.
6. Editing a **live** thing sends it back through the queue for a second look, and **the live version stays published untouched** until the edit is approved. Implemented as a `thing_edits` overlay row, not a status change on the live row (§2).
7. Hero flagging (`hero_eligible`) is metadata-only and **applies immediately** from Queue or Catalog — no re-review round-trip.
8. Hero plan: pin is an override; unpinned days fall back to the existing ranker ("Auto"). A pin whose thing is archived, or whose Tier-1 date no longer matches, **auto-clears to Auto** and the day is flagged in the rail.
9. Neighborhood coverage uses the **six `nearby_zone` values**, not the 11 granular neighborhoods.
10. Reject stays single-press (no reason picker). Deferred options recorded in the mockup's notes are **not** in this build: reject-reason quick-pick, Tier-3 depth column, catalog Archive action.

---

## 2. Schema migration — `supabase/migrations/2026xxxx_cockpit_v2.sql` (⚠ C0 approval gate)

Additive only. Present this migration to me at the C0 checkpoint **before applying it**. If recon §3 shows any of these names collide or the live enum values differ from `sbdaymaker_schema.sql`, stop and show me the conflict.

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

**Rationale you can relay if I ask:** `thing_edits` as an overlay (vs. cloning the row) avoids poisoning trigram dedupe with a near-identical sibling, keeps the uuid stable for saves/share-links already in users' `localStorage`, and makes "the live version stays up" true by construction. `hero_pins` as intent (vs. pre-creating future editions) keeps `editions` meaning what it means today — one drafted/approved day — and degrades gracefully if edition drafting isn't built yet (recon §6 tells you which world we're in; see §6 below).

---

## 3. API routes (server, admin-authed; adapt paths/patterns to recon §§1–2)

Every route: validate the caller is the authenticated admin, validate inputs against the enums, write `audit_log`, return the minimal JSON the client needs. Use the existing Supabase client pattern from recon §3.

| Route | Method | Contract |
|---|---|---|
| `/api/review/approve` | POST | `{ id, edits?: EditPayload, hero_eligible?: boolean }` → in **one transaction**: apply `edits` to the row (and `thing_tags` upserts with `tag_source='founder'`), set `hero_eligible` if provided, set `status='published'`, `last_confirmed=now()`, write `audit_log('approve', payload: edits)`. Enforce the negative rules at write time (21+ never gets `family_day`; non-free never gets `free_sb`) — reject the request with a clear message if violated. |
| `/api/review/reject` | POST | unchanged from today (recon §2), plus `audit_log`. |
| `/api/review/queue` | GET | today's contract, extended: each row includes its tags, zone, `hero_eligible`, photo fields, and — if the row is a pending `thing_edits` overlay — the merged preview + `edit_of: thing_id`. |
| `/api/admin/hero-eligible` | POST | `{ thing_id, hero_eligible }` → immediate update + audit. Serves Queue and Catalog. |
| `/api/admin/coverage` | GET | `?dim=vibe\|zone` → `{ rows: [{ key, label, evergreen, windows: {7,14,30,45} }] }` computed with the exact occurrence math of §1.2. One SQL round-trip per dimension if possible (a lateral join over windows), otherwise a single query post-processed in the route — never N×M queries. |
| `/api/admin/coverage/cell` | GET | `?dim=&key=&window=` → the drilldown list (id, title, tier, next occurrence string, occurrence count in window). |
| `/api/admin/restock` | POST | `{ scope_kind, scope_key, window_days, when: 'tonight'\|'now' }` → insert directive (`status='queued'`). If `when='now'`: also dispatch the ingest workflow via the GitHub REST API (`workflow_dispatch` with `directive_id` input) and set `status='running'`. **Requires a `GITHUB_TOKEN`-style secret server-side (recon §5 says whether one exists) — if it's a new secret, flag it at the C2 checkpoint before wiring it; never expose it client-side.** |
| `/api/admin/restock/list` | GET | recent directives for the rail (status, note, counts). |
| `/api/admin/catalog` | GET | `?tier=&vibe=&zone=&q=` → published things, paginated (50/page), each row carrying `pending_edit: boolean`. Search uses the existing trigram index (`title ilike` is acceptable at this scale if simpler). |
| `/api/admin/catalog/edit` | POST | `{ thing_id, payload }` → insert `thing_edits` (unique-pending index makes double-edits impossible; surface that error as "an edit is already awaiting review"). The live row is untouched. Audit. |
| `/api/admin/hero-pins` | GET/POST/DELETE | GET next-14-days pins + each day's valid candidates (⭑ things occurring that day per the §1.2 occurrence logic, plus ⭑ evergreens). POST `{ pin_date, thing_id }` — validate the thing is published, ⭑, and actually occurs that date. DELETE `{ pin_date }`. Audit both. |

**Approve-with-edits of a `thing_edits` overlay:** when the queue row being approved is an edit overlay, approve = apply `payload` (plus any further in-queue edits) to the **live** row, mark the overlay `applied`, keep `status='published'`, audit `('edit_applied')`. Reject = mark overlay `discarded`; the live row is untouched.

---

## 4. UI build (match the mockup; tokens only)

### 4a. Shell
Cockpit layout: pacific-dark top bar (brand, live counts pulled from the queue/drops endpoints), tab strip with counts, the run-status banner. Tabs are real routes sharing the layout — deep-linkable, and the browser back button behaves.

### 4b. Queue (upgrade in place)
Preserve the existing keyboard pattern (recon §9) and extend it: **A** approve (with pending edits + hero flag), **E** toggle edit-in-place, **H** hero toggle, **R** reject, **↑/↓** move, **B** bulk-approve green, **◂/▸** cycle photo while editing. Edit mode per the mockup: contenteditable title/blurb with gold affordance, tag pills toggle on/off (all 10 shown in edit mode; the negative rules grey out illegal pills with a tooltip rather than allowing an invalid state), photo cycling among resolver options, the gold "Edited: …" banner enumerating pending changes. Optimistic remove on approve/reject with an Undo toast (Undo re-inserts client-side and calls a compensating route — if today's code has no compensating pattern, implement Undo as a 5-second delayed commit instead; say which you chose). Cards from restock directives render the terracotta `restock · {scope}` provenance pill (join on `source` or a directive back-reference — recon §4 tells you what the landing step can carry; prefer stamping `things.source = 'restock:{directive_id}'`). Edit-overlay cards render a distinct kicker ("Founder edit of a live thing") and the approve button reads **Approve & replace live**.

### 4c. Coverage
The heatmap per the mockup: dimension toggle (vibe/zone), four cumulative window columns, per-column relative RAG + the floor checkbox (default on), deep tint for column max/min, count in Ink via `--font-mono`, colorblind-safe corner dot, `aria-label` per cell ("Date Night, next 14 days: 9 things"). Cell click → drilldown panel (not a modal) listing the cell's contents. Row-end ↻ Restock → the modal with the tonight/now radio, the gate reassurance copy from the mockup verbatim, and confirm → toast + the directives rail updates. Directives rail lives on Queue's sidebar *and* is reachable from Coverage. Empty-cell drilldown shows the mockup's "this is exactly what Restock is for" empty state.

### 4d. Live catalog
Dense rows per the mockup (thumb chip · title · tier chip · when · zone · vibes · price), tier segmented control + vibe select + zone select + search, count header ("N of M live"). ⭑ toggles instantly. **Edit** opens the same editor UI pre-filled; submitting posts to `/api/admin/catalog/edit`, flips the row to the dashed-gold "edit pending review" state (Edit disabled), and toasts the mockup's copy: the edit is at the top of the Queue; the live version stays up until re-approved.

### 4e. Hero plan
14-day rail per the mockup. Pinned day: pin pill + title + meta + **Change pin**. Unpinned: dashed **Auto** tile showing the ranker's projected pick for that date (compute with the same candidate logic as the picker: first ⭑ Tier-1 that day, else ⭑ recurring/evergreen — or, if recon §6 found a real ranker function, call that; never fork the logic). Picker sheet offers only valid candidates for that date; empty state per the mockup. Today's tile gets the gold ring. Stale-pin handling per §1.8: compute validity at read time and render the invalid-pin day amber with a one-tap "Clear to Auto".

---

## 5. Worker changes (`ingest/` — adapt to recon §4)

1. **Directive consumption (queued path):** at the start of the nightly run, read `restock_directives where status='queued'`, mark `running`. After the normal full run, execute a **targeted pass** per directive: re-run the adapter set with the directive as a hint — for `vibe` scopes, bias source selection (recon §4 says whether adapters take params; if they're zero-arg, run them all and filter candidates post-gate by proposed tag/zone before landing, stamping `source='restock:{id}'`). Everything flows through the **same gate → dedupe → enrich → land** path; nothing about the gate changes. Finish: `status='done'`, `results_count`, human-readable `run_note`. Failures: `status='failed'` + note — never throw the whole nightly run away because a directive failed.
2. **Run-now path:** add `workflow_dispatch` with a `directive_id` input to the existing ingest workflow. When invoked with a `directive_id`, run **only** that directive's targeted pass (not the full nightly). Same gate, same landing, same audit.
3. **Edition drafter + pins (conditional on recon §6):** if edition drafting exists, teach it: when drafting the edition for date D, if `hero_pins[D]` exists and is still valid (published, ⭑, occurs on D), set the hero pick from the pin and audit `('hero_pin_honored')`; else fall through to the existing ranker and, if a pin existed but was invalid, audit `('hero_pin_stale')`. If edition drafting does **not** exist yet, build nothing speculative — the Hero plan tab still works as intent storage, and you flag at the C4 checkpoint that pin *consumption* awaits the edition-drafter build.
4. **Batch-Claude cost note:** a directive's targeted pass adds one bounded enrich batch. Keep it inside the existing single-nightly-batch posture where possible (append directive candidates to the night's batch). Run-now necessarily makes its own batch call — that's the priced-in cost of the override; do not optimize it away by calling Claude from the app.

---

## 6. Phases, checkpoints, exit checks

**C0 — Recon reconciliation + migration approval (no product code).**
Read the recon file. Produce `docs/cockpit-v2/01_CockpitV2_Deltas.md`: every place this plan's assumptions differ from the live code, with your adaptation. Present the §2 migration verbatim. **STOP.** I approve the migration and the deltas before anything else happens.
*Exit:* deltas doc exists; migration applied only after my explicit yes; `npm test` still green.

**C1 — Shell + Queue upgrade.**
Layout/tabs/shell; queue upgraded per §4b; approve-with-edits transaction; hero toggle; H key; provenance pills; Undo. Existing queue behavior (bulk-approve, keyboard walk) must not regress.
*Exit:* approve a card with a title edit + tag toggle + photo change in one A-press and verify the published row carries all three + one audit row; negative-rule pill correctly blocked; both widths shown. **STOP.**

**C2 — Coverage + Restock (queued path only).**
Coverage API + heatmap + drilldown + floor toggle; restock modal writing directives; directives rail; worker's queued-path consumption (§5.1) behind a dry-run flag you demo with. Flag the GitHub-token question now (§3) so the answer is ready for C2b.
*Exit:* coverage numbers hand-verified against three SQL spot-checks you show me; a queued directive visibly consumed by a local worker dry-run landing `needs_review` rows with the restock stamp; both widths. **STOP.**

**C2b — Run now.** `workflow_dispatch` + the dispatch call from the restock route + running/done status polling in the rail.
*Exit:* one real dispatched run end-to-end; secret never present client-side (prove with a bundle grep). **STOP.**

**C3 — Live catalog + thing_edits round-trip.**
Catalog per §4d; edit overlay flow; overlay approval/rejection semantics in the queue.
*Exit:* edit a live thing → row shows pending state and the public page still renders the old content → approve in queue → live row updated, overlay `applied`, pending state cleared; reject path leaves the live row byte-identical. **STOP.**

**C4 — Hero plan.**
Rail, picker, pins API, stale-pin amber state; drafter integration per §5.3 if applicable.
*Exit:* pin/unpin round-trip with audit rows; an artificially staled pin renders amber and clears to Auto in one tap; both widths. **STOP.**

**C5 — Hardening pass.**
Keyboard-only walkthrough of all four tabs; reduced-motion check; 390px pass on every surface; empty states (empty queue, zero-coverage cell, no candidates in hero picker, catalog no-matches); error states (failed directive shows `failed` + note; dispatch failure surfaces a toast, not a silent swallow); audit-log spot-check of every action type in §0.5.
*Exit:* a written checklist with each item ticked, and a final plain-terms summary of what shipped, what was deferred (§1.10 list), and any proposed entries for `14_SBDaymaker_Build_Deltas.md`.

---

## 7. Explicitly out of scope (do not build, even if tempting)

Reject-reason picker · Tier-3 depth column · catalog Archive/unpublish · granular-neighborhood coverage · coverage trend-over-time charts · any Explore/Saved/Discover SB change beyond §5.3's drafter read of `hero_pins` · any new paid service · any per-request AI call · any schema change beyond §2.

*End of build plan. When in doubt between this document and the live code, the code is truth — flag the drift, don't paper over it.*
