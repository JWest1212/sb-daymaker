# SB Daymaker Remediation R1: Build Index

Status: ready for Claude Code. Source: the 2026-09-21 UI audit (103 findings) and the 2026-09-21 technical pass (docs/audits/2026-09-21-technical-pass.md). Eight waves grouped into three runs. Claude Code runs each run end to end and stops only at five named checkpoints.

Place this folder at docs/remediation-r1/. The audit log belongs at docs/audits/SB_Daymaker_UI_Audit_Log.md so acceptance tests can cite finding IDs.

## Prime directive

Fix root causes before symptoms, and never make a fix that can delete a visitor's saves. The order is load-bearing. Wave 1 must land before Wave 2 because retiring past events on the current code would delete more saves, not fewer.

## How the build runs (read this first)

- Three runs, not eight sessions. Run A is Waves 1 and 2. Run B is Waves 3, 4, and 5. Run C is Waves 6, 7, and 8. Inside a run, Claude Code moves from task to task without asking, commits after every wave, and keeps docs/remediation-r1/PROGRESS.md current (wave, task, status, blockers) so any new session can resume with the Resume prompt.
- Five checkpoints only. Claude Code stops, shows evidence, and waits for "go" at exactly these moments:
  - CP1 (Wave 2): before archiving finished events. Shows the dry-run counts by month and 20 titles.
  - CP2 (Wave 2): before the hero_eligible data pass. Shows counts per rule and 20 examples that would lose eligibility.
  - CP3 (Wave 4): before writing the area backfill. Shows the table of proposed assignments by source and 30 examples.
  - CP4 (Wave 6): after the card rebuild, before the layout work. Shows the homepage at 390px in Today, Weekend, and Month.
  - CP5 (Wave 8): before committing canon. Shows the CLAUDE.md and Doc 14 diffs.
  Everything else, including every dry-run in Wave 5, runs without a stop; Claude Code applies its own review rules and reports what it did in the run summary.
- One DDL paste, before anything starts. All additive columns, one index, and one read policy are in the single block below. Nothing else touches the schema.
- Claude Code runs every Acceptance line itself with its browser tools and reports only failures and the three URLs worth a look. Jim reads screenshots at checkpoints and a short summary at the end of each run.
- Two prompts total: Kickoff (once) and Resume (whenever a session ends early). No per-wave starters.
- If a wave cannot complete because of something outside its scope (a missing enum value, a source with no data), Claude Code writes it to PROGRESS.md under "Blocked", skips that task, and continues; blocked items are listed in the run summary.

## Why this order

1. Run A stops the site from deleting saves, restores the 533 hidden listings, retires the dead events that caused the overflow, and gives the day's pick real rules. This is the trust layer, and it is why saves must be fixed before events are archived.
2. Run B fixes what the front end depends on: Plan's logic, one area vocabulary that Explore, Plan, and Saved all consume, and the pipeline that writes titles, blurbs, series, images, and the digest sample.
3. Run C rebuilds the screens on clean data: the Explore shell and one card anatomy, the loops around Saved and share, offline, forms, metadata, then names, voice, the welcome flow, and canon.

## Decision ledger (defaults; override before the wave that uses them)

| # | Decision | Used by | Override by |
|---|---|---|---|
| D1 | Saved resolves each saved id directly. It never auto-deletes. Unknown ids render as "no longer listed" with a remove control. | W1 | W1 start |
| D2 | The public pool excludes finished events at query time. The pipeline archives events 7 days after they end. Archived detail pages stay reachable with an "already happened" banner so saved, shared, and restore links never 404. | W1, W2 | W1 start |
| D3 | Civic meetings get an additive `is_civic` flag set by source adapter. The feed, pick, search, and Plan exclude them. No civic surface in R1. | W2 | W2 start |
| D4 | Library programs stay. "LOTG" becomes "Library on the Go". Recurring sessions collapse into one card per series. | W5, W6 | W5 start |
| D5 | The Place door becomes a real filter. The 8 door areas are the public vocabulary. `nearby_zone` is mapped to them, not migrated, in R1. Areas with zero results show as disabled with their count. | W4 | W4 start |
| D6 | Recurring series display as one card per series per horizon ("Every Sunday, next Sep 27") using a `series_key`. Data-model consolidation is deferred. | W5, W6 | W5 start |
| D7 | The WHEN row ships the locked six pills: Today, Tomorrow, Weekend, Next Wknd, Week, Month. | W6 | W6 start |
| D8 | The blocking welcome overlay becomes a dismissible strip over real content. The full tour stays behind "How SB Daymaker works". | W8 | W8 start |
| D9 | No em dashes anywhere. En dashes become "to" in prose and a hyphen in numeric ranges. | W5, W8 | W5 start |
| D10 | The first-three-visits hero rule is not built in R1 and is removed from canon. | W8 | W8 start |
| D11 | Near Me on Explore is not built. The Place door covers it. Canon updated. | W4, W8 | W4 start |
| D12 | The digest sample renders from live data for the current send week. | W5 | W5 start |
| D13 | The guides' "one detail is wrong on purpose" game is retired until the catalog's accidental errors are fixed. | W5 | W5 start |
| D14 | Civic feeds keep ingesting (for a future surface) but never publish to the public pool. | W2 | W2 start |

## Invariants for every wave

- The eight CLAUDE.md constraints hold. The ranker never reads sponsor status. No per-request AI. No accounts. No new paid services.
- DDL is additive only and is pasted by Jim into the Supabase SQL editor. Claude Code never runs migrations. Each block below uses `if not exists`.
- Tokens only. No new hex values. Small text uses Ink, Ink-2, or Pacific.
- Zero em dashes in code, copy, data, emails, alt text, slugs, and these specs. Plain dollar signs.
- The 597-test suite stays green. Each wave adds tests for the pure functions it touches.
- `lib/explore.ts` sort keys (`happening_tier`, `starts_at`) are not changed. Filters and eligibility are added around the cascade, not inside it.
- Every wave ends with the Acceptance list run in a browser at 390px width and reported as pass or fail per line, then a stop.
- Never disable `react-hooks/exhaustive-deps` without a comment proving the dependency is inert.

## The single DDL paste (Jim, before Kickoff)

```sql
-- R1 additive schema. Safe to run more than once.
alter table things add column if not exists is_civic boolean not null default false;
alter table things add column if not exists archived_at timestamptz;
alter table things add column if not exists series_key text;
alter table things add column if not exists venue_name text;
alter table things add column if not exists price_note text;
create index if not exists things_pool_idx on things (status, happening_tier, starts_at) where status = 'published';
create index if not exists things_series_idx on things (series_key) where status = 'published';
-- Saved and shared links must be able to render items that already happened.
drop policy if exists things_read_archived on things;
create policy things_read_archived on things for select to anon using (status = 'archived');
```

No enum changes. If a wave needs an enum value the live database lacks, it records the gap in PROGRESS.md and continues.

## Wave map

| Wave | Name | Size | Root findings closed |
|---|---|---|---|
| 1 | Stop the loss | S to M | SAV-001, SAV-002, SHR-001, TP-A1, TP-A3, TP-A4-05 |
| 2 | Retire the dead, gate the pick | M | EXP-001, EXP-004, DET-001, DET-003, DET-004, DET-014, EXP-007, EXP-010, EXP-017, TP-A7-06, TP-A8, TP-C8-03 |
| 3 | Plan integrity | M | PLN-001 to PLN-008, TP-A9, DSC-003 |
| 4 | Where things are | L | EXP-002, EXP-003, EXP-038, PLN-003, PLN-006, SAV-006, SAV-007, DET-002, DET-009, XC-005, TP-A2 |
| 5 | Pipeline and content quality | L | EXP-005, EXP-006, EXP-008, EXP-009, EXP-030 to EXP-033, DET-005, DET-006, DET-008, DET-010, DET-011, CON-001, CON-003, DSC-001, DSC-006 to DSC-008, DSC-010, XC-002, TP-A7 |
| 6 | Explore shell and cards | L | EXP-011 to EXP-016, EXP-019, EXP-021, EXP-024 to EXP-029, EXP-034, EXP-036, MAP-001, DET-007, DET-015, DSC-004, EDG-001, META-002, A11Y-001, A11Y-003, TP-A6, TP-B-01, TP-B-05, TP-C1, TP-C4, TP-C6, TP-C7 |
| 7 | Saved, share, offline, forms, metadata | M | SAV-003, SAV-005, SHR-002, SHR-003, SHR-004, FRM-001, FRM-002, EML-001, CON-002, META-001, META-003, DET-013, A11Y-002, A11Y-005, TP-A5-02, TP-C3 |
| 8 | Names, voice, welcome, canon | M | XC-001, XC-004, XC-006, MAP-002, MAP-003, EXP-035, EML-002, DSC-005, DSC-009, PLN-005, DET-012, DSC-002, TP-C2, TP-C8-05 |

Retracted or not defects, do not build: EXP-018, EXP-023, EXP-037, SAV-004, META-004, A11Y-003 (focus rings are on the card, correct), TP-B-02, TP-B-04, the hearts part of SHR-002.

Full coverage matrix: 09_R1_Coverage_Matrix.md.

## Jim's parallel track (cockpit, no code, any time after Run A)

- Reject the "AUDIT TEST" submission and report. Delete the three audit share tokens and the restore token if desired.
- After Run B, open the neighborhood sweep console for rows the backfill could not resolve.
- After Run B, spot-check 30 listings for blurb quality.
- Confirm the civic source list (D3) is complete.

## Kickoff (paste once, after the DDL)

```
We are starting Remediation R1 for SB Daymaker. The specs live in docs/remediation-r1/.

1. Read docs/remediation-r1/00_R1_INDEX.md in full. The prime directive, "How the build runs", the decision ledger, and the invariants are hard rules for the entire build. Then read CLAUDE.md and docs/audits/2026-09-21-technical-pass.md.
2. Confirm the R1 DDL landed: the columns is_civic, archived_at, series_key, venue_name, price_note exist on things and the anon role can select archived rows. If anything is missing, stop and tell me exactly what to paste.
3. Create the branch remediation-r1 from the current production branch and tell me which branch that was. Run the test suite and record the count in docs/remediation-r1/BASELINE.md with: published row count, rows returned by getPublishedThings(), happening_tier 2 and 3 rows in the pool, Lighthouse mobile LCP for /, and a 390px homepage screenshot.
4. Create docs/remediation-r1/PROGRESS.md and keep it current after every task.
5. Run Run A (Waves 1 and 2) end to end. Stop only at CP1 and CP2 as defined in the index, show the evidence, and wait for my "go". Commit after each wave with the message in the spec. Run every Acceptance line yourself and report only failures.
6. When Run A is complete, give me a plain-language summary of what changed, what I should look at on the live preview (three URLs), anything blocked, and then stop and wait before Run B.

Run B (Waves 3, 4, 5) stops only at CP3. Run C (Waves 6, 7, 8) stops only at CP4 and CP5. I will say "start Run B" and "start Run C". I never run terminal commands; you handle all execution and explain in plain terms.
```

## Resume (paste whenever a session ended early)

```
Resume Remediation R1. Read docs/remediation-r1/PROGRESS.md, then the index and the spec for the wave in progress. Continue from the first task not marked done, without repeating completed tasks. The checkpoint rules in the index still apply: stop only at CP1 to CP5, and only if that checkpoint has not already been approved (PROGRESS.md records approvals). Report when the current run is complete.
```

## Mid-build utilities

```
Pause. Re-read the invariants and decision ledger in docs/remediation-r1/00_R1_INDEX.md and tell me whether anything in the last hour of work drifted from them.
```
```
Run the golden-rule check: grep the repo, the built pages, and the last 200 published rows for U+2014 and report every hit.
```
