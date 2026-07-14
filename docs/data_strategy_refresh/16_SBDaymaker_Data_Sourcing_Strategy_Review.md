# 16 · SB Daymaker — Data Sourcing & Ingestion Strategy Review

`Consultant review · senior data architecture + applied AI · grounded in the caa7302 as-built snapshot`

> **Scope.** A full, opinionated re-examination of how SB Daymaker discovers, ingests, deduplicates, enriches, and trusts Santa Barbara event data. Read against the real pipeline (`ingest/run.ts`, 32 adapters, `dedupe.ts`, `enrich.ts`) and the eight load-bearing constraints in `CLAUDE.md`, not a blank slate. House style: no em-dashes, plain dollar signs.

---

## 0. The one-sentence thesis

Your pipeline is not broken; it is **capped**. Every new source today costs a hand-written adapter, so coverage grows at the speed of your own hands. The whole review optimizes for one number: **coverage-per-founder-minute** (and per dollar). Nothing below is added tooling for its own sake; if it does not buy coverage, quality, or trust per minute of your time, it does not belong.

---

> **Update note (2026-07-12) — read alongside Doc 18.** After this review was written, the three-door taxonomy (Doc 17) made **findability**, not just clean data, a first-class objective, and Doc 18 (Findability & Tagging Architecture) extends four items below. Where they differ, Doc 18 is the newer authority for the tagging and findability portion. The extensions, in brief (full detail in Doc 18 §9):
> 1. **The confidence gate (§2.5, §3.8) becomes findability-aware** — it also checks a thing has a real door-zone, an activity bucket, and its qualifying occasion tags before auto-publishing, not just that the record is valid.
> 2. **The coverage layer (§3.9) gains a dimension** — the heatmap adds an **activity-bucket** axis on top of zone and occasion, and watches Uptown & Upper State from day one.
> 3. **Venue intelligence (§3.11) starts now, not later** — a small **venue-attribute registry** (Doc 19's venue dictionary) is the first brick, seeded by Dog Friendly and reused for accessibility, patio, and parking.
> 4. **Source prioritization (§3.2) scores partly by door-cell coverage** — a source's value is partly which thin door-cells it feeds, not just raw volume.
>
> Everything else in this review stands as written.

---

## 1. Candid critique of the current strategy

Credit first, because it is earned: this is a disciplined, fail-soft, genuinely well-built ingestion system for a solo operator. Per-adapter try/catch means one bad source cannot sink a run. The gate refuses to invent facts. The enrich step never sees or alters a date or time (the trust guarantee is real and verifiable in code). Structured lanes (Ticketmaster API, ICS, WordPress `tribe_events` REST, JSON-LD, Localist) are exactly the right sources to prioritize. Most teams do far worse.

Now the honest problems, in priority order:

1. **Sources are code, not data.** There is no `sources` table. The registry is a hardcoded array in `registry.ts`, the canonical-source ranking is a hand-maintained regex table in `dedupe.ts`, and the recurring rhythms live in a hand-edited `recurringRegistry.ts`. This is the root cause of the coverage cap: you cannot add, score, prioritize, retire, or measure a source without a code change and a deploy. Everything downstream (prioritization, coverage analysis, reliability learning) is impossible to build cleanly until sources are rows.

2. **Adapter-per-source does not scale to "if it is happening, we have it."** Thirty-two adapters covers the marquee venues and civic calendars well. It will never cover the long tail: the winery tasting-room series, the church hall concert, the pop-up night market, the meetup, the nonprofit fundraiser. That long tail is where "comprehensive" is won or lost, and it is precisely the set that does not justify a bespoke adapter each.

3. **AI does the low-value job and skips the high-value one.** Today Claude does voice and occasion tags. It does **not** do extraction, normalization, entity resolution, or dedupe adjudication, all of which are deterministic-adapter or absent. That is backwards for a coverage mission. Extraction from messy pages is the task AI is uniquely good at and the task that would unlock the long tail.

4. **No confidence layer, so the 15-minute budget cannot scale.** Every landed row is `needs_review`. `ai_confidence` in `audit_log` is just averaged tag confidence, not a data-quality score. Without per-event confidence you cannot auto-publish the safe 80% and reserve your attention for the ambiguous 20%. This is the single biggest lever on your time budget.

5. **Silent-empty sources look healthy.** A source that returns `[]` (an SPA shell, a changed page structure, a dead feed) records as green with `0 fetched / 0 landed`. The as-built ops doc flags this directly. You have no way to tell "quiet night" from "quietly broken," which means coverage can rot without a single alarm.

6. **No coverage or blind-spot instrumentation.** The live data shows the symptom: 87% Tier-1, an evergreen backstop of only 51, `festival_fair` at 2, `weekly_special` at 0, 179 things with no occasion tag, 86 stale past-dated rows never pruned. Nothing in the system surfaces these gaps as actionable work.

7. **Dedupe has real edge-case exposure.** The near-match requires the same SB calendar day **and** both rows carrying `starts_at`, and uses title trigram alone with no venue signal. Consequences: recurring and time-TBD events dedupe poorly; two genuinely different "Live Music" events at the same venue on the same day can false-merge; the same event titled differently across two sources ("Jazz at SOhO" vs "SOhO Restaurant: Live Jazz") can false-split below 0.55. It is a good 80% solution with no path for the hard 20%.

8. **Observability is pull, not push, and single-channel.** No alerting, no dead-man's-switch for a missed run, no Sentry, digest from the `resend.dev` sandbox sender. If the Action never fires, nothing notices.

None of these are quality failures. They are all **scale-of-coverage** failures. That is the correct thing to fix.

---

## 2. Recommended end-to-end data architecture

The design principle: **three ingestion lanes feeding one canonical event store, governed by a sources table, gated by a confidence score.** Structured sources stay authoritative and mostly untouched. AI earns its keep on the long tail and the hard cases only.

### 2.1 The backbone: a `sources` table (data, not code)

Make every source a row. This is the keystone; almost everything else depends on it.

Minimum columns: `id`, `key`, `label`, `url`, `lane` (`structured` / `generic` / `render`), `parse_method`, `category_hints`, `neighborhood_hint`, `authority` (0-1), `reliability` (learned 0-1), `expected_yield` (rolling median events/run), `crawl_frequency`, `last_ok_at`, `last_yield`, `consecutive_empty`, `status` (`active`/`paused`/`retired`/`candidate`), `maintenance_burden` (1-5), `notes`. The regex ranking in `dedupe.ts` becomes a join on `sources.authority`. The registry array becomes a query. The recurring registry becomes rows.

You keep the hand-written adapters; they simply register as `structured`-lane sources. What changes is that a **new** source no longer requires code.

### 2.2 Three ingestion lanes

**Lane A, Structured (keep as-is, expand).** API / ICS / JSON-LD / WordPress-REST / Localist. These are gold: machine-readable, stable, cheap, high-confidence. Keep every existing adapter. Bias all future discovery toward finding more of these (many venues expose an ICS or a `tribe_events` endpoint you have not wired). No AI in the extraction step; confidence starts high.

**Lane B, Generic AI extraction (the new unlock).** For the HTML long tail that does not justify a bespoke adapter: fetch the page (polite `fetchHtml`, Playwright/Crawl4AI for JS, Scrapfly for hostile SPAs), reduce to clean text, and hand it to **Haiku in batch** with a strict extraction tool schema (title, start date/time, venue, address, price, url). One generic adapter serves unlimited sources. This is what breaks the adapter ceiling. Guardrails below.

**Lane C, Managed render (reserve, already wired).** Scrapfly with `render_js=true` for the two SPA sources you have parked (`eventbrite`, `allevents`) and future JS-only sites. It exists in `http.ts`; the decision is when to spend on it, per source, driven by the sources table.

### 2.3 The trust firewall for AI-extracted events (non-negotiable)

The trust guarantee today is "AI never touches dates." Lane B forces a new question: what if AI **extracts** the date? Resolve it explicitly:

- A date/time produced by AI extraction is a **candidate**, never a fact, until it is either (a) corroborated by a second source, (b) matched to a structured signal, or (c) confirmed by you. AI-extracted events land at **lower confidence** and, below the auto-publish floor, go to the review queue.
- Lane A structured dates keep their current status: taken as-is, AI never edits them.
- This preserves the spirit of the constraint (AI does not silently rewrite when an event happens) while letting AI do the extraction work that grows coverage.

### 2.4 Canonical event identity (the quiet moat)

Introduce a stable `event_key` derived from `venue + normalized-title + date` (for dated) or `venue + normalized-title + rrule` (for recurring), assigned during dedupe. This is the spine that makes cross-source merging, recurring instances, popularity aggregation, and reliability learning all coherent. Without it you are re-deriving identity on every run. See section 6.

### 2.5 Confidence-gated publishing

Every event gets a `data_confidence` (0-1, section 8). The gate becomes: high confidence + structured lane auto-publishes; mid confidence lands `needs_review`; below floor is suppressed (held, not shown). This is the mechanism that lets coverage grow without growing your review time. It is the highest-leverage single change in this document.

### 2.6 What stays where (automation boundary)

| Task | Automated | Model-assisted | Human |
|---|---|---|---|
| Structured extraction (Lane A) | Yes | — | — |
| Long-tail extraction (Lane B) | — | Yes (Haiku) | Review below confidence floor |
| Title/venue normalization | — | Yes (Haiku) | — |
| Occasion tags + blurbs | — | Yes (Haiku) | — |
| Dedupe, clear cases | Yes | — | — |
| Dedupe, ambiguous band | — | Yes (Sonnet) | Rare tiebreak |
| Recurring-series detection | — | Yes (Sonnet, proposes) | Approve in cockpit |
| Dates/times | Lane A only | Never edits | Confirms Lane B |
| High-confidence publish | Yes | — | — |
| Low-confidence / new-source publish | — | — | Yes |
| Coverage audit | Yes (weekly job) | Yes (Sonnet) | Acts on cards |

Keep dates and final low-confidence publish human or deterministic. Everything else can be model-assisted or automated.

---

## 3. The eleven evaluation areas, each with a recommendation

### 3.1 Source discovery
Do **not** run continuous AI discovery in the pipeline; it burns time and budget for diminishing returns. Instead run a **quarterly discovery sprint** (about 2 hours, four times a year) driven from the chat/project you already have: prompt Claude with web search (or Perplexity if you prefer) to enumerate candidate sources by category x neighborhood, then diff that list against the `sources` table to surface what you are missing. Every survivor is inserted as a `candidate` row and can go live through Lane B **same day, no adapter**. Discovery is cheap; the reason it has not paid off is that ingestion was expensive. Lane B fixes that. Prioritize discovering more Lane A (ICS / JSON-LD / WordPress) endpoints, which many venues already expose.

### 3.2 Source prioritization
Score each source and let the score drive crawl frequency, dedupe authority, and review routing:

`priority = authority(0-1) x freshness_weight + uniqueness(0-1) - maintenance_burden_penalty`, with a hard reliability multiplier from learned extraction success.

Concretely: authority (venue-direct 1.0, structured API 0.9, civic 0.7, aggregator 0.4), uniqueness (share of that source's events that appear nowhere else, computed from dedupe outcomes), reliability (rolling extraction success and yield-vs-baseline), maintenance burden (how often the adapter breaks). Recompute weekly from the run tables you already write (`source_runs`, `ingest_drops`). This replaces the hand-tuned regex ranking with a learned, queryable ranking.

### 3.3 Crawl and ingestion architecture
Keep GitHub Actions and the fail-soft orchestrator; they are right. Add per-source scheduling from the `sources` table so you are not full-crawling everything every night. Recommended cadence: structured APIs and ICS nightly (cheap); marquee venue HTML nightly; long-tail Lane B sources spread across the week (source-specific scheduling to protect the 20-minute wall clock); Scrapfly render only for sources flagged to need it. Change detection via ETag / Last-Modified / content hash stored on the source row: skip extraction when a page is unchanged (saves AI cost and runtime). Keep the existing per-adapter try/catch, 90s+1-retry AI pattern, and 500ms polite rate limit. Add exponential backoff on `consecutive_empty` and auto-pause a source after N consecutive failures with an alert.

### 3.4 Role of AI
Expand deliberately, within batch-only and the trust firewall. Give AI: Lane B extraction, title and venue normalization, occasion tagging and blurbs (current), recurring-series proposals, dedupe adjudication for the ambiguous band only, confidence scoring inputs, and the weekly coverage audit. Do **not** give AI: authority over Lane A dates, final publish of low-confidence rows, or anything at user-tap time. **Model split, opinionated and minimal:** Haiku 4.5 for high-volume extraction / normalization / tags / blurbs; Sonnet for the low-volume weekly jobs (coverage audit, hard dedupe, recurring inference); search-driven discovery stays offline in the quarterly sprint. **Recommend against** adding Gemini or a third vendor for "diversity": one API family, tiered, is far cheaper to maintain for one operator, and vendor sprawl is a maintenance tax with no coverage payoff. Perplexity is optional and only for discovery; Claude web search already covers it.

### 3.5 Event schema and enrichment
You already have a strong record (neighborhood, nearby_zone, indoor, is_21_plus, time_of_day_fit, price_band/free, editorial_weight, last_confirmed, local_note). Be disciplined: add the few fields that materially move search, filter, or trust and that you can populate reliably. Additive DDL, applied by hand as always. Priority additions:

1. `data_confidence numeric(3,2)` and `source_count smallint` (drives auto-publish, ranking tiebreak, freshness UI).
2. `event_key text` (canonical identity; indexed).
3. `vibe` (small controlled vocabulary, not free text; powers the By Vibe door).
4. `weather_sensitivity smallint` (beyond the `indoor` proxy; drives the golden-hour and rainy-day logic).
5. `duration_minutes smallint` and `dog_friendly boolean` (both high-signal for planning, cheaply inferred).

Defer the rest (parking difficulty, popularity estimate, age restrictions as a distinct field) until the behavioral loop and coverage layer justify them. **Rule:** any AI-inferred attribute carries its own confidence and never overwrites a structured fact. Capture raw extracted payloads in a `source_events` table so you can recompute enrichment without re-crawling.

### 3.6 Deduplication
Keep the deterministic two-layer core for the clear cases; it is fast and correct there. Fix the edges:
- Add **venue/location as a signal**: same normalized venue + same day raises confidence and lets you lower the title threshold; different venue with similar title stays split (kills the false-merge of two "Live Music" nights only when venues differ, and rescues the false-split of differently-worded same-event titles when venue agrees).
- Add a **Claude adjudication pass (Sonnet, batch) on the ambiguous band only** (roughly 0.35-0.55 similarity, same day, same-or-unknown venue). Do not send the bulk; send only the genuinely uncertain pairs. This is where AI beats trigrams.
- Assign `event_key` at merge so recurring instances and cross-source dupes converge to one identity.
- Track false-positive risk explicitly: log every merge with its evidence so a wrong merge is auditable and reversible.

### 3.7 Recurring events
Endorse the current **hybrid**: one parent `thing` plus `recurring_schedules` rows, with generated dated instances for display. It is the right model; do not switch schemas. Two changes: move the hardcoded `recurringRegistry.ts` into a DB table (founder-curated through the cockpit, still your call, but data not code, so it participates in coverage and reliability), and attach a **freshness decay** to recurring instances (a weekly night not re-confirmed in N weeks drops confidence and eventually needs re-verification), so a cancelled standing event does not haunt the feed forever.

### 3.8 Confidence scoring
Composite `data_confidence` (0-1) from: source authority (from `sources`), extraction method (structured 1.0 > AI-extracted corroborated > AI-extracted single-source), field completeness, cross-source agreement (`source_count`), recency, and recurring freshness. Effects: **publishing** (above floor auto-publish, mid needs_review, below floor suppress); **ranking** (a quality tiebreak only, never a sponsor signal, so the trust rule holds); **review routing** (only mid-band reaches your 15 minutes); **re-crawl priority** (low-confidence and stale get re-checked first); **UI** (a freshness/"last confirmed" affordance). This is the pressure valve on your time budget.

### 3.9 Coverage analysis and blind spots
Build a **weekly coverage report** (batch, Sonnet-assisted) that makes gaps actionable, surfaced as cards in the Coverage cockpit tab:
- Category x neighborhood x horizon matrix vs a baseline (flags `festival_fair`=2, `weekly_special`=0, thin evergreen, empty neighborhoods).
- **Silent-miss detection**: any active source whose yield drops below its `expected_yield` baseline (this is the direct fix for "green 0/0 looks healthy").
- Stale sources (`last_ok_at` beyond threshold) and stale events (the 86 past-dated rows).
- A recall spot-check: once a week, ask Claude+search "what is happening in Santa Barbara this weekend," diff against the DB, and estimate how much you are missing. This is your closest proxy for the "if it is happening, we have it" promise, measured rather than hoped.

### 3.10 Monitoring and operations
Fix the push-signal gap before adding dashboards. Order: (1) yield-vs-baseline alerting per source (turns the silent-empty blind spot into an alarm); (2) a dead-man's-switch for a missed run; (3) verify the Resend domain so alerts actually send from you, not the sandbox. Then a single cockpit ops panel over tables you already write (`source_runs`, `ingest_drops`, `image_spend`): source health (yield vs baseline), freshness, confidence distribution, dedupe rate, events/day, stale rate, review-queue depth, AI cost, image cost. You do not need Sentry or a new stack; you need baselines and one reliable alert channel.

### 3.11 Competitive advantage over 3-5 years
The moat is not any single feature; it is the **compounding combination** competitors cannot easily assemble: a clean canonical event/venue/organizer graph (from `event_key`), plus source-reliability learning (the `sources` table gets smarter every week), plus your want-to-been behavioral signal (real local popularity nobody else in SB has), plus the editorial voice. Layer on lightweight user-submitted verification ("still happening?" tap, no account needed) and AI-discovered long-tail events, and you have a dataset that is broader, fresher, and more trusted than anyone would rationally rebuild. Foursquare's City Guide shutdown is the cautionary proof that raw listings without a behavioral and trust moat do not hold; your want-to-been loop is exactly that moat.

---

## 4. Prioritized roadmap

**Quick wins (days, high leverage, low risk)**
- Yield-vs-baseline alerting + dead-man's-switch + verified Resend sender. Turns silent rot into a signal.
- Prune the 86 stale past-dated rows and wire ongoing archival (extend the reaper or the nightly run).
- Stand up the `sources` table and backfill the 32 adapters + the regex ranking + the recurring registry into rows. No behavior change yet; it unblocks everything.

**Medium term (weeks)**
- `data_confidence` + `source_count` columns and confidence-gated auto-publish. Reclaims most of your daily review time.
- Lane B generic AI extraction over a first batch of 10-20 discovered long-tail sources. First real coverage jump.
- Dedupe upgrade: venue signal + `event_key` + Sonnet adjudication on the ambiguous band.
- Weekly coverage report with silent-miss detection into the Coverage tab.

**Long term (quarters)**
- Canonical venue/organizer graph and popularity estimation from the want-to-been loop.
- Source-reliability learning feeding prioritization automatically.
- User-submitted verification (no accounts).
- Quarterly discovery sprint as a standing rhythm; the long tail compounds.

---

## 5. Recommended tool and model stack (with rationale)

- **Keep:** GitHub Actions worker, Supabase, the structured adapters, the polite fetcher, Scrapfly as reserve. All correct; do not replace.
- **Fetch for Lane B:** Playwright or **Crawl4AI, self-hosted in the Action (free)** over Firecrawl (paid per page). Rationale: you already have Scrapfly for the hostile-SPA case and Claude for extraction, so Firecrawl mostly duplicates capability you own at a recurring cost. Use Firecrawl only if you would rather buy time than run Playwright, and price it in (roughly $16-50/mo) against the $45-95 floor.
- **Extraction + normalization + tags + blurbs:** **Claude Haiku 4.5**, batch, strict tool schemas. Pennies per night at long-tail volume.
- **Weekly heavy reasoning (coverage audit, hard dedupe, recurring inference):** **Claude Sonnet**, batch, low volume, cents per week.
- **Discovery:** Claude with web search (already available) in the quarterly sprint. Perplexity optional, not required.
- **Explicitly do not add:** Gemini/third model family for the pipeline, Firecrawl-by-default, Sentry, a queue, or a second database. Each is maintenance with no coverage payoff for a solo operator.

Net new recurring cost if you self-host fetch: effectively $0 above today (AI stays in the cents-to-low-dollars range). Comfortably inside the floor.

---

## 6. Highest-impact opportunities (ranked)

1. **Confidence-gated auto-publish.** Converts your 15-minute ceiling from a coverage limit into a quality-review sample. Highest leverage on time.
2. **Lane B generic AI extraction.** Converts the adapter-per-source ceiling into a data problem. Highest leverage on coverage.
3. **`sources` table.** Unblocks prioritization, coverage analysis, and reliability learning. Highest leverage on everything else.
4. **Silent-miss detection.** Cheapest defense of the trust promise; stops invisible coverage rot.
5. **Canonical `event_key`.** The quiet structural investment that makes the 3-5 year moat coherent.

---

## 7. Key risks, assumptions, and tradeoffs

- **AI extraction accuracy (Lane B).** Risk: a hallucinated date/venue publishes. Mitigation: the trust firewall (AI dates are candidates, low confidence, corroboration or human confirm before auto-publish); structured lanes remain authoritative. Tradeoff accepted: some long-tail events wait in review rather than auto-publishing. Correct trade.
- **Runtime pressure on the 20-minute Action.** Playwright + more sources can blow the wall clock. Mitigation: per-source scheduling, change-detection skips, and a per-run page cap. Tradeoff: a source may refresh every 2-3 days rather than nightly. Fine for the long tail.
- **Auto-publish publishes a bad event.** Mitigation: floor tuned conservatively at first, structured-only auto-publish to start, expand as reliability data accrues. Tradeoff: slightly slower time-to-live for some events in exchange for trust.
- **Additive-DDL discipline.** All new columns are additive and hand-applied by you in the SQL editor, consistent with the standing constraint. No destructive migrations.
- **Assumption:** the batch-only and no-accounts constraints hold. Nothing here needs per-request AI or a login; verification is anonymous and optional.
- **Complexity honesty:** this adds a `sources` table, a confidence field, one generic adapter, and two weekly jobs. That is real added surface. It is justified only because each piece directly buys coverage, quality, or time. Anything that did not is deliberately excluded.

---

## 8. Phased implementation plan (realistic for one person)

Each phase is a stop-and-show gate, one at a time, mockup-first where there is UI, consistent with how you build.

- **Phase 1, Instrument (quick).** Yield baselines + alerting + dead-man's-switch + verified sender + stale-row pruning. Ships confidence that the system is honest about its own health.
- **Phase 2, Sources as data.** Create `sources`, backfill the 32 adapters + ranking + recurring registry, point dedupe authority at the table. No behavior change; pure unblock.
- **Phase 3, Confidence gate.** Add `data_confidence` + `source_count`, compute in the pipeline, auto-publish structured high-confidence. Measure the drop in daily review time.
- **Phase 4, Lane B.** Generic fetch + Haiku extraction over 10-20 discovered long-tail sources, landing at low confidence into review. First coverage jump; validate accuracy before widening.
- **Phase 5, Dedupe + identity.** Venue signal, `event_key`, Sonnet adjudication on the ambiguous band.
- **Phase 6, Coverage layer.** Weekly Sonnet coverage report + silent-miss cards in the Coverage tab; run the first quarterly discovery sprint.
- **Phase 7, Moat.** Venue/organizer graph, popularity from want-to-been, anonymous verification. Long-horizon, compounding.

Sequence matters: instrumentation and the sources table come first because every later phase reads from them.

---

## 9. The top 5 decisions I would make first

1. **Make sources data.** Create the `sources` table and backfill everything hardcoded into it. Nothing else scales until this exists.
2. **Ship a `data_confidence` score and auto-publish the safe majority.** This is the only way coverage grows without eating your 15 minutes.
3. **Build Lane B (generic AI extraction) to break the adapter-per-source ceiling**, behind the trust firewall (AI dates are candidates, not facts).
4. **Fix silent-miss detection now** (yield-vs-baseline alerting). It is cheap and it directly defends the "if it is happening, we have it" promise.
5. **Keep the model stack to one vendor, tiered** (Haiku for volume, Sonnet for weekly reasoning). Resist Gemini/Firecrawl/Perplexity-in-pipeline; vendor sprawl is a tax with no coverage payoff for a solo operator.

---

*End of Doc 16. This is a strategy review, not a build spec; each phase should get its own mockup-first delta spec before Claude Code touches anything.*
