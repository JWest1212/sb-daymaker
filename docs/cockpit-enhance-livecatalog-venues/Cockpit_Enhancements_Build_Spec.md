# Cockpit Enhancements — Comprehensive Build Spec

`Status: draft for Claude Code · covers all 30 changes from the comprehensive mockup · phased`

> **What this is.** The build runbook for every cockpit enhancement surfaced in the Live Catalog assessment and the Venues audit. It is **phased on purpose** — nine ordered phases, each a coherent chunk with exit criteria and a hard stop-and-show. Do **not** run it end to end. Finish a phase, verify it runs, summarize what changed and what to test, then wait for Jim's go-ahead.
>
> **Visual target:** `Cockpit_Enhancements_Comprehensive_Mockup.html` (the pin numbers LC-1…LC-14 and V-1…V-16 in this spec map 1:1 to that file). **Contract:** `CLAUDE.md`. **Ground truth:** the live code. Where a doc and the code disagree, follow the code and flag it.

---

## How to use this spec

1. **One phase at a time.** Each phase ends in **STOP**. Do the phase, run the dev server, confirm it renders with no console errors, tell Jim exactly what to test, and wait. Do not start the next phase unsolicited.
2. **DDL is a manual step for Jim.** Some phases need an additive schema change. **Never run DDL yourself and never automate it.** When a phase needs it, print the exact SQL, tell Jim to paste it into the Supabase SQL editor, and wait for him to confirm it's applied before writing code that depends on it. All DDL here is **additive only** (new columns/tables, nothing dropped or altered destructively).
3. **No terminal commands asked of Jim.** You handle all execution except the Supabase DDL paste above.
4. **Every new API route must call `getAdminUser()` and 401 on null.** There is no `middleware.ts` — auth is per-route. A new route that forgets this is unprotected.
5. **Never hardcode a color/font/spacing.** Pull from `sbdaymaker_tokens.css`. Reuse existing cockpit CSS classes (`.sheet`, `.thumb`, `.tagtoggle`, `.budget-chip` once built, `.toast`, `.herostar`, `.lrow`) rather than inventing new ones where one exists.
6. **WCAG 2.2 AA is a floor.** Every new interactive element: visible `:focus-visible`, keyboard-operable, ≥44px touch target, aria-label on icon-only buttons.
7. **Mutations write `audit_log` and call `revalidatePublic()`** when they change a public surface. Match the existing pattern in `app/api/admin/*` routes.
8. **Batch-AI-only still holds.** Nothing in here fires a Claude call in response to a click. The one AI-adjacent feature (LC-10) only **queues a directive** for the nightly worker.

---

## Decisions baked in (override before running the dependent phase if you disagree)

| Open call | Default in this spec | Change it by… |
|---|---|---|
| **LC-11** editable start time | **NOT built.** The reject-and-re-ingest lock stays; it protects the green trust chip. | Telling me to add a narrow, audited correction field before Phase 1. |
| **V-4** persist "leave on motif" | **Built.** Adds an additive `things.no_venue_ack` boolean so dismissed events stop reappearing. | Dropping the column + the exclusion in Phase 6. |
| **V-5** weak-guess one-click | **Kept.** The low-confidence "Attach to X" suggestion shows when `bestVenueMatch` scored above zero but below the auto-propose threshold. | Removing it from Phase 6 for a cleaner manual-only list. |
| **V-6** catcher placement | **Pane** inside the Venues tab, under "Matches to review." | Switching to its own tab in Phase 6 if the all-tiers list proves long. |

---

## Phase map (nothing is dropped)

| Phase | Theme | Pins | DDL? |
|---|---|---|---|
| **0** | Land the existing uncommitted subsystem (the gate) | LC-12, LC-14 (partial) | reconcile only |
| **1** | Live Catalog correctness + trust | LC-1, LC-2, LC-4, LC-5, LC-6, LC-7, LC-14 | no |
| **2** | Cost visibility (shared budget surfacing) | LC-8, V-10 | no |
| **3** | Live Catalog photo workflow | LC-9, LC-13 | no |
| **4** | Queued re-enrich directive | LC-10 | **yes** (`enrich_directives`) |
| **5** | Live Catalog bulk actions | LC-3 | no |
| **6** | Venues: the no-match catcher | V-1, V-2, V-3, V-4, V-5, V-6 | **yes** (`things.no_venue_ack`) |
| **7** | Venues: pool + linkage management | V-7, V-8, V-9, V-11, V-12 | no |
| **8** | Venues: a11y + governance sweep | V-13, V-14, V-15, V-16 | no |

---

## Phase 0 — Land the existing uncommitted subsystem (verify first, may already be done)

**Goal:** get the already-built Card Imagery Phase 2 work (catalog image picker + routes, the entire Venues tab + routes, the venue migrations) committed and deployed to production, safely, before any new work stacks on it.

**Verify-first:** run `git status`. If the venues tab, catalog image routes, and venue migrations are already committed and on `main`, **skip to Phase 1** and just report that. Otherwise:

**Pre-flight (report all of these to Jim before merging):**
1. **Auth gate:** confirm every route under `app/api/admin/venues/**` and `app/api/admin/catalog/**` (edit, delete, photo, venue-photos/fetch, find-more-images, and the six venues routes) calls `getAdminUser()` and 401s on null. List any that don't. Do not merge until every one is gated.
2. **Migrations applied:** confirm with Jim that `20260625_photo_options.sql`, `20260625_images.sql`, and `20260709_card_imagery_phase2_venues.sql` are already applied in **live** Supabase (they were applied manually). Reconcile these files into git so the tree matches the live DB.
3. **Env vars:** confirm `GOOGLE_PLACES_KEY` and `IMAGE_MONTHLY_CALL_CAP` exist in Vercel **production** (not just local). Flag if absent.
4. **Delete stray files (LC-12):** remove `app/api/admin/catalog/delete/route 2.ts` and `app/admin/WeightNudge 2.tsx` — inert duplicates.
5. **Schema-doc note (LC-14, partial):** add a header to `sbdaymaker_schema.sql` pointing to the migration files as the current source of truth for `venues`/`venue_photos`/`image_spend`/`image_cache`/`photo_options`/`things.venue_id`. (The stale ImagePicker comment is finished in Phase 1.)

**Deploy:** push to a branch, confirm the Vercel **preview** deploy builds and both the Live catalog and Venues tabs load and function against it, then merge to `main`.

**Exit criteria:** both tabs load in production; every admin route is auth-gated; migrations reconciled; stray files gone; Jim has smoke-tested the preview.

**STOP.** Report the pre-flight findings and the preview URL. Wait for Jim to confirm the production deploy before Phase 1.

---

## Phase 1 — Live Catalog correctness + trust

**Goal:** fix the changes that put wrong data on the live site or give a wrong mental model. All small, no new heavy UI.

- **LC-1 — Correct the subhead.** In `CatalogView.tsx`, replace the header subhead with copy that matches reality: *"Everything currently published. Edits here go live immediately, no review step. To change a start time, reject and re-ingest in the Queue."* (No em dashes.)
- **LC-2 — Error state ≠ empty.** In `fetchPage()`, on a failed/`!res.ok` fetch, set an error flag and render a distinct error banner ("Couldn't refresh the list. Showing the last results.") with a **Retry** button, instead of silently keeping stale rows. Keep the existing "no results" copy only for a genuine empty success.
- **LC-4 — Surface the pending-edit badge.** Add the `pending` class to `.lrow` when `row.pending_edit` is true and render a small "Pending edit in Queue" badge. The CSS rule `.lrow.pending` already exists — this just wires it. (If you'd otherwise stop querying `pending_edit`, don't; it's now used.)
- **LC-5 — Hero toggle await + revert.** Change the hero-star handler to `await` the `/api/admin/hero-eligible` response, revert the optimistic flip on failure, and show an error toast. Mirror the existing WeightNudge revert-on-error pattern.
- **LC-6 — Recompute `nearby_zone` on neighborhood edit.** Extract the zone-derivation logic from `ingest/land.ts` into a shared pure helper (e.g. `lib/geo.ts` → `deriveNearbyZone(neighborhood, lat, lng)`). Call it inside `app/api/admin/catalog/edit/route.ts` whenever `neighborhood` changes, and write the recomputed `nearby_zone` in the same update. Do not change the ingest behavior — just reuse the same rule.
- **LC-7 — Edit-sheet focus trap.** On sheet open, move focus to the first field and trap Tab within the sheet; on close, restore focus to the triggering Edit button. Build this as a small reusable hook (`useFocusTrap`) — the Venues sheet (V-14) will reuse it.
- **LC-14 — Stale comment.** Update `app/admin/review/ImagePicker.tsx`'s file comment that still calls the fetch route "stubbed"; it now describes a real cost-incurring flow.

**DDL:** none.

**Exit criteria:** each item verified in the dev server; a neighborhood edit visibly updates the row's zone; a forced hero-toggle failure reverts with a toast; the edit sheet keeps keyboard focus.

**STOP.** Summarize and wait.

---

## Phase 2 — Cost visibility (shared budget surfacing)

**Goal:** make Google photo spend legible everywhere it can be spent, and stop the "free" button from spending silently. Covers **LC-8** (catalog) and **V-10** (venues) with one shared component.

- **Build a read route:** `GET /api/admin/image-budget` (auth-gated) → `{ used, cap, month }` from `image_spend` for the current `monthKey()` and `IMAGE_MONTHLY_CALL_CAP`.
- **Build a shared `<BudgetChip>`** (tokens only): shows `used / cap this month`, turns amber near the cap. Drop it into the catalog image picker (LC-8) and the venues fetch panel (V-10).
- **Honest free/paid split (LC-8).** In `lib/venueFetch.ts` / the fetch path, make the free button **strictly free**: never fire a Google Place Photo call when Google was not explicitly requested. Remove the "Wikimedia < 3 silently triggers Google" behavior. Reserve every paid call for the explicit "Fetch via Google" button, and relabel: "Fetch free candidates (Wikimedia + Pexels · no cost)" and "Fetch via Google (1 paid call · counts to budget)."
- **Capped ≠ empty (LC-8).** Thread the cap-hit reason back from `fetchGooglePhotoCandidates()`'s `hasBudget()` so the toast can say "Monthly photo budget reached, resets on the 1st" instead of "No photos found."

**DDL:** none.

**Exit criteria:** the budget chip shows a real count in both tabs; the free button provably makes no Google call (verify `image_spend.google_calls` doesn't move); a cap-hit fetch shows the distinct message.

**STOP.** Summarize and wait.

---

## Phase 3 — Live Catalog photo workflow

**Goal:** shrink the most-touched workflow.

- **LC-9 — Apply best.** Add an "Apply best" button in the catalog image picker that commits the top-ranked fetched option in one click (the ranking already exists). Keep fetched candidates in state so closing and reopening the sheet doesn't discard them. Attach an **Undo** to the "Use this photo" toast (reuse the `.toast .undo` CSS that already exists in the cockpit) since the photo goes live instantly with no confirm.
- **LC-13 — find-more-images.** Decide with Jim: wire the existing `find-more-images` route into the picker as a "Search wider (free)" fallback button, **or** delete the route. Default: wire it (it's already a complete free-source handler). If wired, it's a free (Pexels + Wikimedia) call — label it as such.

**DDL:** none.

**Exit criteria:** "Apply best" sets a photo in one click; reopening the sheet preserves fetched options; undo restores the prior photo.

**STOP.** Summarize and wait.

---

## Phase 4 — Queued re-enrich directive (batch-AI-only)

**Goal:** let Jim ask for a fresh AI blurb/tag draft without a live Claude call.

**DDL (Jim runs first):**
```sql
-- additive: mirrors restock_directives
create table if not exists enrich_directives (
  id uuid primary key default gen_random_uuid(),
  thing_id uuid not null references things(id),
  status text not null default 'queued',   -- queued | done | error
  requested_by text default 'founder',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists enrich_directives_status_idx on enrich_directives (status);
```
Stop and have Jim paste this into Supabase and confirm before writing the code below.

- **Route:** `POST /api/admin/catalog/redraft` (auth-gated) → inserts `enrich_directives` rows `status='queued'` for the given `thing_id` (single) or `ids[]` (bulk, used by Phase 5). Audit `action:'redraft_queued'`.
- **UI:** a "Redraft blurb + tags tonight" control in the edit sheet footer (and it becomes a bulk action in Phase 5). Confirm to Jim it does **not** call Claude now.
- **Worker:** in `ingest/run.ts`, add a consumer that picks up queued `enrich_directives`, re-runs `ingest/enrich.ts` for those `thing_id`s, and lands the fresh draft as a **pending `thing_edits` overlay** (not a silent live overwrite — it shows in the Queue for a normal glance-and-approve), then marks the directive `done`. Reuse the existing `enrich-backfill` path if it fits.

**Exit criteria:** clicking "Redraft tonight" inserts a queued row (verify in Supabase) and fires no network AI call; a manual worker run turns the directive into a Queue overlay.

**STOP.** Summarize and wait.

---

## Phase 5 — Live Catalog bulk actions (own phase; L-effort)

**Goal:** the biggest time win — act on many rows at once, for the safe/uniform operations only.

- Add a checkbox column to `.lrow` and a selection model in `CatalogView.tsx` (select-all respects the current filter).
- Add a **bulk action bar** (reuse the mockup's styling) scoped to: **hero-eligible on/off**, **add tag**, **remove tag**, **set weight**, **redraft tonight** (Phase 4), **archive**. Keep **blurb** and **photo** out of bulk (per-item by nature).
- Bulk endpoints: reuse the existing single-row routes in a loop server-side, or add a thin `/api/admin/catalog/bulk` that validates and applies. Negative-tag rules (`filterTags`) still enforced server-side.
- **Because bulk archive writes live with no review**, require a count-confirm ("Archive 12 things?") and attach an **Undo** to the result toast.

**DDL:** none.

**Exit criteria:** selecting N rows and applying each safe op works and writes `audit_log` per row; bulk archive confirms and can be undone; illegal tag combos are still rejected.

**STOP.** Summarize and wait.

---

## Phase 6 — Venues: the no-match catcher (own phase; L-effort · depends on Phase 0)

**Goal:** surface the events that silently sit on a motif because nothing matched them, and let Jim resolve them in place. All tiers.

**DDL (Jim runs first):**
```sql
-- additive: persists the "leave on motif" dismissal (V-4)
alter table things add column if not exists no_venue_ack boolean not null default false;
```
Stop and have Jim confirm before the loader change.

- **Loader (V-1):** extend the venues loader so it also returns a **"no confident match"** bucket: unattached things (`venue_id` null, status published/needs_review) that either scored 0 in `bestVenueMatch` **or** have a null address, **excluding** `no_venue_ack = true`. Note the existing 200/40 caps and page the list rather than silently truncating.
- **Pane (V-1, V-6):** render the catcher as a new pane under "Matches to review," per the mockup. Filter chips (All/T1/T2/T3), address toggle, search, soonest-first sort with T1 on top.
- **Attach to existing (V-2):** `POST /api/admin/venues/attach` `{thing_id, venue_id}` → set `things.venue_id`; if the venue has an approved pool, apply today's rotation pick to the thing's live photo fields (reuse the `/venues/match` logic). Audit + `revalidatePublic()`. Client shows a venue typeahead over the loaded active venues with pool-photo counts.
- **Create venue from here (V-3):** factor the catalog's auto-create-venue logic into a shared `createVenue()` helper and expose `POST /api/admin/venues/create` `{display_name, place_id?, lat?, lng?, from_thing_id}` → create venue (additive), attach the thing, audit, revalidate. Reuse the existing `/venues/lookup-place-ids` for the "Look up automatically" button.
- **Persist dismiss (V-4):** "Leave on motif" sets `no_venue_ack = true` (audit). The row drops from the list and stays gone on reload.
- **Weak-guess (V-5):** when `bestVenueMatch` scored above zero but below the auto-propose threshold, show the guess as a one-click "Attach to X (low confidence)" that routes through the V-2 attach.

**Exit criteria:** the pane lists real unmatched events; attach applies a pool photo immediately when one exists; create-venue registers + attaches; "Leave on motif" persists across reload.

**STOP.** Summarize and wait.

---

## Phase 7 — Venues: pool + linkage management

**Goal:** close the loop so a bad attach or a bad photo is fixable, and venue creation is first-class.

- **V-7 — Attached-events list.** In the venue detail sheet, replace the count-only display with a list of the things linked via `venue_id` (tier chip, title, when) with a click-through to open each. Add the list to the loader or a `GET /api/admin/venues/[id]/things`.
- **V-8 — Detach / re-assign.** `POST /api/admin/venues/detach` `{thing_id}` → set `venue_id` null, audit, revalidate. (Decide with Jim whether to also clear the inherited photo or leave the last one; default: leave it, it re-resolves next pass.)
- **V-9 — Remove-photo cleanup.** When an approved `venue_photos` row is removed, find things currently serving that URL for this venue and re-pick from the remaining pool (or clear to motif if the pool is now empty), audit. Stops a removed photo from staying live indefinitely.
- **V-11 — Add venue.** A first-class "New venue" control in the Venues grid header, using the shared `createVenue()` from Phase 6.
- **V-12 — Archive confirm.** Add a confirm dialog before "Archive venue" (it's one click with no confirm today).

**DDL:** none.

**Exit criteria:** the attached-events list renders and links through; detach clears `venue_id`; removing a live pool photo re-resolves the affected events; archive prompts first.

**STOP.** Summarize and wait.

---

## Phase 8 — Venues: a11y + governance sweep

**Goal:** the small, cheap closes.

- **V-13 — Aria-label the remove "✕"** button on approved-pool photos.
- **V-14 — Venue-sheet focus trap** using the `useFocusTrap` hook from Phase 1 (trap, autofocus, restore).
- **V-15 — Audit-log** on `photos/remove` and `photos/reorder` so all six venue mutations write a consistent trail.
- **V-16 — Revalidate on place_id / coordinate edit** in `venues/edit` (today only archive revalidates), so a corrected place_id propagates promptly.

**DDL:** none.

**Exit criteria:** screen-reader label present on the remove button; venue sheet traps focus; remove/reorder appear in `audit_log`; a place_id edit revalidates the public surfaces.

**STOP.** Report completion of the full plan.

---

## Appendix — collected DDL (additive, Jim runs manually in Supabase)

Only two phases need schema, both additive:

```sql
-- Phase 4
create table if not exists enrich_directives (
  id uuid primary key default gen_random_uuid(),
  thing_id uuid not null references things(id),
  status text not null default 'queued',
  requested_by text default 'founder',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists enrich_directives_status_idx on enrich_directives (status);

-- Phase 6
alter table things add column if not exists no_venue_ack boolean not null default false;
```

Everything else is code-only. No column is dropped or retyped anywhere in this plan.
