# Section 5 - Screen-by-Screen Inventory

Shared shell facts (apply to every SCR-01..SCR-11; not repeated per screen): app/admin/layout.tsx wraps each page in `.sbd-cockpit`, runs the auth gate (redirect to /cockpit/login when signed out), loads the topbar counts via loadCockpitCounts(), and renders CMP-01. The layout is `export const dynamic = "force-dynamic"`, so every admin page is fully dynamic per-request server rendering; there is no ISR and no static caching anywhere in the Cockpit. No Cockpit screen fires analytics: lib/analytics.ts is never imported by scoped files (verified by grep). No Cockpit screen displays end-user PII: the product's only end-user PII (digest subscriber emails, magic-link emails) lives in tables no scoped screen queries; per-screen confirmations below only where a screen touches anything adjacent. Navigation between screens is the tab strip (CMP-01) plus the deep links noted per screen.

## SCR-01 - Review queue - /admin/review

Purpose: the daily triage desk. The operator reviews every pipeline-queued item (status needs_review) and every pending founder edit of a live item, then publishes, edits-and-publishes, or rejects each one; plus quick curation gestures (hero flag, editorial weight, photo choice) and sidebar health monitoring (source health, dropped candidates, merged duplicates, auto-publish metrics).

Rendering files: app/admin/review/page.tsx (server: `loadCockpitData()` then `<ReviewQueue initial={data} />`; metadata title "Review cockpit · SB Daymaker", robots noindex; force-dynamic) -> CMP-05 (ReviewQueue) composing CMP-06 (ReviewCard) x N, CMP-07 (ImagePicker, edit mode), CMP-03 (WeightNudge, per card), sidebar CMP-11, CMP-08, CMP-09, CMP-10.

Key UI elements and copy (all quoted from source, see 03-components.md for full per-component copy):

- Digest strip: "Latest run" / "{n} in queue · {n} dropped ({breakdown})" / red "{source names} down" when sources failed.
- Title row: "Review queue" + live count "{n} item(s)"; filter pills "All / Events / Recurring / Places" (aria-pressed group, mapped to happening_tier 1/2/3); button "▣ Bulk-approve green (B)".
- Cards: see CMP-06 (tier badge, trust chip "Deterministic start"/"Confirm cadence"/"Evergreen", provenance with "view source ↗", confidence badge "{n}% confidence", hero pill "★ Hero H", weight nudge, actions "Approve & publish A" / "Edit E" / "Reject R").
- Toast with "Undo" (2.6s window) after approve/reject/bulk.
- Sidebar panels: "Time reclaimed", "Source health", "Dropped tonight", "Merged events", "Shortcuts".

Canonical states:

- Loading: none exists in code (server component renders complete; no loading.tsx anywhere under app/admin/ - verified by find; client mutations show per-control busy states like "Fetching…", "Un-merging…").
- Empty: "Queue cleared / Nothing left to review. The next batch lands tomorrow at 2 a.m." (ReviewQueue.tsx lines 275-279).
- Error: none exists in code for the page load (no error.tsx under app/admin/; a failed loadCockpitData() surfaces as the Next.js default error page). Mutation errors: approve/reject/bulk POSTs are fire-and-forget - `post()` ignores the response entirely, so a failed publish shows "Published" + Undo and the card silently returns on next visit [the failure is invisible; see 10-observability.md]. Weight nudge and un-merge do check responses and toast failures.

Data-fetch strategy: one server fetch per page load (loadCockpitData(): queue + drops + sources + metrics + merges, service-role). All mutations are client fetches to /api/review/* and /api/admin/*. Updates are optimistic with a 2.6-second undo window (COMMIT_MS) and beforeunload flush with keepalive fetches. No pagination: the whole queue renders at once. No polling; data refreshes only on navigation/reload.

Keyboard interaction map (ReviewQueue.tsx lines 203-234; suppressed while focus is in INPUT/TEXTAREA/SELECT):

| Key | Browse mode | Edit mode |
|---|---|---|
| ArrowDown / ArrowUp | move active card | (inactive) |
| A | approve active card | approve (commits draft + publishes) |
| E | enter edit mode | exit edit mode (draft kept) |
| Escape | (nothing) | exit edit mode (draft kept) |
| H | toggle hero flag | toggle hero flag |
| R | reject active card | deliberately withheld |
| B | bulk-approve green chips | (inactive) |
| ArrowLeft / ArrowRight | (nothing) | cycle photo options |

Analytics: no. PII: none displayed (queue rows are venue/event content; sources are URLs).

Conditional rendering: overlay cards (pending thing_edits) get the gold kicker and different action labels/payloads; registry-candidate cards (isRegistryProposalSource) swap the action row for the copy-snippet panel; tier filter; confidence row only when data_confidence is non-null.

Responsive: two-column grid (1fr 300px) collapses to one column under 900px (sidebar drops below the queue); card image/body grid stacks under 620px; topbar wraps and tab strip becomes horizontally scrollable under 640px (all in cockpit.css).

Accessibility: mixed but deliberate - real buttons throughout, aria-pressed on filter pills/tag toggles/hero pill, aria-live on weight value, role="status" on the toast, aria-labels on image nav; but the card itself is an article with onClick (selection by click has no keyboard equivalent other than arrows), the Undo control is a span with role="button" tabIndex=0 but no keydown handler (Enter/Space do not trigger it), and the ARIA tablist in the shell has no arrow-key behavior.

Navigation: default landing screen after login (LoginForm pushes here) and the /cockpit redirect target; reachable from every screen via the "Queue" tab. Its own outbound links: "view source ↗" (external), registry panel -> /admin/coverage/recurring-rhythms (SCR-05), dropped-panel "Review manually →"/"Compare →" (external).

## SCR-02 - Coverage - /admin/coverage

Purpose: see whether the published Tier 1 + Tier 2 supply is thick enough per vibe (or per zone) over the next 7/14/30/45 days, inspect any cell, and queue or dispatch targeted "restock" ingestion runs for thin rows; secondary: monitor restock directives and per-source health at a glance.

Rendering: app/admin/coverage/page.tsx (server, force-dynamic; Promise.all of loadCoverage("vibe"), countPublishedWithNoZone(), loadSourceHealth()) -> CMP-12.

Key elements/copy: header "Coverage" with deep links "Neighborhood Sweep →" (+ red "{n} no zone" badge when countPublishedWithNoZone() > 0), "Recurring Rhythms →", "Sources →" (+ "{n} flagged" badge); dimension toggle "By vibe" / "By neighborhood"; subtitle "Published Tier 1 + Tier 2 occurrences per window, cumulative from today. Click a cell to see what's in it."; the heatmap, legend, drilldown, restock modal, and two sidebar panels (all copy quoted in CMP-12).

States: loading - initial load is server-rendered; "Loading coverage…" appears only when switching to the not-yet-cached dimension; drilldown shows "Loading…". Empty - the grid always renders (zero cells are red); drilldown empty state quoted in CMP-12; directives "No directives yet..."; sources "No sources yet." Error - none exists in code for page load; client fetch failures leave the cached view (catch -> null) and the restock failure path toasts.

Data-fetch: server fetch on load; client fetches for dimension switch (cached per dimension for the visit), cell drilldown, directives list (on mount and after each restock), restock POST. No polling: a "running" directive only updates its status on manual reload [INFERRED from absence of any interval/subscription].

Keyboard: Escape closes restock modal, then drilldown. Nothing else.

Analytics: no. PII: none.

Conditional rendering: badges only when counts > 0; restock modal; drilldown; floor toggle changes shading only.

Responsive: covlayout collapses under 900px; the grid has min-width 700px inside an overflow-x auto wrapper (horizontal scroll on phones).

Accessibility: cells are real buttons with descriptive aria-labels; modal has role="dialog" aria-modal="true" and aria-labelledby, but no focus trap and no focus restore (the shared useFocusTrap hook is used only by SCR-06's edit sheet and SCR-09's venue detail sheet, not here); scrim click closes.

Navigation: "Coverage" tab; deep links out to SCR-03/04/05; restock lands work in SCR-01's queue later.

## SCR-03 - Sources - /admin/coverage/sources

Purpose: manage the source registry - trust (authority), lane, cadence intent, lifecycle status (candidate/active/paused/retired) - and read per-source health against its own baseline; add new candidate sources without a deploy.

Rendering: app/admin/coverage/sources/page.tsx (server: loadSources()) -> CMP-13.

Copy highlights: intro paragraph (quoted in CMP-13) including the load-bearing caveat that adding a candidate "does not start fetching on its own until a code adapter ... exists for that key"; count heading "{n} source(s)"; button "+ Add a candidate"; table headers Source / Lane / Authority / "Yield (last / baseline)" / "Empty streak" / Status.

States: loading - none exists in code (server-rendered; buttons show busy via disabled). Empty - "No sources yet." table row. Error - none for page load; mutation failures toast ("Update failed: {error}", "Add failed…", "Save failed…").

Data-fetch: server fetch; client refetch of the full list after each save (GET API-18); status PATCHes update local state optimistically-after-response (not optimistic; waits for res.ok).

Keyboard: none (the sheet lacks Escape handling).

Analytics: no. PII: none.

Responsive: table inherits sweep-dtable styles; no dedicated mobile layout (wide table will overflow) [INFERRED from absence of any breakpoint rules for this table].

Accessibility: real table semantics; sheet has dialog roles but no focus trap; labels wrap inputs (implicit association).

Navigation: from SCR-02's "Sources →" link (with flagged badge); back link "← Coverage".

## SCR-04 - Neighborhood Sweep - /admin/coverage/neighborhood-sweep

Purpose: keep every published thing in a real door-zone (so the public "Place" door can see it): run the free zone resolver, apply its confident results, hand-triage the residue with one-tap zone chips, and grow the venue-to-zone dictionary.

Rendering: app/admin/coverage/neighborhood-sweep/page.tsx (server: runNeighborhoodSweep({ dry: true }) + loadVenueDictionary() on every load) -> CMP-14.

Copy: header + intro ("Make sure every published thing lands in a real zone, so nothing that is actually in Santa Barbara falls into "other," where the Place door cannot see it."), buttons "Run sweep (dry run)" / "Apply resolved →", stamp "last run: {time}", the three step sections (full copy in CMP-14).

States: loading - server-rendered; buttons show "Running…" / "Applying…" / "Adding…". Empty - triage: "Nothing to triage, every published thing resolved." Error - none for page load; "Apply failed, check the console." and per-action toasts for client failures.

Data-fetch: page load re-runs the dry sweep server-side (a real computation, not a cached snapshot); client GET re-runs it on demand; apply/triage/dictionary are client POSTs. Triage list is capped at 50 rendered rows (25+25) per pass; the operator is told to re-run to page through.

Keyboard: none.

Analytics: no. PII: none.

Responsive: stat grid 2-col -> 4-col at min-width 560px; otherwise single column flow.

Accessibility: chips are real buttons in a role="group" aria-label="Assign a zone"; add-venue inputs have aria-labels; no dialogs on this screen.

Navigation: from SCR-02 ("Neighborhood Sweep →" with the no-zone badge); back link "← Coverage".

## SCR-05 - Recurring Rhythms - /admin/coverage/recurring-rhythms

Purpose: maintain the recurring-happenings registry (farmers' markets, live-music nights, art walks) that scrapers cannot reliably find; entries feed the nightly pipeline without a code change. Also the paste-destination of SCR-01's registry-snippet cards.

Rendering: app/admin/coverage/recurring-rhythms/page.tsx (server: loadRecurringRhythms()) -> CMP-15.

Copy: intro "The standing weekly / biweekly / monthly happenings the scrapers can't reliably find, farmers' markets, live-music nights, art walks. Add or edit here; the next nightly run picks it up, no code change."; "+ Add a rhythm"; table and sheet copy in CMP-15.

States: loading - none in code beyond busy buttons. Empty - "No rhythms yet, add the first one above." Error - none for page load; toasts for save/toggle failures.

Data-fetch: server fetch; full-list client refetch after save; active toggle waits for response then patches local state.

Keyboard: none.

Analytics: no. PII: none.

Responsive: rr-dayrow fields wrap (flex-wrap, min-width 140px); table has no mobile treatment.

Accessibility: activate checkboxes carry aria-label "Activate/Deactivate {title}"; sheet dialog roles without focus trap; tag toggles aria-pressed.

Navigation: from SCR-02 and from SCR-01's registry panel (new tab); back link "← Coverage".

## SCR-06 - Live catalog - /admin/catalog

Purpose: find and fix anything already published: inline live edits (title/blurbs/neighborhood/tags), photo swaps with cost-explicit fetching, hero flag and editorial weight curation, unpublish (single or bulk), tag/weight bulk operations, and queueing overnight AI redrafts.

Rendering: app/admin/catalog/page.tsx (server: loadCatalog({ page: 1 })) -> CMP-16 composing CMP-17 (in the edit sheet), CMP-07, CMP-03, CMP-02.

Header copy: "Live catalog", count "{shown} of {total} live", subtitle: "Everything currently published. Edits here go live immediately, no review step. To change a start time, reject and re-ingest in the Queue."

States: loading - "Loading…" in the empty slot while a filtered fetch runs; count shows "…". Empty - "No published things match these filters." Error - the LC-2 stale banner ("Couldn't refresh the list. Showing the last results." + Retry) for list refreshes; mutation failures toast; page-load failure has no error boundary (none exists in code).

Data-fetch: server first page; all subsequent filtering/pagination via client GET /api/admin/catalog (API-07). Pagination is real (pageSize from server; pager UI). Hero toggle optimistic-with-revert; edits/photo/bulk wait for response; bulk archive optimistic list removal after response with toast Undo.

Keyboard: Escape closes the edit sheet. No other shortcuts (no arrow nav, no approve-key equivalents).

Analytics: no. PII: none.

Conditional rendering: bulk bar only with a selection; pending-edit pill; location prompt inside the photo picker only when the venue lacks identifiers; pager only when totalPages > 1.

Responsive: rows collapse their action strip to a full-width line under 560px; the sheet is width min(560px, 92vw).

Accessibility: the edit sheet is one of the Cockpit's two focus-trapped dialogs (lib/useFocusTrap.ts; the other is SCR-09's venue detail sheet); checkboxes and selects carry aria-labels; toast Undo is a span with role="button" tabIndex=0 and no key handler (same gap as SCR-01).

Navigation: "Live catalog" tab. Redraft results surface later in SCR-01 (pending-edit overlay cards); "Pending edit in Queue" pill points the operator back to SCR-01.

## SCR-07 - Hero plan - /admin/heroes

Purpose: control the public front page's marquee ("hero") card for each of the next 14 days: pin a specific hero-eligible thing to a day, clear a pin back to the ranker's automatic pick, and spot stale pins.

Rendering: app/admin/heroes/page.tsx (server: loadHeroPlan()) -> CMP-18.

Header copy (contains the trust rule, verbatim): "Pin the marquee card for any day. Unpinned days fall back to the ranker's pick from the ⭑ hero-eligible pool (the ranker never reads sponsor status). Pinning today's card takes effect on the live site's hero right away; pins for future days are saved and go live when that day arrives."

States: loading - none in code (server-rendered; refresh() replaces the plan silently). Empty - per-day "no ⭑ candidates this day" and the picker's empty gatebox (quoted in CMP-18). Error - none for page load; toasts "Pin failed" / "Clear failed".

Data-fetch: server load; after every pin/unpin a full GET refresh of the plan. No polling.

Keyboard: Escape closes the picker sheet. Nothing else.

Analytics: no. PII: none.

Conditional rendering: today ring; stale-pin amber state (a pin whose thing no longer occurs that day); disabled pin button when a day has no candidates.

Responsive: herorail is auto-fill minmax(215px, 1fr) - reflows to fewer columns naturally.

Accessibility: dialog roles without focus trap; day-card status conveyed by emoji+text (not color alone).

Navigation: "Hero plan" tab. Candidates are fed by the ⭑ hero flags set in SCR-01/SCR-06.

## SCR-08 - Edition draft - /admin/edition-draft

Purpose: review and shape the twice-weekly email edition before its automatic send: edit chrome and per-pick copy (with an optional Claude rewrite), choose/upload pick images, reorder secondaries, swap picks, and make the one consequential decision - Hold (blocks the send) vs Approve (a note to self, or an immediate send if the window passed).

Rendering: app/admin/edition-draft/page.tsx (server: loadPendingEditions() + loadEditionDraftDetail() for the first) -> CMP-19 composing CMP-20 (x per pick), CMP-21, CMP-22, CMP-23.

States: loading - archive tab "Loading…"; AI button "Asking Claude…"; save buttons "Saving…". Empty - the no-edition gatebox (quoted in CMP-19); "No sent or failed editions yet." Error - per-action toasts ("Save failed", "Swap failed", "Reorder failed", "Update failed") and inline image/AI errors; none for page load.

Data-fetch: server loads pending list + first detail; everything after is client fetches (detail reload after every save; archive lazy; search debounced 300ms). The preview iframe re-requests API-24 on every nonce bump. No polling.

Keyboard: Enter submits the AI-edit input (PickEditor line 127). No Escape handling, no shortcuts. (The swap sheet closes only via scrim/✕/Done.)

Analytics: no. PII: none displayed. Adjacent fact: the send path (lib/edition/send.ts, triggered by cron or by Approve-past-window) reads digest_subscribers server-side, but no subscriber data reaches this screen.

Conditional rendering: tabs; multi-edition select; slot-conditional fields (CMP-20); Reset-to-draft button only when status != draft; reorder arrows only for secondaries.

Responsive: panels/preview cap at 640px and go full-width under 680px; image option grid 6 -> 3 columns under 560px. The preview iframe is a fixed 2200px tall.

Accessibility: fields use label-wrapped inputs; reorder buttons have aria-labels "Move up"/"Move down"; the preview iframe has a title; sheets lack focus traps.

Navigation: "Edition draft" tab; archive rows link out to the public /edition/{date}.

## SCR-11 - Flags - /admin/flags

Purpose: triage visitor-submitted corrections ("flags") on public content: open each flagged thing/guide, then Resolve (fixed) or Dismiss (not actionable).

Rendering: app/admin/flags/page.tsx (server: loadFlags()) -> CMP-26.

States: loading - none in code. Empty - "No open flags. Nothing needs a look right now." Error - none exists in code: a failed resolve/dismiss shows nothing (button re-enables silently; CMP-26 lines 23-35).

Data-fetch: server load; per-flag POST; local list removal on success. No polling, no pagination.

Keyboard: none.

Analytics: no. PII: none [flags are anonymous; FlagRow carries no submitter identity - see lib/flagsServer.ts in 06-data-architecture.md].

Responsive/styling: uses the public component layer (sbd-flags-view), max-width 720px, no cockpit-specific breakpoints.

Accessibility: semantic ul/li, real buttons, links open in new tabs.

Navigation: "Flags" tab; target links lead to the public site.

## SCR-09 - Venues - /admin/venues

Purpose: curate the venue registry that powers compliant, auto-refreshing imagery and venue-based features: approve fuzzy thing-venue matches, resolve the no-match backlog, bulk-fix missing Google place_ids, maintain each venue's approved photo pool, mark dog-friendly venues, and archive/restore venues.

Rendering: app/admin/venues/page.tsx (server: loadVenuesData()) -> CMP-24.

Intro copy: "Founder-curated venues + photo pools (Card Imagery Phase 2). Approve a fuzzy match to attach a thing to a venue; curate 3-5 approved photos per venue so its events rotate through real, vetted photos instead of a generic auto-pick."

States: loading - none for page load; per-action busy labels ("Fetching…", "Looking up…", "Searching…", sheet attached-things "Loading…"). Empty - per section (quoted in CMP-24). Error - toasts per action ("Attach failed", "Fetch failed", "Save failed", "Lookup failed", "Retry failed", "Create failed", "Restore failed"); none for page load.

Data-fetch: one big server load (every venue + pools + proposals + catcher); full refresh() re-GET (API-54) after nearly every mutation; the detail sheet lazily fetches attached things per open. Catcher pagination is client-side (40/page). "Matches to review" renders at most 40 with no pager.

Keyboard: Escape closes the venue detail sheet. Nothing else.

Analytics: no. PII: none.

Conditional rendering: weak-match panels, location prompts, archived section only when non-empty, dog "suggested" badges.

Responsive: venue grid auto-fill minmax(230px, 1fr); wide sheet min(900px, 94vw); no table layouts.

Accessibility: VenueDetailSheet is focus-trapped (V-14 comment: "unmount (closing) restores focus to the triggering vcard"); photo buttons carry aria-labels ("Move earlier", "Move later", "Remove {source} photo from the approved pool"); source pills spell the source name (comment: "always spelled out (not just a color cue)"); dog rows are label-wrapped checkboxes with explicit aria-labels.

Navigation: "Venues" tab; attached-thing links open the public /thing/{id}; the Images desk (SCR-10) and catalog picker (SCR-06) reuse this screen's venue system and point the operator here for fixes.

## SCR-10 - Images - /admin/images

Purpose: burn down the backlog of published things without a real photo, at three cost tiers: free (Wikimedia prefetch/search, venue pool photos), paid-per-click (Google fetch), and bulk (auto-free, auto-Google, pool builds), with every assignment auditable and revertible within the session.

Rendering: app/admin/images/page.tsx (server: loadImagesDesk()) -> CMP-25 composing CMP-07 and CMP-02.

States: loading - background prefetch spinners per thumb ("Fetching…" on the shared picker); bulk progress text on the button ("Locating {i}/{n}…" etc.); "Refreshing…". Empty - "Nothing left without an image / Every published item in this view has a real photo, or you've marked it fine as-is." Error - toasts per action; "Refresh failed, showing the last loaded list"; none for page load.

Data-fetch: server load (capped at 1000 rows, flagged in UI); client mutations against seven endpoints (API-05 via catalog/photo, API-34..API-39, API-46, API-49, API-47/48 in the Google-fetch fallback chain); background batched prefetch; no polling; manual "↻ Refresh list".

Keyboard: the fullest map after SCR-01 - arrows (cards + candidates), A, W, V, F, G, Shift+G, M, Escape; documented in the on-screen "Shortcuts" panel with exactly the copy quoted in CMP-25.

Analytics: no. PII: none.

Conditional rendering: venue line has three variants (attached/suggested/none); pool-build strip only when targets exist; session strip only after an assignment; cap banner only when scanCapped.

Responsive: uses the standard .wrap two-column layout (sidebar drops below 900px); cards stack under 620px.

Accessibility: candidate thumbs are real buttons with positional aria-labels; confirm dialogs are native window.confirm; toast Undo has the same span-role gap as SCR-01.

Navigation: "Images" tab; failure paths explicitly direct to the Venues tab ("pick the right place from the Venues tab", "add a place_id from the Venues tab").

## SCR-12 - Cockpit login - /cockpit/login

Purpose: the single admin sign-in (email + password via Supabase Auth). There are no other accounts and no self-serve signup/reset in the UI.

Rendering: app/cockpit/login/page.tsx (server shell; metadata title "Cockpit, sign in", robots noindex) -> CMP-27. Copy: eyebrow "SB Daymaker · admin", title "Cockpit", description "Sign in to review and publish content."

States: loading - button "Signing in…". Empty - n/a (a form). Error - the raw Supabase auth error message rendered under the fields (e.g. "Invalid login credentials" [INFERRED - message text comes from Supabase at runtime, not this codebase]).

Data-fetch: none server-side; the sign-in is a client Supabase call that sets auth cookies.

Keyboard: form submit on Enter (native form semantics). No shortcuts.

Analytics: no. PII: this screen handles the OPERATOR's credentials only; no end-user PII.

Conditional rendering: error line only on failure. Responsive: public-app .sbd-public layout, maxWidth 380. Accessibility: label-wrapped inputs with required; real submit button.

Navigation: destination of the admin layout's unauthenticated redirect; on success goes to SCR-01. There is no "forgot password" path and no link back to the public site.

## SCR-13 - Legacy cockpit redirect - /cockpit (LEGACY)

app/cockpit/page.tsx: no UI at all; `redirect("/admin/review")` with force-dynamic (comment: "The Phase-8 cockpit is superseded by the full review cockpit (Phase 12). force-dynamic so the redirect resolves per-request (not collapsed at build, which would bake in the unauthenticated outcome and misroute logged-in users)."). All state questions: n/a (no rendering). Documented so the downstream AI knows /cockpit is a live URL that lands on SCR-01.
