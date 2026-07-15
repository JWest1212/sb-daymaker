# Data Arch Redesign · Side Spec — Occasion Tags: Rainy Day + Dog Friendly

`Status: v1 · 2026-07-12 · build spec. Populates the two Occasion-door tiles whose data does not yet exist. Cites Doc 18 (two-pass tagging), Doc 19 (venues table), Doc 22 (door composition).`

> **What this builds.** The tiles for Dog Friendly and Rainy Day already render in the live Occasion door (built in Doc 22), but almost nothing carries either tag, so both sheets are near-empty. This spec fills them: `rainy_day` deterministically from the existing `indoor` field, and `dog_friendly` from a founder-marked flag on the `venues` table. Both are Pass 1 (deterministic, rule-stamped) in the Doc 18 model. No AI, no per-request calls.
>
> **Precedence.** `CLAUDE.md` is the contract; code is truth. `lib/explore.ts` untouched. Additive-only DDL, applied by Jim.

---

## 1. Why this is needed

Doc 22 shipped the two tiles but deliberately deferred their data (rule: no option may dead-end). This closes that gap. The two tags fill by different mechanisms because the underlying facts live in different places:

- **Rainy Day** is a property of the *thing* (is it indoors), already stored as `indoor`. Fully automatable.
- **Dog Friendly** is a property of the *venue* (does it allow dogs), not present in event text. Needs a small founder pass on the venue registry, then automatic.

---

## 2. Rainy Day (deterministic, near-hands-off)

### 2.1 Rule
A thing qualifies for `rainy_day` when `indoor = true` **and** it is not outdoor-only. Since `indoor = true` already implies not-outdoor-only, the rule reduces to: **`indoor = true` → stamp `rainy_day`.** The negative rule (outdoor-only never qualifies) is satisfied by the `indoor` flag itself.

### 2.2 Tag mechanics
- Written as a Pass 1 rule tag: `tag_source = 'rule'`, high confidence.
- `rainy_day` already exists as an enum value (confirmed orphaned in the audit), so **no DDL**. Confirm it is in the enum the Occasion door reads; if not, that is the one additive change and Jim applies it.
- Weather-gating stays a **render-time** condition (the tile shows only on gray/rain days via the existing OpenWeather signal). This spec only populates the tag; it does not touch the gating, which Doc 22 already built.

### 2.3 Backfill + self-heal
- One pass over all published things: where `indoor = true` and `rainy_day` absent, add it.
- Fold the rule into the live `ingest/` land step so new indoor things self-tag.

### 2.4 The one manual check
`indoor` defaults to `false` and its accuracy across the catalog is unverified. Before trusting the backfill, spot-check a sample: are indoor venues actually flagged `indoor = true`? If many are wrong, `rainy_day` inherits the error. This is a ~10-minute cockpit review, not a build task. If `indoor` proves broadly inaccurate, flag it and we scope a separate `indoor` accuracy pass (out of scope here).

---

## 3. Dog Friendly (one founder pass, then automatic)

### 3.1 Why venue-level
Dog policy is a venue fact, almost never in event text, so per-event AI inference would be low-confidence noise. The trustworthy path is a founder-marked flag on the venue, inherited by every event there. This is the venue-attribute registry from Doc 18 §6 becoming real, seeded on the `venues` table Doc 19 created.

### 3.2 Schema (additive, Jim applies)
Add one column to the existing `venues` table:
```sql
alter table venues add column if not exists dog_friendly boolean not null default false;
```
Designed to be the first of several venue attributes (accessibility, patio, parking) added the same way later. Also confirm `dog_friendly` exists in the Occasion-door tag enum; if not, add it (additive), per Doc 22 §5.

### 3.3 Cockpit: the founder pass
A checklist in the Venues cockpit surface: each venue gets a Dog Friendly toggle. You mark the ones you know allow dogs (beaches, patios, open-air venues, trails). This is your local knowledge, one time. The list is short because most events cluster at a knowable set of venues.

Optional accelerator (recommended, low effort): pre-check an obvious starter set by rule before you review, so you are confirming rather than starting blank. Reasonable auto-suggestions: venues whose things are predominantly `outdoor_activity` / `scenic_chill`, and known dog-welcoming types (beaches, parks, outdoor tasting patios). You then correct the suggestions. AI is not required; a simple heuristic pre-fill is enough.

### 3.4 Tag mechanics + self-heal
- A Pass 1 rule: for each thing, if its resolved venue has `dog_friendly = true`, stamp the thing `dog_friendly` (`tag_source = 'rule'`).
- Negative rule: leash-prohibited venues never qualify. Since qualification is driven by the venue flag, "leash-prohibited" simply means you leave that venue's flag `false`. No separate logic needed.
- Backfill once over published things; fold into the live `ingest/` land step so new things at dog-friendly venues self-tag.
- When you later flip a venue's flag, a light re-stamp pass updates its things (or it corrects on the next nightly run).

---

## 4. Phased build (stop and show)

**Phase 1 — Rainy Day rule + backfill.** Implement the `indoor → rainy_day` Pass 1 rule; dry-run to show how many things would gain it; apply; fold into land step. *Show:* projected and applied counts; the Rainy Day sheet populated (on a simulated gray day if needed).

**Phase 2 — Venues dog_friendly column + cockpit toggle.** Jim applies the column DDL. Build the toggle in the Venues surface with the optional heuristic pre-fill. *Show:* the venue checklist, pre-filled, ready for your pass.

**Phase 3 — Founder pass (you) + Dog Friendly rule.** You mark dog-friendly venues. Implement the venue→thing `dog_friendly` Pass 1 rule; backfill; fold into land step. *Show:* the Dog Friendly sheet populated from your marked venues.

---

## 5. Acceptance checklist

- [ ] `rainy_day` stamped on all `indoor = true` things; rule in the live land step; no DDL needed (confirm enum).
- [ ] `indoor` accuracy spot-checked; any systemic error flagged, not silently inherited.
- [ ] Weather-gated render untouched (Doc 22 owns it); this spec only populates the tag.
- [ ] `venues.dog_friendly` column added (Jim); Occasion enum has `dog_friendly`.
- [ ] Venues cockpit toggle works; optional heuristic pre-fill present.
- [ ] Things at dog-friendly venues carry `dog_friendly`; rule in the live land step.
- [ ] Both tags are `tag_source = 'rule'`; no AI, no per-request calls, no `lib/explore.ts` change.
- [ ] Never touched dead code: `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.

---

## 6. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then this spec (Data_Arch_Redesign_Occasion_Tags_Spec.md), and Doc 22 for the door
context. Populate the two Occasion tags whose data does not yet exist. No AI, both are deterministic
Pass 1 rules. Do the 3 phases in section 4, ONE at a time, stop and show me after each, wait for my go.

Constraints:
- lib/explore.ts consumed as-is. Never touch lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx,
  NearMeSheet.tsx. Self-heal rules go in the LIVE ingest/ land step only.
- rainy_day: rule is indoor=true -> stamp rainy_day. Do NOT touch the weather-gated render (Doc 22
  built it). Confirm rainy_day is in the Occasion-door tag enum; if not, tell me the additive SQL.
- dog_friendly: venue-driven. I will run the `alter table venues add column dog_friendly ...` SQL
  myself. Tag a thing only if its resolved venue has dog_friendly = true.

Phase 1 now: implement the rainy_day rule, dry-run over published things and show me the count that
would gain it, then stop before applying.
```

---

*Side spec, outside the numbered sourcing sequence. Finishes the visible door work and warms up the venues table the sourcing specs lean on.*
