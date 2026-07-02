# Cockpit v2 — Codebase Recon Prompt (paste this into Claude Code)

Copy everything below the line into Claude Code inside VS Code, at the repo root. It is **read-only** — it produces one markdown file and changes no code.

---

Read `CLAUDE.md` first, in full. Then perform a **read-only reconnaissance** of this repository and produce a single file: `docs/cockpit-v2/00_CockpitV2_Recon.md`. Do not modify, create, or delete any other file. Do not run migrations. Do not ask me to run any terminal commands — run everything you need yourself.

**Why:** I am about to hand you a build plan for Cockpit v2 (a four-tab admin redesign: Queue · Coverage · Live catalog · Hero plan). That plan was written against the canonical docs (`sbdaymaker_schema.sql`, `11_SBDaymaker_Ingestion_Build_Guide.md`, the Product Bible). Docs drift; code is truth. Your recon file is the ground-truth snapshot the build plan will be reconciled against. Where the live code disagrees with a canonical doc, **record the code's reality and flag the doc as stale** — do not "fix" anything during recon.

Structure the recon file with exactly these ten sections. In every section, cite **real file paths and line-anchored excerpts** from this repo (short excerpts, enough to be unambiguous). If something a section asks about does not exist in the repo, say so explicitly — "does not exist" is a finding, not a gap in your report.

## 1. Admin cockpit — routes & components (as built)
- Every route under the admin surface (expected near `app/admin/**`, but report what actually exists), with the component tree for the review queue: page shell, card component, sidebar panels, keyboard handling.
- How admin auth is enforced (Supabase Auth wrapper? middleware? route group?) and exactly which file gates it.
- The CSS approach in the cockpit as built: Tailwind config location, whether `sbdaymaker_tokens.css` is mirrored into it, any `sbd-*` class conventions in use, and any hardcoded hex values you find (flag each — they're violations of CLAUDE.md §8.2).

## 2. Review queue API — the exact contracts
- Every API route the cockpit calls (expected near `app/api/review/**`): method, request shape, response shape, and what each writes to the DB (status transitions, `audit_log` writes).
- Specifically: what does **approve** do today, field by field? Does it accept any edit payload, or only an id? What does **reject** write? Is there an **edit/save** route at all?
- Where bulk-approve lives (client loop vs. dedicated route).

## 3. Database — actual state vs. the schema contract
- Enumerate the tables, columns, enums, and indexes that actually exist (read `supabase/migrations/**` in order; if the repo has a way to introspect the live DB without side effects, use it and say which you used).
- Diff against `sbdaymaker_schema.sql`: list every drift (missing column, extra table, changed enum) in a table with a **stale-doc flag** column.
- Confirm specifically, with evidence: `things.hero_eligible`, `things.editorial_weight`, `things.happening_tier`, `things.nearby_zone`, `thing_tags`, `recurring_schedules` (and its `day_of_week`/`start_time` shape), `editions` + `edition_picks` (and the one-hero-per-edition unique index), `audit_log`, `source_runs`, `ingest_drops`, and the `thing_status` enum values.
- Note which Supabase client patterns the app uses (service-role vs. anon key, where each client is constructed, RLS posture on admin tables).

## 4. The ingestion worker — as it actually runs
- The worker entrypoint and its step order (expected `ingest/run.ts` orchestrating gate → dedupe → enrich → images → land → digest — report what's real).
- The adapter registry: which adapters are active, the `SourceAdapter` interface as coded, and whether adapters accept any parameters (scope, date range) or are zero-arg.
- The batch Claude call in `enrich`: model id(s) pinned, what fields it writes, how the candidate set is assembled, timeout/retry handling.
- The gate: file, exported signature, drop reasons, and whether the gate test suite exists and passes (`npm test` — run it, report the result).
- How landed rows get `status='needs_review'` and how drops land in `ingest_drops`.

## 5. Scheduling & GitHub Actions
- Every workflow in `.github/workflows/**`: name, trigger (`cron` expressions, `workflow_dispatch` present or absent), what it runs, which secrets it references.
- Whether any Vercel Cron routes exist alongside the Action (per Doc 03) and what they do.
- **This matters for the build:** Cockpit v2's "Run now" restock needs a `workflow_dispatch` trigger with inputs, and its API route needs a way to call the GitHub REST API. Report whether a GitHub token already exists anywhere in the env/secrets inventory, or whether that's a new secret.

## 6. Edition drafting & the hero today
- Where (if anywhere) the nightly run drafts an `editions` row and picks a hero. If edition drafting isn't built yet, say so — the Hero plan phase depends on knowing this.
- How the live site's Explore hero is selected today (ranker location, inputs it reads). Confirm with a code citation that it does **not** read `is_featured` / `sponsor_id` (the trust rule) — if you cannot confirm, flag loudly.

## 7. The public-site read paths Coverage must mirror
- The exact query/logic the live app uses to decide what's "on" in a window: how Tier 1 (`starts_at`) and Tier 2 (`recurring_schedules` day-of-week expansion) are combined for the Explore cascade. Coverage math must reproduce the site's own definition of an occurrence, not invent a parallel one — cite the function(s) to reuse or extract.
- Where `occasion_tag` filtering reads from (`thing_tags` join? confidence threshold in use?).

## 8. Environment & secrets inventory
- Every env var the app and worker read (names only, never values), grouped by consumer (Next.js app / ingest worker / Action), and where each is documented vs. actually read in code. Note anything read in code but missing from `SBDaymaker_Credentials_and_Env.md` (stale-doc flag).

## 9. Conventions the build must match
- Component naming, file placement, server/client component split conventions, how toasts/optimistic UI are done today (if at all), test framework and where tests live, lint/format config.
- The keyboard-shortcut implementation pattern in the current queue (so v2 extends it rather than re-inventing it).

## 10. Drift ledger & open questions
- A single consolidated table: **finding · file · what the canonical doc says · what the code says · recommendation (follow code / flag to Jim)**.
- A short list of questions only Jim can answer (keep it to blocking items; don't pad it).
- Append a one-paragraph note to `14_SBDaymaker_Build_Deltas.md`? **No — do not write to it during recon.** Instead, end the recon file with a "proposed delta-ledger entries" section I can approve.

**Exit criteria for this task:** `docs/cockpit-v2/00_CockpitV2_Recon.md` exists; every claim in it carries a file path; every doc/code disagreement appears in the Section 10 ledger; no other file in the repo changed (`git status` shows only the new file — include its output at the end of the recon). Then stop and summarize what you found in plain terms, leading with anything that would change the Cockpit v2 build plan.
