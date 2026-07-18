# GATE 4 — The Concierge Day (the planner engine, the moat)

`Build: Elevation v1 · Gate 4 of 6 · target: 3–4 sessions · the differentiator`
`Prereq: Gate 1 (hours, address, tiers, zones all populated). This engine is only as good as Gate 1's data.`

---

## Why this gate exists

This is the one feature on the roadmap that makes SB Daymaker **categorically** different rather than incrementally nicer. Visit Santa Barbara, the Independent's calendar, Edhat, Google, and any generic AI assistant can all produce a *plausible* Santa Barbara day. None produces a *validated* one — geographically clustered, open at the hours it schedules you, with realistic transitions and parking accounted for, meal logic built in, and a shareable permalink. The constraint data that makes validation possible (real hours, real addresses, parking truth, zone geography) is proprietary and locally verified — it exists nowhere for an LLM to have trained on. The promise is already on the site ("Tell us the shape, we'll draft it, you tweak it"); today the delivery is a filter form. This gate closes that gap.

**Read before coding — mandatory:** `docs/plan-feature/SBDaymaker_Plan_Build - fresh setup.md` (the current canonical Plan build spec), `docs/plan-feature/SBDaymaker_Plan_Mockup - fresh setup.html` (the visual target), `CLAUDE.md` §9 (Plan is canon; `rankCandidates`/`buildDraft` are pure/deterministic; `buildDay.ts`/`dayShapes.ts` are removed and must not return; no `.ics`; no map; no AI at tap time; Share+Clear go-bar; ephemeral plan). **The engine here extends `rankCandidates`/`buildDraft`; it does not replace the Plan architecture.**

**Decisions locked:** full engine — **party composition, anchor, meals, transport, budget** · plans shared via **server permalink, no account** (rides `shared_states`) · **no weather logic this build** (deferred — do not build weather swaps).

**Hard constraints that shape the engine (from §2/§3):** deterministic only, no per-request AI; no accounts; no transactions; no `.ics`; no map tiles. Everything below is rule-based and runs at tap time from pre-computed `things` data.

---

## SCHEMA CHANGES (additive only — Jim applies by hand)

```sql
-- ============================================================================
-- GATE 4 DDL — additive only. Paste into Supabase SQL editor.
-- ============================================================================

-- Add the plan-permalink kind to the shared_states enum (the v10 note references
-- '/p/[token]' with kind='shared_plan', but the enum only ships save_restore + shared_list).
alter type shared_state_kind add value if not exists 'shared_plan';

-- (No other schema needed: a shared plan is a shared_states row with kind='shared_plan'
--  and a jsonb payload = the ordered stop list + params. No account, no PII.)
```

> Note: `alter type … add value` cannot run inside a transaction block in some Supabase editor modes — Jim should run this statement on its own.

---

## The engine, conceptually

`buildDraft` today seeds one ranked pick per selected part-of-day. Gate 4 upgrades it from a **picker** to a **constraint solver** while keeping it pure and deterministic. The pipeline is:

```
inputs → candidate pool → hard-constraint filter → geo-cluster → slot assignment
       → transition + parking annotation → meal insertion → validation pass → editable draft
```

Each step below is a pure function; compose them in `lib/plan/`.

---

## G4.1 — Expanded inputs (party / anchor / transport / budget / meals)

**Extend `PlanSetup`** (keep the existing When / Where / Time-of-day; add fine-tune fields). Use the founder's sequential single-select pattern where it's mobile-friendly; keep it short.

- **Party template:** Couple · Family (with a follow-up **kid age band**: toddler / young kids / tweens+ ) · Solo · Group. Drives family negative-rules (no `is_21_plus` on a family plan; nap-window logic for toddlers) and pace.
- **Anchor:** "Start from" — a hotel/address picker or a neighborhood. The plan clusters around this point and computes transitions from it. (No map; a text address → geocode via the address/lat-lng already stored, or a zone centroid.)
- **Transport:** Walking · Car · Bike. Determines transition realism (walking caps cross-zone hops; car unlocks Goleta/Carpinteria/backcountry like Lizard's Mouth).
- **Budget band:** $ · $$ · $$$ · "mix." Filters/weights candidates by `price_band`; a $ plan won't seat you at three $$$ dinners.
- **Meals:** which meals to include (breakfast / lunch / dinner / none) — drives meal insertion (G4.5).
- **Pace/energy:** Packed vs. Slow — controls how many stops per period.

Store the resolved input set as the plan's `params` (goes into the shareable payload).

**Acceptance test A4.1:** selecting Family→toddler + Walking + $$ + lunch produces a materially different candidate set and stop count than Couple + Car + $$$ + dinner; all inputs round-trip into `params`.

---

## G4.2 — Hard-constraint filter (the validation that makes it "concierge," not "filter")

Before ranking, drop any candidate that **cannot** be true for this plan. Pure function `lib/plan/hardFilter.ts`:

- **Open-hours validity:** using Gate 1 `hours` + event `starts_at`, a candidate is eligible for a slot only if it is open during that slot. A museum that closes at 5 cannot be a 6pm stop. Events must fall in-window.
- **Party rules:** family plan → exclude `is_21_plus`; toddler band → prefer entries with the practical/stroller-friendly signal, exclude late-night.
- **Transport reachability:** walking plan → exclude stops outside a walkable radius of the anchor/cluster; only car unlocks distant zones.
- **Budget:** exclude `price_band` above the chosen band (with "mix" allowing one splurge).
- **Quality:** only Tier-1 (and optionally Tier-2) things are plan-eligible; Tier-3 never enters a plan.

**Acceptance test A4.2:** no generated plan schedules a closed venue, a 21+ venue on a family plan, an out-of-budget stop beyond the "one splurge" allowance, or a car-only spot on a walking plan. Unit tests cover each rule.

---

## G4.3 — Geo-clustering (minimize transitions)

**Task:** `lib/plan/cluster.ts` — group eligible candidates by `nearby_zone` and proximity (lat/lng), then bias the day toward **one or two adjacent zones** rather than zig-zagging across the county. The anchor sets the starting cluster. Walking plans stay in a single zone where possible; car plans may span two clusters with an explicit drive between them. This is the "park once and forget the car exists" logic the Funk Zone guide already teaches — encode it.

**Acceptance test A4.3:** a walking plan keeps all stops within one zone (or flags the exception); a car plan spanning two zones inserts an explicit transition between the clusters; no plan bounces zone→zone→first-zone.

---

## G4.4 — Slot assignment + transition/parking annotation

**Task:** `buildDraft` places the top-ranked eligible candidate into each active period (morning / lunch / afternoon / golden-hour / dinner / evening), respecting pace (packed = more stops). Between consecutive stops, annotate a **transition block**:
- Walking/drive time estimate (from lat/lng or zone adjacency — a coarse deterministic table is fine; no live routing API).
- **Parking guidance** drawn from the thing's own data or its zone's known reality (the guides already hold "park once on Anacapa above Yanonali; the Funk Zone lots are a trap"). Store zone-level parking truth in a small hand-authored `lib/plan/parkingByZone.ts` map so every plan through a zone inherits it.
- Each stop carries one **tap-to-swap alternate** (the next-best eligible candidate for that slot) — reuse the existing ranked pool; this does **not** revive the retired `SwapSheet` (that was a different, dead component) unless the current Plan spec already sanctions an inline swap; follow the canonical Plan build doc.

**Acceptance test A4.4:** a generated day shows each stop with a realistic transition + parking note between stops; each stop offers a swap to the next-best eligible option; swapping never introduces a hard-constraint violation (re-runs the filter).

---

## G4.5 — Meal logic (a plan without lunch isn't a plan)

**Task:** `lib/plan/meals.ts` — if the plan spans a mealtime and the user included that meal, ensure a food stop occupies it, matching budget band and cluster (a Funk Zone afternoon lunches in the Funk Zone, not across town). If the ranked spine didn't already place food there, insert the best eligible food `thing` for that slot/zone/budget. Never leave a 4+ hour plan mealless.

**Acceptance test A4.5:** any plan ≥ 5 hours that includes lunch contains a lunch stop in-cluster and in-budget; a "no meals" plan contains none; the meal stop respects the family/21+ rules.

---

## G4.6 — Validation pass (belt and suspenders)

**Task:** `lib/plan/validate.ts` runs after assembly and asserts the finished plan violates nothing: all stops open at their times, transitions are physically plausible for the transport mode, budget respected, party rules respected, no duplicate stop, meals present as requested. If a violation slipped through (e.g. a swap), auto-repair by re-drawing that slot; if unrepairable, surface an honest note ("we couldn't fit dinner in your budget nearby — here's the closest option") rather than shipping a broken plan.

**Acceptance test A4.6:** a fuzz test generating 100 random input combinations produces zero plans that fail `validate` (or each failure surfaces an honest note, never a silent broken plan).

---

## G4.7 — Shareable permalink (server, no account)

**Decision:** plans share via a server permalink, no account, riding `shared_states`.

**Task:**
- On "Share," write a `shared_states` row: `kind='shared_plan'`, `payload` = the ordered stops + `params`, `email` NULL (no PII). Return the token; the URL is `/p/[token]` (matches the `CLAUDE.md` v10 note).
- `/p/[token]` renders a read-only view of the plan (stops, times, transitions, parking notes) that a friend/partner opens with no app, no login. They can save individual stops to their own device (reuse the saved mechanism) or "Make my own plan" from it.
- Give `/p/[token]` its own OG image (a "day card" — mirrors Gate 5's per-thing OG work) so a shared plan previews as a designed artifact, not a bare link.
- **No `.ics` export** (retired in §9 — do not build it even though it's a natural ask).

**Acceptance test A4.7:** building a plan and tapping Share produces a `/p/<token>` URL that opens the exact plan read-only on another device with no login; the payload stores no PII; the link previews with a day-card OG image; no `.ics` anywhere.

---

## G4.8 — The draft is editable and honest about being a draft

Per the canonical Plan spec, the result is an **editable draft**, not a locked magic day: every stop is individually removable/replaceable, "Regenerate" redraws with fresh picks, "Start blank" is available, and the go-bar is **Share + Clear** (no Save; the plan is ephemeral). Preserve all of this — Gate 4 makes the draft *smarter*, not more rigid. Keep the "Suggested" labeling on seeded stops.

**Acceptance test A4.8:** every stop is removable and swappable; Regenerate produces a different valid plan; Start blank works; the go-bar is Share + Clear; nothing about the richer engine reintroduces a locked/auto "Make My Day" (scrapped per §9).

---

## Gate 4 acceptance summary

- [ ] **A4.1** Expanded inputs materially change output; params round-trip.
- [ ] **A4.2** Hard filter blocks closed/21+/over-budget/unreachable candidates; unit-tested per rule.
- [ ] **A4.3** Clustering minimizes transitions; walking stays in-zone; car spans ≤2 clusters with explicit drives.
- [ ] **A4.4** Stops carry transition + parking annotations and a valid swap alternate.
- [ ] **A4.5** Meals inserted correctly per budget/cluster/party; no long plan left mealless.
- [ ] **A4.6** Fuzz test: 100 input combos, zero silent broken plans.
- [ ] **A4.7** `/p/<token>` shares read-only, no login, no PII, day-card OG, no `.ics`.
- [ ] **A4.8** Draft stays editable/ephemeral; Share+Clear go-bar; no revived auto-day.
- [ ] **DDL** `shared_plan` enum value added by Jim.

**Definition of done for Gate 4:** a visitor answers a handful of taps and receives a Santa Barbara day that is *actually executable* — open when it says, clustered so you're not driving in circles, parked where a local would park, fed at mealtimes, within budget, and shareable to a partner with one link. This is the thing no competitor and no AI can hand them, because it's built on locally-verified truth they don't have.
