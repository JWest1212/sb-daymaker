# Data Arch Redesign · 24 — Confidence Gate + Conservative Auto-Publish

`Status: v1 · 2026-07-12 · build spec. Second in the sourcing redesign. Reads the sources table from spec 23. Cites Doc 16 (§3.8) and Doc 18 (findability-aware gate).`

> **What this builds.** A per-thing **data-confidence score** (0-1) and a gate that uses it: high-confidence things from trusted sources **auto-publish**, the uncertain middle band goes to your **review queue**, and the bottom is held. This is what converts your 15-minute ceiling from a coverage limit into a quality spot-check, and it is the prerequisite for adding volume (spec 25) without flooding your review.
>
> **Precedence.** `CLAUDE.md` is the contract; code is truth. `lib/explore.ts` untouched. The trust rule holds: confidence is a quality signal, never a sponsor signal. Additive-only DDL, applied by Jim. Conservative by founder decision (start narrow, widen as data proves sources out).

---

## 1. Why this comes second

Spec 23 made sources data with authority and reliability scores. Those are the main inputs to a confidence score. And the gate must exist **before** spec 25 adds the long tail, or every AI-extracted event lands in your queue and buries you. Order matters: sources (23) → confidence (24) → volume (25).

The objective this serves directly: *mostly automated, except the moderate-confidence things I review myself.* This spec is the mechanism that makes that sentence literally true.

---

## 2. The confidence score

### 2.1 Inputs (all already available after spec 23, or on the thing)
A composite `data_confidence` (0-1) from:

- **Source authority** — `sources.authority` (venue-direct high, aggregator low).
- **Source reliability** — `sources.reliability` (learned track record).
- **Extraction method** — structured (API/ICS/JSON-LD) highest; AI-extracted lower (spec 25 sets this).
- **Field completeness** — has date, time, venue, address, description, image.
- **Cross-source agreement** — `source_count`: how many sources independently reported this event (spec 26's dedup sets this; until then it is 1).
- **Recency** — freshly extracted scores higher than stale.
- **Findability** — has a resolved zone and its activity value(s) (Doc 18); missing these lowers confidence but does not block (Place is a sort).

Keep the formula simple and legible: a weighted sum, weights in one config constant, easy to tune. Do not over-engineer; the point is a defensible ordering, not a precise probability.

### 2.2 Storage (additive, Jim applies)
```sql
alter table things add column if not exists data_confidence numeric(3,2);
alter table things add column if not exists source_count smallint not null default 1;
```
`data_confidence` is computed in the pipeline each run. `source_count` is maintained here as 1 and upgraded by spec 26's dedup.

---

## 3. The gate (conservative by decision)

Three bands, tuned conservatively at launch:

| Band | Condition (start conservative) | Action |
|---|---|---|
| **Auto-publish** | high `data_confidence` AND structured lane AND trusted source | publishes with no review |
| **Review** | everything in the middle, including **all AI-extracted** things at launch | your queue |
| **Hold** | below the floor (missing critical fields, unresolved, or very low confidence) | not shown, flagged |

Founder-locked posture: **auto-publish only structured-lane, high-confidence, trusted-source things to start.** Anything AI-extracted (spec 25) goes to review regardless of score until its source earns reliability. Widen the auto-publish band later, per source, as `sources.reliability` accrues. The dial lives in one config so tightening or loosening is a one-line change, not a refactor.

### 3.1 Trust rule (load-bearing)
Confidence never reads sponsor status and never reorders the feed by sponsorship. It is a publish/review/quality signal only. Sponsored placements remain labeled and structurally separate, unchanged.

### 3.2 Effect on ranking (bounded)
`data_confidence` may act as a **quality tiebreak** only, and only if it does not touch `lib/explore.ts` (which owns the cascade order). Preferred: confidence does **not** reorder the live feed at all in this spec; it governs publish/review/hold. Any ranking use is deferred to avoid touching the untouchable file. Keep this spec to the gate.

---

## 4. The review queue (your 15 minutes)

The middle band lands in a cockpit review surface (reuse the existing Queue tab). Each item shows the thing, its `data_confidence`, and *why* it landed in review (the lowest-scoring inputs, e.g. "no venue, AI-extracted, single source"), so your decision is fast. Actions: publish, edit-then-publish, reject. The queue is sorted so the most-likely-good sit at top (fast approvals first).

Measure the win: track review-queue depth and the auto-publish rate before/after, so you can see your time being reclaimed and tune the dial with evidence.

---

## 5. Re-crawl and suppression (uses confidence)

- **Re-crawl priority:** low-confidence and stale things are re-checked first on subsequent runs (a cheap way to upgrade borderline records rather than discard them).
- **Suppression:** below-floor things are held, not deleted, so a later run or a second source can rescue them (raising `source_count` and confidence).

---

## 6. Phased build (stop and show)

**Phase 0 — Confirm inputs (read-only).** Verify `sources.authority`/`reliability` exist (spec 23), what the current publish path is (everything → needs_review today), and where the Queue surface reads from. *Show:* findings and the proposed weighting config.

**Phase 1 — Score.** Add the two columns (Jim applies DDL). Compute `data_confidence` each run from section 2. Dry-run: show the distribution of scores across the current catalog. *Show:* the histogram and a few worked examples (why each scored as it did).

**Phase 2 — Gate (shadow mode).** Apply the bands but **do not change publishing yet**: label what *would* auto-publish / review / hold. *Show:* counts per band and a sample of the auto-publish candidates for you to eyeball. This is the safety check before real auto-publish.

**Phase 3 — Enable auto-publish (conservative).** Turn on auto-publish for the high-confidence structured band only; the rest flows to the Queue. *Show:* the first run's auto-published count vs review count, and queue depth.

**Phase 4 — Queue upgrades + metrics.** Add the "why it's here" reasons to the Queue, the confidence display, and the before/after auto-publish-rate metric. *Show:* the improved Queue and the reclaimed-time metric.

**Phase 5 — Re-crawl priority + suppression.** Low-confidence/stale re-checked first; below-floor held not deleted. *Show:* a borderline thing upgrading on a later run.

---

## 7. Acceptance checklist

- [ ] `data_confidence` and `source_count` columns added (Jim); score computed each run from the section 2 inputs.
- [ ] Weighting lives in one tunable config constant.
- [ ] Gate runs in shadow mode first (Phase 2) with a reviewable band breakdown before any auto-publish.
- [ ] Auto-publish is conservative: structured lane + high confidence + trusted source only; all AI-extracted things go to review at launch.
- [ ] The dial is a one-line config change; widening is per-source via `sources.reliability`.
- [ ] Trust rule intact: confidence never reads sponsor status, never reorders by sponsorship.
- [ ] `lib/explore.ts` untouched; confidence does not reorder the live feed in this spec.
- [ ] Queue shows confidence + reasons; auto-publish-rate and queue-depth metrics tracked.
- [ ] Below-floor things held (not deleted); low-confidence/stale re-crawled first.
- [ ] Never touched `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.

---

## 8. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then this spec (Data_Arch_Redesign_24_Confidence_Spec.md), then Doc 16 section 3.8.
Build a per-thing data_confidence score and a conservative auto-publish gate. This must ship BEFORE
we add volume (spec 25). Do the phases in section 6, ONE at a time, stop and show me after each,
wait for my go.

Constraints:
- I apply all DDL by hand; give me exact SQL and wait.
- lib/explore.ts consumed as-is; confidence does NOT reorder the live feed in this spec. Never touch
  lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx, NearMeSheet.tsx.
- TRUST RULE: confidence never reads sponsor status and never reorders by sponsorship. Quality/publish
  signal only.
- Auto-publish is CONSERVATIVE: only structured-lane, high-confidence, trusted-source things auto-publish
  at launch; everything AI-extracted goes to review regardless of score. The dial must be one config
  constant.
- Phase 2 is SHADOW MODE: label what would auto-publish/review/hold and show me the breakdown BEFORE
  enabling real auto-publish in Phase 3.

Phase 0 now (read-only): confirm sources.authority/reliability exist, show the current publish path
(how things reach needs_review today) and where the Queue reads from, then propose the confidence
weighting config and stop.
```

---

*End of Data Arch Redesign 24. On completion, proceed to 25 (generic AI extraction lane), whose output lands in the review band this gate defines, protecting your time as coverage scales.*
