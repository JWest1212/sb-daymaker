# 20 · SB Daymaker — Live-Code Reconciliation Delta (Docs 18 & 19)

`Status: v1 · 2026-07-12 · reconciliation delta. Authoritative over the sections of Docs 18 and 19 it names. Based on the read-only Claude Code audit of the live codebase after the doors shipped.`

> **What this is.** A short delta (not a rewrite) that corrects Docs 18 and 19 against the live code. The doors are already live and the code diverged from both Doc 17's plan and the specs written from it. Per the house rule (short deltas over full layered rewrites; stale docs flagged, not followed), this file is the correction layer. Where this doc and the live code disagree with Docs 18/19, **this doc and the live code win.**
>
> **Confidence note.** Written from the audit's flagged findings. Four data points (§6) are still needed to finish the Activity reconciliation. Everything else is settled.

---

## 1. Live-code truth (what the audit established)

| Topic | What the specs assumed | Live reality | Consequence |
|---|---|---|---|
| **Place door** | hard filter; missing zone = invisible | **a sort** (bubbles the zone to top, never excludes) | Gate flags for triage, never holds. Stakes drop from "invisible" to "mis-sorted + mis-labeled." |
| **Activity door** | reads `happening_category` | reads **`things.activities text[]`** (uncontrolled array, **no DB enum**) | Doc 18 §7.2 mapping is obsolete. Multi-valued array **kills the single-bucket tradeoff**. Governance gap. |
| **Activity migration** | assumed applied | `20260711_activities.sql` **may be unapplied in prod** | **URGENT:** the live Activity door may be returning all-zero counts. Verify first. |
| **Occasion / middle door** | reads occasion tags | reads **`tags[]`** through a **10-value registry**; the occasion kicker uses `tags[0]` | Two-pass model still fits. Confirm the 10 values before writing Pass 2. |
| **`rainy_day`** | new tag, needs DDL | enum value **already exists**, orphaned from the Living Postcard work; nothing produces or reads it | **No DDL.** Just wire the derivation from `indoor`. |
| **`dog_friendly`** | new tag | **absent everywhere** (zero hits) | Net-new exactly as planned (venue-list-first). One additive enum value. |
| **Card systems** | may share logic | location label (stored `neighborhood`, prettified), weather kicker (live OpenWeather + pure derivation), occasion kicker (`tags[0]` via registry) are **three independent systems** | Do not assume shared logic; touch each in isolation. |
| **Door-2 naming** | "Occasion" (Doc 17) | dead `LensSheet.tsx` ("Lens"), live UI says **"Vibe"**, Doc 17 says **"Occasion"** | Three names, one door. Decide (§5). |
| **Dead code** | — | `LensSheet.tsx` (orphaned), `NearMeSheet.tsx` (live only on Saved), `lib/enrich.ts` + `lib/pipeline.ts` (legacy duplicate pipeline) | **Never target these** in any spec or build. |

---

## 2. Corrections to Doc 18

- **§4 findability gate** — Place is a sort. A missing zone **flags for the neighborhood triage queue and publishes anyway**; it is never held. (Marked inline in Doc 18.)
- **§7.2 Activity mapping** — **superseded.** Activity reads `activities text[]`. The bucket mapping and the `arts_theater` venue-split are void. The single-bucket tradeoff is void (array is multi-valued, which is better: a thing can sit in several Activity buckets). New mapping pending the live vocabulary (§6). (Marked inline in Doc 18.)
- **§3.2 Gap B (Family & Kids)** — possibly moot. If `activities[]` already carries a family value, Family & Kids needs no tag-driven workaround. Confirm against the vocabulary.
- **§8 DDL** — only `dog_friendly` is net-new. `rainy_day` already exists; do not re-add. Confirm which enum holds `rainy_day` and whether it is the same enum the middle door reads. (Marked inline in Doc 18.)

## 3. Corrections to Doc 19

- **§1 framing** — "invisible to Place" corrected to "mis-sorted and location label degrades." (Marked inline in Doc 19.)
- **Gate** — soften any hold to a triage flag; consistent with Place being a sort.
- **Phase 5 self-heal** — target the live `ingest/` land step. Never `lib/pipeline.ts` / `lib/enrich.ts`.
- **Otherwise Doc 19 stands and is fully buildable now.** It depends on `neighborhood` (a real stored column) and nothing in the open Activity questions.

---

## 4. What is buildable now vs blocked

> **Update (2026-07-12).** The Activity migration is **confirmed applied**. The Activity vocabulary is **resolved and locked** at 11 slugs (Doc 21). Activity backfill is now **unblocked and is the highest-priority build** (fixes a live near-empty door).

**Buildable now (no missing data):**
- **Activity backfill (Doc 21)** — deterministic, no AI, fixes the live gap. Do this first.
- The neighborhood sweep (Doc 19), all five phases.

**Still needs data before building (occasion phase only):**
- Occasion Pass 2 wiring and the `family-kids` / `clubs-groups` fill need the **10 occasion tag registry values** confirmed, plus the `rainy_day` enum location and the live enrich/land paths (§6 items 2, 3, 4). None of this blocks Docs 19 or 21.

---

## 5. Open decisions (status)

1. **Activity migration** — RESOLVED. Confirmed applied; the column exists, it was just unpopulated. Fixed by Doc 21.
2. **Activity governance** — RESOLVED. The vocabulary is controlled in **`lib/activities.ts`** (code, not a DB enum), locked at 11 slugs with `festivals-community` added. Live vocabulary is the source of truth; Docs 17/18 reconciled to it.
3. **Door-2 name** — STILL OPEN. Lens vs Vibe vs Occasion. Recommendation: **Occasion**, per Doc 17. Cosmetic; not blocking.

---

## 6. Data points (status)

Gathered: the `activities[]` vocabulary and the full Activity door option list (11 slugs, locked). Still needed, for the **occasion phase only** (not blocking Docs 19 or 21):

2. The 10 values in the occasion/vibe tag registry the middle door reads, and the registry's file path.
3. Which enum `rainy_day` belongs to, and whether it is the one the middle door reads.
4. Confirmed live file paths for the enrich step and the land step under `ingest/`.

---

## 7. Build sequence (net)

1. **Activity backfill (Doc 21)** — first, it fixes a live near-empty door; deterministic, no AI.
2. **Neighborhood sweep (Doc 19)** — independent, improves the Place sort and card labels.
3. **Gather §6 items 2-4** in a read-only Claude Code pass whenever convenient.
4. **Then** the occasion two-pass + `family-kids`/`clubs-groups` fill + `rainy_day` derivation, written against the confirmed registry.

*End of Doc 20. This delta expires once its corrections are folded into a v2 of Docs 18 and 19; until then it is authoritative over the sections it names.*
