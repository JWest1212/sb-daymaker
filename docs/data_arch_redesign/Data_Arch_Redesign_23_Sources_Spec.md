# Data Arch Redesign · 23 — Sources as Data + Health Monitoring

`Status: v1 · 2026-07-12 · build spec. Keystone of the sourcing redesign. Cites Doc 16 (§3.1-3.3, §3.10), and reuses the venues-table pattern from Doc 19.`

> **What this builds.** Every ingestion source today is hardcoded: an entry in an adapter registry, a rank in a regex table, no row anywhere. This spec makes each source a **row in a `sources` table**, with the fields needed to score, schedule, and monitor it, and adds **silent-miss detection**: an alert when a source that normally returns events quietly returns nothing. This is the keystone; the confidence gate (24), the extraction lane (25), and the dedup upgrade (26) all read from or write to this table.
>
> **Precedence.** `CLAUDE.md` is the contract; code is truth. `lib/explore.ts` untouched. Additive-only DDL, applied by Jim. Behavior parity for the adapters is the bar: turning them into rows must not change what they ingest.

---

## 1. Why this is the keystone

Doc 16's central finding: the pipeline is capped because every source lives in code, so you cannot add, score, prioritize, retire, or measure a source without a code change. Three things become possible only once sources are rows:

1. **Prioritization** by authority, yield, and uniqueness (feeds spec 24 and future discovery).
2. **Silent-miss detection** by comparing each source's run against its own baseline (the single cheapest defense of the coverage promise; a source returning `[]` currently logs as healthy).
3. **Reliability learning** over time (a source's track record becomes data the pipeline can act on).

Nothing here changes what the adapters *do*. It changes where their identity and health *live*.

---

## 2. What exists today (Phase 0 confirms, read-only)

Before designing the table, confirm the live shape: where the adapter registry is defined, the fields each adapter carries, how the canonical-source ranking works (the regex table from `dedupe.ts`), where run outcomes are recorded today (the audit found `source_runs` / `ingest_drops` style tables, confirm names), and the current count of active/disabled sources. The table is modeled on what actually exists. Do not assume; read it.

---

## 3. Schema (additive, Jim applies)

### 3.1 `sources`
```sql
create table if not exists sources (
  id                uuid primary key default gen_random_uuid(),
  key               text not null unique,        -- stable slug, matches the adapter key
  label             text not null,
  url               text,
  lane              text not null default 'structured',  -- 'structured' | 'generic' | 'render' (25 uses this)
  parse_method      text,                        -- 'api' | 'ics' | 'jsonld' | 'wp_rest' | 'html' | ...
  authority         numeric(3,2) not null default 0.70,  -- 0-1, feeds dedupe rank + prioritization
  category_hints    text[] not null default '{}',
  neighborhood_hint neighborhood,
  crawl_frequency   text not null default 'nightly',     -- 'nightly' | 'weekly' | 'reserve'
  expected_yield    integer not null default 0,          -- rolling median events/run; baseline for alerts
  last_ok_at        timestamptz,
  last_yield        integer,
  consecutive_empty integer not null default 0,
  reliability       numeric(3,2) not null default 1.00,  -- learned 0-1
  maintenance_burden smallint not null default 1,        -- 1-5
  status            text not null default 'active',      -- 'active' | 'paused' | 'retired' | 'candidate'
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table sources enable row level security;   -- service-role / cockpit only
```

### 3.2 Run history (reuse or add)
If a `source_runs`-style table already exists (Phase 0), reuse it; otherwise add a minimal one so baselines can be computed:
```sql
create table if not exists source_runs (
  id          uuid primary key default gen_random_uuid(),
  source_key  text not null references sources(key),
  ran_at      timestamptz not null default now(),
  fetched     integer not null default 0,
  landed      integer not null default 0,
  errored     boolean not null default false,
  error_note  text
);
create index if not exists source_runs_key_time_idx on source_runs(source_key, ran_at desc);
```

The `dedupe.ts` canonical-source regex ranking is replaced by a join on `sources.authority`.

---

## 4. Migration approach (parity-first)

**Seed from the registry.** Generate one `sources` row per existing adapter, carrying its key, label, lane/parse_method, and an initial `authority` derived from the current regex rank (venue-direct high, aggregators low). No hand entry.

**Point the pipeline at the table.** The orchestrator reads source config and dedupe authority from `sources` instead of the hardcoded registry/regex. The adapters themselves (the parse logic) stay exactly as they are; only their registration and ranking move to data.

**Parity gate.** A dry run must produce the same landed set and the same dedupe canonical choices as before the migration. Only then is the hardcoded registry/regex retired.

---

## 5. Silent-miss detection (the monitoring half)

### 5.1 Baselines
After each run, update `sources.last_yield`, `last_ok_at`, and a rolling `expected_yield` (median of recent non-zero runs). `consecutive_empty` increments on a zero-yield run, resets on a healthy one.

### 5.2 The alert
A source fires an alert when it drops **materially below its own baseline**, not against a global threshold. Concretely: a run returns 0 (or below a fraction of `expected_yield`) for a source whose `expected_yield` is meaningfully above 0. This catches the exact failure the audit flagged: an SPA shell or changed page structure returning `[]` while logging green. New/low-yield sources do not false-alarm because their baseline is near 0.

### 5.3 Channels
- **Cockpit:** a health panel in the Coverage area (reuse the surface from Doc 19): each source with yield-vs-baseline, `last_ok_at`, and `consecutive_empty`, sorted so problems surface first.
- **Push:** a daily summary via the verified Resend sender listing any source below baseline and any missed run (dead-man's-switch: the nightly job records a heartbeat; no heartbeat by a cutoff also alerts).

### 5.4 Auto-pause
After N consecutive empties (default 5, tunable), set `status = 'paused'` and alert, so a broken source stops wasting the run budget until you look at it.

---

## 6. Cockpit: Sources surface

Under the Coverage area (or its own tab): list sources with key, lane, status, authority, expected vs last yield, last-ok, and consecutive-empty. Actions: pause/resume, edit authority/frequency, retire, add a candidate. Same register as the other cockpit tables; 44px targets; WCAG AA; keyboard-friendly. Adding a source here is how spec 25's generic lane will onboard the long tail without code.

---

## 7. Phased build (stop and show)

**Phase 0 — Read the current sourcing (read-only).** Registry location and fields, dedupe regex ranking, existing run tables, source count. *Show:* findings and the finalized schema before any DDL.

**Phase 1 — Tables + seed.** Jim applies DDL. Seed `sources` from the registry with derived authority. *Show:* row count, and a comparison of seeded authority vs the old regex order.

**Phase 2 — Pipeline reads the table (parity).** Orchestrator reads source config + dedupe authority from `sources`; dry run asserts identical landed set and canonical choices. *Show:* parity report (0 differences to proceed); then retire the hardcoded registry/regex.

**Phase 3 — Run history + baselines.** Record each run to `source_runs`; compute `expected_yield`, `last_yield`, `last_ok_at`, `consecutive_empty`. *Show:* baselines populated after a run.

**Phase 4 — Alerts + auto-pause.** Cockpit health panel; daily Resend summary; dead-man's-switch heartbeat; auto-pause after N empties. *Show:* a deliberately-emptied source (test) firing the alert and the panel flagging it.

**Phase 5 — Sources cockpit surface.** The management UI in section 6. *Show:* pausing/adding a source from the cockpit and the pipeline honoring it next run.

---

## 8. Acceptance checklist

- [ ] Phase 0 documented the real registry/regex/run shape; schema matches.
- [ ] `sources` (and run history) created with RLS; seeded from the registry; authority derived from the old rank.
- [ ] Pipeline reads source config and dedupe authority from `sources`; parity dry run shows 0 differences; hardcoded registry/regex retired.
- [ ] Each run writes `source_runs`; baselines (`expected_yield`, `last_yield`, `last_ok_at`, `consecutive_empty`) update.
- [ ] Below-baseline alert fires per-source (not global); new/low-yield sources do not false-alarm.
- [ ] Dead-man's-switch alerts on a missed nightly run; auto-pause after N empties.
- [ ] Cockpit Sources surface lists health and supports pause/resume/edit/retire/add.
- [ ] No `lib/explore.ts` change; never touched `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.
- [ ] Adapters' ingest behavior unchanged (same events landed as before the migration).

---

## 9. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then this spec (Data_Arch_Redesign_23_Sources_Spec.md), then Doc 16 sections 3.1-3.3
and 3.10 for rationale. Make ingestion sources DATA (a sources table) instead of hardcoded, and add
silent-miss monitoring. Parity is the bar: the adapters must land the same events after the migration.
Do the phases in section 7, ONE at a time, stop and show me after each, wait for my go.

Constraints:
- I apply all DDL by hand in Supabase; give me exact SQL and wait for confirmation.
- lib/explore.ts consumed as-is. Never touch lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx,
  NearMeSheet.tsx.
- Do NOT retire the hardcoded registry/regex until a parity dry run shows 0 differences in both the
  landed set and the dedupe canonical choices.
- Alerts are per-source vs the source's own baseline, never a global threshold. Use the verified
  Resend sender for the daily summary.

Phase 0 now (read-only): find the adapter registry and the dedupe canonical-source ranking, list the
fields each source carries, show where run outcomes are recorded today, and count active/disabled
sources. Then propose the final sources + run-history schema and stop.
```

---

*End of Data Arch Redesign 23. On completion, proceed to 24 (confidence gate + conservative auto-publish), which reads `sources.authority` and `reliability` as inputs.*
