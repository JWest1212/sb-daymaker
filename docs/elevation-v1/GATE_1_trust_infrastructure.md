# GATE 1 — Trust Infrastructure (the data model that everything else inherits)

`Build: Elevation v1 · Gate 1 of 6 · target: 2–3 sessions`
`Prereq: Gate 0 fully closed. Every later gate (SEO, planner, sharing) reads the fields this gate establishes.`

---

## Why this gate exists

Gate 0 removed the visible lies. This gate converts "curated" from a *claim* into a *system*: a quality tier every entry earns, a publish gate that blocks filler, a detail page that carries what a visitor actually needs (address, directions, hours, real price, correct daypart), a recurrence model that computes real next-dates, and a verification stamp + one-tap correction loop propagated down from the guides. After this gate, the data layer is trustworthy and self-defending, and the planner and SEO gates can build on it safely.

**Read before coding:** `sbdaymaker_schema.sql` (`things`, `thing_tags`, `recurring_schedules`, `shared_states`, `audit_log`), `CLAUDE.md` §2/§4/§5/§9, `ingest/enrich.ts`. Note: the schema **already has** `address`, `lat`, `lng`, `last_confirmed`, `happening_tier`, `happening_category`, `reason_to_go`. Much of this gate is **populating and surfacing existing fields**, not inventing them.

**Decisions locked (from the founder session):**
- Inventory strategy: **expand with quality tiers** (do not cull; demote).
- Tier surfacing: **Tier 2 is demoted and rendered as a compact card**; Tier 1 renders full.
- Local's Secret: **hide the section entirely when there is no real secret** (no filler secrets).
- Correction mechanism: **one-tap flag → review queue.**
- Location on detail pages: **address + a "Directions" deep link** (no map embed, no map API cost).
- No new activity categories this build.

---

## SCHEMA CHANGES (additive only — Jim applies these by hand in the Supabase SQL editor)

> **DDL is a human act.** These blocks are additive and idempotent. Claude Code: **do not run these.** Call them out to Jim, who pastes them into Supabase. Then build the code against them.

```sql
-- ============================================================================
-- GATE 1 DDL — additive only. Paste into Supabase SQL editor.
-- ============================================================================

-- 1. Quality tier (editorial completeness), distinct from happening_tier (structure).
--    1 = full/verified, 2 = demoted/compact, 3 = hidden until fixed.
alter table things add column if not exists quality_tier smallint not null default 2
  check (quality_tier between 1 and 3);

-- 2. Verification / freshness stamp surfaced on detail pages (mirrors the guides' "REFRESHED JUL 2026").
alter table things add column if not exists verified_at timestamptz;
alter table things add column if not exists verified_by text;   -- 'founder' | 'source' | 'submission'

-- 3. Recurrence cadence, so bi-monthly / monthly-first-Thursday events stop being mislabeled "weekly".
do $$ begin
  create type recurrence_cadence as enum
    ('weekly','biweekly','monthly','monthly_nth_dow','bimonthly','seasonal','irregular');
exception when duplicate_object then null; end $$;

alter table recurring_schedules add column if not exists cadence recurrence_cadence not null default 'weekly';
alter table recurring_schedules add column if not exists nth_dow smallint
  check (nth_dow between 1 and 5);          -- e.g. 1 = first <dow> of the month
alter table recurring_schedules add column if not exists next_occurrence date;  -- computed nightly

-- 4. Indoor/outdoor nuance (the single `indoor` bit can't say "both").
do $$ begin
  create type setting_kind as enum ('indoor','outdoor','both');
exception when duplicate_object then null; end $$;
alter table things add column if not exists setting setting_kind;  -- nullable; falls back to `indoor` bit

-- 5. Correction flags (one-tap "something wrong?" → review queue). No PII stored.
do $$ begin
  create type flag_status as enum ('new','reviewing','resolved','dismissed');
exception when duplicate_object then null; end $$;

create table if not exists content_flags (
  id          uuid primary key default gen_random_uuid(),
  thing_id    uuid references things(id) on delete cascade,
  guide_id    uuid references guides(id) on delete cascade,
  reason      text not null,            -- controlled set from the UI: 'wrong_time','closed','wrong_price','wrong_location','bad_photo','other'
  detail      text,                     -- optional free text; NEVER collect contact info here
  status      flag_status not null default 'new',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  constraint flag_targets_one check ((thing_id is not null) <> (guide_id is not null))
);
create index if not exists content_flags_status_idx on content_flags(status);
create index if not exists content_flags_thing_idx  on content_flags(thing_id);
```

**After applying:** the quality-tier backfill (G1.1) is a **data** operation Jim runs via a script you write, not more DDL.

---

## G1.1 — The Entry Quality Gate + tier backfill

**The gate (enforced at publish time, in app code — this is the load-bearing rule of the whole build):** a `thing` may not reach `quality_tier=1` unless it has **all** of:
1. A **what-it-is** first sentence (a human reading the blurb learns what the thing actually is — "LOTG" and "Coast Village Pop-Up" fail this today).
2. An **address** (or, for area-only outdoor spots, a `nearby_zone` + a directions-capable location string).
3. At least **one insider fact** a Google Maps card could not tell you (a real Local's Secret) OR, for events, a concrete logistics fact (parking, arrival timing, what to bring).
4. A **correct daypart** (passes the Gate 0 validator).
5. A **real image** (not placeholder/motif) OR an intentional motif with no pretense of a photo.
6. A **resolved price** (`price_band` set, or "Free," or "Check site" + `buy_url` for ticketed).

**Tier logic (write `lib/quality/tierScore.ts`, pure/deterministic):**
- Passes all 6 → `quality_tier = 1` (renders full).
- Passes what-it-is + address + price but is thin on secret/image → `quality_tier = 2` (renders compact; still discoverable).
- Missing what-it-is OR address → `quality_tier = 3` (**not rendered in the public feed**; sits in the cockpit as "needs work"). This replaces culling: nothing is deleted, weak entries are quarantined until fixed.

**Backfill:** script `ingest/audits/tier_backfill.ts` scores all published rows and writes `quality_tier`. Output a summary (counts per tier) for Jim. Wire `tierScore` into the nightly pipeline so tier is recomputed after every enrich.

**Acceptance test A1.1:** `tierScore` has unit tests for each tier boundary; the backfill runs and reports counts; no `quality_tier=3` row appears in the public Explore feed.

---

## G1.2 — Two-tier rendering (Tier 2 compact card)

**Decision:** Tier 2 entries render as a **compact card** — smaller, no large hero image (motif chip or thumbnail only), title + one-line what-it-is + zone + price. Tier 1 renders the full card as today. This lets you keep breadth (the "+264 more" depth teased in the State Street guide) without letting thin entries masquerade as curated ones.

**Task:** In `Card.tsx` (and the feed mapper in `explore.ts`/`CascadeFeed.tsx`), branch on `quality_tier`. Add a `CompactCard` variant. Tier 1 first, Tier 2 grouped lower in each cascade section (dated/recurring/evergreen keep their order; within a section, tier 1 sorts above tier 2). Never interleave a compact card above a full card in the same section.

**Acceptance test A1.2:** a Tier 2 entry renders visibly lighter than a Tier 1 entry; within a section all Tier 1 cards precede Tier 2 cards; keyboard/focus order matches visual order (WCAG).

---

## G1.3 — Detail page completeness (address + directions + hours + real price + share)

**The Iglesias detail page is the template done right** (ticket link, real parking secret, venue framing). Bring every detail page up to it.

**Every `/thing/[id]` page must carry, when the data exists:**
1. **Address row** with the real street address (populate `things.address`; the schema field already exists).
2. **Neighborhood row, directly beneath the address** — the human-readable zone/neighborhood (Funk Zone, Downtown, Goleta, Montecito, Mesa, Waterfront, Riviera, etc.), from `nearby_zone`/`neighborhood`. **Keep this even when a street address is present** — the address gets you there, the neighborhood tells you where you are and anchors the "nearby / pairs-with" logic. Render it as its own labeled line (e.g. "Neighborhood: Funk Zone"). The only suppression rule from Gate 0 stands: never render the literal placeholder "Other" — if the zone is genuinely unknown, omit the row rather than print "Other."
3. **A "Directions" button** — a deep link to `https://www.google.com/maps/dir/?api=1&destination=<url-encoded address or lat,lng>`. No embedded map, no Maps JavaScript API, no cost. Opens the user's native maps app. (This is the locked decision: address + directions deep link.)
4. **Hours / open-now** where applicable — see G1.5.
5. **Real price** — never a bare "—" (Gate 0 guardrail stays); ticketed events show "Check site" + `buy_url`.
6. **Outbound link, correctly labeled** — see G1.4.
7. **Save + Share + Directions** action row (Share is specced in Gate 5; leave the button wired to a stub that Gate 5 fills, but lay out the three-button row now).
8. **Verification stamp** — see G1.6.
9. **A safety/practical note** for outdoor entries — see G1.7.

**Do not add:** a map embed, a reservation-transaction flow, reviews/ratings (all forbidden by `CLAUDE.md` §9).

**Acceptance test A1.3:** for five sampled Tier-1 things spanning event/restaurant/outdoor/museum/free, each detail page shows a real address, the neighborhood/zone on its own line directly beneath the address, a working Directions deep link (opens Google Maps to the right place), a correctly-labeled outbound link, and the Save/Share/Directions row.

---

## G1.4 — Adaptive outbound-link labeling

**Evidence:** "Get tickets ↗" appears on a **free** library gathering (LOTG). MOXI (a ticketed museum) has **no** link at all. Place pages have no website link.

**Task:** The outbound-link label is a function of type/price, not a constant string:
- Ticketed event (`buy_url` + non-free) → **"Get tickets ↗"**
- Free event with a source page → **"Event details ↗"**
- Place/venue with a website → **"Visit website ↗"**
- Restaurant with a reservation URL → **"Reserve ↗"** (link only; no in-app booking)
- No URL → no button (never a dead label).

Store the destination in `buy_url` (reuse the existing column; it is the generic outbound field). Add `link_label` derivation in `lib/format/outboundLink.ts`.

**Acceptance test A1.4:** LOTG shows "Event details," not "Get tickets"; MOXI shows a working "Visit website" (or none if no URL); no page shows a button that 404s or mislabels.

---

## G1.5 — Hours / open-now (lightweight, no live API)

**Constraint:** batch-AI-only, no per-request calls, $45/mo floor. So "open now" must be computed from **stored** hours, not a live Places lookup.

**Task:**
- Add hours to the enrich pipeline output for `type='place'` things (structured `hours` jsonb: array of `{dow, open, close}`), sourced during nightly enrich from the place data already being fetched. (No new live API — this rides the existing nightly place resolution.)
- If a schema field for hours is preferred over jsonb-in-enrich, add it additively in a follow-up DDL block; for this build, storing hours as a jsonb column is acceptable:
```sql
alter table things add column if not exists hours jsonb;  -- [{dow:0-6, open:"HH:MM", close:"HH:MM"}]
```
- Detail page renders a compact "Open today until X" / "Closed · opens Tue 11" computed client-side from `hours` against local time. This is deterministic (no AI, no live call) and satisfies the constraint.
- Where hours are unknown, render nothing (do not guess).

**Acceptance test A1.5:** a place with known hours shows correct open/closed state at three tested local times; a place with unknown hours shows no hours row (not a wrong one).

---

## G1.6 — Verification stamps propagated down from the guides

**Evidence:** the guides carry "REFRESHED JUL 2026" + "WRITTEN BY A LOCAL" — a trust system. Things carry nothing.

**Task:** Every Tier-1 detail page shows a small, quiet stamp: **"Verified · Jul 2026"** driven by `verified_at` (with `verified_by`). Style per `CLAUDE.md` §5 (accent for the badge, darkened `-text` variant for the small label — never small accent text on light). The nightly pipeline sets `verified_at = now()` whenever a source confirms a row (`last_confirmed` already tracks this — mirror it into `verified_at` on confirm, or display `last_confirmed` directly if Jim prefers one field). Tier 2 may show a lighter "Listed" state; Tier 3 shows nothing (it's not public).

**Acceptance test A1.6:** Tier-1 pages show a dated verified stamp; the date reflects the true last-confirmed date; reduced-motion users see a static stamp (no pulsing dot).

---

## G1.7 — Safety / practical notes on outdoor entries

**Evidence:** Lizard's Mouth (a boulder field near an active shooting range, no shade, fire-closure-prone) carries a great trailhead tip and zero cautions.

**Task:** For `happening_category IN ('outdoor_activity','scenic_chill')` and hike-like entries, the detail page supports an optional **"Before you go"** practical line (drive time from downtown, shade/water, seasonal closure risk, footwear). This reuses the existing long-copy field or a dedicated `practical_note` — add additively only if Jim wants it separate:
```sql
alter table things add column if not exists practical_note text;
```
Jim authors these for the ~10 outdoor entries; you render the block when present, hide it when absent (consistent with the "hide, don't fill" rule).

**Acceptance test A1.7:** Lizard's Mouth shows a "Before you go" note with drive time and terrain caution; outdoor entries without a note simply omit the block.

---

## G1.8 — Local's Secret quality bar (hide when not a real secret)

**Decision:** hide the section entirely when there's no genuine secret. No filler.

**Evidence of filler to remove:** MOXI's "secret" is its main marketing copy (rooftop water deck); the Art Walk's was the leaked QA note (Gate 0).

**Task:** In the detail component, the Local's Secret block renders **only** when a real secret exists. Add a boolean gate: a secret must not be reproducible from the venue's own homepage marketing. Practically: Jim marks which secrets are real (or you flag secrets whose text overlaps the blurb/marketing for his review). When absent, the block does not render (no empty header, no placeholder).

**Acceptance test A1.8:** MOXI shows no Local's Secret (its old one was marketing); the Iglesias/Courthouse-cinema/Lark secrets remain; no detail page shows an empty "Local's secret" header.

---

## G1.9 — Tag entropy fix (make the Occasion filter mean something)

**Evidence:** "Date Night" covers ~40% of evergreen inventory; Iglesias is chip-tagged "Family Day"; the pottery sale is "Wine & Food"; some cards show no chip; cards show one arbitrary tag while details show four.

**Task:**
1. **Enforce the negative rules already written in the schema comments** at write time (in enrich + a validation script): `is_21_plus=true` → never `family_day`; `price_band<>'free'` → never `free_sb`. Add: a comedy/concert at the Bowl is not `family_day` by default.
2. **Cap tag sprawl:** an entry carries at most 3 occasion tags, ordered by `confidence`. The **card** shows the single highest-confidence tag; the **detail** shows up to 3. Card and detail must derive from the same ordered set (no arbitrary divergence).
3. **Chipless cards:** every published card shows exactly one occasion chip (the top tag). If a thing has zero tags, that's a Tier-3 quality failure (G1.1), not a chipless card.
4. Re-run tagging on the flagged offenders; Jim approves.

**Acceptance test A1.9:** no `family_day` tag on any `is_21_plus` thing; no `free_sb` on any priced thing; every published card shows exactly one chip; the card chip is the detail's top chip.

---

## Gate 1 acceptance summary

- [ ] **A1.1** Quality gate + tierScore unit-tested; backfill run; no Tier-3 in public feed.
- [ ] **A1.2** Tier-2 compact card renders; tier ordering within sections correct; focus order matches.
- [ ] **A1.3** Five sampled detail pages carry address + working Directions deep link + labeled outbound + action row.
- [ ] **A1.4** Outbound labels adapt correctly (LOTG fixed, MOXI linked); no dead/mislabeled buttons.
- [ ] **A1.5** Open-now computed from stored hours at three test times; unknown hours omit the row.
- [ ] **A1.6** Tier-1 verified stamps show true dates; reduced-motion static.
- [ ] **A1.7** Outdoor "Before you go" notes render when present, omit when absent.
- [ ] **A1.8** Local's Secret hidden when not real (MOXI); real secrets retained; no empty headers.
- [ ] **A1.9** Negative tag rules enforced; one chip per card; card chip === detail top chip.
- [ ] **DDL** All Gate 1 additive DDL applied by Jim in Supabase before code paths go live.

**Definition of done for Gate 1:** every public entry has earned its tier, every Tier-1 detail page could be handed to a visitor standing on the sidewalk and get them there, and the site now defends its own quality via the publish gate. The correction table (`content_flags`) exists and is wired to the one-tap flag UI (built in Gate 3).
