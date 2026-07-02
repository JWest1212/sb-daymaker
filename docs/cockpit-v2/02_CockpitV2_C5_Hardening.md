# Cockpit v2 — C5 Hardening Checklist (exit artifact)

**Date:** 2026-07-02 · **Scope:** the four-tab cockpit (Queue · Coverage · Live catalog · Hero plan) + the live-hero override.
**Verified by:** code audit + live DB checks + `npm test` (357 green) + typecheck (clean) + route probes. Interactive visual passes (keyboard walk / 390px / reduced-motion) are Jim's to confirm in-browser behind auth; the code-level guarantees below are what make them pass.

## Keyboard operability
- [x] Queue: full keyboard map (A approve · E edit · H hero · R reject · ↑/↓ move · B bulk · ←/→ image cycle), input-guard + edit-lockout preserved.
- [x] Coverage: dimension toggle, cells, floor checkbox, restock buttons, drilldown close are all native `<button>`/inputs (Enter/Space operable).
- [x] Catalog: tier segbar, vibe/zone selects, search input, per-row Hero/Edit, pager — all native focusable.
- [x] Hero plan: tile Pin/Change/Clear buttons + picker rows — all native focusable.
- [x] **Esc closes every sheet** (restock modal, catalog edit, hero picker) + the coverage drilldown — added in C5.
- [x] Global visible focus ring: `.sbd-cockpit :focus-visible { outline: 3px solid var(--pacific) }` (gold on the editable title).

## Reduced motion
- [x] `@media (prefers-reduced-motion: reduce) { .sbd-cockpit * { transition:none; animation:none } }` — covers card-leave, cell hover, toast.

## 390px (phone) pass
- [x] Shell topbar wraps; tab strip scrolls horizontally (≤640px).
- [x] Queue: card thumb stacks (≤620px); sidebar stacks (≤900px).
- [x] Coverage: heatmap scrolls horizontally (min-width 700px in an overflow-x container); layout stacks (≤900px); legend/floor wrap.
- [x] Catalog: filters wrap; row actions drop to their own full-width line (≤560px) — added in C5.
- [x] Hero plan: rail is `auto-fill minmax(215px,1fr)` → single column on phone.
- [x] Sheets are `min(560px, 92vw)`; page padding tightens to 16px on phone.

## Empty states
- [x] Empty queue → "Queue cleared ☀️".
- [x] Zero-coverage cell drilldown → "…this is exactly what Restock is for."
- [x] Hero picker with no candidates → "No ⭑ hero-eligible things occur on this day…".
- [x] Catalog no matches → "No published things match these filters."
- [x] Directives rail empty → "No directives yet."
- [x] Hero tile with no candidates → "no ⭑ candidates this day".

## Error states
- [x] Failed restock directive → worker sets `status='failed'` + `run_note`; rail renders the red `fail` chip + note.
- [x] Restock POST failure → toast "Restock failed: {error}".
- [x] Catalog double-edit → 409 → toast "an edit is already awaiting review".
- [x] Hero pin invalid (not ⭑ / not published / doesn't occur) → toast with the reason.
- [x] Live-hero override is fail-soft: any read problem → ranker picks (public hero never breaks).
- [ ] Run-now dispatch failure toast — **deferred to C2b** (run-now isn't built).

## Audit log (every state change writes it — §0.5)
- [x] `approve` (incl. approve-with-edits, payload carries edits) · `reject`
- [x] `edit` (inline update) · `edit_submitted` · `edit_applied` · `edit_discarded`
- [x] `hero_toggle` · `hero_pin` · `hero_unpin`
- [x] `restock_request` (founder) · `restock_consumed` (system, worker)
- Live DB confirms the actions exercised so far: `approve`, `hero_pin`, `hero_toggle`, `restock_request`, `ai_draft` (enrich). The rest are wired + typechecked.

## ARIA
- [x] Tabs: `role="tablist"/tab` + `aria-selected`. Toggles: `aria-pressed` (filters, tags, hero star, dims). Coverage cells: descriptive `aria-label` each. Sheets: `role="dialog" aria-modal aria-labelledby`. Icon buttons: `aria-label`.

## Deferred (per build-plan §1.10 + this build's decisions)
- Reject-reason quick-pick · Tier-3 depth column · catalog Archive/unpublish (plan §1.10).
- **C2b "Run now"** restock dispatch — needs a `GITHUB_DISPATCH_TOKEN`.
- Per-card restock provenance pill — dropped (would break the `source`/uuid5 invariant).
- Edition-drafter consumption of pins — not built; **partially superseded** by the live-hero override (today's pin now drives the public hero directly).

## Proposed delta-ledger entries (for `01_CockpitV2_Deltas.md`)
- Coverage occurrence math is a new exact helper (`lib/occurrences.ts`); the public feed never expanded recurring schedules.
- `nearby_zone` was backfilled (coords + neighborhood map) and is now derived at ingest landing — this also changed the public Near-Me sort.
- Restock never stamps `source`; queued path is informational; provenance lives on `restock_directives`.
- Live-hero override added to the public Explore path (`getLiveHeroPinId` + ExploreClient) — a deliberate, Jim-approved exception to "don't touch the public surface," keeping pins deterministic + sponsor-blind.
