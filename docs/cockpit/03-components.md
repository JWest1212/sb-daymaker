# Section 4 - Component Inventory

Scope rule used: a component is in scope if its file is imported, directly or transitively, by any scoped route. Every entry carries a mandatory sharedness flag. "Cockpit-only" means no file outside the Section 1 scope imports it (verified by grep).

## 4.1 Shell components

### CMP-01 CockpitTabs - app/admin/CockpitTabs.tsx (Cockpit-only, client)

The topbar + tab strip rendered by app/admin/layout.tsx on every /admin/* screen. Doc comment: "Cockpit v2 shell chrome: pacific-dark topbar + the four-tab strip. Tabs are real routes (deep-linkable, back-button works). Counts are the latest-run snapshot from the server layout, they refresh on navigation."

- Props: `counts: { queue: number; dropped: number; down: number }` (no defaults).
- Renders the brand ("SB Daymaker" with gold "SB", kicker "Cockpit"), three stat blocks (labels "In queue", "Dropped", "Source down"), and eight tabs from a hardcoded TABS array (lines 8-17): Queue (/admin/review, the only tab with a count bubble), Coverage, Live catalog, Hero plan, Edition draft, Venues, Images, Flags.
- Active state: `pathname === t.href || pathname.startsWith(t.href + "/")` sets aria-selected, so Coverage stays lit on its three sub-screens.
- Accessibility: the strip is `role="tablist" aria-label="Cockpit views"`, each Link `role="tab"` - ARIA tabs semantics on what are actually page links (no keyboard arrow-key tablist behavior is implemented).
- Used by: every SCR-01..SCR-11 via the layout.

### CMP-02 BudgetChip - app/admin/BudgetChip.tsx (Cockpit-only, client)

Cost-visibility chip. Doc comment: "LC-8 / V-10, shared cost-visibility chip: 'used / cap this month', turns amber near the cap. Fetches its own state (no prop threading) so it drops into the catalog picker and the venues fetch panel independently."

- Props: none. Fetches GET /api/admin/image-budget (API-33) once on mount; renders null until (and unless) a numeric response arrives; errors are swallowed (`.catch(() => {})`).
- Copy: `{used}/{cap} Google calls`, title tooltip "Google Places photo calls this month, resets on the 1st". Amber class `is-near` at >= 90% of cap.
- Used by: SCR-06 (via CMP-17 CatalogImagePicker), SCR-09 (VenuesView), SCR-10 (ImagesView).

### CMP-03 WeightNudge - app/admin/WeightNudge.tsx (Cockpit-only, client)

The editorial-weight up/down control. Doc comment (load-bearing for the trust rule): "W2.1c, the compact ▲ n ▼ founder-curation gesture, shared by the Queue's ReviewCard and each Live-catalog row. Posts editorial_weight to /api/admin/weight (metadata-immediate, like the hero flag, no re-review). Optimistic with revert-on-error via the host's toast. This is founder curation the ranker is allowed to read; it is NOT sponsor placement. Keep it a two-second gesture."

- Props: `thingId: string; title: string; weight: number; onToast?: (msg: string) => void`.
- Behavior: clamps to [-5, +5] (line 25), optimistic setWeight then POST /api/admin/weight (API-55); on failure reverts and toasts "Weight change failed, reverted"; on success toasts "▲ Boosted {title}" / "▼ Lowered {title}". Buttons disable at the clamp and while busy. `aria-live="polite"` on the value; aria-labels "Boost {title}" / "Lower {title}"; stopPropagation so the host card's onClick does not fire.
- Used by: SCR-01 (in CMP-06) and SCR-06 (in CMP-16).

### CMP-04 TabStub - app/admin/TabStub.tsx (Cockpit-only, server-compatible)

Placeholder view for future tabs. Doc comment: "Placeholder view for a cockpit tab whose build lands in a later phase. Keeps the tab a real, navigable route so the shell's deep-linking works now."

- Props: `title: string; phase: string; blurb: string`. Copy: a construction emoji, the title, the blurb, and "Arriving in phase {phase}".
- Wired-in status: checked in 05-routes-verification.md (no live page imports it as of this spec's commit; it is dormant scaffolding).

## 4.2 Review-queue components

### CMP-05 ReviewQueue - app/admin/review/ReviewQueue.tsx (Cockpit-only, client, 337 lines)

The whole Queue screen body: state machine, keyboard map, optimistic commit/undo engine, and layout (main column + sidebar). Composes CMP-06, CMP-07 (indirectly), CMP-08, CMP-09, CMP-10, CMP-11.

- Props: `initial: CockpitData` (queue, drops, sources, metrics, merges from lib/reviewServer.ts loadCockpitData()).
- State: queue rows, active index, tier filter ("all" | "1" | "2" | "3"), editingId, per-card drafts (`Record<string, ReviewDraft>`), per-card photo pick index, hero overrides, fetchingId, leavingId, toast, and a `pending` ref of scheduled commits.
- The optimistic commit engine (lines 57-82): `commitAction` removes cards from local state immediately (180ms leave animation), schedules the real POST after `COMMIT_MS = 2600` ms, and shows a toast whose "Undo" cancels the timer and splices the rows back at their original indexes. A `beforeunload` listener flushes pending commits immediately; the fetches use `keepalive: true` so they land during navigation (lines 49-55, 196-201).
- approve() (lines 100-114): one press commits pending edits + hero flag + chosen photo, then publishes via POST /api/review/approve (API-56). Overlay cards (pending edits of live things) send `{ overlay_id, edits, photo, hero_eligible }` and toast "Replaced live"; normal cards send `{ ids: [id], photo, edits, hero_eligible }` and toast "Published".
- reject() (lines 117-126): overlay -> `{ overlay_id, id: edit_of, reason: "founder discard" }`, toast "Discarded edit"; normal -> `{ id, reason: "founder reject" }`, toast "Rejected".
- bulkGreen() (lines 128-134): approves every visible green-chip non-overlay card in one POST; empty case toasts "No green-chip items in this view".
- toggleHero() (lines 137-142): metadata-immediate POST /api/admin/hero-eligible (API-31), comment "Hero flag is metadata-only and applies immediately (no re-review, §1.7)". Toasts "★ Hero-flagged {title}" / "Removed hero flag".
- tryFetch() (lines 183-194): POST /api/review/image-fetch (API-57), folds returned options into the card, toasts the server message or "No image available yet.".
- Keyboard map (lines 203-234), the fastest operator path in the product; the handler ignores keys while focus is in INPUT/TEXTAREA/SELECT:
  - Browse mode: ArrowDown/ArrowUp move the active card; A approve; E edit; H hero toggle; R reject; B bulk-approve green.
  - Edit mode: ArrowLeft/ArrowRight cycle photo options; Escape or E exits edit (draft kept); A approves (commits + publishes); H toggles hero; R is deliberately withheld (comment: "R is withheld so a mis-key can't reject a card you're actively editing").
- Empty state (queue cleared): sun emoji, "Queue cleared", "Nothing left to review. The next batch lands tomorrow at 2 a.m."
- Sidebar shortcut legend copy: "A Approve, commits edits + publishes", "E Edit in place (title · blurb · tags · photo)", "H Toggle ★ Hero flag", "R Reject", "↑↓ Move between cards", "B Bulk-approve green chips".
- Digest strip at top: "Latest run", "{n} in queue · {n} dropped ({breakdown})", plus a red "{sources} down" flag when any source status is "fail".

### CMP-06 ReviewCard - app/admin/review/ReviewCard.tsx (Cockpit-only, client, 276 lines)

One queue card, browse and edit modes. Distinct from the orphaned legacy CMP-28 of the same name.

- Props: `item: QueueRow; active; editing; hero; pickIndex; fetching; draft: ReviewDraft | null; leaving` plus callbacks `onAct(kind: "approve" | "edit" | "reject" | "hero"); onCycle; onTryFetch; onSelect; onDraftChange; onToggleTag; onToast?`.
- Variants/states: `is-active` (pacific ring), `is-editing` (gold ring), `leaving` (fade/slide out), `is-overlay` (gold border + kicker "✎ Founder edit of a live thing, the live version stays up until you approve").
- Tier badge labels (lines 12-14): "TIER 1 · EVENT", "TIER 2 · RECURRING", "TIER 3 · PLACE".
- Trust chip row: chip label from lib/review.ts chipLabel() ("Deterministic start" / "Confirm cadence" / "Evergreen") + the pre-formatted mono `when` string; provenance line from provenance() (lines 62-70): tier 3 -> "Place record, no start time to verify"; dated -> "Start from {host}"; else "Recurring, confirm cadence"; with "view source ↗" link only when the source is a real http(s) URL (comment warns a bare host would resolve to /admin/<host>).
- Confidence row: "{n}% confidence" badge tiered by confidenceTier() (>= .85 high, >= .35 mid, else low) plus plain-language confidence_reasons joined with " · ".
- Edit mode: title input (aria-label "Title"), Blurb textarea, Long blurb textarea, Neighborhood select (option "&mdash; none &mdash;" rendered as ", none, " with values from NEIGHBORHOODS), occasion-tag toggle buttons (aria-pressed, with negative rules disabling family_day when is_21_plus and free_sb when price_band is non-free; disabled tooltip "Not allowed for this item"). The start time is NOT editable; the lock note reads: "🔒 Start time is locked, reject & re-ingest to change it."
- Pending-edit banner: "Edited: {list} · press A to commit & publish" (gold, dashed border).
- Action buttons: "Approve & publish" / "Approve & replace live" (overlay), "Edit" / "Done editing", "Reject" / "Discard edit", each with its key hint rendered as a kbd-style span (A / E / R). Right-side status text: "◂ ▸ cycle images" (editing) / "✓ trusted source" (green) / "⚠ needs a glance" (amber) / "place".
- Registry-candidate cards render RegistrySnippetPanel instead of the action row (lines 19-55): label "REGISTRY RHYTHM, copy these details into Recurring Rhythms, then reject this card" (links to /admin/coverage/recurring-rhythms in a new tab), a pre block with the paste-ready snippet, buttons "Copy snippet" (-> "Copied!" for 2.5s) and "Dismiss (reject after copying) R".
- Notable logic: display values prefer the pending draft over the stored row (lines 99-110); the changes[] diff (lines 113-122) drives the banner; photo swaps count as a change when pickIndex > 0.

### CMP-07 ImagePicker - app/admin/review/ImagePicker.tsx (Cockpit-only, client)

Edit-mode image slot. Doc comment: "Edit-mode image slot: arrow through pre-fetched alternates (no network per arrow). Empty until photo_options is filled, then it shows a one-tap 'Try fetching a photo' that hits the real, cost-incurring image-fetch route (Wikimedia free, Google Places billed, see lib/images budget; Pexels retired Phase 3 §6.2)."

- Props: `options: PhotoOption[]; index: number; onCycle(dir); onTryFetch(); fetching: boolean`.
- With options: prev/next round buttons (aria-labels "Previous image option"/"Next image option"), counter "{i+1}/{n}", source pill. Without: pill "no image yet" + button "Try fetching a photo" -> "Fetching…" while busy.
- Used by: CMP-06 (edit mode only). Note SCR-06's picker is a different component (CMP-17).

### CMP-08 SourceHealth - app/admin/review/SourceHealth.tsx (Cockpit-only, server-compatible)

Sidebar panel "Source health": one row per source, latest run, dot colored by status. Copy per row: "0, down" (fail), "refresh" (warn = ok but landed 0), "{landed} new" (ok). Empty state: "No runs yet." Contains the LABEL map of 30+ source keys to display names (Ticketmaster API, SOhO ticketing, ..., LiveNotes SB) at lines 3-46; a new ingest source key not in this map renders as its raw key.

### CMP-09 DroppedPanel - app/admin/review/DroppedPanel.tsx (Cockpit-only, server-compatible)

Sidebar panel "Dropped tonight {n}": each pipeline-dropped candidate with reason (REASON_LABEL map: no_start "no deterministic start", no_title "no title", no_address "no navigable address", no_source "no source", duplicate "duplicate"), optional detail, and an external link "Compare →" (duplicates) or "Review manually →" (other reasons) when source_url is a real URL. Empty: "Nothing dropped in the latest run." Untitled rows: "(untitled candidate)".

### CMP-10 MergedPanel - app/admin/review/MergedPanel.tsx (Cockpit-only, client)

Sidebar panel "Merged events {n}", the dedupe un-merge surface. Doc comment: "Data Arch Redesign 26 Phase 5, the founder's 'un-merge' surface. Each row is a dedupe merge dedupeVenueAware() made: the dropped candidate was archived and pointed at its survivor instead of discarded, so a wrong call is reversible."

- Per row: title, "MERGED into "{survivorTitle}"", button "Un-merge →" (-> "Un-merging…"). POST /api/admin/dedupe/unmerge (API-19); success removes the row and toasts "Un-merged "{title}", back in the review queue"; failure toasts "Un-merge failed for "{title}"". Empty: "No merges to review." Local rows state seeded from props (does not refetch).

### CMP-11 ConfidenceMetrics - app/admin/review/ConfidenceMetrics.tsx (Cockpit-only, server-compatible)

Sidebar panel "Time reclaimed" (Doc 24 §4 "measure the win"). Rows: "Auto-published (all-time)", "You approved by hand", "Auto-publish rate" ({n}%), always-shown "Held back (below floor)" and "In your queue right now". No-data state: "No approvals recorded yet, check back after your queue moves."

## 4.3 Coverage components

### CMP-12 CoverageView - app/admin/coverage/CoverageView.tsx (Cockpit-only, client, 287 lines)

The Coverage heatmap screen body. Props: `initial: CoverageResult; noZoneCount: number; sourceHealth: SourceHealthItem[]`.

- State: active dimension ("vibe" | "zone") with per-dimension result cache; floor toggle (default on); selected cell + its item list; restock modal state (row, window, when); directives list; toast.
- Grid: rows are vibes or zones, columns are the four COVERAGE_WINDOWS (7/14/30/45 days, labels "next 7d" etc. from WIN_LABEL). Cell shading comes from shadeColumn() in lib/coverage.ts (relative within a column, "deep" variants at the extremes) with the absolute-floor override when the checkbox is on. Each cell is a real button with a computed aria-label like "Downtown, next 7d: 2 occurrences (below floor)".
- Cell click -> GET /api/admin/coverage/cell (API-09) and a drilldown panel listing each thing (tier pill, title, "{n}x" occurrence count, when).
- "↻ Restock" per row opens the modal (role="dialog" aria-modal, title "Restock"): window select, two radios "Queue for tonight's run" (description: "The 2 a.m. pipeline targets this gap across the full source catalogue. Results land in tomorrow's review queue. No new cost path.") and "Run now" (description: "Dispatches the ingest worker on demand (~10-20 min) via a fresh pass across all sources. Real API spend, use it for urgent gaps; the nightly queue is free."), the gate box ("Everything found passes the same gate as the nightly run, deterministic start-time required, dedupe against the DB, category + zone checks, and arrives in your review queue. Nothing goes live without your approval."), footer "Cancel" / "Queue restock" or "Run now". Confirm POSTs /api/admin/restock (API-42); toasts: "Running now: {label}, fresh candidates land in the queue in ~10-20 min." / "Run-now dispatch failed ({error}). Queued for tonight instead." / "Queued restock: {label}" / "Restock failed: {error}".
- Sidebar: "Restock directives {n}" (from GET /api/admin/restock/list, API-41; status pill queued/running/done/fail; empty copy "No directives yet. Use ↻ Restock on a thin row.") and "Source health {n} flagged" (server-loaded; per row "{last} last · baseline {expected} · {n} empty in a row · last ok {date}" or "· never run"; empty "No sources yet.").
- Keyboard: Escape closes the restock modal first, then the drilldown (lines 69-78). No other keys.
- Legend copy: "thin, restock" / "okay" / "stocked" / "shading is relative within each column" / checkbox "Absolute floor (7d<3 · 14d<5 · 30d<8 · 45d<10 always red)".
- Loading states: "Loading coverage…" while switching dimension; "Loading…" in the drilldown. Empty drilldown: "Nothing scheduled here in this window, this is exactly what Restock is for. Use the ↻ button on the {label} row to queue a targeted fetch for tonight."

### CMP-13 SourcesView - app/admin/coverage/sources/SourcesView.tsx (Cockpit-only, client, 218 lines)

Source-registry management table. Props: `initialSources: SourceRow[]` (from lib/sourcesServer.ts loadSources()).

- Table columns: Source (label + mono key), Lane (+ parse_method), Authority (2dp), "Yield (last / baseline)", "Empty streak", Status pill (active=done/candidate=q/paused=run/retired=fail via statusBadgeClass), and per-row actions: Edit; Pause (active) or Activate/Resume (candidate/paused); Retire (any non-retired). Inactive rows get class rr-inactive-row (50% opacity).
- Status changes PATCH /api/admin/coverage/sources/[key] (API-17); success toast: "{label} → {status}. Next nightly run picks this up, no deploy needed."
- Add/edit sheet (role="dialog"): fields Key (add only; hint "stable machine id, matches a future adapter's key", placeholder "e.g. sbNewVenue"), Label, URL, "Authority (0-1, how much dedupe trusts this source)", Lane (add only: structured/generic/render) or "Crawl frequency (data only for now, per-source scheduling isn't wired into the pipeline yet)" (nightly/weekly/reserve), Notes (edit only). Client-side validation toasts: "Authority must be a number between 0 and 1." / "Label is required." / "Key is required.". Save POSTs API-18 (add: "Added {label} as a candidate.") or PATCHes API-17 ("Saved {label}.").
- Page intro copy documents the contract: "...Adding a candidate registers it for tracking; it does not start fetching on its own until a code adapter (or a future generic extraction lane) exists for that key."
- No keyboard shortcuts (Escape does not close this sheet - unlike CMP-12's modal).

### CMP-14 NeighborhoodSweepView - app/admin/coverage/neighborhood-sweep/NeighborhoodSweepView.tsx (Cockpit-only, client, 335 lines)

Three-step zone-hygiene desk. Props: `initialSummary: SweepSummary; initialDictionary: DictionaryEntry[]` (page runs runNeighborhoodSweep({ dry: true }) server-side on every load).

- Step 1 "Measure the gap": stat tiles (resolved / "unresolved → triage" / auto-resolve rate % / "$0 API cost (no geocoding)"), a per-method waterfall (METHOD_LABEL map lines 8-16: "Venue dictionary (place ID)", "Venue dictionary (name match)", "Source-implied venue", "Coordinates (in zone)", "Address / street", "Already had a zone", "Unresolved"), and the zone distribution with the two thinnest non-zero zones flagged ("...is the thinnest zone right now, this feeds the source-targeting work, not the sweep, flagged here so it's visible from day one.").
- Actions: "Run sweep (dry run)" (GET API-12, re-computes) and "Apply resolved →" (POST API-10; toast "Applied: {n} things moved out of other/null. {n} still need triage."; failure "Apply failed, check the console.").
- Step 2 "Place the residue" - triage queue: rows show title, venue/addr/src guesses, either a suggestion ("{confidence} suggested from {method}: {zone pill}") or "No signal found, no venue match, no source hint, no coordinates, no street match."; one-tap zone chips (CHIP_LABEL: Downtown, Funk Zone, Waterfront, The Mesa, Mission/Riviera, Uptown, Goleta/IV, Montecito+, Regional / Online) POST API-13; assigned rows show "✓ Assigned to {zone}.". Display capped at 25 street-suggested + 25 no-suggestion rows: "Showing {n} of {m} still open. Assign a few, then Run sweep again to page through the rest." Empty: "Nothing to triage, every published thing resolved."
- Step 3 "The reusable asset" - venue dictionary table (Venue + "aka" aliases, Zone pill, Source with founder highlighted) plus an add row (input placeholder "Add a venue (e.g. Carpinteria Arts Center)", zone select "Pick a zone", button "Add"/"Adding…") POSTing API-11. The self-heal note: "Self-healing. Once folded into the nightly land step, every new thing gets a zone automatically. A brand-new venue is a one-time add here, then it is solved forever."
- No keyboard shortcuts.

### CMP-15 RecurringRhythmsView - app/admin/coverage/recurring-rhythms/RecurringRhythmsView.tsx (Cockpit-only, client, 255 lines)

Registry of standing weekly/biweekly/monthly happenings. Props: `initialRhythms: RecurringRhythmRow[]`.

- Table: Rhythm (title + "{venue} · {neighborhood}"), When (formatDayTime), Category pill, Active checkbox ("On"/"Off"; toast "{title} is active, next nightly run includes it." / "{title} turned off, next nightly run skips it."), Edit button. Inactive rows dimmed. Empty: "No rhythms yet, add the first one above."
- Add/edit sheet fields: Title, Venue, Address, Neighborhood (NEIGHBORHOODS from lib/review.ts), Category (RECURRING_CATEGORIES), "Reason to go", Frequency (RECUR_FREQUENCIES), Day of week, Start/End time (type=time, disabled by the checkbox "Time not published, show "(time TBD)" instead of guessing"), Source URL, occasion-tag toggles labeled "Tags (leave all off to auto-tag from category)". Validation toast: "Title, venue, address, and source URL are required." Save POST API-15 (new) / PATCH API-14 (edit); toasts "Added {title}." / "Saved {title}."
- This is the destination form for the Queue's registry-snippet flow (CMP-06 RegistrySnippetPanel links here).
- No keyboard shortcuts.


## 4.4 Live-catalog components

### CMP-16 CatalogView - app/admin/catalog/CatalogView.tsx (Cockpit-only, client, 538 lines)

The Live catalog screen body: filterable, paginated list of published things with per-row actions, an edit sheet, and the LC-3 bulk bar. Props: `initial: { rows: CatalogRow[]; total: number; page: number; pageSize: number }`.

- Filters: tier pills (All / Tier 1 / Tier 2 / Tier 3), vibe select ("All vibes" + OCCASIONS), zone select ("All zones" + ZONES), and a debounced (350ms) title search (placeholder "Search titles…", aria-label "Search live things"). Any filter change refetches page 1 from GET /api/admin/catalog (API-07).
- Row: select checkbox (aria-label "Select {title}"), 44px thumb, title + tier chip (T1/T2/T3) + gold "Pending edit in Queue" pill when a thing_edits overlay exists, meta line (when · zone · tags · price), actions: CMP-03 WeightNudge, hero pill (optimistic with revert; toasts "★ Hero-flagged {title}" / "Removed hero flag" / "Hero toggle failed, reverted"), "Edit" (title tooltip "Edit, applies to the live site"), "Delete" (tooltip "Remove from the live site (unpublish)").
- Rows are grouped under date-bucket headers (row.groupLabel, e.g. computed server-side; header renders when groupKey changes).
- Delete: window.confirm - `Remove "{title}" from the live site?\n\nIt will be unpublished (reversible), not permanently deleted.` then POST /api/admin/catalog/delete (API-02); success toast "Removed "{title}" from the site". No Undo on single delete (unlike bulk archive).
- Edit sheet (role="dialog", aria-modal, one of exactly two Cockpit surfaces using the shared focus trap (`useFocusTrap(sheetRef, !!editing)`, line 40; the other is SCR-09's VenueDetailSheet)): CMP-17 photo picker on top, then Title, Blurb, Long blurb, Neighborhood select, occasion tag toggles with the same negative rules as the Queue, and the gate note: "Changes apply to the live site immediately, no review step. (Start time isn't editable here; to change one, reject & re-ingest in the Queue.)" Footer: "Redraft blurb + tags tonight" (left, tooltip "Queues a fresh AI blurb/tags draft for tonight's worker, no AI call now"), "Cancel", "Save changes". Save POSTs /api/admin/catalog/edit (API-03); success toast "Saved, live on the site now." Escape closes the sheet (lines 51-55).
- Redraft POSTs /api/admin/catalog/redraft (API-06); toasts "Queued for tonight's redraft, no AI call now. It'll land in the Queue for review." / "Already queued for tonight's redraft."
- Bulk bar (appears when any row is selected; "Select all {n} on this page" checkbox above the list): "{n} selected", buttons "★ Hero on", "☆ Hero off", "Add tag…", "Remove tag…", "Set weight…", "Redraft tonight", danger "Archive", "Clear". Tag/weight open a sub-row with a select/number input + "Apply". All POST /api/admin/catalog/bulk (API-01) with `{ ids, op, ... }`; ops hero_on/hero_off/add_tag/remove_tag/set_weight/archive/unarchive (redraft goes to API-06 with `{ ids }`). Bulk archive confirms via window.confirm ("Archive {n} thing(s)?\n\nThey'll be unpublished (reversible), not permanently deleted."), then offers toast Undo that POSTs op "unarchive" and restores rows. Add-tag success may report skips: `Added "{tag}" to {n} thing(s), skipped {n} not allowed for it`.
- Selection safety comment (lines 59-62): "LC-3: selection is scoped to what's currently loaded (this page, under the active filter), clear it on every navigation so a stale id can't ride along into a different page/filter and get bulk-acted on unseen."
- Stale-data banner on refresh failure (LC-2): "Couldn't refresh the list. Showing the last results." + "Retry" button; the last-known rows stay visible.
- Pager: "← Prev / Page {n} of {m} / Next →".

### CMP-17 CatalogImagePicker - app/admin/catalog/CatalogImagePicker.tsx (Cockpit-only, client, 347 lines)

The Live catalog's photo tool, wrapping CMP-07 with commit + fetch actions. The file header comment is the authoritative behavior spec: browsing options is free/local; "Use this photo" is the one deliberate commit ("posts straight to /api/admin/catalog/photo and applies to the live row immediately"); the 2026-07-10 addendum routes "Fetch candidates"/"Fetch via Google" through the same venue/pool system as the Venues tab ("so a Google photo picked here still gets the compliant 7-day refresh + dead-photo fallback + digest notification instead of being a raw, never-refreshed URL. The venue itself is never shown as a concept here").

- Props: thingId, photoUrl/photoSource/photoAttribution (current live photo), options, venueId, placeId, lat, lng, and callbacks onApplied, onVenueAttached, onOptionsFetched, onToast.
- Fetch row buttons (cost-explicit labels): "Fetch free candidates (Wikimedia · no cost)", "Fetch via Google (1 paid call · counts to budget)", "Search wider (free)", plus CMP-02 BudgetChip. Fetch POSTs /api/admin/catalog/venue-photos/fetch (API-08); result toasts include "Found {n} photo(s) ({w} Wikimedia + {g} Google)", "Monthly photo budget reached, resets on the 1st, showing Wikimedia results", "Found {n} Wikimedia photo(s)", "No photos found yet, add a place_id or coordinates below". Search-wider POSTs /api/admin/catalog/find-more-images (API-04) and merges deduped-by-URL options ("Found {n} more option(s)" / "No new options found").
- Location prompt (only when the venue lacks place_id/coords): explanatory copy variants (e.g. "No place_id or coordinates on file for this yet, add one to fetch real photos."), inputs Google place_id / Latitude / Longitude (placeholders "ChIJ…", "34.4208", "-119.6982"), buttons "Look up automatically" (POST /api/admin/venues/lookup-place-ids, API-48; notes like "Matched: {name}, {address}. Review, then Save & fetch." or "Only found a bare address match, but here are real nearby places, pick one if it's right:" with per-candidate "Use this") and "Save & fetch" (POST /api/admin/venues/edit, API-47, then re-fetch). Comment: lookup "Pre-fills the manual inputs above rather than saving directly, so a weak/wrong match never lands without Jim seeing it first".
- Commit actions: "Use this photo" (disabled when the shown option is already live, then labeled "Currently live") and "Apply best" (tooltip "Commit the top-ranked option in one click"); both call applyOption() -> POST /api/admin/catalog/photo (API-05) with `{ thing_id, url, source, attribution, venue_photo_id }`, then toast with an Undo that re-posts the previous photo ("Reverted"). Removing (applying a placeholder option) toasts "Photo removed, showing the gradient now".


## 4.5 Hero plan component

### CMP-18 HeroPlanView - app/admin/heroes/HeroPlanView.tsx (Cockpit-only, client, 135 lines)

14-day hero pinboard. Props: `initial: HeroPlan` (lib/heroServer.ts loadHeroPlan()).

- Day cards: date label + "Today" pill; one of three states: pinned ("📌 Pinned", title, "T{tier} · {when}", button "Change pin"), stale pin ("⚠ Pin invalid", title, "no longer valid for this day", button "Clear to Auto"), or auto ("Auto" + the ranker's pick or "no ⭑ candidates this day"; button "Pin a hero" or disabled ", no candidates, ").
- Picker sheet (role="dialog"): "Pin a hero, {day label}"; candidate rows with "Pin" buttons; empty state: "No ⭑ hero-eligible things occur on this day. Flag more things as Hero (in Queue or Catalog), or leave the day on Auto."; footer "Clear pin (back to Auto)" (when pinned) and "Done". Escape closes.
- pin() POST /api/admin/hero-pins (API-32) `{ pin_date, thing_id }`, toast "Hero pinned", then full refresh via GET API-32; unpin() DELETE API-32 `{ pin_date }`, toast "Cleared to Auto"; failures "Pin failed" / "Clear failed".

## 4.6 Edition-draft components

### CMP-19 EditionDraftView - app/admin/edition-draft/EditionDraftView.tsx (Cockpit-only, client, 306 lines)

Weekly-email review desk with two tabs ("Draft reviewer" / "Archive"). Props: `pending: EditionSummary[]; initialDetail: EditionDraftDetail | null`.

- Slot titles (lines 11-13): hero "Hero, The Move", secondary "Secondary", nonevent "Non-event", anchor "Anchor, Always worth it". Status labels: draft "Draft", approved "Approved", skipped "On hold" (comment at lines 14-19: "'skipped' is the DB value (unchanged, avoids a migration) but reads as permanent/terminal, it isn't... the one real effect is that it stops the send").
- No-edition state: "No edition to review right now. The drafter runs Wednesday and Saturday mornings (06:00 PT), a full day before each send. Already-sent or failed editions are in the Archive tab."
- Header: "Edition draft {date} · Thu weekend|Sun week-ahead", plus an edition select when more than one is pending.
- "Draft preview" panel: an iframe of GET /api/admin/editions/[id]/preview (API-24) with a cache-busting nonce bumped after every save (comment lines 62-64).
- "Draft editor" panel: Chrome card (Subject / Preheader / Greeting inputs + "Save chrome" -> PATCH API-25); one card per slot rendering CMP-20; secondaries have ▲▼ reorder ("use ▲▼ to reorder") implemented as two parallel PATCHes of swapped positions (moveSecondary, lines 126-140; toast "Reordered"/"Reorder failed").
- Decision card: "Approve" / note input (placeholder "Note (optional)") / "Hold" / "Reset to draft" -> PATCH API-25 with status approved|skipped|draft. The load-bearing hint copy: "This edition sends automatically at its normal time (07:00 PT on send day) whether or not you approve it, approving is just a note to yourself. Hold is the one thing that stops it: click it and this edition will NOT send until you take it off hold. It stays fully editable either way. If its normal send time has already passed (e.g. it was on hold), clicking Approve sends it right away instead of waiting for the next scheduled window." Approve-past-window toast: "Approved, sent to {n} reader(s) just now" or "Approved, but the send failed: {reason}".
- Archive tab lazy-loads GET /api/admin/editions/archive (API-28) into CMP-23.
- Swap flow opens CMP-21; doSwap POSTs API-27 `{ slot, position, thingId }` ("Swapped"/"Swap failed").
- No Escape handling on its sheets other than SwapPicker's own scrim/Done.

### CMP-20 PickEditor - app/admin/edition-draft/PickEditor.tsx (Cockpit-only, client, 164 lines)

Editor for one edition pick. Props: pick, editionId, saving, onSave, onSwap, onImageSaved, onMoreImagesFound, reorder?.

- Slot-conditional fields (lines 8-10): image editor only for hero/secondary; When+Neighborhood only hero/secondary; "Local's secret (shown only if ~40+ characters)" only hero. Manual picks get a gold inset bar + "manual" chip.
- effectiveBlurb() (lines 20-24) mirrors renderData.ts's blurbSourceFor: hero uses blurb_long ?? blurb; comment: "so the editor always shows what will actually render/send".
- AI edit row: input placeholder `Describe an edit… e.g. "make it warmer" or "mention it's dog-friendly"`, Enter submits, button "Claude edit for me" -> "Asking Claude…" (POST API-20 with `{ instruction, currentBlurb }`; result replaces the blurb field locally and marks dirty; error "Claude edit failed").
- "Save changes" disabled until dirty; onSave PATCHes API-23 with override_* fields.

### CMP-21 SwapPicker - app/admin/edition-draft/SwapPicker.tsx (Cockpit-only, client, 105 lines)

Swap sheet: "Ranked candidates" list (current one marked "current"/disabled "Current") or, once the query is 2+ chars, a 300ms-debounced "Search results" list from GET API-26 (input placeholder "Search all published things…"; "Searching…" / "No matches"). Hero-slot rows preview blurb_long (candidateBlurb mirrors renderData). Empty candidates: "No ranked alternates for this slot, search above for any published thing."

### CMP-22 EditionImageEditor - app/admin/edition-draft/EditionImageEditor.tsx (Cockpit-only, client, 103 lines)

Image slot for hero/secondary picks. MAX_OPTIONS = 10 (comment: "6 guaranteed at draft time + up to 4 more via 'find more'"; "the drafter guarantees 6 real options for every selected pick before the cockpit ever opens (draft.ts's ensureImageOptions)"). Current image (or "No image"), a 6-across option grid (active = gold ring; title = attribution), "Find more options ({n}/10)" (POST API-21), "Paste an image URL" + "Use URL", and "Upload" (file input accepting jpeg/png/webp/gif; POSTs multipart to API-22). Errors render inline ("Failed to set image" / "Couldn't find more options" / "Upload failed").

### CMP-23 ArchiveTable - app/admin/edition-draft/ArchiveTable.tsx (Cockpit-only, client, 38 lines)

Sent/failed editions table: Date / Type (Thu|Sun) / Subject / Status chip (sent=green, failed=amber) / Sent / Opens / Clicks / "View →" link to the public /edition/{date} page for sent rows. States: "Loading…" (rows null) and "No sent or failed editions yet."

## 4.7 Flags component

### CMP-26 FlagsView - app/admin/flags/FlagsView.tsx (Cockpit-only, client, 85 lines)

Header comment: "Elevation v1 · Gate 3 · G3.6, the cockpit Flags view. Lists open visitor corrections, each linking to the flagged thing/guide, with Resolve / Dismiss."

- Props: `initialFlags: FlagRow[]`. Header: "Flags" / "{n} open correction(s) from visitors." Empty: "No open flags. Nothing needs a look right now."
- Card per flag: reason label, target link (new tab) + kind, optional detail text, timestamp (SB-local). Buttons "Resolve" / "Dismiss" POST /api/admin/flags/[id] (API-30) with `{ action }`; success removes the row locally. NOTE: a failed POST is silent - the code only checks res.ok to remove the row and shows no error at all (lines 23-35).
- Styling divergence: this is the one admin view styled by public-app classes (sbd-flags-view / sbd-flag-card in app/components.css lines 6392+), not cockpit.css.


## 4.8 Venues component

### CMP-24 VenuesView - app/admin/venues/VenuesView.tsx (Cockpit-only, client, 944 lines - the largest Cockpit file)

Venue registry + photo-pool curation desk. Props: `initial: VenuesData` (venues with photo pools, match proposals, the no-match catcher list, archived venues). Contains two internal sub-components: PhotoStrip (lines 20-111) and VenueDetailSheet (lines 113-278).

Sections, top to bottom:

1. "Matches to review ({n})" - fuzzy thing-to-venue proposals; row shows tier, address, "proposed: {venue} (score {n})"; buttons "Approve" (POST /api/admin/venues/match, API-49; toast "Attached to {venue}") and "Not a match" (client-side dismiss only, returns next load). Capped at 40 rendered rows (`.slice(0, 40)`, line 612) with no "more" indicator. Empty: "Nothing to review, every published/needs_review thing either has no address, is already attached, or scores no match against a known venue."
2. "No confident match ({n})" - the catcher (comment "Phase 6 (V-1...V-6)"): unattached things "quietly sitting on a motif until you resolve them here." Filters: tier pills, title search, "No address only" checkbox; client-side pagination 40/page. Per row: optional low-confidence guess with one-click "Attach to {venue} (low confidence)"; "Attach to existing…" (venue select + Attach); "Create venue from here…" (name input + "Create & attach", POST /api/admin/venues/create, API-45, with from_thing_id; then auto-runs a place_id lookup for the new venue - a strong match auto-saves via API-47, else note "No confident place_id match, fine-tune it from the venue card below."); "Leave on motif" (POST /api/admin/venues/ack, API-44; comment: "persists via things.no_venue_ack; the row is gone for good"; toast "Left on motif").
3. "Place ID lookup" - bulk lookup for venues missing place_id ("Nothing is saved until you approve a proposed match."). Button "Look up place_ids for venues missing one" POSTs API-48 with {}; toast "{n} strong match(es), {n} weak, {n} with no result". Strong rows: "matched: {name}, {address}" + Approve/Skip. Weak rows: "⚠ weak match, probably just a geocoded address, not a real business", nearby candidates with "Use this", "Use address match", a retry search ("Know the real name? Search again", placeholder "e.g. Santa Barbara Public Library, Santa Barbara CA"), "Skip this venue". No-match footer: "No Google match at all for: {names}."
4. "Venues ({n})" grid + "+ New venue" inline create (POST API-45 name-only). Each vcard button opens VenueDetailSheet.
5. "Dog Friendly checklist ({n} marked)" - searchable checkbox list of all venues, suggested-first sort, saving via API-47 with `{ dog_friendly }`. Copy: "Mark the venues you know allow dogs... A thing at a dog-friendly venue shows under the Dog Friendly door automatically, live, no separate step." plus "{n} suggested below (name or category match)".
6. Collapsible "Show archived venues ({n})" with per-row "Un-archive" (API-47 `{ status: "active" }`).

VenueDetailSheet (wide sheet, role="dialog", focus-trapped via useFocusTrap - one of exactly two focus-trapped Cockpit dialogs, with SCR-06's edit sheet): editor fields Display name / Radius (m) / "Google place_id (needed to fetch Google candidates)" / "Latitude (needed to fetch Wikimedia candidates)" / Longitude; "Save" (API-47) and "Archive venue" behind window.confirm: `Archive "{name}"?\n\nIts attached things keep their venue_id and last photo, they just stop rotating/matching further. Reversible from the archived-venues list.`; lazy-loaded "Attached things ({n})" list (GET /api/admin/venues/[id]/things, API-43) with public links and per-thing "Detach" (POST API-46); then PhotoStrip.

PhotoStrip: "Approved pool ({n})" (target copy: "3-5 is the target pool size") with per-photo reorder ◀▶ (POST API-53) and remove ✕ (POST API-52; V-9 toast "Removed, {n} thing(s) re-picked from the remaining pool"); "Candidates ({n})" with "Fetch free candidates (Wikimedia · no cost)" (disabled without place_id AND lat) and "Fetch via Google (1 paid call · counts to budget)" (disabled without place_id; warning "⚠ "Fetch via Google" is greyed out, this venue has no place_id yet...") both POST API-51; per-candidate Approve (POST API-50) / Reject (API-52); the long cost-explainer note ("'Fetch free candidates' is strictly free (Wikimedia, never expires)... Google returns the same up-to-10 photos every time... each click spends real cap budget..."); CMP-02 BudgetChip.

Keyboard: Escape closes the detail sheet (lines 321-325). Nothing else.

### CMP-25 ImagesView - app/admin/images/ImagesView.tsx (Cockpit-only, client, 892 lines)

The Images desk. Header comment: "the backlog worker for published things without a real photo. Modeled on the Queue's keyboard-first card flow, composing the machinery that already exists: the shared ImagePicker thumb, /api/admin/catalog/photo (apply), /api/admin/venues/match (attach + pool photo), /api/admin/catalog/venue-photos/fetch (paid Google, cap-guarded), and the free Wikimedia prefetch that fills candidate strips in the background."

- Filters: tier pills (All/Events/Recurring/Places), title search, "No address only"; client-side pagination 40/page over the filtered set. Header count "{n} need(s) an image". Cap note when the server scan truncated: "Showing the first 1000 imageless items, work through these and Refresh for more."
- Background prefetch (lines 143-161): for every option-less row on the current page, batched (8 at a time) POSTs to /api/admin/images/prefetch (API-39), at most once per row per session; results also persist server-side.
- Per card: shared CMP-07 thumb; "now: {photo_source|no image}" pill; venue line - attached ("Attached: {venue}" + pool status), suggested ("Likely venue: {name} score {n} · {n} approved photo(s)" with "Attach & use pool photo V" / "Not a match" / "Pick different…"), or "No venue match" with "Attach to a venue…" (venue select); candidate mini-strip (click to select, gold ring; aria-label "Candidate {i} of {n} ({source})"); attribution; action row: "Use selected A", "Search free F", "Google ($) G", "Google auto ($) ⇧G", "Looks right as-is M".
- Bulk actions (toolbar): "▣ Auto-free (page)" (POST /api/admin/images/auto-assign, API-35, for the page; confirm copy: "Strong venue matches attach + use an approved pool photo; otherwise the top Wikimedia result is applied. No paid Google calls. Everything lands in the reviewed strip with one-click revert."); "▣ Auto-free (all {n})" (whole filtered view; chunked 60; per chunk: locate missing place_ids via POST /api/admin/images/locate, API-37, batched 25; prefetch batched 8; then auto-assign; live progress text "Locating {i}/{n}…" / "Searching…" / "Assigning…"; confirm warns "A large backlog can take several minutes, keep the tab open."); "▣ Auto-Google (all $)" (POST /api/admin/images/auto-google, API-36, chunked 60, "Stops hard at the monthly cap, watch the budget chip.", confirm quotes "~1 billable call each ... skipped, never guessed"); "Keep motif (view)" (bulk ack via POST /api/admin/images/ack, API-34, confirm: "Permanently dismiss {n} item(s) in this view as "fine on the motif"? ... Tip: narrow the view first (e.g. Events + "No address only")..."); CMP-02.
- "Venue pools to build {n}" strip: venues shared by >= 2 queue items with zero approved photos, top 15; buttons "Build pool (free)" / "with Google ($)" POST /api/admin/images/pool-build (API-38); success toast "{venue}: pool photo approved · {n} item(s) assigned".
- "Assigned this session {n}" strip: every assignment (manual, venue, auto) with how-label (Venue pool / Wikimedia (auto) / Picked / Google (auto)) and a one-click "Revert" (re-applies the previous photo via API-05, detaches a session-attached venue via API-46, and puts the row back on top; toast "Reverted, back in the queue").
- Empty state: sun emoji, "Nothing left without an image", "Every published item in this view has a real photo, or you've marked it fine as-is."
- Sidebar: "Shortcuts" legend (quoted below), "How this desk works" (7 explanatory rows, including "Google is the only paid step and always an explicit press" and ""Keep motif (view)" is the honest tail: dated events with no address are MEANT to sit on the motif"), and "Queue" stats ("{n} without a real image", "{n} assigned this session", "Catalog coverage: {n}% real images ({n} of {n} published lack one)", "↻ Refresh list").
- Keyboard map (lines 575-598; guarded against field focus): ArrowUp/ArrowDown move cards; ArrowLeft/ArrowRight cycle candidates; A apply selected; W apply top-ranked; V attach suggested venue; F free search; G Google fetch; Shift+G Google auto-apply; M dismiss (ack); Escape closes the attach-venue row.

## 4.9 Login and legacy components

### CMP-27 LoginForm - app/cockpit/login/LoginForm.tsx (Cockpit-only, client, 58 lines)

Email + password form using public-app form classes and the shared Button (components/ui). Calls `supabase.auth.signInWithPassword({ email, password })` via getBrowserSupabase(); on success `router.push("/admin/review")` + refresh; on failure renders the raw Supabase error message in `.sbd-field__error`. Button copy "Sign in" / "Signing in…". Labels "Email" / "Password", both required.

### CMP-28 ReviewCard (LEGACY, ORPHANED) - app/cockpit/ReviewCard.tsx

The Phase-8 review card. Imported by NOTHING (verified by grep across the repo); the only file that ever rendered it was the old /cockpit page, which is now a pure redirect. It imports Tag from @/components/ui, prettify from @/components/explore/derive, and approveThing/rejectThing from app/cockpit/actions.ts. Documented for completeness; treat as dead code. Its server actions in app/cockpit/actions.ts remain live-importable (see 07-api-backend.md): approveThing/rejectThing write things.status + audit_log rows with actor "founder", runPipeline() runs the legacy in-app nightly, signOut() signs out and redirects to /cockpit/login - none of these are referenced by any live screen (the live console has NO logout control).

Shared-with-public components imported by scoped files (not given CMP ids; they are the public design system): components/ui/Button.tsx (login), components/ui/Chip.tsx Tag (orphaned legacy card only), and transitively the rest of the components/ui barrel. components/explore/derive.ts prettify (orphaned legacy card only; note this file is dirty in the working tree).

