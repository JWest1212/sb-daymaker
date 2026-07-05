# WC Build Spec — Canon v10 Reconciliation

`Doc WC · for Claude Code · run alongside or immediately after Wave 1 · written against commit caa7302 + assessment Doc 18/19`

---

## What this is

A documentation-only session. **No application code changes. No schema changes. No behavior changes.** You are amending the project's governing contract — `Core Project Files/CLAUDE.md` — plus the deltas ledger, so that the canon matches the shipped product. Every future Claude Code session inherits whichever version of reality these files describe; right now they describe a product that doesn't exist (and forbid one that does).

**Audience note:** Jim is a non-technical founder. Every amendment you write must be readable by him. Keep CLAUDE.md's existing voice and structure — you are patching a living document, not rewriting it.

## Ground rules

1. Read `Core Project Files/CLAUDE.md` and `Core Project Files/14_SBDaymaker_Build_Deltas.md` in full before editing anything.
2. **Verify each claimed drift against the live repo before writing it into canon.** The list below was accurate at commit `caa7302`; if Wave 1 has since landed, several items change tense (e.g., analytics may now be TRUE). Write what is true at the moment you edit.
3. Touch ONLY: `Core Project Files/CLAUDE.md`, `Core Project Files/14_SBDaymaker_Build_Deltas.md`, and (one small banner each, if they exist and are stale) `Core Project Files/START_HERE.md` and `Core Project Files/00_SBDaymaker_Project_Context.md`. Nothing else.
4. Preserve everything in CLAUDE.md that is still true — especially the eight load-bearing constraints §2, which are all unchanged.
5. Bump the status line to `v10 canon` with today's date.

## The amendments (verify each, then apply)

### A1 — The app is four sections, not three
CLAUDE.md v9 declares three sections and lists the My Plan itinerary builder as "Removed — do NOT build." In production: a full Plan surface is live (`/plan`, `PlanClient`/`PlanSetup`/`PlanResults`/`ItinerarySpine`, a "Build your day" CTA on Explore, a Plan tab in `BottomNav`, shared plans at `/p/[token]`, `shared_plan` enum value, localStorage itineraries). Three `docs/` directories chart its deliberate iteration (plan-feature → plan-simplification → revert-to-simple).

Amend: (a) the header line and §1 to **four sections: Explore · Saved · Discover SB · Plan**; (b) the v9 note and §9 to describe Plan as it actually shipped — the *simplified* plan (questionnaire → deterministic ranked spine → share/save), explicitly noting what remains removed: the swap sheet, pin-picker, day-shape selector, drum-roll time picker, and `.ics` export (these are genuinely dead in code — confirm via the orphan list); (c) keep "deterministic; no AI at tap time" as the standing rule for Plan (true in code — `lib/plan/rankCandidates.ts` is pure).

### A2 — Cron topology
CLAUDE.md §4 says the nightly pipeline runs on Vercel Cron. Truth: the nightly ingest is a **GitHub Action** (`.github/workflows/ingest.yml`, 09:00 UTC, `npx tsx ingest/run.ts`); the only Vercel cron is the weekly reaper; `/api/cron/nightly` is a deprecated no-op. Amend the stack table and any prose that says otherwise. Add one sentence on why (worker isolation + 20-min timeout + GH secrets), so a future session doesn't "helpfully" move it back.

### A3 — The cockpit lives at `/admin/*`
References to the cockpit at `/cockpit` should note the live console is `/admin/*` (Queue · Coverage · Live catalog · Hero plan), with `/cockpit/login` as the current login page and `/cockpit` a redirect. Do not describe this as final — Wave 4 relocates login — describe it as current.

### A4 — Analytics status
State whatever is true when you edit: either "Vercel Web Analytics installed (Wave 1) with seven custom events; dashboard toggle required" or, if Wave 1 hasn't landed, "NOT yet installed — Wave 1 item." Never leave the v9 claim that it's simply in the stack.

### A5 — Known-open ledger inside CLAUDE.md
Add a short "Known open items (do not silently fix; see Doc 19)" block so sessions don't wander: the edition sender (unbuilt), Discover guides (unseeded), happy-hour windows (no data), legacy `lib/pipeline.ts`/`lib/enrich.ts` duplicate (Wave 4), migrations-tree incompleteness (Wave 4), itineraries-store collision (Wave 4). Remove items from this block in later waves as they close.

### A6 — One new working rule (§8)
Add verbatim: **"`react-hooks/exhaustive-deps` is never disabled without a comment proving the omitted dependency is inert."** (Context for the ledger: five silent disables in one file shipped the been-marking regression.)

### A7 — Model pinning check
§4 says exact model IDs, never "latest." Verify the live enrich model string in `ingest/enrich.ts` (`claude-haiku-4-5` at snapshot) and record it in the stack table as the pinned nightly model, so drift is visible.

### A8 — Doc 14 ledger entries
Append newest-first entries for A1–A7 (and, if Wave 1 landed, confirm its four entries exist — add them if the Wave 1 session missed §2 of its spec). Each entry: date, what changed in canon, one-line rationale.

### A9 — Stale banners (light touch)
If `START_HERE.md` / `00_SBDaymaker_Project_Context.md` still open with "three sections," add a one-line banner under their status line: *"v10 note: the app is four sections (Plan reinstated in simplified form) — CLAUDE.md v10 is authoritative; see Doc 14."* Do not rewrite their bodies.

## Acceptance & stop-and-show

- [ ] Diff of CLAUDE.md shown to Jim with each amendment labeled A1–A7.
- [ ] Doc 14 entries appended, newest-first, matching the ledger's existing format.
- [ ] A grep for "three sections" / "do NOT build" across Core Project Files returns only historical references that are now correctly banner-flagged.
- [ ] Nothing outside the four named files changed (`git status` proof).
- [ ] One-paragraph summary for Jim in plain terms: "your contract now matches your product; here's what it says differently."

*End of Doc WC.*
