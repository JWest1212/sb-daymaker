# Live Catalog (`/admin/catalog`) — Current-State Spec

Grounded in the actual code as of commit **5fa2000** (2026-07-09), read on
2026-07-10 on branch `fix/edition-bench-size-12`. This is a literal
description of what the code does today — not a design doc, not a
recommendation list.

**Working-tree state at time of writing:** the branch has uncommitted changes
touching the catalog subsystem directly:
- Modified: `app/admin/catalog/CatalogView.tsx`, `lib/catalogServer.ts`
- Untracked (new, not yet committed): `app/admin/catalog/CatalogImagePicker.tsx`,
  `app/api/admin/catalog/find-more-images/route.ts`, `app/api/admin/catalog/photo/route.ts`,
  `app/api/admin/catalog/venue-photos/`
- Untracked stray duplicate: `app/api/admin/catalog/delete/route 2.ts` — byte-identical
  to `app/api/admin/catalog/delete/route.ts`. Because Next.js route files must be
  named exactly `route.ts`, this file is **not wired into routing at all** — it's
  inert junk sitting in the tree (likely a leftover from an editor "save as" or a
  merge artifact), not a second live endpoint.

So this spec describes a page that is mid-flight: the image subsystem (section 4)
in particular is all new/uncommitted work.

---

## 1. File inventory

| File | Role |
|---|---|
| [app/admin/catalog/page.tsx](../../app/admin/catalog/page.tsx) | Server page. Calls `loadCatalog({ page: 1 })`, renders `<CatalogView initial={...}>`. `force-dynamic`. |
| [lib/catalogServer.ts](../../lib/catalogServer.ts) | `loadCatalog()` — the only server-side data loader for this page (service-role Supabase read). |
| [app/admin/catalog/CatalogView.tsx](../../app/admin/catalog/CatalogView.tsx) | The entire client UI: filter bar, row list, pager, edit sheet, toast. 276 lines, one component. |
| [app/admin/catalog/CatalogImagePicker.tsx](../../app/admin/catalog/CatalogImagePicker.tsx) | New (untracked). The in-sheet photo fetch/review/assign widget. 271 lines. |
| [app/admin/review/ImagePicker.tsx](../../app/admin/review/ImagePicker.tsx) | Shared "thumbnail + prev/next arrows" presentational component, reused from the Queue cockpit. Its doc comment is stale (see §6). |
| [app/admin/WeightNudge.tsx](../../app/admin/WeightNudge.tsx) | Shared ▲/▼ editorial-weight control, reused from the Queue cockpit. (A duplicate `WeightNudge 2.tsx` also sits untracked in `app/admin/` — same "stray file" situation as `route 2.ts`, not imported by anything in this page.) |
| [app/api/admin/catalog/route.ts](../../app/api/admin/catalog/route.ts) | `GET` — filtered/paginated catalog read, backs the filter bar. |
| [app/api/admin/catalog/edit/route.ts](../../app/api/admin/catalog/edit/route.ts) | `POST` — apply title/blurb/blurb_long/neighborhood/tags directly to a published row. |
| [app/api/admin/catalog/delete/route.ts](../../app/api/admin/catalog/delete/route.ts) | `POST` — archive (soft-delete) a published row. |
| [app/api/admin/catalog/photo/route.ts](../../app/api/admin/catalog/photo/route.ts) | `POST` — apply a picked photo_option to a row's live `photo_url`/`photo_source`/`photo_attribution`. New/untracked. |
| [app/api/admin/catalog/venue-photos/fetch/route.ts](../../app/api/admin/catalog/venue-photos/fetch/route.ts) | `POST` — the actual "Fetch candidates" / "Fetch via Google" backend: attaches/creates a venue for the thing, then runs the shared venue photo fetch. New/untracked. |
| [app/api/admin/catalog/find-more-images/route.ts](../../app/api/admin/catalog/find-more-images/route.ts) | `POST` — a free-source (Pexels+Wikimedia) widening search. **Exists, but nothing in the Catalog UI calls it** (see §4, §6). New/untracked. |
| [lib/venueFetch.ts](../../lib/venueFetch.ts) | `fetchCandidatesForVenue()` — the Wikimedia-geosearch + Google-Place-Photo fetch shared by the Venues tab and this page's `venue-photos/fetch` route. |
| [lib/venuePool.ts](../../lib/venuePool.ts) | `slugifyVenueKey`, `isWeakPlaceMatch`, pool-scoring helpers used by the auto-attach/auto-create venue logic. |
| [app/api/admin/venues/edit/route.ts](../../app/api/admin/venues/edit/route.ts) | Reused by the picker's "Save & fetch" (writes place_id/lat/lng onto the auto-created/attached venue). |
| [app/api/admin/venues/lookup-place-ids/route.ts](../../app/api/admin/venues/lookup-place-ids/route.ts) | Reused by the picker's "Look up automatically" button (Google Text Search + Nearby Search, single-venue mode). |
| [lib/review.ts](../../lib/review.ts) | `CatalogRow`, `PhotoOption`, `NEIGHBORHOODS`, `OCCASION_TAGS`, `filterTags()`, `whenString()` — shared shapes/pure helpers used by both the Queue and this page. |
| [lib/occasions.ts](../../lib/occasions.ts), [lib/zones.ts](../../lib/zones.ts) | Vocab for the vibe/zone filters. |
| [ingest/images.ts](../../ingest/images.ts) | The nightly resolver (`resolveImages`) and its building blocks (`imageQuery`, `findMoreOptions`, `fetchGooglePhotoCandidates`, `wikimediaGeosearch`, the `CAP`/`image_spend` accounting). The Catalog page imports only `imageQuery`/`findMoreOptions` (for the orphaned find-more-images route) and, via `lib/venueFetch.ts`, the Google/Wikimedia primitives and cap accounting. |
| [ingest/enrich.ts](../../ingest/enrich.ts) | The nightly Claude blurb/tag drafter. Not reachable from this page at all (see §7). |
| [app/admin/review/cockpit.css](../../app/admin/review/cockpit.css) | The only stylesheet; shared by the whole `/admin` cockpit (scoped under `.sbd-cockpit`, applied in `app/admin/layout.tsx`). Catalog-specific rules: `.lrow`/`.lthumb`/`.lgroup`/`.lmeta`/`.lacts` (row layout), `.catphoto-*` (image picker wrapper), reuses `.sheet`/`.scrim`/`.thumb`/`.tagtoggle`/`.wnudge`/`.herostar`/`.toast`/`.pager` from the Queue. |
| `Core Project Files/sbdaymaker_schema.sql` | The checked-in "data contract." **Stale relative to the live schema** — see the conflict noted in §2. |
| `supabase/migrations/20260625_photo_options.sql`, `20260625_images.sql`, `20260709_card_imagery_phase2_venues.sql` | The actual DDL for `photo_options`, `image_spend`/`image_cache`, and `venues`/`venue_photos`/`things.venue_id` — none of these tables/columns appear in `sbdaymaker_schema.sql`. |

---

## 2. Data / server layer

### `loadCatalog(filters)` — [lib/catalogServer.ts:51-129](../../lib/catalogServer.ts#L51-L129)

- Signature: `loadCatalog(f: { tier?: 1|2|3; vibe?: string; zone?: string; q?: string; page?: number } = {}): Promise<CatalogResult>`.
- `PAGE_SIZE = 50` ([lib/catalogServer.ts:43](../../lib/catalogServer.ts#L43)).
- Query source: `things` where `status = 'published'` only. Filters: `tier` → `eq(happening_tier)`, `zone` → `eq(nearby_zone)`, `q` → `ilike(title, %q%)`, `vibe` → resolved first via a separate `thing_tags` lookup into an id list, then `.in('id', vibeIds)` (an extra round-trip, not a join).
- The main select pulls **the entire matching set** (`.range(0, 1999)` — up to 2000 rows) before paginating **in process**, so the chronological/tiered ordering is global rather than per-page. Comment at [lib/catalogServer.ts:65-66](../../lib/catalogServer.ts#L65-L66) states this is deliberate ("admin scale, ~hundreds").
- Ordering (`bucketAndGroup`, [lib/catalogServer.ts:16-26](../../lib/catalogServer.ts#L16-L26)):
  - Bucket 0: Tier 1 (dated) items with a future-or-today `starts_at`, chronological. Group key = SB-local day; label `"Today · <date>"` for today, else `"<date>"`.
  - Bucket 1: Tier 2 (recurring), alphabetical by title. Group label `"Recurring — every week"`.
  - Bucket 2: Tier 3 (evergreen), alphabetical by title. Group label `"Anytime in SB"`.
  - Bucket 3: Tier 1 items whose `starts_at` is in the past, newest-first. Group label `"<date> · past"`.
- After sorting, the requested page is sliced, then a second query fetches `thing_edits` rows with `status='pending'` for just that page's ids, to set `pending_edit` per row ([lib/catalogServer.ts:93-99](../../lib/catalogServer.ts#L93-L99)).
- Full field list returned per row (the `SELECT` constant, [lib/catalogServer.ts:44-49](../../lib/catalogServer.ts#L44-L49)): `id, title, blurb, blurb_long, neighborhood, is_21_plus, happening_tier, nearby_zone, price_band, hero_eligible, editorial_weight, photo_url, photo_source, photo_attribution, photo_options, place_id, lat, lng, venue_id, starts_at, thing_tags(tag), recurring_schedules(...)`. Notably **absent**: `source` (the provenance URL), `address`, `category`, `reason_to_go`, `buy_url`, `time_of_day_fit`, `indoor`, `is_featured`, `sponsor_id`, `photo_query` — none of these are fetched or shown here (see §7).
- On a Supabase config/read error, returns an empty result (`{ rows: [], total: 0, ... }`) and logs to console — there is no user-visible distinction between "no results match your filter" and "the read failed" (see §6).

**Schema conflict flag:** `Core Project Files/sbdaymaker_schema.sql` (the doc CLAUDE.md calls the canonical "data contract") defines `things` **without** `photo_options`, `venue_id`, or any `venues`/`venue_photos`/`image_spend`/`image_cache` tables — all of which this page depends on directly. Those were added by separate, later migration files (`20260625_photo_options.sql`, `20260625_images.sql`, `20260709_card_imagery_phase2_venues.sql`), which is the correct source of truth for the current live schema; `sbdaymaker_schema.sql` itself has not been kept in sync.

### API routes

**`GET /api/admin/catalog`** — [route.ts](../../app/api/admin/catalog/route.ts)
- Auth: `getAdminUser()`; 401 if absent.
- Params: `tier` (must be exactly `1`/`2`/`3`, else ignored — no 400 for garbage input), `vibe`, `zone`, `q`, `page`.
- Just forwards to `loadCatalog()` and returns its JSON verbatim. No validation beyond the tier coercion.

**`POST /api/admin/catalog/edit`** — [route.ts](../../app/api/admin/catalog/edit/route.ts)
- Body: `{ thing_id, payload: { title?, blurb?, blurb_long?, neighborhood?, tags? } }`.
- Loads `is_21_plus, price_band, status` for the row; 404 if missing, 400 if `status !== 'published'` ("only published things are editable here").
- Always stamps `last_confirmed = today` (date-only string) on any edit.
- `neighborhood`, if given, is validated against `NEIGHBORHOODS`; anything else silently becomes `null`.
- `tags`, if given, are passed through `filterTags()` (drops off-enum tags, strips `family_day` if `is_21_plus`, strips `free_sb` if not free); if the founder's submitted tag list contained a now-illegal tag, the route returns **400** with `"Tag not allowed for this item: <tag>"` rather than silently dropping it — the UI itself never lets you set an illegal combination (`disabled` toggle buttons, see §3), so this 400 path only fires if the disabled-state logic and this server check ever drift apart.
- Writes: `things` update (patch fields + `last_confirmed`); if `tags` present, a full `delete` + re-`insert` into `thing_tags` (not a diff) with `tag_source: 'founder'`, `confidence: 1.0`.
- **Does not touch `nearby_zone`.** `nearby_zone` is only ever computed once, at ingest time, from `neighborhood`/`lat`/`lng` ([ingest/land.ts:14-23,36](../../ingest/land.ts#L14-L23)). Editing `neighborhood` here can desync `nearby_zone` from the new value — the "Near Me" zone filter/sort and the neighborhood the founder just set can silently disagree after an edit (see §6).
- Audit: one `audit_log` row (`action: 'catalog_edit'`, `actor: 'founder'`, `payload.edits` = only the changed fields).
- Writes go straight to the live row (no review queue) and call `revalidatePublic()` (revalidates `/`, `/discover`, `/saved`, `/discover/[id]`, `/thing/[id]`) — live immediately. The page itself is `force-dynamic` so its own re-fetch doesn't depend on this revalidation.
- No `title`-emptiness enforcement beyond `.trim()` truthiness (an empty/whitespace title is silently skipped rather than rejected — the old title just survives).

**`POST /api/admin/catalog/delete`** — [route.ts](../../app/api/admin/catalog/delete/route.ts)
- Body: `{ thing_id }`. Sets `status = 'archived'` (never a real `DELETE`). One `audit_log` row (`action: 'archive'`, `payload.via: 'catalog_delete'`). `revalidatePublic()`.
- No status-guard (unlike `/edit`, this route doesn't check the row is currently `published` before archiving — archiving an already-archived row is a harmless no-op, so this is inert rather than dangerous, but it's an asymmetry with `/edit`'s explicit guard).

**`POST /api/admin/catalog/photo`** — see §4.

**`POST /api/admin/catalog/venue-photos/fetch`** — see §4.

**`POST /api/admin/catalog/find-more-images`** — see §4 (dead route from this page's perspective).

None of the catalog routes hit the review queue (`thing_edits`) — every write here is a direct, immediate live-row mutation, which is different from the Queue's own approve/reject flow.

---

## 3. UI inventory (screen-by-screen)

Root render: [CatalogView.tsx:137-276](../../app/admin/catalog/CatalogView.tsx#L137-L276), a single component, no sub-routes/tabs of its own (the Catalog **tab** sits inside `CockpitTabs.tsx` alongside the Queue and other admin tabs — [CockpitTabs.tsx:11](../../app/admin/CockpitTabs.tsx#L11): `{ href: "/admin/catalog", label: "Live catalog", showCount: false }`).

### Header
- `<h1>` "Live catalog" (a spare `<span className="count">` sits empty next to it — no count badge is ever put there; the actual live count is shown separately at right: `"{rows.length} of {total} live"`, or `"…"` while `loading`).
- Subhead: static text, "Everything currently published. Edits go back through the Queue; the live version stays up until you re-approve." — **this sentence describes the Queue's overlay-edit behavior, not what this page actually does.** Every edit and delete on this page (§2) applies directly and immediately to the live row; nothing here goes back through the Queue. This is a stale/incorrect copy string, not a behavior bug, but it actively misdescribes the page's own "no review step" design (which the edit sheet's own `.gatebox` text — "Changes apply to the live site immediately — no review step" — correctly states two panels later). The two strings contradict each other on the same screen.

### Filter bar ([CatalogView.tsx:146-165](../../app/admin/catalog/CatalogView.tsx#L146-L165))
- Tier pills: All / Tier 1 / Tier 2 / Tier 3, `role="group" aria-label="Filter by tier"`, each button `aria-pressed`.
- Vibe `<select>`: "All vibes" + the 10 `OCCASIONS`.
- Zone `<select>`: "All zones" + the 6 `ZONES`.
- Search `<input type="search">`: debounced 350ms ([CatalogView.tsx:35](../../app/admin/catalog/CatalogView.tsx#L35)), matches title only (server-side `ilike`).
- Any filter change resets to page 1 and refetches ([CatalogView.tsx:58](../../app/admin/catalog/CatalogView.tsx#L58)).
- No filter-combination validation — all four compose as independent server-side `AND`s.

### Result list
- Grouped by `groupKey`/`groupLabel` from the server, rendered as a running "did the group change" check over the already-sorted page ([CatalogView.tsx:169-207](../../app/admin/catalog/CatalogView.tsx#L169-L207)) — pure client-side header insertion, no client-side re-sort.
- Each row (`.lrow`, 44px-thumb / main / actions 3-col grid):
  - Thumbnail: `photo_url` as an `<img>` if set, else an empty `.lthumb` div (gradient background from CSS, no `alt` text either way — `alt=""` is explicit on the `<img>`, correctly marking it decorative).
  - Title + tier chip (`T1`/`T2`/`T3`, color-coded by CSS class `t{tier}` — colors not verified in this pass beyond class existence).
  - Meta line: `when` (mono, pre-formatted server-side string), zone label, tags (mapped through `OCCASION_BY_KEY` for display labels, raw key if unmapped), price band (`—` if null).
  - Actions: `WeightNudge` (▲/▼, −5..+5, posts to `/api/admin/weight`, optimistic with revert-on-error), a Hero star toggle (`★`/`☆`, posts to `/api/admin/hero-eligible`, **optimistic with no revert-on-error** — the fetch result isn't awaited/checked at all, [CatalogView.tsx:60-68](../../app/admin/catalog/CatalogView.tsx#L60-L68), so a failed hero-flag write leaves the UI silently showing the wrong state until the next full reload), Edit button, Delete button.
  - `pending_edit` (computed server-side, present on every `CatalogRow`) **is never read anywhere in this component** — no badge, no dashed-border class, nothing. The CSS already has a rule for it (`.lrow.pending { border-style: dashed; border-color: var(--gold); }`, [cockpit.css:225](../../app/admin/review/cockpit.css#L225)) but no row ever gets the `pending` class, so that rule is currently unreachable dead CSS on this page. A founder editing a live row here has no visual signal that a separate pending edit for that same thing is sitting in the Queue.

### Pagination ([CatalogView.tsx:209-215](../../app/admin/catalog/CatalogView.tsx#L209-L215))
- Only rendered if `totalPages > 1`. "← Prev" / "Page N of M" / "Next →", both buttons `disabled` at the ends or while `loading`. No page-number jump, no page-size control.

### Empty / loading state
- One shared branch: `rows.length === 0` renders `.covempty` with `"Loading…"` if `loading`, else `"No published things match these filters."` ([CatalogView.tsx:167-168](../../app/admin/catalog/CatalogView.tsx#L167-L168)). There's no visual distinction between "first paint, waiting on the initial server-rendered data" (never happens, since `initial` is server-rendered) and "actively refetching after a filter change" (this DOES show "Loading…", replacing the whole list rather than showing a subtler in-place spinner). There's also no separate error state — a failed `fetch` in `fetchPage()` just leaves `res` as `null` and does nothing ([CatalogView.tsx:52-54](../../app/admin/catalog/CatalogView.tsx#L52-L54)): `loading` still gets set back to `false`, but `rows`/`total`/`page` are never updated, so the view silently keeps showing the previous page's data with no toast, no error banner — a fetch failure is indistinguishable from "nothing changed."

### Edit sheet ([CatalogView.tsx:217-271](../../app/admin/catalog/CatalogView.tsx#L217-L271))
- A modal `.sheet` + `.scrim` overlay, `role="dialog" aria-modal="true" aria-labelledby="ceTitle"`. Opened by "Edit," closed by the `✕` button, the scrim click, Cancel, or `Escape` (global `keydown` listener, [CatalogView.tsx:38-42](../../app/admin/catalog/CatalogView.tsx#L38-L42)).
- No focus trap and no focus management at all: no `autoFocus`, no ref-based focus move into the sheet on open, and no focus restoration to the triggering row's Edit button on close. Tab order can leave the open sheet into the page behind the scrim.
- Contents, top to bottom:
  1. `CatalogImagePicker` (§4).
  2. Title — single-line `<input>`, free text.
  3. Blurb — `<textarea rows={2}>`.
  4. Long blurb — `<textarea rows={3}>`.
  5. Neighborhood — `<select>` of the 11 `NEIGHBORHOODS` + "— none —".
  6. Occasion tag toggles — all 10 `OCCASION_TAGS` as pill buttons, `aria-pressed`. `family_day` is `disabled` when `is_21_plus`; `free_sb` is `disabled` when `price_band` is set and not `"free"` — these mirror `filterTags()`'s server-side rule exactly, so the UI can't produce a combination the server would reject (title on the disabled button explains why).
  7. A static `.gatebox` note: "Changes apply to the live site immediately — no review step. (Start time isn't editable here; to change one, reject & re-ingest in the Queue.)"
  8. Footer: Cancel / "Save changes."
- Not editable here at all: `price_band`, `is_21_plus`, `starts_at`/recurring-schedule fields, `nearby_zone`, `hero_eligible` (that's the row-level star, separate control), `editorial_weight` (same), `photo_source`/photo fields directly (only via the picker widget).
- Save (`submitEdit`, [CatalogView.tsx:100-122](../../app/admin/catalog/CatalogView.tsx#L100-L122)): posts the whole draft (not a diff) to `/edit`. On success, patches local `rows` state directly (no refetch) and shows a toast "Saved — live on the site now."; on failure, shows a toast with the server's `error` message (or a generic fallback) and **leaves the sheet open with the unsaved draft intact** (doesn't close it, doesn't revert anything) — the founder can retry Save without re-typing.
- Toast: single global toast (`.toast`, `role="status"`), auto-dismiss after 3.6s, no stacking (each new toast replaces whatever's showing), no manual dismiss, no undo action ever attached to it (unlike the Queue cockpit's own `.toast .undo` CSS class, which does exist in cockpit.css but is never rendered on this page).
- Delete (`del`, [CatalogView.tsx:125-133](../../app/admin/catalog/CatalogView.tsx#L125-L133)): a native `window.confirm()` (not a themed modal) stating the item will be "unpublished (reversible), not permanently deleted." On success, removes the row from local state and decrements `total`; on failure, a toast with the error.

### Reduced motion / focus-visible
- Global, not catalog-specific: `.sbd-cockpit :focus-visible { outline: 3px solid var(--pacific); ... }` ([cockpit.css:12](../../app/admin/review/cockpit.css#L12)) and `@media (prefers-reduced-motion: reduce) { .sbd-cockpit * { transition: none !important; animation: none !important; } }` ([cockpit.css:210](../../app/admin/review/cockpit.css#L210)) both apply here because `app/admin/layout.tsx` wraps every admin page in `<div className="sbd-cockpit">`. No catalog-specific reduced-motion or focus handling exists beyond that inherited baseline.

### Keyboard
- The only catalog-specific keyboard behavior is `Escape` closing the edit sheet. There is no keyboard shortcut for hero-toggle, edit, delete, or row navigation on this page (the Queue's own cockpit does render a `.herostar .k` kbd-hint span in CSS, but `CatalogView.tsx`'s hero button never renders that span, so no shortcut hint or binding exists here either).

---

## 4. Image subsystem (in-page fetch / review / assign)

This is entirely new/uncommitted code (§1). It is a Live-catalog-specific "follow-up" bolted onto the Card Imagery Phase 2 venue/pool system, per the code's own comments — not part of the original Phase 1 spec.

### Trigger point
- Lives entirely **inside the Edit sheet**, at the top, as the first thing rendered ([CatalogView.tsx:223-235](../../app/admin/catalog/CatalogView.tsx#L223-L235)): `<CatalogImagePicker thingId photoUrl photoSource options venueId placeId lat lng onApplied onVenueAttached onToast />`. There is no per-row fetch action from the list view itself — opening Edit is required to reach it.

### UI shape ([CatalogImagePicker.tsx:204-270](../../app/admin/catalog/CatalogImagePicker.tsx#L204-L270))
- A single `.thumb` slot (the shared `ImagePicker` component, also used by the Queue) — **not a grid or carousel of multiple photos at once.** One photo shown at a time; `‹`/`›` arrows cycle a local `index` through the in-memory `options` array (no network per arrow-click), with an `"{n}/{total}"` counter and a source pill (`google`/`wikimedia`/`pexels`/`owned`/`placeholder`, color-coded by `SOURCE_CLASS` in `ImagePicker.tsx`).
- Below the thumb: two fetch buttons, "Fetch candidates" and "Fetch via Google" (both disabled while `fetching`).
- Conditionally (only if the resolved venue is missing a `place_id` and/or coordinates): an inline "location" panel with `place_id`/lat/lng text inputs, a "Look up automatically" button, and a "Save & fetch" button.
- Below that (if `options.length > 0`): the current option's attribution text (or empty string) and a single commit button, "Use this photo" / "Applying…" / "Currently live" (disabled when the current option is already the live photo).

### Sources, order, and call path
- **"Fetch candidates" → `include_google: false`; "Fetch via Google" → `include_google: true`.** Both POST to `/api/admin/catalog/venue-photos/fetch` — client → this Next.js API route → `lib/venueFetch.ts`'s `fetchCandidatesForVenue()` → the Google/Wikimedia primitives in `ingest/images.ts`. This is a server-mediated call chain, never client → external API directly.
- **This is a different code path than the nightly ingest resolver** (`resolveImages()` in `ingest/images.ts`). The nightly resolver's full priority ladder (image_cache reuse → marquee-venue pin → direct-Google-for-food-venues → Wikimedia → paid Google Place Photo → Pexels → placeholder, per the file's own header comment at [ingest/images.ts:6-18](../../ingest/images.ts#L6-L18)) is **not** what runs when a founder clicks "Fetch" here. The catalog-page fetch only ever runs Wikimedia geosearch (if the venue has lat/lng) and Google Place Photos (if the venue has a place_id, gated as below) — **no Pexels, no marquee-venue pin, no image_cache reuse.**
- Venue attachment happens first, server-side, inside `/venue-photos/fetch` ([route.ts:41-85](../../app/api/admin/catalog/venue-photos/fetch/route.ts#L41-L85)), in this order:
  1. If the thing already has `venue_id`, use that venue.
  2. Else if the thing has a `place_id` that exactly matches an existing **active** venue's `place_id`, attach to that venue (deterministic exact match only — no fuzzy matching at this step).
  3. Else, auto-create a new venue seeded from the thing's own title (slugified, collision-suffixed with the thing id's first 8 chars if needed)/`place_id`/`lat`/`lng` (`radius_m: 150` default).
  - Every attach/create is written back onto `things.venue_id` immediately and logged to `audit_log` (`venue_auto_attached` / `venue_auto_created`).
- Once a venue is resolved, `fetchCandidatesForVenue()` ([lib/venueFetch.ts:35-78](../../lib/venueFetch.ts#L35-L78)):
  - If the venue has lat/lng: Wikimedia geosearch, ranked, top 5.
  - Google Place Photos fire if the venue has a `place_id` **and** (`includeGoogle` was explicitly requested **or** the Wikimedia result count was under `WIKIMEDIA_SUFFICIENT_COUNT = 3`) — so "Fetch candidates" (Wikimedia-only button) can still silently trigger a paid Google call when Wikimedia comes up thin, even though the button's own label doesn't say so.
  - New rows are `upsert`ed into `venue_photos` as **unapproved**, deduped on `(venue_id, stable_ref)` — a repeat fetch is safe (no duplicate rows), though Google's own photo listing is fixed/unpaginated so a re-fetch of an already-fetched venue finds nothing new from Google.
  - The route then returns the venue's **entire current photo set** (approved pool first, then fresh unapproved candidates, [route.ts:93-103](../../app/api/admin/catalog/venue-photos/fetch/route.ts#L93-L103)) as `PhotoOption[]`, each carrying a `venuePhotoId`.
- The picker's `doFetch()` ([CatalogImagePicker.tsx:88-114](../../app/admin/catalog/CatalogImagePicker.tsx#L88-L114)) replaces its whole `options` array with whatever came back and resets `index` to 0 — **only if the response array is non-empty.** An empty result leaves the previously-displayed options (if any) untouched.
- Toast on a non-empty result names the counts, e.g. `"Found 4 photo(s) (3 Wikimedia + 1 Google)"` or `"Found 3 Wikimedia photo(s)"` if Google wasn't fetched. On empty: `"No photos found yet"`, plus `" — add a place_id or coordinates below"` if the venue has neither.

### The orphaned route: `find-more-images`
- [app/api/admin/catalog/find-more-images/route.ts](../../app/api/admin/catalog/find-more-images/route.ts) exists, is a complete, working handler (loads the thing, builds a query via `imageQuery()`, calls `findMoreOptions()` — Pexels + Wikimedia title-search, explicitly no Google, per its own doc comment), and is **never called from anywhere in the Catalog UI.** Grep across `app/admin/catalog/*.tsx` confirms zero references. The live picker instead exclusively uses the venue-photos/fetch path above. This route is reachable only by a direct HTTP call — dead code from the page's perspective.

### Location-fixup sub-flow (only shown when needed)
- If the resolved venue lacks a `place_id` and/or coordinates, an inline panel appears with three text inputs (place_id, lat, lng) plus:
  - **"Look up automatically"** → POSTs `{ venue_id }` to `/api/admin/venues/lookup-place-ids` (single-venue mode). Server does a Google Text Search on `"{display_name}, Santa Barbara, CA"`; if the result reads as a bare/weak address match (`isWeakPlaceMatch`), it also does a tight-radius (75m) Nearby Search for real named POIs at that point. **Writes nothing** — every result is only used to pre-fill the three text inputs (`fillCandidate`) client-side; nothing is saved until the founder clicks Save.
  - **"Save & fetch"** → POSTs the (possibly lookup-filled, possibly hand-typed) place_id/lat/lng to `/api/admin/venues/edit`, then immediately calls `doFetch(false)` again.
  - If the lookup only found a weak/bare-address match, any real nearby POIs found are listed with individual "Use this" buttons that just re-fill the three inputs (still requires a manual "Save & fetch" click after).

### Assign / persist ("Use this photo")
- POSTs to `/api/admin/catalog/photo` with `{ thing_id, url, source, attribution, venue_photo_id? }` ([CatalogImagePicker.tsx:178-202](../../app/admin/catalog/CatalogImagePicker.tsx#L178-L202)).
- Server side ([photo/route.ts](../../app/api/admin/catalog/photo/route.ts)):
  - `source: "placeholder"` (no `url`) explicitly clears the photo back to the branded gradient (`photo_url`/`photo_attribution` set to `null`).
  - If a `venue_photo_id` is present (meaning the picked option came from the venue-photos/fetch path) and that `venue_photos` row isn't already `approved`, the route **also approves it** — sets `approved: true` and appends it to the end of the venue's approved `sort_order`, and logs a separate `audit_log` row (`photo_approved`, `via: "catalog"`). This is what folds the pick into the venue's own compliant, nightly-refreshed pool rather than leaving it a one-off raw URL.
  - The route then read-modify-writes `things.photo_options`, **prepending** the newly-applied option (deduped by URL) onto the row's existing persisted array — this is what lets a later re-open of Edit recognize the live photo as one of its own alternates. Note: the object written here is `{ url, source, attribution }` only — it does **not** carry `venuePhotoId` even when the original pick had one, so the persisted `photo_options` array's shape for that entry differs from what a fresh venue-photos/fetch would have returned.
  - `things.photo_url` / `photo_source` / `photo_attribution` are updated. One `audit_log` row (`photo_set`). `revalidatePublic()` — visible on the live card immediately.
- Client side (`onApplied` → `applyPhoto` in `CatalogView.tsx`): patches both the row list and the (still-open) edit sheet's local state directly — no refetch.
- **Anything fetched-but-not-applied is lost on close.** `doFetch()`'s returned options only ever live in the picker's local React state; nothing is persisted to `things.photo_options` unless "Use this photo" is actually clicked. Closing the sheet after browsing fetched candidates (without applying one) discards them — the next time Edit is opened for that thing, the picker falls back to whatever was in the row's last-persisted `photo_options`, with no memory of the intervening fetch.

### Cost / cap guardrails
- The shared monthly counter (`image_spend.google_calls`, `CAP = process.env.IMAGE_MONTHLY_CALL_CAP ?? 500`, [ingest/images.ts:41](../../ingest/images.ts#L41)) governs Google Place Photo calls everywhere, including this page's fetch path (via `lib/venueFetch.ts:60-66` → `loadSpend`/`saveSpend`/`CAP` imported from `ingest/images.ts`). **A Google Place Photo call from this page IS billed at click time** (real-time HTTP calls to `places.googleapis.com`, not a queued/batched job) whenever the cap isn't already exceeded.
- **Nothing about the cap or remaining budget is surfaced anywhere in the Catalog UI.** `CatalogImagePicker.tsx` never fetches or displays `image_spend`, the cap value, or a remaining-budget count. The founder gets no warning before a "Fetch via Google" click, no running total, and no indication when a fetch silently returned 0 Google results because the cap was already hit that month (the toast in that case just says `"Found 3 Wikimedia photo(s)"` or `"No photos found yet"` — indistinguishable from "this venue genuinely has no Google photos"). `fetchGooglePhotoCandidates()`'s own `hasBudget()` check ([ingest/images.ts:575](../../ingest/images.ts#L575)) fails closed (returns `[]`) with no signal threaded back up about *why*.
- There is no admin-visible cap/spend readout anywhere in the catalog or (as far as this page reaches) the venues tooling reviewed here.

### Loading / empty / error / no-results states
- Fetching: both fetch buttons show `"Fetching…"` and disable; the picker's own `fetching` prop also swaps the "Try fetching a photo" placeholder-state button (only shown when `options.length === 0`) to the same disabled/"Fetching…" state.
- Empty (no options at all yet): the shared `ImagePicker` renders a "no image yet" pill and a single "Try fetching a photo" button in place of the arrows (this reuses the same component/copy as the Queue's picker — see the stale doc-comment note in §6).
- No photos found after a fetch: a toast only (`"No photos found yet"` [+ hint to add place_id/coords]); the thumb itself just keeps showing whatever it was showing before (placeholder, if this was the first fetch).
- Network/parse failure on any of the fetch/lookup/save calls: all four network calls in this component (`doFetch`, `saveLocationAndRefetch`, `doLookupPlaceId`, `useThisPhoto`) `.catch(() => null)` and then check `res?.ok`, surfacing failure only via `onToast?.(res?.error ?? "<generic message>")` — no inline error state in the picker itself, no retry affordance beyond re-clicking the same button.
- Attribution: shown as plain text under the thumb when present (`current?.attribution ?? ""` — silently blank if absent, not hidden).

### Confirm / undo for replacing a live photo
- None. "Use this photo" applies immediately with no confirmation step (unlike Delete, which uses `window.confirm()`). There is no undo affordance in the toast (the toast's own CSS supports an `.undo` link elsewhere in the cockpit, but this flow never renders one) — reverting a bad photo pick means manually cycling back to the previous option (if it's still in `options`) and clicking "Use this photo" again, or clearing to `placeholder` and starting over.

---

## 5. State & behavior

- **Client state model:** all local `useState` in `CatalogView` — no global store, no URL-synced filter state (reloading the page resets filters to defaults; the initial server load always ignores current filter state and fetches page 1 unfiltered, per `page.tsx`).
- **Optimistic vs. refetch, per action:**
  - WeightNudge: optimistic, reverts on failure (has its own component-level revert logic).
  - Hero toggle: optimistic, **no revert on failure** (fire-and-forget fetch, result never checked).
  - Edit save: not optimistic — waits for the server response, then patches local state from the submitted draft (not from what the server actually persisted — though for this route, what's sent is what's saved, filtered tags aside, so this is consistent in practice as long as no tag was rejected).
  - Delete: waits for server response before removing the row from local state.
  - Photo apply: waits for server response before patching local + sheet state.
- **Live-site reflection:** every mutating catalog route (`edit`, `delete`, `photo`) calls `revalidatePublic()`, which revalidates the public homepage/discover/saved/detail routes — changes are visible on the live site essentially immediately, no queue/approval delay, no build step.
- **Confirm dialogs:** only Delete (native `window.confirm`). Nothing else — not photo replace, not tag/neighborhood changes, not Save itself.
- **Known ways the UI can get out of sync with the DB:**
  1. `nearby_zone` staleness after a `neighborhood` edit (§2) — the DB and the row's own "zone" concept can silently disagree post-edit, and the UI has no way to notice or surface this (the row's own zone display, `ZONE_LABEL[r.nearby_zone]`, will keep showing the pre-edit zone).
  2. Hero-flag write failures are invisible (no revert, no error toast) — the toggle can show `★` in the UI while the DB still has `hero_eligible: false` (or vice versa) until the page is reloaded.
  3. Fetched-but-unapplied photo candidates are never persisted (§4) — re-opening Edit after closing without applying loses the fetch.
  4. A failed background refetch (`fetchPage`) after a filter change leaves the visible rows/total from the *previous* filter state with no indication anything went wrong (§3).
  5. `pending_edit` is loaded into every row but never displayed (§3) — a founder can edit-and-save a live row here while an unrelated pending `thing_edits` overlay for the *same* thing sits in the Queue, with nothing on this screen hinting that a second, independent edit path exists for that row.

---

## 6. Known gaps / rough edges

- **Stray/dead files in the working tree:** `app/api/admin/catalog/delete/route 2.ts` (byte-identical dead duplicate, not wired into routing at all) and `app/admin/WeightNudge 2.tsx` (same pattern, unused). These look like editor/merge artifacts, not intentional code.
- **Dead route:** `/api/admin/catalog/find-more-images` is fully implemented but has zero callers in the Catalog UI (§4). Either it's a leftover from an earlier design (before the venue-photos path replaced it) or wiring was never finished.
- **Stale doc comment:** `app/admin/review/ImagePicker.tsx`'s file comment still describes the empty-state fetch button as hitting "the (stubbed) image-fetch route" ([ImagePicker.tsx:11](../../app/admin/review/ImagePicker.tsx#L11)) — that stub reference predates this page's real, non-stubbed, cost-incurring fetch flow (§4) and is now inaccurate for both this page and (presumably) the Queue's own usage of the same component.
- **Contradictory on-screen copy:** the page subhead ("Edits go back through the Queue; the live version stays up until you re-approve") directly contradicts the edit sheet's own gatebox text ("Changes apply to the live site immediately — no review step") and the actual route behavior (§3). A founder reading only the page header would form the wrong mental model of what "Save" does here.
- **`nearby_zone` desync on neighborhood edit** — a real, reproducible data-integrity gap: edit a row's neighborhood here, and `nearby_zone` (used for the public "Near Me" filter/sort) is never recomputed (§2, §5).
- **`pending_edit` is computed and unused** — an extra query (`thing_edits` lookup) runs on every page load for no visible effect (§2, §3, §5).
- **No error state distinct from "empty"** — both the main list and the image picker collapse "request failed" and "genuinely nothing here" into the same UI (§3, §4).
- **Image cost cap is invisible** — no remaining-budget display, no pre-click warning, no distinguishable "capped" vs. "nothing found" outcome anywhere the founder can see (§4). This is the single biggest gap flagged by the prompt's own audit lens: a paid external call can fire from this page with zero cost visibility to the person clicking the button.
- **No focus management in the edit sheet** — no trap, no auto-focus on open, no focus restoration on close (§3).
- **No undo for photo replacement** — only Delete gets a confirm dialog; a bad "Use this photo" click requires manually cycling back (§4).
- **Hero-flag write has no failure handling at all** — the only genuinely fire-and-forget mutation on the page (§5).
- **A11y is otherwise reasonably solid for the built parts** — proper `aria-pressed` on all toggle-style buttons, `role="dialog" aria-modal="true"` + labelled sheet, `role="group"` + `aria-label` on the tier filter and tag-toggle groups, decorative image `alt=""`, global `:focus-visible` styling and `prefers-reduced-motion` handling inherited from the shared cockpit shell — the gaps above are specific holes, not a systemic absence.
- **Hardcoded values:** `PAGE_SIZE = 50`, `WIKIMEDIA_SUFFICIENT_COUNT = 3`, `NEARBY_RADIUS_M = 75`, the default venue `radius_m: 150`, the toast auto-dismiss `3600`ms, the debounce `350`ms — none configurable from the UI (expected for this kind of internal tool, noted for completeness rather than as a defect).
- **Schema/doc drift:** `Core Project Files/sbdaymaker_schema.sql` (nominally canonical per CLAUDE.md) does not reflect the tables/columns this page actually depends on (§1, §2) — anyone reading only that file would not know `venues`, `venue_photos`, `image_spend`, `image_cache`, `photo_options`, or `things.venue_id` exist.

---

## 7. Manual vs. automated surface (automation audit)

### One-row-at-a-time actions, and whether batch exists
Every action on this page is single-row. There is no multi-select, no checkbox column, no "select all + bulk apply" of any kind, for any of: hero-flag toggle, weight nudge, edit (any field), delete/archive, photo fetch, or photo apply. Filtering (tier/vibe/zone/search) is the only thing that operates on more than one row at once, and it only narrows what's *displayed* — it triggers no batch action.

### Editable fields: manually typed vs. pre-filled from ingest
| Field | Editable here? | Where it's first set |
|---|---|---|
| `title` | Yes (free text) | Ingested from source; not AI-touched (`enrich.ts` never rewrites `title`). |
| `blurb` / `blurb_long` | Yes (free text) | AI-drafted at ingest time by `ingest/enrich.ts` (Haiku call, before the row is ever published) — pre-filled into the sheet from the live row's current value, so opening Edit shows the AI's (or a prior founder edit's) copy already in place. |
| `neighborhood` | Yes (dropdown, 11 values) | Set at ingest/geocode time (`ingest/land.ts`). |
| `tags` (occasion tags) | Yes (toggle pills, negative-rule-gated) | AI-proposed at ingest time (`ingest/enrich.ts`'s `applyNegativeRules`), then code-filtered again at publish/edit time by `lib/review.ts`'s `filterTags()`. |
| `nearby_zone` | **No** (display-only) | Computed once at land time from lat/lng or neighborhood (`ingest/land.ts`); an edit to `neighborhood` here does not recompute it (§2, §6). |
| `price_band`, `is_21_plus` | **No** | Set at ingest; no path to change either from this page. |
| `starts_at` / recurring schedule | **No** | Explicitly called out in the sheet's own gatebox text: "reject & re-ingest in the Queue" is the only way to change a time. |
| `hero_eligible` | Yes, but as a separate row-level star toggle, not part of the Edit sheet draft | Defaults `true` at ingest (schema default); founder-toggled thereafter. |
| `editorial_weight` | Yes, via the row-level WeightNudge control, not part of the Edit sheet | Defaults `0`; founder-nudged thereafter. |
| `photo_url` / `photo_source` / `photo_attribution` / `photo_options` | Yes, via the dedicated picker (§4), not free text | Resolved at ingest time by `ingest/images.ts`'s `resolveImages()` (the full free→paid ladder); this page's own fetch (§4) is a narrower, venue-scoped alternative path, not a re-run of that same resolver. |

The fields founders most re-type/re-check, based on what's editable and what commonly needs correction per the code's own guard logic: **occasion tags** (the negative-rule disabling in the UI signals these are the ones that commonly need a human override of the AI's proposal) and **the photo** (the only field with a dedicated multi-step review workflow built around it, implying it's the one the AI/ingest pipeline gets wrong most often in practice).

### What the nightly worker already computes vs. what this page can (re)do in-page
- **Blurb/tag drafting** (`ingest/enrich.ts`, Haiku call): runs only as part of the ingest pipeline (`ingest/run.ts`, invoked as scripts/GitHub Actions). **Not reachable from the Catalog page at all** — there is no "redraft with AI" button here; a founder unhappy with the blurb/tags must hand-edit them in the sheet. `ingest/run.ts` does have a standalone `enrich-backfill` path ([run.ts:63-121](../../ingest/run.ts#L63-L121)) for missing blurbs/tags across published+needs_review rows, but it's a script entry point, not a page-triggerable action.
- **Photo resolution** (`ingest/images.ts`'s `resolveImages()`): same story — the nightly resolver's full ladder (image_cache, marquee pin, direct-Google-for-food, Wikimedia, paid Google, Pexels, placeholder) only runs as part of the ingest scripts. The Catalog page's own "Fetch" buttons (§4) call a *different*, narrower function (`fetchCandidatesForVenue()`) that only does Wikimedia geosearch + Google Place Photos through the venue system — there is no in-page way to trigger the same resolver the nightly worker uses, and no in-page way to force a specific step of that ladder (e.g. "check image_cache again," "try the marquee-venue pin").
- **Geocoding / `nearby_zone` derivation** (`ingest/land.ts`): one-time, at land. No in-page re-run; an edit here can desync it (§2, §6).

### Data the row already carries but the catalog UI never surfaces
`loadCatalog()`'s own `SELECT` (§2) doesn't even fetch: `source` (the provenance URL — useful for "where did this come from" but absent from both the query and the UI), `address`, `category`, `reason_to_go`, `buy_url`, `time_of_day_fit`, `indoor`, `is_featured`, `sponsor_id`, `photo_query` (the debug search-term field from ingest). Of what *is* fetched, `recurring_schedules` is read-only (baked into the `when` mono string, no per-field schedule editor), and `pending_edit` is fetched but literally unused (§3).

### Repeated-motion click paths for common tasks

**Fix a photo (fetch → review → select → apply):**
1. Click "Edit" on the row (opens sheet, loads picker with whatever's currently persisted).
2. Click "Fetch candidates" (or "Fetch via Google") — wait for the network round trip.
3. *(Sometimes)* if the venue lacks a place_id/coords: fill in or "Look up automatically," then "Save & fetch," then wait again.
4. Cycle `‹`/`›` through however many alternates came back to find one worth using.
5. Click "Use this photo."
6. Click "Save changes" (not strictly required for the photo itself — it's already live after step 5 — but the sheet is still open and habitually gets a Save/Cancel close) or close the sheet.
— **5–7 discrete clicks/waits** for the common case, more if the location-fixup sub-flow is needed, and step 2's result is thrown away entirely if the founder backs out before step 5 (§4/§5).

**Fix a wrong occasion tag:**
1. Edit → 2. toggle the tag pill(s) → 3. Save changes. (3 steps; no batch across rows even for a systematic mis-tag affecting many rows of the same category.)

**Correct a wrong event time:**
1. Edit sheet explicitly cannot do this (gatebox text says so) → founder must go to the Queue, reject the row, and re-ingest it from source. Not a click-path within this page at all — a full context switch to a different cockpit screen and a different, heavier workflow (reject + re-run ingest) for what might be a one-character time typo.

### Already-partially-automated-but-left-manual
- Photo fetching is "automated" in the sense that a click triggers real API calls and ranking, but selecting among the results and committing one is 100% manual, one row at a time — there's no "auto-apply the top-ranked option" shortcut here even though the nightly resolver already does exactly that ranking-then-auto-pick for every row at ingest time.
- The venue auto-attach/auto-create logic (§4) is fully automated and invisible to the founder ("venue-backed, invisible to me," per the code's own comment) — the one piece of this subsystem that requires zero manual steps.
- Tag-legality enforcement (`filterTags`) is automated and consistent between client (disabled buttons) and server (400 on violation) — no manual double-checking needed there.
