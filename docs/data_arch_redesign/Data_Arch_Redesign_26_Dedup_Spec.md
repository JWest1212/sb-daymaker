# Data Arch Redesign · 26 — Dedup Upgrade + Canonical Event Identity

`Status: v1 · 2026-07-12 · build spec. Fourth and final in the sourcing redesign. Depends on 23 (sources/authority), 24 (confidence/source_count), 25 (more sources = more duplicates). Cites Doc 16 (§3.6, §3.11) and the live `dedupe.ts`.`

> **What this builds.** A stronger deduplicator and a **canonical event identity** (`event_key`), so the same event arriving from five sources collapses into one record instead of five. It fixes the edge cases in the current title-plus-same-day matcher, adds a **venue signal**, adds a **Claude adjudication pass on the ambiguous band only**, and drives the **corroboration count** (`source_count`) that specs 24 and 25 depend on. This is the accuracy layer that keeps extreme coverage from becoming extreme noise.
>
> **Precedence.** `CLAUDE.md` is the contract; code is truth. `lib/explore.ts` untouched. Batch-only. Additive-only DDL, applied by Jim. The deterministic core stays fast; AI is used only on the genuinely uncertain minority.

---

## 1. Why this is last, and why it is not optional

More sources (spec 25) inevitably means more duplicates: the same First Thursday reported by the venue, the arts council, and two aggregators. Without a stronger deduplicator, coverage gains show up as clutter and the "same event, many sources" corroboration signal that specs 24 and 25 rely on does not exist. So this comes last (it needs the volume to matter) but it is required to make that volume trustworthy.

The live `dedupe.ts` is a good 80% solution with three known gaps (from the audit and Doc 16 §3.6):
- near-match needs the **same calendar day AND both rows carrying a start time**, so recurring and time-TBD events dedup poorly;
- it uses **title trigram only, no venue signal**, so two different "Live Music" events at one venue can false-merge, and one event titled differently across sources can false-split;
- **no cross-source identity**, so corroboration is not captured.

---

## 2. Canonical event identity (`event_key`)

A stable key assigned at dedup time so the same real-world event converges regardless of source:

- **Dated events:** `event_key = hash(normalized_venue + normalized_title + local_date)`.
- **Recurring instances:** `hash(normalized_venue + normalized_title + rrule_or_cadence)`.

Normalization (shared helper): lowercase, strip punctuation and common noise words ("live", "presents", "the"), collapse whitespace, canonicalize the venue via the `venues` table (Doc 19) so "SOhO" and "SOhO Restaurant & Music Club" resolve to one venue.

### 2.1 Storage (additive, Jim applies)
```sql
alter table things add column if not exists event_key text;
create index if not exists things_event_key_idx on things(event_key);
-- provenance of which sources contributed to a canonical thing:
create table if not exists event_sources (
  event_key   text not null,
  source_key  text not null references sources(key),
  first_seen  timestamptz not null default now(),
  primary key (event_key, source_key)
);
```
`source_count` (spec 24) becomes `count(distinct source_key)` per `event_key` from `event_sources`.

---

## 3. The improved matcher (deterministic core + AI edge)

### 3.1 Keep the deterministic core
Exact-id and clear trigram matches stay as-is; they are fast and correct. Do not send the clear cases to AI.

### 3.2 Add the venue signal
- **Same canonical venue + same day** raises match confidence and lets the title threshold drop (rescues differently-worded same-event titles).
- **Different venue** keeps events split even when titles are similar (kills the "two Live Music nights" false-merge).
- Handle **recurring / time-TBD**: match on venue + title + cadence when a start time is absent, closing the current gap where those dedup poorly.

### 3.3 AI adjudication on the ambiguous band only
Only genuinely uncertain pairs (roughly 0.35-0.55 title similarity, same day, same-or-unknown venue) go to a **Claude (Sonnet) batch** adjudication: "same event or not?" with the two records. The bulk never touches AI. This is where the model beats trigrams, and the volume is small, so cost stays trivial.

### 3.4 Canonical record selection
When records merge, the **highest-authority source** (`sources.authority`) provides the canonical fields; others contribute to `event_sources` and raise `source_count`. This replaces the hand-maintained regex ranking (already moved to `sources.authority` in spec 23).

---

## 4. False-positive / false-negative discipline

Merging is consequential, so every merge is auditable and reversible:

- **Log each merge** with its evidence (which signals fired, similarity scores, AI verdict if used) to the existing audit trail.
- **Reversible:** a wrong merge can be split in the cockpit; splitting restores the separate records.
- **Bias:** when the venue signal disagrees, prefer to **split** (a false-split shows a duplicate, annoying; a false-merge hides a real event, worse). Tune from the merge log.

---

## 5. What this unlocks downstream

- **Corroboration** (`source_count`) feeds spec 24's confidence and spec 25's promotion-out-of-review, the "a second source confirmed it" signal.
- **Canonical identity** is the spine for the 3-5 year moat in Doc 16 §3.11: venue/organizer graph, popularity aggregation across sources, trend detection, all keyed on `event_key`.

---

## 6. Phased build (stop and show)

**Phase 0 — Read the live dedup (read-only).** Walk `dedupe.ts`: exact + near-match logic, thresholds, canonical selection. Confirm `venues` (Doc 19) and `sources.authority` (spec 23) are available. *Show:* findings and the proposed normalization + `event_key` rules.

**Phase 1 — Normalization + `event_key` (shadow).** Add the columns (Jim). Compute `event_key` for the catalog without changing dedup behavior yet; report how many things share a key (i.e. would collapse). *Show:* the collapse preview and sample groups, so you can eyeball correctness before merging.

**Phase 2 — Venue signal in the matcher.** Add venue-aware matching and the recurring/time-TBD path. Run in shadow: report new merges and new splits vs current behavior. *Show:* the diff, especially any new merges, for your review before it goes live.

**Phase 3 — AI adjudication on the ambiguous band.** Sonnet batch on the uncertain pairs only; everything else deterministic. *Show:* the ambiguous pairs and the model's verdicts, plus the cost (should be trivial).

**Phase 4 — Canonical selection + corroboration.** Highest-authority source provides canonical fields; populate `event_sources` and `source_count`. *Show:* a multi-source event collapsed to one with its source list and count.

**Phase 5 — Merge log + cockpit un-merge.** Auditable merges; a cockpit action to split a wrong merge. *Show:* splitting a merged pair and both records returning.

---

## 7. Acceptance checklist

- [ ] `event_key` + `event_sources` added (Jim); `source_count` derives from distinct sources per key.
- [ ] Deterministic core unchanged for clear cases; only the ambiguous band hits AI.
- [ ] Venue signal added; recurring/time-TBD events dedup correctly (current gap closed).
- [ ] Every phase that changes merging runs in shadow first with a reviewable diff before going live.
- [ ] Canonical fields come from the highest-authority source (`sources.authority`).
- [ ] Merges logged with evidence; reversible via cockpit un-merge; bias toward split on venue disagreement.
- [ ] `source_count` corroboration feeds specs 24 and 25.
- [ ] Batch-only; AI limited to the ambiguous band (Sonnet); cost trivial.
- [ ] `lib/explore.ts` untouched; never touched `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.

---

## 8. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then this spec (Data_Arch_Redesign_26_Dedup_Spec.md), then Doc 16 section 3.6 and the
live dedupe.ts. Strengthen dedup and add a canonical event_key so the same event from many sources
collapses to one and corroboration (source_count) is captured. Keep the deterministic core; use AI
only on the genuinely ambiguous minority. Do the phases in section 6, ONE at a time, stop and show me
after each, wait for my go.

Constraints:
- Keep exact + clear trigram matches deterministic and fast; do NOT send clear cases to AI. Only the
  ~0.35-0.55 ambiguous band (same day, same/unknown venue) goes to a Sonnet batch adjudication.
- Every phase that changes MERGING runs in SHADOW first: report new merges and splits vs current
  behavior and let me review BEFORE it goes live. Bias toward SPLIT when the venue signal disagrees.
- Canonical fields come from the highest-authority source (sources.authority). Log every merge with
  evidence; make merges reversible via a cockpit un-merge.
- I apply all DDL by hand; give me exact SQL and wait.
- Batch only. lib/explore.ts consumed as-is. Never touch lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx,
  NearMeSheet.tsx.

Phase 0 now (read-only): walk dedupe.ts (exact + near-match logic, thresholds, canonical selection),
confirm venues and sources.authority are available, then propose the normalization + event_key rules
and stop.
```

---

*End of Data Arch Redesign 26, and of the four-spec sourcing sequence (23 → 24 → 25 → 26). Together: sources become data and self-monitor, a confidence gate protects your review time, a generic lane pulls in the long tail, and canonical identity keeps that volume clean and corroborated. This is the accuracy backbone under the "extreme coverage, mostly automated" goal.*
