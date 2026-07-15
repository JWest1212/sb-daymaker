# Data Arch Redesign · Side Spec — Recurring Registry: Code to Data

`Status: v1 · 2026-07-12 · build spec. Moves the founder-maintained recurring rhythms from a hardcoded TypeScript file into a DB table edited in the cockpit. Cites Doc 16 (data-not-code) and the venues-table pattern from Doc 19.`

> **What this builds.** `recurringRegistry.ts` (or equivalent) is a hardcoded TypeScript file of standing weekly/monthly rhythms that you hand-edit and paste. This spec moves those rows into a `recurring_rhythms` DB table you edit in the cockpit, so recurring events become data like sources and venues, not code. The nightly pipeline reads the table instead of the file.
>
> **Precedence.** `CLAUDE.md` is the contract; code is truth. Additive-only DDL, applied by Jim. Behavior parity is the bar: the pipeline must produce the same recurring things after the migration as before.

---

## 1. Why now, and the one caveat

Doc 16 recommended making the recurring registry data rather than code, alongside sources and venues. Doing it now (your call) removes a standing bit of code-editing friction and lets recurring rhythms participate in coverage and monitoring later. The caveat you should hold: this is a **migration with a parity risk**. The recurring registry drives real things that appear in the live feed, so the failure mode is "a standing event silently stops appearing." The whole spec is built around proving parity before the file is retired, so that risk is controlled.

---

## 2. What exists today (Phase 0 confirms)

Before designing the table, confirm the live shape (read-only): the file's path, the exact fields each rhythm carries (name, venue, day-of-week or cadence, time, category/activity, zone, any start/end window), how the pipeline reads it, and how many rhythms exist. The table schema mirrors whatever the file actually stores, plus provenance. Do not assume the fields; read them.

---

## 3. Schema (additive, Jim applies)

A `recurring_rhythms` table mirroring the file's fields. Illustrative shape, finalized against Phase 0 findings:

```sql
create table if not exists recurring_rhythms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  venue         text,
  neighborhood  neighborhood,             -- reuse existing enum; door maps to zone in code
  cadence       text not null,            -- e.g. 'weekly' | 'biweekly' | 'monthly'
  day_of_week   smallint,                 -- 0-6 where applicable
  time_text     text,                     -- display time, matching the file's format
  category      happening_category,       -- reuse existing enum
  activities    text[] not null default '{}',
  starts_on     date,                     -- optional window
  ends_on       date,
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table recurring_rhythms enable row level security;   -- service-role / cockpit only
```

Match column names and types to the file's real fields so the pipeline change is a swap, not a reshape.

---

## 4. Migration approach (parity-first)

**Seed from the file.** Generate the initial rows directly from the current registry contents, so the table starts as an exact copy. No hand re-entry.

**Dual-read, compare, then cut over.** For one step, have the pipeline read both the file and the table and assert they produce identical recurring output. Only once they match byte-for-byte does the file get retired. This is the parity gate that de-risks the migration.

**Retire the file.** Once the table is authoritative and parity is proven, remove the file's role (leave the file itself if other code references it until a later cleanup, but the pipeline reads only the table).

---

## 5. Cockpit editing

A Recurring Rhythms surface (under the Venues or Coverage area): list rows, add, edit, toggle `active`. This replaces the edit-a-file-and-paste loop. Same register as the other cockpit tables: functional, keyboard-friendly, 44px targets, WCAG AA. Adding or editing a rhythm here writes to the table and the next nightly run reflects it, no deploy.

---

## 6. Phased build (stop and show)

**Phase 0 — Read the file (read-only).** Report path, fields, reader logic, row count. *Show:* the findings and the finalized table schema before any DDL.

**Phase 1 — Table + seed.** Jim applies the DDL. Seed rows from the file exactly. *Show:* row count and a spot comparison of table vs file.

**Phase 2 — Dual-read parity.** Pipeline reads both; assert identical recurring output over a dry run. *Show:* a parity report (0 differences required to proceed).

**Phase 3 — Cut over + cockpit.** Pipeline reads only the table; build the cockpit editor. *Show:* a rhythm edited in the cockpit appearing correctly in a dry-run feed.

---

## 7. Acceptance checklist

- [ ] Phase 0 documented the file's real fields; schema matches them.
- [ ] `recurring_rhythms` created with RLS; seeded exactly from the file (row counts equal).
- [ ] Dual-read parity shows 0 differences before cutover.
- [ ] Pipeline reads the table only; file no longer drives recurring output.
- [ ] Cockpit editor: add / edit / toggle active works; changes reflect next nightly run.
- [ ] No `lib/explore.ts` change; never touched `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.
- [ ] A standing rhythm that appeared before the migration still appears after (spot-checked).

---

## 8. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then this spec (Data_Arch_Redesign_Recurring_Registry_Spec.md). Migrate the
hardcoded recurring registry into a DB table the pipeline reads, editable in the cockpit. Parity is
the bar: the pipeline must produce identical recurring output before the file is retired. Do the
phases in section 6, ONE at a time, stop and show me after each, wait for my go.

Constraints:
- I apply all DDL by hand in Supabase; give me exact SQL and wait.
- lib/explore.ts consumed as-is. Never touch lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx,
  NearMeSheet.tsx.
- Do NOT retire the file until dual-read parity shows 0 differences.

Phase 0 now (read-only): find the recurring registry file, list its exact fields, show how the
pipeline reads it and how many rhythms exist, then propose the final table schema and stop.
```

---

*Side spec, outside the numbered sourcing sequence. Makes recurring events data, consistent with sources and venues.*
