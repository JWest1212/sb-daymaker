# 19 · SB Daymaker — Neighborhood Sweep + Venue Dictionary (Build Spec)

`Status: v1 · 2026-07-12 · build spec. Mockup-first: pairs with 19_SBDaymaker_Neighborhood_Sweep_Mockup.html. Cites Doc 18 (Findability & Tagging Architecture).`

> **What this builds.** A one-time, mostly-automated pass that gives every published thing a correct `neighborhood`, so nothing that is actually in Santa Barbara sits in `other`/null where the Place door cannot see it. It also produces the venue dictionary, the reusable asset that later becomes the venue-attribute registry (Doc 18 §6). This is build spec 1, the first move because zones gate the rest of the findability work.
>
> **Precedence.** Doc 18 §7.1 is the authority for the zone model: the 8 door-zones are a read-time **code mapping over the existing 11-value `neighborhood` enum**, never a stored field. This spec makes `neighborhood` accurate; it does not introduce a zone column. `CLAUDE.md` is the contract; code is truth.

> **RECONCILIATION BANNER (2026-07-12) — read Doc 20 alongside this.** The live-code audit confirmed this spec is buildable as written, with two corrections. **(1)** Place is a **sort, not a filter**: a missing zone degrades the sort and the on-card location label, it does not make a thing invisible. So the sweep's value is "better sort + accurate label," and nothing is ever held for lacking a zone. **(2)** Phase 5's self-heal targets the **live `ingest/` land step**. Never target the dead `lib/pipeline.ts` or `lib/enrich.ts` (legacy duplicate pipeline), nor `LensSheet.tsx` / `NearMeSheet.tsx`. Otherwise this spec stands and does not depend on the open Activity questions, so it is the right first build.

---

## 1. The job, in one paragraph

The pipeline already assigns a `neighborhood` to most things, but a residue lands in `other` or null. Because Place is a sort, those things still appear, but they do not bubble up when their zone is picked and their on-card location label degrades (the "Downtown" line on the card). The sweep runs a deterministic resolver over the published catalog, writes confident matches automatically, and routes the rest to a one-tap cockpit triage. The resolver then folds into the live `ingest/` land step so new things self-resolve, and the Coverage tab watches for any thing that publishes without a zone so the residue cannot grow back. No AI, no paid geocoding, one additive table.

---

## 2. What changes and what does not

**Changes (all additive):**

- One new table, `venues` (venue name to neighborhood, applied by hand by Jim). Designed to grow into the venue-attribute registry.
- One new pure module, the neighborhood resolver, reused by the sweep and the nightly land step.
- One new cockpit surface under Coverage (the mockup): summary, triage, dictionary.

**Does not change:**

- No change to the `neighborhood` or `nearby_zone` enums. The 8 door-zones stay a code mapping (Doc 18 §7.1). `nearby_zone` (6 values, Near Me + guides) is untouched.
- No AI. No per-request calls. No paid geocoding API (cost floor protected).
- `lib/explore.ts` untouched. Batch-only and no-accounts hold.

---

## 3. The one schema decision (flag)

The venue dictionary is a **DB table, not a hardcoded TS file.** This diverges from the `recurringRegistry.ts` pattern (a founder-maintained file with paste-ready snippets). Recommended here as a table because three things all want DB-backed venue data: cockpit triage writing new venues on assignment, the nightly self-heal reading them, and the venue-attribute registry (dog_friendly, accessibility, patio, parking) that Doc 18 builds on top. This is one additive DDL statement Jim applies once in the Supabase SQL editor. If you would rather keep the file pattern, say so and I will rework triage to emit paste-ready rows instead; my recommendation is the table.

### 3.1 DDL (Jim applies by hand)

```sql
create table if not exists venues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_norm     text not null,                 -- lowercased, punctuation-stripped; match key
  neighborhood  neighborhood not null,         -- 11-value enum; door maps to 8 zones in code
  place_id      text,                          -- optional strong match to a Google Place
  aliases       text[] not null default '{}',  -- alternate names seen in titles/addresses
  created_by    text not null default 'founder',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists venues_name_norm_idx on venues(name_norm);
create index  if not exists venues_place_id_idx  on venues(place_id) where place_id is not null;

alter table venues enable row level security;   -- service-role / cockpit only; no public policy
```

The explicit RLS enable closes the defense-in-depth gap flagged for the other cockpit-added tables in the data-layer audit. Future venue-attribute columns (`dog_friendly boolean`, `wheelchair_accessible boolean`, `has_patio boolean`, `parking_difficulty smallint`) are added later, additively, when Doc 18's tagging build reaches them. Do not add them now.

---

## 4. The resolver (the reusable core)

New pure module: `ingest/adapters/_shared/resolveNeighborhood.ts`. Input is a thing/candidate (`title`, `address`, `place_id`, `source_url`, `lat`, `lng`, current `neighborhood`). Output is `{ neighborhood, method, confidence }`. It is called by both the sweep and the nightly land step, so it must be side-effect-free.

### 4.1 Waterfall (highest trust first)

1. **place_id match** — `thing.place_id` equals a `venues.place_id` → that venue's neighborhood. Confidence 0.98.
2. **Venue-name match** — a `venues.name_norm` or alias appears in the normalized `title` or `address` → that neighborhood. Confidence 0.9.
3. **Source-implied venue** — the `source_url`/source key implies a known venue (reuse the `sourceKeyOf` mapping already in `dedupe.ts`: `sohosb.com` → SOhO → downtown, and so on) → that neighborhood. Confidence 0.85.
4. **Point-in-polygon** — if `lat`/`lng` are present, test against 8 rough zone bounding boxes (free; coordinates are already stored). Confidence 0.75 (SB's linear coastal geography makes boxes workable; edges are the weak spot).
5. **Street / address match** — a street token in `address` maps via a code table (State St 400-1300 → downtown; State below the 101 → funk_zone; Coast Village Rd → montecito; Cabrillo / Harbor → waterfront; Cliff Dr / Mesa Ln → mesa; Mission Canyon → mission_canyon; La Cumbre / Hope Ave → upper_state; Hollister / Calle Real → goleta; Carpinteria Ave / Linden → carpinteria). Confidence 0.6.
6. **Existing neighborhood** — if already a real value (not other/null), keep it. (Applies in the nightly path, not to the residue sweep.)
7. **Unresolved** — remains `other`/null → triage.

### 4.2 Write policy

- Confidence at or above **0.75** (methods 1-4) writes `neighborhood` directly, no review.
- Confidence **0.6** (street match) is a soft suggestion: it pre-fills the triage chip but does not auto-write, because street guesses are the noisiest tier. (Tunable; start conservative.)
- Below that → triage, no suggestion.

### 4.3 Zone chips write a canonical neighborhood (flag)

Triage shows 8 zone chips (friendlier than 11 neighborhoods). Each chip writes a canonical `neighborhood` value. For the two zones that fold multiple neighborhoods, triage collapses to a default: Mission & Riviera → `mission_canyon`, Montecito+ → `montecito`. The finer distinction (riviera vs mission_canyon, carpinteria vs montecito) is preserved for **known venues in the dictionary** (SB Botanic Garden stores `mission_canyon`, Carpinteria Arts Center stores `carpinteria`), so only the hand-triaged residue loses granularity, which is a small set and refinable later per Doc 18 §7.1.

---

## 5. Seeding the dictionary (minimizes your time)

Do not hand-enter hundreds of venues. Seed in two moves:

1. **Auto-seed from the adapters.** The ~24 venue-direct sources already encode a known venue and a known location. Phase 1 generates the initial `venues` rows from the registry. Starter set (name → neighborhood):

   SOhO → downtown · The Granada Theatre → downtown · Lobero Theatre → downtown · Arlington Theatre → downtown · Center Stage → downtown · New Vic / Ensemble (ETC) → downtown · SB Museum of Art → downtown · Dargan's → downtown · Downtown SB (district) → downtown · MOXI → funk_zone · Figueroa Mountain Brewing (SB taproom) → funk_zone · SB Museum of Natural History → mission_canyon · SB Botanic Garden → mission_canyon · SB Bowl → riviera · Music Academy of the West → montecito · Alcazar Theatre → carpinteria · Carpinteria Arts Center → carpinteria · Stearns Wharf → waterfront · Condor Express (harbor) → waterfront · UCSB → goleta · Ice in Paradise → goleta.

   Multi-location sources (Libraries, SB Land Trust trails) are **not** single dictionary entries; they resolve per-event via address/coordinates.

2. **Grow via triage.** Every venue you place in triage offers to add itself to the dictionary, so your review time compounds into the asset. The long tail fills itself over the first few weeks.

---

## 6. Phased build (stop and show at each gate)

One phase at a time. Finish, show me what to look at, wait for go.

**Phase 1 — Table + seed + resolver.** Jim applies the DDL. Auto-seed `venues` from the adapter registry (§5.1). Build `resolveNeighborhood.ts` (pure, unit-tested on a handful of fixtures). *Show:* the seeded dictionary and the resolver's output on 10 sample things.

**Phase 2 — Dry-run sweep.** A `runNeighborhoodSweep({ dry: true })` function (callable from a cockpit server action; no AI, pure DB read + compute) that runs the resolver over all published things and returns the summary (resolved, unresolved, by-method, by-zone). Mirrors the existing `DRY_RUN` posture: writes nothing. *Show:* the real numbers (this replaces the mockup's invented counts).

**Phase 3 — Cockpit surface.** Build the mockup under Coverage: summary, triage queue (things at other/null with suggestions), dictionary view + add. Read-only until Phase 4. *Show:* the rendered cockpit against live data.

**Phase 4 — Apply.** "Apply resolved" writes the at-or-above-0.75 matches to `things.neighborhood`. Triage one-tap writes the chosen neighborhood and upserts the venue into `venues`. *Show:* count moved out of other/null, residue remaining.

**Phase 5 — Self-heal.** Call `resolveNeighborhood` inside `ingest/land.ts` before insert so new things get a neighborhood automatically. Add a "published with no zone" count to the Coverage tab. *Show:* the next nightly run resolving new things with zero manual work.

---

## 7. Acceptance checklist

- [ ] `venues` table created with RLS enabled; no public policy.
- [ ] Dictionary auto-seeded from adapters; the starter set (§5.1) present and correct.
- [ ] `resolveNeighborhood.ts` is pure, unit-tested, and returns `{ neighborhood, method, confidence }`.
- [ ] Dry-run sweep prints resolved / unresolved / by-method / by-zone over live published things and writes nothing.
- [ ] Cockpit surface renders summary, triage, and dictionary; matches the mockup; 44px targets; visible focus rings; reduced-motion safe.
- [ ] Apply writes only confidence-at-or-above-0.75 matches automatically; street-tier and below go to triage.
- [ ] Triage one-tap writes `neighborhood` and upserts the venue (with canonical neighborhood per §4.3).
- [ ] `land.ts` calls the resolver for new things; Coverage shows the no-zone watch count.
- [ ] `other` remains a valid outcome for genuinely regional/online things (zero wrong `other`, not zero `other`).
- [ ] No enum change, no `lib/explore.ts` change, no AI call, no paid geocoding, no new PII.

---

## 8. Risks and calls

- **Venue table vs file** (§3) — recommended table; flag raised, reversible to the file pattern if you prefer.
- **Street-match noise** — the 0.6 tier is deliberately not auto-written; it only pre-fills a triage suggestion. Tune the threshold after seeing Phase 2 numbers.
- **Point-in-polygon edges** — rough boxes misfire at zone borders; venue and source matches carry the majority, so box errors surface only for coordinate-only things and are caught in triage.
- **Multi-neighborhood zone collapse** (§4.3) — accepted for the hand-triaged residue; dictionary keeps precision for known venues.
- **Libraries / trails** — multi-location, resolved per-event, not as single dictionary rows.

---

## 9. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then Doc 20 (20_SBDaymaker_LiveCode_Reconciliation_Delta.md) FIRST because it
corrects the specs against the live code, then Doc 18 sections 4 and 7.1, then this spec
(19_SBDaymaker_Neighborhood_Sweep_Spec.md) and its mockup.

Do STEP 0 before any building. It is read-only except item 1, which I will apply by hand.

STEP 0 - verify and gather (report back, change nothing except telling me DDL to run):
1. Check whether the migration 20260711_activities.sql is applied to the live/prod DB. If it is
   NOT applied, STOP and tell me the exact SQL to run, and warn me the Activity door may be
   returning all-zero counts until I apply it. Do not apply it yourself.
2. Dump these four read-only facts so they can be pasted back for the next spec:
   a. the distinct values currently in things.activities
   b. the 10 values in the occasion/vibe tag registry the middle door reads, plus its file path
   c. which enum rainy_day belongs to, and whether that enum is the one the middle door reads
   d. the confirmed live file paths for the enrich step and the land step under ingest/
Then stop and show me STEP 0 results before touching the sweep.

Then build the Neighborhood Sweep in the 5 phases in section 6, ONE phase at a time. After each
phase, stop, tell me what changed and exactly what to look at, and wait for my go.

Hard constraints (do not violate without flagging):
- Place is a SORT, not a filter (Doc 20). A missing zone flags for triage and still publishes;
  never hold a thing for lacking a zone.
- The 8 door-zones are a READ-TIME code mapping over the existing 11-value `neighborhood` enum
  (Doc 18 §7.1). Do NOT add a zone column or change the `neighborhood` or `nearby_zone` enum.
- No AI, no per-request calls, no paid geocoding API. Point-in-polygon uses only lat/lng already
  stored, against rough zone boxes.
- `lib/explore.ts` is consumed as-is. No new end-user PII.
- NEVER target the dead code: lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx, NearMeSheet.tsx.
  The self-heal in Phase 5 goes into the LIVE ingest/ land step only.
- The `venues` table DDL in §3.1 is applied by ME in the Supabase SQL editor. Tell me to run it
  first; do not create it yourself.

Phase 1 (after STEP 0 and my go):
1. Give me the exact `venues` DDL to paste (from §3.1), and wait for me to confirm I have run it.
2. Auto-seed `venues` from the adapter registry using the starter set in §5.1.
3. Build `ingest/adapters/_shared/resolveNeighborhood.ts` as a pure function implementing the §4.1
   waterfall and §4.2 write policy, with unit tests on fixtures.
Then stop and show me the seeded dictionary and the resolver output on 10 sample things.
```

---

*End of Doc 19 build spec. On approval of Phase results, the next findability build is spec 2 (the full backfill: deterministic pass then AI judgment pass over the catalog, per Doc 18 §6).*
