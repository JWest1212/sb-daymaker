# SB Daymaker Cockpit - Build Spec Index

Spec v3 - generated from sb_daymaker_cockpit_spec_prompt_v3.md - regenerate by re-running that prompt.

## Metadata (Section 0)

Output of the required commands, run at generation time:

- Generation timestamp (`date -u +"%Y-%m-%dT%H:%M:%SZ"`): `2026-07-20T22:43:29Z`
- Repo root (`git rev-parse --show-toplevel`): `/Users/jameslightbody/Documents/sb-daymaker` (folder name: `sb-daymaker`)
- Branch (`git branch --show-current`): `main`
- Commit (`git rev-parse HEAD` / `--short`): `b9e1b17fa41d03f19ab18c29ed1a7c0912312942` / `b9e1b17`
- Working tree (`git status --porcelain`): DIRTY. 23 modified files and 24 untracked paths exist. Almost all of them are public-app files (the plan engine under lib/plan/, explore components, submit flow) and are OUT of Cockpit scope. Exactly two dirty items fall inside the Cockpit scope defined in Section 1:
  - `components/explore/derive.ts` (modified): imported by the orphaned legacy file app/cockpit/ReviewCard.tsx (and by the public app). This spec describes the working-tree version.
  - `components/ui/FeaturedLabel.tsx` (untracked): lives inside the shared components/ui directory that Cockpit files import from, but it is NOT exported by components/ui/index.ts and no scoped file imports it, so it is out of scope in practice.
  For every other file this spec cites, the working tree matches HEAD. Where this spec describes any in-scope file, it describes the working tree.

## Reading order

1. [01-overview-scope.md](01-overview-scope.md) - what the Cockpit is, the exact scope path list, route census, runtime/dependency/config surface (Sections 1-2)
2. [02-design-system.md](02-design-system.md) - tokens, cockpit.css divergence, hardcode audit (Section 3)
3. [03-components.md](03-components.md) - component inventory with CMP-NN ids (Section 4)
4. [04-screens.md](04-screens.md) - screen-by-screen inventory with SCR-NN ids (Section 5)
5. [05-routes-verification.md](05-routes-verification.md) - fresh route census cross-check (Section 6)
6. [06-data-architecture.md](06-data-architecture.md) - schema, drift flags, ER diagram, read/write matrix (Section 7)
7. [07-api-backend.md](07-api-backend.md) - every endpoint with API-NN ids (Section 8)
8. [08-auth-permissions.md](08-auth-permissions.md) - auth flow and the protection map (Section 9)
9. [09-state-frontend.md](09-state-frontend.md) - state management and client logic (Section 10)
10. [10-observability.md](10-observability.md) - logging, audit, alerting vs silence (Section 11)
11. [11-change-safety.md](11-change-safety.md) - safe-to-restyle vs load-bearing, per screen (Section 12)
12. [12-operator-workflows.md](12-operator-workflows.md) - task inventory and time costs (Section 13)
13. [13-activity-fragility.md](13-activity-fragility.md) - 90-day git churn (Section 14)
14. [14-ux-pain-points.md](14-ux-pain-points.md) - ranked UX debt (Section 15)
15. [15-glossary-questions.md](15-glossary-questions.md) - glossary and open questions (Sections 16-17)
16. [appendix-index.json](appendix-index.json) - machine-readable index of all SCR/CMP/API ids and tables

## Invariants block (read before proposing any change)

These are the rules that must survive any UI/UX redesign. Each is grounded in code cited in the linked section.

1. Trust rule: sponsor status must never influence ranking or selection. lib/explore.ts lines 58-59: "The sort key must NEVER read `is_featured` or `sponsor_id`". The founder curation that IS allowed to affect rank: editorial_weight and hero pins (both sponsor-blind; see 11-change-safety.md). Do not add sponsor-aware sorting to any Cockpit list.
2. `starts_at` is never operator-editable, anywhere in the Cockpit. The Queue's edit mode says "🔒 Start time is locked, reject & re-ingest to change it." (app/admin/review/ReviewCard.tsx line 210) and no edit payload carries a start time (see 11-change-safety.md). Deterministic, source-verified times are the product's core trust mechanic.
3. All Cockpit auth is admin-only. There are no end-user accounts anywhere in the product. The only end-user PII is subscriber emails (table subscribers) plus their unsubscribe tokens; no Cockpit screen displays either (verified per screen in 04-screens.md; only the server-side edition send path reads them).
4. The review queue's keyboard flow (A approve, R reject, E edit, H hero, B bulk-approve, arrow keys to navigate; ArrowLeft/Right cycle photos in edit mode; see SCR-01 in 04-screens.md) is the operator's fastest path; changes that steal focus or intercept those keys break the daily workflow.
5. Every admin API route re-checks auth itself via getAdminUser() from lib/reviewServer.ts. There is no middleware; the layout gate protects pages only. Never assume a new route is protected by default (see 08-auth-permissions.md).
6. Approve/edit/reject paths call revalidatePublic() (lib/reviewServer.ts) to refresh ISR caches; removing those calls silently delays public updates by up to the ISR window.

## Coverage checklist (Appendix B)

Every in-scope source file mapped to the section(s) documenting it. "04" means 04-screens.md, etc.

| File | Documented in |
|---|---|
| app/admin/layout.tsx | 01, 04 (shell), 08 |
| app/admin/CockpitTabs.tsx | 03 (CMP-01), 04 |
| app/admin/BudgetChip.tsx | 03 (CMP-02) |
| app/admin/WeightNudge.tsx | 03 (CMP-03) |
| app/admin/TabStub.tsx | 03 (CMP-04) |
| app/admin/review/page.tsx | 04 (SCR-01) |
| app/admin/review/ReviewQueue.tsx | 03 (CMP-05), 04 |
| app/admin/review/ReviewCard.tsx | 03 (CMP-06), 04 |
| app/admin/review/ImagePicker.tsx | 03 (CMP-07) |
| app/admin/review/SourceHealth.tsx | 03 (CMP-08) |
| app/admin/review/DroppedPanel.tsx | 03 (CMP-09) |
| app/admin/review/MergedPanel.tsx | 03 (CMP-10) |
| app/admin/review/ConfidenceMetrics.tsx | 03 (CMP-11) |
| app/admin/review/cockpit.css | 02 |
| app/admin/coverage/page.tsx | 04 (SCR-02) |
| app/admin/coverage/CoverageView.tsx | 03 (CMP-12), 04 |
| app/admin/coverage/sources/page.tsx | 04 (SCR-03) |
| app/admin/coverage/sources/SourcesView.tsx | 03 (CMP-13), 04 |
| app/admin/coverage/neighborhood-sweep/page.tsx | 04 (SCR-04) |
| app/admin/coverage/neighborhood-sweep/NeighborhoodSweepView.tsx | 03 (CMP-14), 04 |
| app/admin/coverage/recurring-rhythms/page.tsx | 04 (SCR-05) |
| app/admin/coverage/recurring-rhythms/RecurringRhythmsView.tsx | 03 (CMP-15), 04 |
| app/admin/catalog/page.tsx | 04 (SCR-06) |
| app/admin/catalog/CatalogView.tsx | 03 (CMP-16), 04 |
| app/admin/catalog/CatalogImagePicker.tsx | 03 (CMP-17) |
| app/admin/heroes/page.tsx | 04 (SCR-07) |
| app/admin/heroes/HeroPlanView.tsx | 03 (CMP-18), 04 |
| app/admin/edition-draft/page.tsx | 04 (SCR-08) |
| app/admin/edition-draft/EditionDraftView.tsx | 03 (CMP-19), 04 |
| app/admin/edition-draft/PickEditor.tsx | 03 (CMP-20) |
| app/admin/edition-draft/SwapPicker.tsx | 03 (CMP-21) |
| app/admin/edition-draft/EditionImageEditor.tsx | 03 (CMP-22) |
| app/admin/edition-draft/ArchiveTable.tsx | 03 (CMP-23) |
| app/admin/venues/page.tsx | 04 (SCR-09) |
| app/admin/venues/VenuesView.tsx | 03 (CMP-24), 04 |
| app/admin/images/page.tsx | 04 (SCR-10) |
| app/admin/images/ImagesView.tsx | 03 (CMP-25), 04 |
| app/admin/flags/page.tsx | 04 (SCR-11) |
| app/admin/flags/FlagsView.tsx | 03 (CMP-26), 04 |
| app/cockpit/page.tsx | 01, 04 (SCR-13) |
| app/cockpit/login/page.tsx | 04 (SCR-12) |
| app/cockpit/login/LoginForm.tsx | 03 (CMP-27), 04 |
| app/cockpit/actions.ts | 07 (legacy server actions), 08 |
| app/cockpit/ReviewCard.tsx | 03 (CMP-28, orphaned), 05 |
| app/api/admin/** (55 route.ts files) | 07 (API-01..API-55), 08 |
| app/api/review/** (5 route.ts files) | 07 (API-56..API-60), 08 |
| lib/review.ts | 03, 06, 09 |
| lib/reviewServer.ts | 06, 07, 08 |
| lib/sourcesServer.ts | 06, 07 |
| lib/venuesServer.ts | 06, 07 |
| lib/heroServer.ts | 06, 07 |
| lib/imagesServer.ts | 06, 07 |
| lib/flagsServer.ts | 06, 07 |
| lib/coverageServer.ts | 06, 07 |
| lib/coverage.ts | 06, 07 (intentionally summarized: pure grid math shared with public app) |
| lib/catalogServer.ts | 06, 07 |
| lib/neighborhoodSweep.ts | 06, 07 (intentionally summarized: pure helpers) |
| lib/neighborhoodSweepServer.ts | 06, 07 |
| lib/recurringRhythms.ts | 06, 07 (intentionally summarized: pure helpers shared with ingest) |
| lib/recurringRhythmsServer.ts | 06, 07 |
| lib/supabaseAdmin.ts | 01, 08 |
| lib/supabaseServer.ts | 01, 08 |
| lib/supabaseBrowser.ts | 01, 08 |
| lib/pipeline.ts | 07 (legacy, called by app/cockpit/actions.ts + cron) |
| lib/email.ts | 07, 10 (Resend sender used by heartbeat + edition send) |
| lib/useFocusTrap.ts | 03 (shared hook) |
| lib/edition/cockpitTypes.ts | 03, 06 |
| lib/edition/cockpitServer.ts | 06, 07 |
| lib/edition/types.ts | 06 (intentionally summarized: type declarations only) |
| lib/edition/draft.ts | 07 |
| lib/edition/imageHost.ts | 07 |
| lib/edition/imageDiscovery.ts | 07 |
| lib/edition/send.ts | 07 |
| lib/edition/render.ts | 07 (intentionally summarized: email HTML renderer) |
| lib/edition/renderData.ts | 07 (intentionally summarized: render input builder) |
| lib/edition/window.ts | 07 (intentionally summarized: date-window math) |
| lib/venuePool.ts | 07 |
| lib/venueFetch.ts | 07 |
| lib/visualAssignment.ts | 07 (intentionally summarized: shared with nightly pipeline) |
| lib/explore.ts | 07 (intentionally summarized: shared public ranking lib; cockpit uses selected helpers) |
| lib/occasions.ts | 03 (intentionally summarized: shared tag vocabulary) |
| lib/zones.ts | 06 (intentionally summarized: shared zone vocabulary) |
| lib/doorZones.ts | 06 (intentionally summarized: shared zone geometry) |
| lib/geo.ts | 07 (intentionally summarized: pure geometry helpers) |
| lib/slug/ensureSlug.ts | 07 (intentionally summarized: slug generator shared with pipeline) |
| ingest/images.ts | 07 (image waterfall, shared with ingest worker) |
| ingest/marqueeVenues.ts | 07 (intentionally summarized: static venue list) |
| ingest/dedupe.ts | 07 (intentionally summarized: sourceKeyOf helper only) |
| ingest/confidence.ts | 07 (intentionally summarized: confidence scoring shared with worker) |
| packages/shared/types.ts | 06 (intentionally summarized: shared row types) |
| components/ui/* (barrel per components/ui/index.ts) | 03 (shared design-system components) |
| components/explore/derive.ts | 03 (intentionally summarized: only prettify() used, by orphaned legacy file) |
| app/api/cron/nightly/route.ts | 07 (cockpit-adjacent background job) |
| app/api/cron/heartbeat/route.ts | 07 (cockpit-adjacent background job) |
| app/api/cron/reaper/route.ts | 07 (cockpit-adjacent background job) |
| app/api/cron/send-edition/route.ts | 07 (cockpit-adjacent background job) |
