# Section 12 - Change-Safety Map

Purpose: let a UI/UX pass improve the Cockpit without breaking behavior. Two lists per screen. Every load-bearing item cites the file that makes it load-bearing; inferred risks are tagged [INFERRED].

## The product-wide rules first (apply to every screen)

1. Trust rule: sponsor status must never influence ranking. lib/explore.ts lines 58-59: "The sort key must NEVER read `is_featured` or `sponsor_id`, paid placement can never buy rank here." The Cockpit's two ranking inputs that ARE allowed: editorial_weight (WeightNudge.tsx header comment: "This is founder curation the ranker is allowed to read; it is NOT sponsor placement") and hero pins (heroServer.ts getLiveHeroPinId comment: "Deterministic + sponsor-blind (reads hero_pins only, never is_featured/sponsor_id)"). Never add sponsor-aware sorting, badging-that-implies-rank, or a "featured first" toggle to any Cockpit list.
2. The never-editable field: starts_at. No Cockpit surface can edit a start time; the Queue's edit mode shows "🔒 Start time is locked, reject & re-ingest to change it." (ReviewCard.tsx line 210) and the catalog sheet repeats it (CatalogView.tsx line 512). EditPayload (lib/review.ts 146-152) and the catalog edit payload simply have no starts_at field. A redesign that adds a time input would breach the product's core trust mechanic (deterministic, source-verified times).
3. No middleware: every new admin route must carry its own getAdminUser() check (08-auth-permissions.md).
4. House style: repo lint forbids em-dashes in source and content (package.json "check:emdash", scripts/check-emdash.mjs); UI copy proposals must comply.

## SCR-01 Review queue

Safe to restyle: card visual chrome (borders, shadows, tier badge colors, chip colors), sidebar panel styling, digest strip layout, toast appearance, typography, spacing, the Shortcuts legend presentation.

Load-bearing:
- The whole keyboard map and its focus guard (ReviewQueue.tsx 203-234), including R being withheld in edit mode. Any wrapper that focuses inputs, intercepts keys, or portals cards breaks the fastest workflow.
- COMMIT_MS = 2600 undo engine + beforeunload flush + keepalive posts (ReviewQueue.tsx 12, 49-82, 196-201). Changing removal timing or unmount behavior can drop commits.
- Payload field names built in editPayloadFor()/approve() (ReviewQueue.tsx 85-114) matching API-56/API-59/API-60 contracts.
- Tag toggle negative rules and their disabled states (ReviewCard.tsx 226-231, lib/review.ts filterTags).
- Overlay-card semantics: key by overlay_id, distinct labels/payloads ("Approve & replace live" / "Discard edit"), the gold kicker (ReviewCard.tsx 97, 129, 258-266).
- Registry-snippet panel replacing the action row for registry sources (ReviewCard.tsx 251-256): its copy IS the workflow instructions.
- provenance() link rule: only full http(s) URLs are linked (ReviewCard.tsx comment 64-66: a bare host "resolves to /admin/<host>").
- prioritize() ordering and overlays-first prepend (lib/review.ts 257-267, reviewServer.ts 284): "the most-likely-good sit at top" is a designed property, not incidental [comment-cited].
- Audit-logged actions: approve/reject/update/hero/weight all write audit_log; renaming or merging buttons must keep one action = one audit verb [INFERRED risk].

## SCR-02 Coverage

Safe: heatmap cell styling (as long as count text stays Ink per the tokens-file a11y rule), legend, sidebar styling, modal visuals.

Load-bearing: shadeColumn()/COVERAGE_FLOORS semantics and the "shading is relative within each column" legend truth (lib/coverage.ts 39-70); the restock POST body {scope_kind, scope_key, window_days, when} (CoverageView.tsx 97) matching API-42; the modal's tonight-vs-now cost framing copy (real API spend vs free nightly; CoverageView.tsx 264-274) [INFERRED: the copy is the only cost guardrail]; Escape close ordering modal-then-drilldown (69-78).

## SCR-03 Sources

Safe: table styling, badge colors, sheet layout.

Load-bearing: status lifecycle verbs (active/paused/retired/candidate) and their PATCH values (SourcesView.tsx 59-71, API-17); authority 0-1 validation (73-79); the intro's contract copy ("Adding a candidate ... does not start fetching on its own until a code adapter ... exists") which prevents a false mental model [INFERRED]; key immutability (key only settable on create, SourcesView.tsx 172-176).

## SCR-04 Neighborhood Sweep

Safe: stat tiles, waterfall bars, chip styling.

Load-bearing: the dry-run-by-default contract (page load and "Run sweep" are dry; only "Apply resolved →" writes; page.tsx runNeighborhoodSweep({ dry: true })); triage POST body {id, zoneKey, venueName} where venueName is null for "other" (NeighborhoodSweepView.tsx 134-149) - it feeds the self-growing dictionary; the 25+25 render cap with its "Run sweep again to page through" instruction (265-279).

## SCR-05 Recurring Rhythms

Safe: table and sheet styling.

Load-bearing: the timeUnknown checkbox clearing start/end (RecurringRhythmsView.tsx 84, 226-228) - "time TBD" is a first-class product state; the field names in the POST/PATCH payload (85-89) matching API-14/15; active toggle copy tying to the nightly run.

## SCR-06 Live catalog

Safe: row/thumb/pill styling, group header styling, pager styling.

Load-bearing: LC-3 selection clearing on every fetch (CatalogView.tsx 59-63) - a redesign persisting selection across pages reintroduces the exact bulk-action-on-unseen-rows hazard the comment documents; LC-2 stale-not-empty error banner (76-82, 403-408); bulk op names hero_on/hero_off/add_tag/remove_tag/set_weight/archive/unarchive (API-01 contract); the two window.confirm texts (167, 296) and bulk-archive's Undo-via-unarchive (305-318); instant-apply photo semantics in CMP-17 (applyOption + Undo re-post) vs draft-save semantics of the text fields - two different commit models in one sheet, do not visually merge them [INFERRED]; the focus trap (line 40); Escape close (51-55); the gate note about start times (512).

## SCR-07 Hero plan

Safe: day-card styling, pill styling.

Load-bearing: the subtitle's trust sentence ("the ranker never reads sponsor status", HeroPlanView.tsx 47-51); pin/unpin payloads {pin_date, thing_id} (26-40) and server validation (heroServer.ts validatePin); stale-pin state and "Clear to Auto" (73-81) - pins go stale legitimately and the rail is the only surface showing it; same-day pin immediacy (subtitle + getLiveHeroPinId).

## SCR-08 Edition draft

Safe: panel chrome, preview frame styling (height is arbitrary), archive table styling.

Load-bearing: the Decision hint copy (EditionDraftView.tsx 286-289) - it encodes the send contract (sends regardless of Approve; Hold is the only stopper; Approve-past-window sends immediately) that took four fix-commits to stabilize (13-activity-fragility.md); status vocabulary draft/approved/skipped with "On hold" as display label only (comment 14-19: "never compare against this anywhere"); per-pick override_* field names (100-112, API-23); secondary reorder as paired position PATCHes (126-140); the preview nonce reload (62-64, 73); slot-conditional fields in CMP-20 (SHOWS_* maps mirror the renderer); effectiveBlurb() parity with renderData.ts (PickEditor 16-24) - the editor must keep showing what will actually send.

## SCR-09 Venues

Safe: grid card styling, strip/candidate card styling, sheet layout.

Load-bearing: the free-vs-paid fetch split and its disabling logic (PhotoStrip: Wikimedia needs place_id OR lat, Google needs place_id; VenuesView.tsx 62-73) plus the cost-explainer copy (81-87); approve/remove/reorder photo semantics including V-9 reassignment toast (368-379); "Leave on motif" permanence via things.no_venue_ack (comment 502-503) vs "Not a match" being render-only (336-338) - two dismissals with different persistence, keep them visually distinct [INFERRED]; the review-before-write principle in place-id lookup ("Nothing is saved until you approve a proposed match.", 753-755); archive confirm text (232); the focus trap (V-14, 137-140).

## SCR-10 Images

Safe: card/strip/panel styling, shortcut legend presentation.

Load-bearing: the full keyboard map (ImagesView.tsx 575-598); realOptions() scrubbing retired pexels sources (line 56, lib/review.ts dropRetiredPhotoOptions - a Jim-dated content rule); the Google-pays-preselects-Google behavior (306-309 comment "You just paid for Google, pre-select the first Google result so A applies what the press fetched"); the session revert contract (revertAssign 179-198: re-apply prev photo, detach if attached_now, requeue at top); the three confirm dialogs' cost language (372-377, 394-400, 459-464); chunk sizes and sequencing of the bulk loops (409-439: locate 25s, prefetch 8s, assign 60s) [INFERRED: sized to API/rate limits]; STRONG_MATCH_SCORE gate for V-key auto-attach (586-590, lib/review.ts 52-58).

## SCR-11 Flags

Safe: everything visual (it uses public-app classes).

Load-bearing: the resolve/dismiss action values (FlagsView.tsx 23-35, API-30); target links resolving slug-or-id (flagsServer.ts 72). The missing failure feedback is a bug to fix, not behavior to preserve [INFERRED].

## SCR-12 Login / SCR-13 redirect

Safe: form styling. Load-bearing: signInWithPassword + push to /admin/review (LoginForm.tsx 20-27); the redirect target chain (/cockpit -> /admin/review -> /cockpit/login when signed out); do not add public links to /admin paths (robots noindex is the only shielding besides auth).
