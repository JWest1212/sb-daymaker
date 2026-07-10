# Venues tab (`/admin/venues`) — Current-State Spec

Grounded in the actual code as of commit **5fa2000** (2026-07-09), read on
2026-07-10 on branch `fix/edition-bench-size-12`. Literal description of what the
code does today — not a design doc.

**Working-tree state:** every single file that makes up the Venues tab is
**untracked** — none of it exists in git history yet. This entire subsystem
(server page, client view, all six API routes, the server loader, the pool
helpers) is uncommitted work sitting in the local working directory:
`app/admin/venues/`, `app/api/admin/venues/`, `lib/venuesServer.ts`,
`lib/venuePool.ts`, `lib/venueFetch.ts`, `lib/venues.ts`,
`supabase/migrations/20260709_card_imagery_phase2_venues.sql`, plus the Catalog
page's related `app/api/admin/catalog/venue-photos/` route. `git log` has no
commits touching any of these paths.

---

## 1. File inventory

| File | Role |
|---|---|
| [app/admin/venues/page.tsx](../../app/admin/venues/page.tsx) | Server page. Calls `loadVenuesData()`, renders `<VenuesView initial={...}>`. `force-dynamic`. |
| [app/admin/venues/VenuesView.tsx](../../app/admin/venues/VenuesView.tsx) | The entire client UI — 545 lines, one file: matches-to-review pane, place-ID lookup pane, venue grid, venue detail sheet (editor + photo pool), archived-venues drawer, toast. |
| [lib/venuesServer.ts](../../lib/venuesServer.ts) | `loadVenuesData()` — the one server-side loader for this page. |
| [app/api/admin/venues/route.ts](../../app/api/admin/venues/route.ts) | `GET` — the full `VenuesData` payload (used for the client's `refresh()` after every mutation). |
| [app/api/admin/venues/edit/route.ts](../../app/api/admin/venues/edit/route.ts) | `POST` — rename/resize/place_id/lat/lng/archive/un-archive a venue. |
| [app/api/admin/venues/match/route.ts](../../app/api/admin/venues/match/route.ts) | `POST` — approve a fuzzy thing→venue match (writes `things.venue_id`). |
| [app/api/admin/venues/lookup-place-ids/route.ts](../../app/api/admin/venues/lookup-place-ids/route.ts) | `POST` — Google Text Search (+ Nearby Search fallback) to propose a `place_id` for venues missing one. Shared with the Catalog picker's single-venue "Look up automatically." |
| [app/api/admin/venues/photos/fetch/route.ts](../../app/api/admin/venues/photos/fetch/route.ts) | `POST` — fetch Wikimedia/Google candidates for one venue. |
| [app/api/admin/venues/photos/approve/route.ts](../../app/api/admin/venues/photos/approve/route.ts) | `POST` — promote a candidate into the approved pool. |
| [app/api/admin/venues/photos/remove/route.ts](../../app/api/admin/venues/photos/remove/route.ts) | `POST` — hard-delete a `venue_photos` row (candidate reject OR approved-pool removal, same action). |
| [app/api/admin/venues/photos/reorder/route.ts](../../app/api/admin/venues/photos/reorder/route.ts) | `POST` — swap `sort_order` with the adjacent approved photo. |
| [lib/venueFetch.ts](../../lib/venueFetch.ts) | `fetchCandidatesForVenue()` — the actual Wikimedia+Google fetch logic, shared verbatim between this tab's fetch route and the Catalog page's `venue-photos/fetch` route. |
| [lib/venuePool.ts](../../lib/venuePool.ts) | Pure helpers: `pickFromPool` (date-hash rotation), `dedupeFeedVenuePhotos` (render-time), `scoreVenueMatch`/`bestVenueMatch` (the **fuzzy** matcher this tab's "Matches to review" pane uses), `slugifyVenueKey`, `isWeakPlaceMatch`. |
| [ingest/images.ts](../../ingest/images.ts) | Not part of this tab's UI, but the contrast matters: its `matchVenueForCandidate()` (exact venue_id/place_id match only) is a **separate, different** matcher from this tab's fuzzy `bestVenueMatch()`. |
| `supabase/migrations/20260709_card_imagery_phase2_venues.sql` | DDL for `venues`, `venue_photos`, `things.venue_id`. Uncommitted (§ above). |
| [app/admin/review/cockpit.css](../../app/admin/review/cockpit.css) | Shared cockpit stylesheet; venues-specific rules from line ~451 on (`.vsection`, `.venuegrid`, `.vcard`, `.photostrip-heading`, `.approvedstrip`/`.approvedcard`, `.candidategrid`/`.candidatecard`, `.veditor-*`, `.matchlist`/`.pickrow`/`.weakmatch`, `.cc-src`). |
| [app/admin/CockpitTabs.tsx:14](../../app/admin/CockpitTabs.tsx#L14) | Confirms "Venues" is a real tab: `{ href: "/admin/venues", label: "Venues", showCount: false }`. |

---

## 2. Data / server layer

### `loadVenuesData()` — lib/venuesServer.ts:68-172

No parameters, no filters, no pagination — it loads everything in one shot via five parallel queries (`Promise.all`, lines 72-93):

1. `venues` where `status='active'`, ordered by `display_name` — all fields needed for the editor and the fuzzy matcher.
2. `venue_photos`, **all rows regardless of `approved`**, ordered by `sort_order` — split client-side (in this function) into `approved` vs `candidates` buckets per venue.
3. `things.venue_id` for every published/needs_review thing with a non-null `venue_id` — used only to build a **count** per venue (`attachedCounts` Map).
4. `things` with `venue_id IS NULL`, status published/needs_review, **`address IS NOT NULL`** — the pool the fuzzy matcher scores against.
5. `venues` where `status='archived'` — for the "Show archived venues" drawer.

**Fields returned per venue** (`VenueRow`, lines 26-38): `id, key, display_name, place_id, lat, lng, radius_m, name_patterns, attachedCount, approvedPhotos[], candidatePhotos[]`. `approvedPhotos`/`candidatePhotos` each carry `id, source, serving_url, attribution` (+ `sort_order` on approved).

**The fuzzy match list** (lines 133-165): for every unattached, addressed thing, `bestVenueMatch()` (from `lib/venuePool.ts`) scores it against every active venue and keeps only the single best-scoring venue (`MAX_MATCHES_PER_THING = 1`, line 65) — a thing with no positive score against anything is silently dropped (`if (!best) continue`, line 153). The scan stops once 200 matches have accumulated (`MAX_MATCH_PROPOSALS = 200`, line 66) — the comment calls this "a generous cap on the review pane, not a silent truncation of the underlying scan," but it **is** a truncation in effect: anything past the 200th accumulated match is never scored in that render at all (the `break` at line 146 exits the loop entirely, not just the display). Sorted by score descending (line 165).

**This "matches" list is NOT a complete "things missing a venue" inventory.** It excludes: things with `venue_id` already set (correctly excluded), things with a null `address` (line 88's filter), and — critically — things with `venue_id` null but that score **zero** against every registered venue's `name_patterns`/proximity (e.g., a Tier-1 event at a venue that isn't in the registry at all, or whose title doesn't contain any of the venue's configured name patterns). Those are fetched into `unmatchedRes.data` but never surface anywhere — no count, no fallback list, nothing. See §5.

### API routes

**`GET /api/admin/venues`** — auth-gated, returns `loadVenuesData()` verbatim. No query params.

**`POST /api/admin/venues/edit`** — `{ venue_id, display_name?, radius_m?, name_patterns?, status?, place_id?, lat?, lng? }`. Partial patch (only provided fields are written). `place_id`/`lat`/`lng` can be explicitly cleared (empty string → `null` for place_id; `lat`/`lng` pass through `undefined`-check only, so `null` is a valid clearing value). `audit_log` insert (`action: 'venue_edit'`). `revalidatePublic()` **only when `status === 'archived'`** (comment: "an archived venue's things fall back to gradient/motif eventually") — a plain rename/radius/place_id/coordinate edit does **not** revalidate the public site at all, even though it can change what a Tier-1 event resolves to on its next resolve pass.

**`POST /api/admin/venues/match`** — `{ thing_id, venue_id }`. Writes `things.venue_id`. If the venue already has an approved pool, **immediately applies today's rotation pick** (`pickFromPool`) directly to `photo_url`/`photo_source`/`photo_attribution` on that thing — so approving a match here can also change a live thing's displayed photo in the same request, with no separate confirmation step. `audit_log` (`action: 'venue_match_approved'`). `revalidatePublic()` always (unconditional, unlike `/edit`).

**`POST /api/admin/venues/lookup-place-ids`** — already documented in the Catalog audit; same route, two modes (bulk: all venues missing a `place_id`; single: one `venue_id` + optional override `query`). Writes nothing — proposals only.

**`POST /api/admin/venues/photos/fetch`** — `{ venue_id, include_google? }`. Loads the venue, calls the shared `fetchCandidatesForVenue()`. No status-guard on the venue (works even on an archived venue, since the route never checks `status`). No `audit_log` entry for a fetch itself (candidates are unapproved rows, not yet a durable decision).

**`POST /api/admin/venues/photos/approve`** — `{ photo_id }`. Sets `approved: true`, appends `sort_order` (max existing approved + 1). `audit_log` (`action: 'photo_approved'`).

**`POST /api/admin/venues/photos/remove`** — `{ photo_id }`. **Hard `DELETE`** of the `venue_photos` row — no soft-delete/"rejected" state exists in the schema (comment: "there's no `rejected` state in the additive-only Phase 2 DDL... deleting is equivalent to hiding"). Same route/action whether the photo was an unapproved candidate ("Reject") or an already-approved pool photo ("✕" remove) — the UI just relabels the same button. **No `audit_log` entry at all for this route.** Explicitly, per its own comment: this does **not** touch any `things` row currently displaying the deleted photo — that thing's `photo_url` is left pointing at a now-deleted row's URL until the next resolve/backfill pass or a manual override.

**`POST /api/admin/venues/photos/reorder`** — `{ photo_id, direction: 'up'|'down' }`. Swaps `sort_order` with the adjacent approved photo (two parallel updates). No-op (returns `{ok:true}` without writing) at either end of the list. **No `audit_log` entry for reorder either.**

So: three of the six mutation routes (`edit`, `match`, `photos/approve`) write `audit_log`; two (`photos/remove`, `photos/reorder`) do not. That's an inconsistency in this subsystem, not a documented deliberate split.

---

## 3. UI inventory (screen-by-screen)

Single component, `VenuesView.tsx:199-544`.

**Header:** `<h1>` "Venues" + a live count of active venues (`data.venues.length`). Subhead (static): *"Founder-curated venues + photo pools (Card Imagery Phase 2). Approve a fuzzy match to attach a thing to a venue; curate 3–5 approved photos per venue so its events rotate through real, vetted photos instead of a generic auto-pick."*

**Section 1 — "Matches to review (N)"** (lines 375-395): a list of `pickrow`s, one per fuzzy-matched unattached thing, capped to the first 40 rendered (`.slice(0, 40)`, line 381 — a **second**, UI-level truncation on top of the loader's 200-item cap). Each row: title, tier chip (T1/T2/T3), address, proposed venue name, score (one decimal). Two buttons: **Approve** (calls `/venues/match`) and **Not a match** (client-side-only dismiss — adds to a local `Set`, `dismissed`; nothing is persisted, so a dismissed proposal reappears on next page load/refresh). Empty state: a specific sentence explaining the three reasons the list could be empty (no address / already attached / scores no match).

**Section 2 — "Place ID lookup"** (lines 397-479): one button, "Look up place_ids for venues missing one" (bulk mode, no `venue_id` in the request). Results render three ways: **strong matches** (Approve/Skip), **weak matches** (flagged "⚠ weak match — probably just a geocoded address, not a real business," offering any nearby named-POI candidates found, a raw address-only fallback, and a free-text "search again" retry box scoped to that one venue), and a plain sentence listing venues with **no match at all**. "Skip"/dismissal here is also client-side-only (`placeIdDismissed` Set) — nothing persisted.

**Section 3 — "Venues (N)"** (lines 481-500): a responsive grid (`.venuegrid`, `auto-fill, minmax(230px,1fr)`) of `vcard` buttons, one per active venue, each showing: display name, `"{attachedCount} thing(s) attached"`, `"{N} approved photo(s)"` (styled with a `.warn` class when zero), and up to 4 thumbnail previews of its approved photos (or an "none" placeholder box if zero). Clicking a card opens the detail sheet. **No search/filter control anywhere in this section** — with ~26 active venues today this is a flat, unfiltered grid.

**Archived venues** (lines 502-524): a collapsed-by-default toggle button ("Show/Hide archived venues (N)", `aria-expanded`), only rendered if any exist. Expanded view is a plain list with an "Un-archive" button per row — no other fields shown for an archived venue (no photo count, no attached count).

**Venue detail sheet** (`VenueDetailSheet`, lines 106-197; rendered at 526-539): modal `.sheet.sheet--wide`+`.scrim`, `role="dialog" aria-modal="true"`. Opened by clicking a venue card, closed by ✕/scrim-click/`Escape` (global keydown listener, lines 222-226 — same pattern as the Catalog sheet). **No focus trap, no autofocus, no focus restoration on close** (same gap as the Catalog editor). Contents:
- Editable fields: Display name, Radius (m, `min={25}`), Google place_id, Latitude, Longitude — plain inputs, no validation beyond `Number(...) || venue.radius_m` fallback for radius. A hint paragraph appears if both `place_id` and `lat` are unset, linking out to Google's Place ID Finder tool.
- **Save** button — posts the whole form as a patch to `/venues/edit`.
- **Archive venue** button — no confirm dialog at all (unlike the Catalog page's `window.confirm()` on Delete) — one click archives immediately. (Recoverable via the archived-venues drawer, but no in-the-moment confirmation.)
- The photo pool (`PhotoStrip`, described in full in §4).

**Toast:** same shared pattern as Catalog — single global toast, `role="status"`, auto-dismiss after 3.2s (slightly shorter than Catalog's 3.6s), no stacking, no undo affordance.

**Loading/empty/error states:** **there is no loading indicator anywhere in this component** — not for the initial page (server-rendered, so moot) and not for any of the eight `refresh()`-triggering mutations (fetch, approve, remove, reorder, save, archive, unarchive, match-approve). Between a click and the toast appearing, the UI shows nothing. A failed `fetch()` in any handler falls back to `res?.error ?? "<generic> failed"` in the toast — there is no distinct "the whole page failed to load" state; if `loadVenuesData()`'s Supabase client is unconfigured, the page silently renders "Venues 0 active" with all sections empty, no error banner.

**Keyboard/focus/aria:** `Escape` closes the detail sheet. Reorder buttons have `aria-label` ("Move earlier"/"Move later"). The `aria-expanded` toggle on the archived-venues button is correct. **The approved-photo "✕" remove button has no `aria-label`** — its only accessible content is the bare "✕" glyph (contrast: the Catalog tab's equivalent Delete button does have an `aria-label`). Approve/Reject buttons on candidate cards rely on their visible text only (fine). Global `:focus-visible`/`prefers-reduced-motion` handling is inherited from `.sbd-cockpit` (`app/admin/layout.tsx`), same as every other admin page — nothing venue-specific.

---

## 4. Photo pool workflow (Q1, in full)

**Seeing current photos:** yes, in full, split into two clearly separate strips inside the detail sheet (`PhotoStrip`, `VenuesView.tsx:15-104`):
- **"Approved pool (N)"** — a wrapping flex strip (`.approvedstrip`) of fixed-width (160px) `.approvedcard`s, each a 4:3 photo with a source pill (Google/Wikimedia, always spelled out per a 2026-07-10 addendum comment, lines 9-13), an attribution caption underneath, and an overlay button row: **◀** (move earlier, disabled at index 0), **▶** (move later, disabled at the last index), **✕** (remove). Order shown **is** `sort_order` (the loader orders `venue_photos` by `sort_order` ascending, line 79, and buckets preserve that order).
- **"Candidates (N)"** — a responsive grid (`.candidategrid`) of larger `.candidatecard`s, each with a source pill and an overlay button row: **Approve**, **Reject**. No ordering concept for candidates (whatever order the DB query returns).

Empty states are explicit: "No approved photos yet — fetch candidates below and approve a few (3–5 is the target pool size)" and "No candidates fetched yet."

**Fetching new candidates:** two buttons, "Fetch candidates" (Wikimedia-first, `include_google:false`) and "Fetch via Google" (`include_google:true`, always available as a deliberate second click per the 2026-07-10 addendum comment, lines 20-23 — not gated behind a quantity threshold from the UI's side). Both call `POST /api/admin/venues/photos/fetch`, which calls the exact same `fetchCandidatesForVenue()` (`lib/venueFetch.ts`) that the Catalog page's picker uses. Sources: Wikimedia geosearch (needs `lat`/`lng`) and Google Place Photos (needs `place_id`; auto-fires even off the plain "Fetch candidates" button if Wikimedia comes up under 3 results, or always when "Fetch via Google" is clicked). **"Fetch candidates" is disabled if the venue has neither `place_id` nor `lat`; "Fetch via Google" is disabled (with a `title` tooltip) if there's no `place_id`.** A static help paragraph (lines 75-80) explains Google returns a fixed, non-paginated list, so re-clicking it won't find anything new unless Google's own listing changed — and that each Google click "spends real cap budget."

**Cost/cap:** yes, a Google click **does** cost money at click time (same shared `image_spend`/`CAP` mechanism traced in the Catalog audit — `fetchCandidatesForVenue` → `fetchGooglePhotoCandidates` → real `places.googleapis.com` calls, gated by `hasBudget()`). **The cap/remaining budget is NOT surfaced anywhere in this tab** — no number, no warning, no distinguishable "capped" vs. "genuinely nothing found" outcome. Same gap documented for the Catalog tab; it exists here too, in the tool that is arguably the primary place a founder would spend that budget deliberately.

**Approve / reorder / remove / "set primary":**
- **Approve** a candidate → `POST /venues/photos/approve` → `approved:true`, `sort_order` = current max approved + 1 (appended to the end, never inserted at a chosen position). Logged to `audit_log`.
- **Reorder** an approved photo → `POST /venues/photos/reorder` → swaps `sort_order` with the immediate neighbor (one step at a time, no jump-to-position). **Not** logged to `audit_log`.
- **Remove** — same route/action (`/venues/photos/remove`, hard delete) whether it's an unapproved candidate ("Reject") or an approved pool photo ("✕"). **Not** logged to `audit_log`. Removing an approved photo does **not** touch any thing currently displaying it — that thing keeps showing the (now-orphaned) URL until something else re-resolves it.
- **"Set a primary photo" does not exist as a concept anywhere in this system.** There is no single "cover photo" flag. What each individual Tier-1 event actually shows is decided per-thing by `pickFromPool()`'s date+thing-id hash rotating through the **whole** approved list — `sort_order` governs rotation order and the reorder UI's own left-to-right position, not "which one always shows."

**Relationship to the Catalog "Use this photo" flow:** they write to the **same** `venue_photos` table, the same `approved`/`sort_order` fields. When a founder picks a photo in the Catalog editor that came from the venue-backed fetch (carries a `venuePhotoId`), the Catalog's own `/api/admin/catalog/photo` route independently re-implements the identical approve-and-append-sort_order logic (not by calling this tab's `/venues/photos/approve` route internally — it's duplicated logic reaching the same table) — so an approval made from the Catalog page **does** show up here, in this tab's "Approved pool," and vice versa. There are now two separate code paths that can each flip `approved: true` on a `venue_photos` row.

---

## 5. Event linkage (Q2, in full)

**Per-venue linkage shown:** only a **raw count** — `"{attachedCount} thing(s) attached"` on each venue card (`VenuesView.tsx:487`, sourced from `lib/venuesServer.ts:95-99`, a simple `things.venue_id` group-count over published/needs_review rows). **There is no list of which specific things are attached, no click-through from a venue to its events, and no such list in the detail sheet either** — the detail sheet only shows the editor fields and the photo pool (§3); attached-things is not a rendered field there at all. Confirmed by direct search: `attachedCount` appears nowhere except as that one summary number.

**Is there any view of events NOT linked to a venue?** Partially, and narrowly:
- The **"Matches to review"** pane (§2/§3) is the only surface that touches unlinked events at all. It shows events with `venue_id IS NULL` **only if** they (a) have a non-null `address`, and (b) score above zero against at least one registered venue's `name_patterns` or proximity radius (`bestVenueMatch`/`scoreVenueMatch`, `lib/venuePool.ts`). This is a fuzzy-match **proposal** queue, not an inventory of "everything missing a venue."
- **Events that fail both conditions are invisible on this tab, with no count and no fallback list anywhere.** Concretely: an event with `venue_id` null and a `place_id` that doesn't match any registered venue's `place_id` (the exact case the ingest resolver's `matchVenueForCandidate` would also miss, per your framing) is only caught here if its **title or address text** happens to contain one of a venue's configured `name_patterns`, or its coordinates fall within a venue's `radius_m`. An event with none of those — e.g. a venue whose name doesn't literally appear in the event title, or a venue not registered at all — produces **zero visibility anywhere in this tab.** There is no raw "N events have no venue" counter in `VenuesData` or rendered anywhere in `VenuesView.tsx`.
- The proposal list itself is capped twice over: the loader stops scoring after 200 accumulated matches (`lib/venuesServer.ts:66,146`), and the UI then only renders the first 40 of whatever the loader returned (`VenuesView.tsx:381`).

**Attaching an event to a venue from this tab:** yes, but **only** via approving a proposal in "Matches to review" (`POST /venues/match`) — there is no free-form "pick any thing, pick any venue, attach" control, no search-a-thing-by-title box, nothing that lets a founder manually attach an event that never appeared in the fuzzy-match list at all (e.g., because it scored zero). The **only other** attach paths in the whole codebase are the Catalog page's auto-attach-or-create flow and the two automatic ingest-side mechanisms (exact-match at land time, and the nightly `matchVenuesByPlaceId()` sweep) — none of which are reachable from this tab.

**Creating / editing / deactivating a venue here:**
- **Edit:** yes, in full (display name, radius, place_id, lat/lng) via the detail sheet's Save button.
- **Deactivate ("Archive"):** yes, one click, no confirm dialog, reversible via the archived-venues drawer's "Un-archive."
- **Create:** **no.** There is no "add venue" / "new venue" control anywhere in `VenuesView.tsx` — confirmed by direct search. The only places a new `venues` row is ever `insert`ed are (a) the Catalog page's auto-create-on-fetch route (`app/api/admin/catalog/venue-photos/fetch/route.ts:69`) and (b) the one-off CLI seeding script (`seedVenueRegistry()` in `ingest/run.ts`) — neither is part of this tab. A founder cannot register a brand-new venue from the Venues tab itself.
- **Detach a thing from its venue:** no control exists anywhere in this tab (or, as far as this investigation traced, anywhere else in the codebase).

---

## 6. What this tab does vs. doesn't do for Tier-1 image work

**Already served, in full, by this tab:**
- Curating a venue's approved photo pool end-to-end for a venue that's already registered: fetch (Wikimedia/Google) → approve → reorder → remove, all with immediate persistence to the same `venue_photos` rows the resolver and the Catalog picker both read.
- Editing/correcting a venue's `place_id`/coordinates (needed for fetching to work at all), including an automated bulk "look up place_ids for everything missing one" pass with human review before anything saves.
- A founder-reviewed (not blind) fuzzy attach path for events that the ingest resolver's exact-match logic would otherwise miss, **provided** the event scores a positive match against a registered venue's name patterns or proximity.
- Archiving a venue that's gone bad, reversibly.

**Not served by this tab — the gaps relevant to "catch unmatched events":**
- **No inventory of events with no venue_id at all.** The tab only ever shows the subset that both has an address and scores a positive fuzzy match. An event that scores zero (no name-pattern hit, no proximity hit, or the venue isn't registered yet) is completely invisible here — no count, no list, no way to discover it from this screen.
- **No way to see which things are attached to a given venue** — only a count. No click-through, no per-venue events list, no way to spot-check "did the right things get attached" without querying the database directly.
- **No way to manually attach an arbitrary thing to an arbitrary venue** outside the auto-scored proposal queue — if the fuzzy matcher doesn't surface a pairing, there's no manual search-and-attach fallback anywhere in this UI.
- **No way to detach/re-assign a thing from a venue** once attached (via any mechanism — this tab, the Catalog auto-attach, or the automatic ingest sweeps).
- **No way to create a new venue from this tab** — a founder discovering an unregistered venue (Q2's exact scenario) has to go through the Catalog page's auto-create-on-fetch side effect instead of registering it here directly.
- **The image-spend/cap budget is not surfaced**, same gap as the Catalog tab — a founder curating pools here (arguably the primary place this budget gets spent deliberately) gets no visibility into how much of the monthly cap remains.
- **Two of six mutation routes don't write `audit_log`** (`photos/remove`, `photos/reorder`) while the other four do — an inconsistent audit trail for this subsystem.
- **Removing an approved pool photo doesn't touch anything currently showing it** — an event can keep displaying a now-deleted photo's URL indefinitely with no automatic cleanup and no warning to the founder that this will happen.
