# Data Arch Redesign · 25 — Generic AI Extraction Lane

`Status: v1 · 2026-07-12 · build spec. Third in the sourcing redesign. Depends on 23 (sources table) and 24 (confidence gate). Cites Doc 16 (§2.2, §3.3, §3.4) and Doc 18's trust firewall.`

> **What this builds.** The coverage unlock: a **generic lane** that fetches an arbitrary event page, has **Claude Haiku** extract the event(s) into structured fields, and lands them like any other source, so a new source goes live **without a hand-coded adapter**. This breaks the adapter-per-source ceiling that caps coverage today. Fetching is **self-hosted** (founder decision, to protect the cost floor), with Scrapfly held in reserve for JavaScript-heavy pages.
>
> **Precedence.** `CLAUDE.md` is the contract; code is truth. `lib/explore.ts` untouched. Batch-only (nightly), no per-request AI. Additive-only DDL, applied by Jim. **The trust firewall (section 4) is non-negotiable:** AI-extracted dates are candidates, not facts.

---

## 1. Why this is the coverage lever, and why it comes third

Doc 16's core: "if it is happening in SB, we have it" is won or lost on the long tail, the winery series, the church hall show, the pop-up market, the meetup, none of which justify a bespoke adapter. A generic lane serves unlimited such sources with one code path. It comes third on purpose: it needs the `sources` table (23) to register long-tail sources as data, and the confidence gate (24) so its output lands in review rather than flooding the live feed. Building it before 24 would bury you; before 23 would mean hardcoding the very sources this is meant to free.

---

## 2. The lane, end to end

For a source whose `sources.lane = 'generic'`:

1. **Fetch** the page politely (existing polite fetcher; Playwright/Crawl4AI for JavaScript; Scrapfly reserve for hostile SPAs). Respect robots, rate limits, timeouts, as the current fetcher does.
2. **Change-detect.** Store a content hash / ETag on the source row; if unchanged since last run, skip extraction (saves AI spend and runtime).
3. **Reduce** the page to clean text (strip nav/boilerplate) to keep the AI payload small and cheap.
4. **Extract** with Haiku (batch) using a strict tool schema: `title`, `start_date`, `start_time`, `end`, `venue`, `address`, `price`, `url`, one object per event found. Temperature low; the model returns only the schema.
5. **Normalize + land** through the existing gate and dedup, tagged `lane = 'generic'`, `extraction_method = 'ai'`, which spec 24 scores lower and routes to review.

---

## 3. Cost and runtime discipline (protects the floor)

Self-hosted fetch is free but adds runtime to the nightly Action (20-minute wall). Controls:

- **Per-run page cap** and **source-specific scheduling** (from `sources.crawl_frequency`): long-tail sources spread across the week, not all nightly.
- **Change-detection skip** avoids re-extracting unchanged pages.
- **Haiku, batch, reduced text** keeps AI cost in pennies-per-night territory.
- **Scrapfly only** for sources flagged to need JavaScript rendering (metered; used sparingly).
- Track AI spend and fetch runtime per run in `source_runs` (extend spec 23's table), so cost never creeps invisibly.

Net expected: near-$0 above today, inside the cost floor, with runtime bounded by the page cap.

---

## 4. The trust firewall (non-negotiable)

AI extraction introduces a new risk: a hallucinated or misread date/venue. The firewall, from Doc 18:

- **AI-extracted dates/times are candidates, not facts.** They never auto-publish. They land in the review band (spec 24) until confirmed by (a) a second source corroborating (raising `source_count`), (b) a match to a structured signal, or (c) your review.
- **Structured-lane dates keep their status:** taken as-is, AI never edits them. The generic lane never overwrites a structured thing's fields.
- **Extraction is additive discovery**, not authority. A generic-lane event is a *lead*, promoted to trusted only through corroboration or your confirmation.
- Low extraction confidence + missing fields → hold, not publish.

This is what lets AI grow coverage without ever silently putting a wrong "when" in front of a user.

---

## 5. Onboarding a source (the payoff)

With this lane, adding a long-tail source is: create a `sources` row (`lane = 'generic'`, its URL, a crawl frequency), done. No adapter, no deploy. The quarterly discovery sprint (Doc 16 §3.1) feeds candidate URLs straight into this. The cockpit Sources surface (spec 23) is where you or a discovery pass adds them.

### 5.1 Schema (additive, Jim applies)
```sql
alter table sources add column if not exists content_hash text;
alter table sources add column if not exists etag text;
-- extraction_method on things (if not already added by spec 24's lane work):
alter table things add column if not exists extraction_method text not null default 'structured';
```

---

## 6. Phased build (stop and show)

**Phase 0 — Confirm foundations (read-only).** Verify 23 (`sources.lane`) and 24 (confidence gate + review band) are in place; confirm the polite fetcher and Scrapfly wiring; confirm batch-AI harness (Haiku) exists. *Show:* readiness check and the extraction tool schema for review.

**Phase 1 — Extractor, offline.** Build the fetch → reduce → Haiku-extract → structured-output function. Test it **offline** on a handful of saved sample pages (no landing). *Show:* extracted structured events vs the source pages, so you can judge accuracy before anything lands.

**Phase 2 — One source, end to end, into review.** Register one real long-tail source as `generic`; run the lane; land its output into the **review band only** (never auto-publish). *Show:* the extracted events in the Queue with their low confidence and "AI-extracted" reason.

**Phase 3 — Change-detection + scheduling + cost tracking.** Content-hash skip, per-run page cap, source-specific frequency, AI-spend + runtime logging. *Show:* a second run skipping the unchanged source, and the cost/runtime line.

**Phase 4 — Widen to a first batch.** Onboard 10-20 discovered long-tail sources as `generic`. *Show:* the coverage lift (new things in review) and the runtime/cost staying within bounds.

**Phase 5 — Corroboration promotion.** When a second source corroborates a generic-lane event, raise `source_count` and let spec 24's gate reconsider it. *Show:* a corroborated event's confidence rising out of the review floor.

---

## 7. Acceptance checklist

- [ ] Foundations confirmed: `sources.lane`, confidence gate, review band, polite fetcher, Haiku batch harness.
- [ ] Extractor tested offline on sample pages before anything lands (Phase 1 accuracy check).
- [ ] Generic-lane output always lands in review at launch; **never auto-publishes**; dates are candidates.
- [ ] Structured things never overwritten by the generic lane.
- [ ] Change-detection skips unchanged pages; per-run page cap and source-specific scheduling enforced.
- [ ] Scrapfly used only for flagged JavaScript sources; AI spend + runtime logged per run.
- [ ] Adding a long-tail source is a `sources` row only, no adapter, no deploy.
- [ ] Corroboration raises `source_count` and lets the gate re-evaluate.
- [ ] Batch-only, no per-request AI; `lib/explore.ts` untouched; never touched `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.
- [ ] Cost stays within the floor; runtime within the nightly wall.

---

## 8. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then this spec (Data_Arch_Redesign_25_Extraction_Spec.md), then Doc 16 sections 2.2,
3.3, 3.4 and Doc 18's trust firewall. Build a generic AI extraction lane so new long-tail sources go
live WITHOUT a hand-coded adapter. Self-hosted fetch (Playwright/Crawl4AI), Haiku batch extraction,
Scrapfly reserve for JS-only pages. Do the phases in section 6, ONE at a time, stop and show me after
each, wait for my go.

Constraints (do not violate):
- TRUST FIREWALL: AI-extracted dates/times are CANDIDATES, never facts. Generic-lane output ALWAYS
  lands in the review band (spec 24), NEVER auto-publishes, until corroborated or I confirm. Never
  overwrite a structured thing's fields.
- Batch AI only, no per-request calls. Haiku for extraction. Reduce page text before sending.
- Protect the cost floor and the 20-min nightly wall: content-hash change-detection skip, per-run page
  cap, source-specific scheduling from sources.crawl_frequency, Scrapfly only for flagged JS sources,
  log AI spend + runtime per run.
- I apply all DDL by hand; give me exact SQL and wait.
- lib/explore.ts consumed as-is. Never touch lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx,
  NearMeSheet.tsx.

Phase 0 now (read-only): confirm sources.lane exists (spec 23), the confidence gate + review band
exist (spec 24), the polite fetcher and Scrapfly wiring, and the Haiku batch harness. Then show me the
proposed extraction tool schema and stop.
```

---

*End of Data Arch Redesign 25. On completion, proceed to 26 (dedup upgrade + canonical event identity), which collapses the duplicates that more sources inevitably create and drives the corroboration signal this lane relies on.*
