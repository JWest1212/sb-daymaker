# SB Daymaker — Ongoing Ingestion & Review Pipeline: Options, Recommendation & Build Plan

**Generated:** 2026-06-24 · **Status:** proposal for review · **Assumes:** Doc 08 build plan (MVP through Phase 8) is complete; this is the missing *front half* of the Phase-8 pipeline (ingestion → image resolve → approve).

**Locked constraints carried in from project context + this session's interview:**
- Solo operator, **~15 min/day** maintenance ceiling.
- **~$45/mo** existing platform floor; **up to ~$50/mo additional** headroom for ingestion infra.
- **Batch AI only** — no per-request Claude calls; ingestion runs Claude in nightly batches.
- **Ranker never reads sponsor status**; ingestion never sets `is_featured`/`sponsor_id`.
- **Cockpit approval screen** is the chosen review surface (build it).
- **Daily digest** is the chosen failure mode for broken sources (no live debugging).
- **Hard start-time gate (NON-NEGOTIABLE):** any Tier-1 or Tier-2 item that *requires* a start time must have an **accurate, deterministically-identified** start, or it is **dropped** (never published, never guessed). Evergreen Tier-3 "activities" are exempt — they have no start time to be wrong.
- Everything lands `status='needs_review'`; the human approves.

---

## 1. The core problem, restated

Hand-compiling 107 things proved the *rules* (the strict gate) but is not repeatable weekly. The site needs a machine that refills `needs_review` on a schedule while the founder only approves. The hard part is **not** "find events" — aggregators do that. The hard part is the same thing that made the seed pass slow by hand:

1. **Deterministic start times.** A wrong start = a locked door = a broken trust promise. Most long-tail sources publish fuzzy times ("8-ish", "Wednesdays") that must be rejected, not salvaged.
2. **Source coverage.** The marquee venues (Bowl, Granada, Arlington) have clean APIs. **The bulk of SB Daymaker's actual value — SOhO, Lobero, Music Academy, the Independent, civic series, the Funk Zone, recurring rhythms — has no API** and must be fetched and structured.
3. **Dedupe across sources.** The same show appears on the venue site, LiveNotes, and an aggregator. The DB already has the tools for this (`uuid5` exact-match + `things_title_trgm_idx` GIN trigram index).

So the architecture is a **tiered adapter system**, not a single feed. APIs are the cheap reliable backbone; the proven hand-sources become structured scrapers; Claude runs one nightly batch for voice + classification only.

---

## 2. What the data-source research found (and the key decision it forces)

I checked the obvious paid feeds against the two things that matter: **does it carry a deterministic exact start time, and does it cover SB's long tail?**

| Source | Cost | Exact start time? | SB coverage | Verdict |
|---|---|---|---|---|
| **Ticketmaster Discovery API** | **Free** (5,000 calls/day, JSON) | **Yes** — `dateTime` per event | Marquee only (Bowl, Arlington, Granada via TM/AXS rails) | **USE** — free, structured, exact. The backbone for big venues. |
| **SeatGeek API** | Free key | Yes, but commerce-shaped | Thin on SB small venues | Optional corroborator; not primary. |
| **Eventbrite API** | Free key | Yes | Spotty/messy for SB (per seed-session notes) | Low priority; corroborate only. |
| **PredictHQ** | **Enterprise/tailored** (well over budget) | Yes, normalized | Broad but forecasting-shaped, not curation-shaped | **SKIP** — wrong shape, wrong price. |
| **Bandsintown / Songkick** | Free-ish | **Often NOT** (artist lists, missing times) | Discovery of *what's on*, not *when* | Discovery only — never trust for time (matches seed finding). |
| **Your proven hand-sources** (SOhO ticketing, Visit SB, Independent, City of Goleta/SB, LiveNotes, venue sites) | Free to fetch | **Yes** (server-rendered detail pages) | **The actual long tail** | **STRUCTURE THESE** — they are the moat. |

**The decision this forces:** the ~$50/mo is **not** best spent on an aggregator subscription. It's best spent (if at all) on a **scrape-reliability layer** (rotating fetch / anti-bot / JS-render) so the long-tail scrapers don't rot — and even that is optional, because most of your confirmed sources are server-rendered and fetchable today with plain HTTP. **The likely steady-state spend is well under $50/mo, possibly near $0 incremental.** (See §6 cost model.)

---

## 3. The pipeline shape (shared by all options)

```
┌─────────────────────────────────────────────────────────────────────┐
│  NIGHTLY (scheduled)                                                  │
│                                                                       │
│  ① FETCH          per-source adapters pull raw payloads               │
│     ├─ API tier:   Ticketmaster Discovery (free, exact dateTime)      │
│     ├─ Scrape tier: SOhO, Visit SB, Independent, City sites, LiveNotes│
│     └─ Places tier: Google Places refresh (weekly cadence, closures)  │
│                                                                       │
│  ② NORMALIZE      raw → candidate rows (pure functions, no AI)        │
│     └─ THE STRICT GATE runs here (the §3 seed rules as code)          │
│         • require title + navigable address + source URL             │
│         • T1/T2: require deterministic exact start → else DROP        │
│         • derive time_of_day_fit, price_band; assign uuid5 id        │
│                                                                       │
│  ③ DEDUPE         uuid5 exact-match + title-trigram×date near-match   │
│     └─ prefer venue-owned ticketing as canonical                     │
│                                                                       │
│  ④ ENRICH (batch Claude, ONE call)  voice/blurb + tag proposal       │
│     └─ classification + negative-rule tags; NEVER touches start time  │
│                                                                       │
│  ⑤ IMAGE RESOLVE  (existing Phase-8 waterfall) owned→Pexels→Wikimedia │
│     →Google Places Photo→placeholder, under the billing cap          │
│                                                                       │
│  ⑥ LAND           insert status='needs_review' (on conflict do nothing)│
│  ⑦ DIGEST         email: N new, M dropped+why, K sources broken       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  DAILY (human, ≤15 min)                                               │
│  COCKPIT REVIEW QUEUE → approve / edit / reject → publish             │
└─────────────────────────────────────────────────────────────────────┘
```

The strict gate (②) is the heart. It is the §3 methodology from the seed compilation, turned into a deterministic validator. **Claude (④) runs after the gate, never before** — so AI never has the chance to "rescue" a row that failed the start-time test. This is what makes the hard gate enforceable.

---

## 4. Three architecture options

All three implement the same pipeline shape and the same gate. They differ on **where the code runs** and **how much you build vs. buy**. All fit the budget; they trade setup effort against robustness.

### Option A — "Stay in the stack" (Vercel Cron + Supabase)
**What:** Ingestion runs as Vercel Cron jobs hitting Next.js route handlers; data lands in Supabase; the cockpit is a new admin route in the existing app. Batch Claude via the API on a nightly trigger.

- **Pros:** Zero new infra or accounts. One deploy target, one bill. Cron + serverless is plenty for a nightly job over ~10 sources. Cockpit reuses existing auth/session and the schema you already have.
- **Cons:** Vercel function timeouts (long scrape sweeps must be chunked per-source, not one mega-job). No heavy headless-browser rendering on Vercel — JS-only sites need a fetch fallback.
- **Cost:** ~$0 incremental (within existing Vercel/Supabase tiers) + Claude batch (~cents/run) + occasional Google Places.
- **Best if:** You want the simplest thing that works and your sources stay mostly server-rendered (they do today).

### Option B — "Dedicated worker" (GitHub Actions nightly + Supabase)
**What:** A scheduled GitHub Action (free cron) runs a Python/Node ingestion script end-to-end, writes to Supabase via service role, calls Claude batch, then exits. Cockpit still lives in the Next.js app.

- **Pros:** No serverless time limits — a single script can run the full sweep, render JS if needed (Playwright in the Action), and take minutes without timeout anxiety. Clean separation: ingestion is a repo job, the app just reads `needs_review`. Easiest place to add a real headless browser for stubborn sites.
- **Cons:** A second moving part (the Action) and a second place to watch. Secrets live in GitHub. Slightly more "ops" conceptually, though still serverless-free-tier.
- **Cost:** ~$0 (GitHub Actions free minutes cover a nightly job comfortably) + Claude batch + Google Places.
- **Best if:** You want maximum scraper robustness (JS rendering, long runs) and like keeping ingestion as versioned code separate from the app.

### Option C — "Managed scrape layer" (Apify/Scrapfly actors + thin glue)
**What:** Offload fetching to a managed scraping platform (e.g., Apify actors for Ticketmaster + custom actors for the long tail; or Scrapfly for anti-bot/JS render). A small nightly job pulls actor outputs, runs the gate + Claude + land.

- **Pros:** Someone else maintains the anti-bot/proxy/JS-render headache — the thing most likely to rot. Ticketmaster and generic site actors already exist. Scales if you add cities later.
- **Cons:** The first real recurring cost ($ per 1K results / platform fee — must be watched against the $50 cap). Adds vendor lock-in and an external dependency. Overkill while your sources are server-rendered and the city is just SB.
- **Cost:** Variable; the part of the $50 budget most at risk of creeping. Defensible only if scrapers start getting blocked.
- **Best if:** Long-tail sources begin hard-blocking plain fetches, or you expand beyond SB and scraper maintenance becomes the bottleneck.

---

## 5. Recommendation

**Build Option B (GitHub Actions worker) for ingestion + the cockpit review screen in the existing app, with Ticketmaster Discovery API as the free backbone and your proven sources as structured adapters. Hold Option C (managed scraping) in reserve as a per-source upgrade only when a specific source starts blocking.**

Why B over A and C:

- **vs. A:** The single hardest reliability risk is long-tail scrapers (sites change/block). B lets you run a real headless browser and long sweeps with no timeout, which is exactly where A gets awkward. The cost is identical (~$0). The only thing A wins is "no second moving part" — and the daily digest already neutralizes the ops burden of that second part.
- **vs. C:** C spends real money to solve a problem you mostly don't have *yet* — today's confirmed sources are server-rendered and fetchable. Buying managed scraping now is paying to insure a risk that hasn't materialized. Keep it as a targeted upgrade: if (say) SOhO or LiveNotes starts blocking, point *that one adapter* at Scrapfly and leave the rest free.

This keeps steady-state incremental cost near **$0–$15/mo** (Claude batch + Google Places + the occasional rescue), leaving most of the $50 headroom unspent as a buffer.

**The start-time gate is implemented identically in all options** and is the non-negotiable core: T1/T2 candidates without a deterministic exact start are dropped at step ②, before Claude ever sees them, and the drop is *counted in the digest* so you can see what's being held back and why.

---

## 6. Cost model (steady state, monthly)

| Line | Option B (recommended) |
|---|---|
| Vercel + Supabase (existing) | $0 incremental (already in the $45 floor) |
| GitHub Actions (nightly worker) | $0 (free minutes cover it) |
| Ticketmaster Discovery API | $0 (free, 5k/day; nightly use is a tiny fraction) |
| Long-tail scrapers (server-rendered fetch) | $0 |
| Claude batch (1 enrichment call/night) | ~$1–5/mo (batch pricing, small payloads) |
| Google Places refresh (weekly, cached) | ~$0–10/mo (mind audit flag B6 SKU + the hard ~$50 image cap already planned for Phase 8) |
| **Reserve: managed scrape rescue (Scrapfly/Apify)** | **$0 until a source blocks, then ~$5–20 for that one source** |
| **Total incremental** | **~$1–15/mo typical; hard ceiling well under $50** |

The Google Places line is the one to watch — it's already governed by the Phase-8 hard billing cap (~$50/mo) and audit flag B6 (re-confirm Place Photo SKU + caching at setup). Ingestion's Places use is *metadata + closure detection* (cheap, cacheable, weekly), distinct from the photo cap.

---

## 7. The strict gate as code (the validator spec)

This is the §3 seed methodology turned into a deterministic function. It runs in step ② with **no AI** so it is auditable and repeatable.

```
function gate(candidate, source_tier):
  # --- hard rejects (drop the row) ---
  if missing(candidate.title): DROP("no title")
  if missing(candidate.address) and not resolvable_venue(candidate.venue_name):
      DROP("no navigable address")
  if missing(candidate.source_url): DROP("no source")

  # --- THE START-TIME GATE (T1/T2 only) ---
  if candidate.tier in (1, 2) and requires_start(candidate.category):
      if not has_deterministic_start(candidate):   # exact date AND clock time,
          DROP("no deterministic start time")       # from a structured/server field
      # "deterministic" = parsed from a machine field or server-rendered detail
      # page, NOT inferred, NOT regex-guessed from prose, NOT "8-ish/dusk".

  # --- evergreen exemption ---
  if candidate.tier == 3:
      require(candidate.reason_to_go)   # Tier-3 rule: never a bare place
      # no start-time requirement — activities have no start to be wrong

  # --- derivations (pure, deterministic) ---
  candidate.time_of_day_fit = bucket(start_hour)         # morning/afternoon/evening/late
  candidate.price_band      = map_price(candidate)       # free only if stated; else band or null
  candidate.id              = uuid5(NS, key(candidate))  # exact-match idempotency
  candidate.status          = 'needs_review'
  candidate.last_confirmed  = run_date
  return candidate
```

Notes that make the gate trustworthy:
- **Address-resolution relaxation** (the one allowed "lookup"): a *sourced venue name* → its known street address is deterministic, not invention. Title/date/time/source stay strict.
- **Optional fields never drop a row** (`local_note`, `ends_at`, `buy_url`, `price_band` may be null).
- **`has_deterministic_start` is the linchpin.** It returns true only for: (a) an API field like Ticketmaster `dateTime`, or (b) a server-rendered detail page with an explicit clock time (the SOhO ticketing pattern). Prose like "doors at 8-ish" returns false → drop.

---

## 8. Per-source adapter registry (priority order)

Each adapter is a small module: `fetch() → raw`, `parse(raw) → candidates[]`, plus a `start_time_strategy` declaring how it proves the start (so the gate knows whether to trust it).

| # | Source | Tier | Fetch | Start-time strategy | Cadence |
|---|---|---|---|---|---|
| 1 | **Ticketmaster Discovery API** | T1 | API (free key) | `dateTime` field (deterministic) | Nightly |
| 2 | **SOhO ticketing** (tickets.sohosb.com) | T1 | HTTP, server-rendered | per-event detail page clock time | Nightly |
| 3 | **Visit Santa Barbara** (/events/`<slug>`) | T1 | HTTP, server-rendered | event page time field | Nightly |
| 4 | **The Independent** (dated listings) | T1 | HTTP | dated article time | Nightly |
| 5 | **City of Goleta / City of SB / UCSB A&L** | T1 | HTTP | civic calendar time | Nightly |
| 6 | **LiveNotes SB** | T1/T2 | HTTP (date-aware parser) | listing time; prefer venue ticketing if conflict | Nightly |
| 7 | **Recurring-rhythm registry** (happy hours, trivia, art walks, Nite Moves) | T2 | curated + source re-confirm | sourced day+time; **NULL allowed** w/ flag for confirmed-day/unknown-time | Weekly re-confirm |
| 8 | **Google Places** | T3 | API | N/A (no start) — metadata + `business_status` closure detection | Weekly |

**Dedupe across adapters:** `uuid5` catches exact re-emits; **title-trigram × date** (existing `things_title_trgm_idx`) catches near-dupes; when a show appears in both LiveNotes and venue ticketing, **prefer the venue's own ticketing** as canonical (it owns the time).

**Closure handling:** Google Places `business_status = CLOSED_PERMANENTLY` → archive the place. (Lesson: "We Want the Funk" must never resurface.)

---

## 9. The cockpit review screen (the 15-min surface)

Design goal: **approve a night's queue in under 15 minutes.** Optimize for keyboard speed and at-a-glance trust signals.

**Layout — a single prioritized queue:**
- One card per `needs_review` row, sorted by *soonest start* (T1/T2) then newest (T3).
- Card shows: title, the AI blurb, start time **with its source link**, neighborhood, tier badge, proposed tags, resolved image (or placeholder), and a **provenance line** ("start time from tickets.sohosb.com detail page").
- **Trust-signal chips:** green = deterministic start from owned ticketing/API; amber = corroborated; the gate already dropped red, so red never appears in the queue — but a collapsible "Dropped tonight (N)" panel shows what was held back and why, so nothing silently vanishes.

**Actions (keyboard-first):**
- `A` approve → publish · `E` edit inline (fix a blurb/tag/time) → approve · `R` reject (with a one-click reason) · `→` next.
- **Bulk approve** a filtered set (e.g., "all Ticketmaster music with green start chips") for the high-confidence tail.

**The digest (email, nightly):** "12 new in queue · 4 dropped (3 no-time, 1 dupe) · 1 source broken: LiveNotes parser returned 0." One link straight into the queue. This is the only thing that should ever ask for your attention.

---

## 10. Build plan (layered on the completed MVP)

Assumes Doc 08 Phases 1–8 are done. Phases below are additive. Rough effort markers assume Claude Code does the bulk; sequence matters more than the estimates.

### Phase 9 — The gate + schema for ingestion provenance
- Implement `gate()` (§7) as a pure, unit-tested module. **This is the foundation; build and test it first against the 107-row seed as fixtures** (every seed row should pass; every documented drop reason should reproduce).
- Add ingestion bookkeeping: a `source_runs` table (run timestamp, source, fetched/qualified/dropped counts, error) and an `ingest_drops` log (candidate, drop reason) so the digest and the cockpit "dropped" panel have data.
- Add a `recurring_schedules.frequency` enum (`weekly`/`biweekly`/`monthly`) — the seed exposed that day-of-week alone can't express "1st Thursday" or "bi-monthly." Backfill the existing rows.
- **Exit:** gate passes all seed fixtures; provenance tables exist.

### Phase 10 — Two adapters end-to-end (the vertical slice)
- Build the **Ticketmaster Discovery** adapter (proves the API path + free exact-time backbone) and the **SOhO ticketing** adapter (proves the server-rendered scrape path + per-detail-page time).
- Wire fetch → gate → dedupe → land for just these two, run by a GitHub Action nightly (Option B). No Claude yet; land rows with raw titles.
- **Exit:** a nightly run lands real SOhO + Bowl rows as `needs_review`, idempotently, with correct drops logged.

### Phase 11 — Batch Claude enrichment (one call/night)
- Add step ④: a single batched Claude call that takes the night's gated candidates and returns blurb + `blurb_long` + proposed tags, enforcing the negative rules (`is_21_plus`→never `family_day`; non-free→never `free_sb`). **Claude runs after the gate, never before.**
- Audit-log every AI draft (`audit_log` already exists).
- **Exit:** landed rows have house-voice blurbs and tags; the start time is untouched by AI.

### Phase 12 — The cockpit review screen
- Build the queue UI (§9) as an admin route: sorted cards, trust chips, keyboard approve/edit/reject, bulk-approve, the collapsible "dropped tonight" panel.
- Approve writes `status='published'` + an `audit_log` approve row.
- **Exit:** you can clear a night's queue from one screen in minutes.

### Phase 13 — Remaining adapters + the nightly digest
- Add adapters 3–6 (Visit SB, Independent, City sites, LiveNotes) and the Google Places weekly refresh (adapter 8) with closure detection.
- Build the **daily digest email** (new/dropped/broken counts + queue link). Wire each adapter to report into `source_runs` so breakage surfaces in the digest, not in production.
- **Exit:** all confirmed sources flow nightly; one digest email summarizes everything; broken sources self-report.

### Phase 14 — Recurring-rhythm registry + hardening
- Build adapter 7: a curated registry of the Tier-2 rhythms (happy hours, trivia, art walks, Nite Moves) that re-confirms on a slow cadence and respects the new `frequency` field. Day-confirmed/time-unknown rhythms land with `start_time=NULL` and a flag (never a guessed time).
- Add the **managed-scrape reserve hook**: a per-adapter config flag that can route a single source through Scrapfly/Apify if it starts blocking — so Option C is a one-line upgrade per source, not a rebuild.
- **Exit:** the full pipeline runs unattended nightly; founder spends ≤15 min/day in the cockpit; cost sits near $0–15/mo with headroom to spare.

---

## 11. Open decisions for the founder

1. **Confirm Option B** (GitHub Actions worker) vs. A (stay in Vercel) — B is recommended for scraper robustness at equal cost; A is defensible if you'd rather not add a second moving part.
2. **Auto-approve policy:** the gate guarantees a deterministic start, so a *high-confidence bulk-approve* (e.g., Ticketmaster music with green chips) is low-risk. Decide whether even that requires a human tap, or whether one trusted source tier may auto-publish. (Default assumption: nothing auto-publishes; you tap.)
3. **Google Places cadence vs. the cap:** confirm weekly metadata refresh fits under the existing Phase-8 billing cap once B6 SKU pricing is re-checked.
4. **`frequency` schema change:** approve adding it now (Phase 9) so the monthly/bi-monthly rhythms surface correctly rather than as fake-weekly.
5. **Reserve trigger:** agree the rule for spending the managed-scrape reserve — i.e., "only when a specific adapter logs N consecutive zero-result/blocked runs in the digest," so cost never creeps silently.
