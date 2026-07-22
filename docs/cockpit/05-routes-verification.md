# Section 6 - Route Verification

Census re-derived fresh at the end of Phase B (commands: `find app/admin app/cockpit -name "page.tsx"` and `find app/api/admin app/api/review -name "route.ts"`).

## 6.1 Fresh counts vs Sections 1 and 5

- Pages: 13 page.tsx files found. Section 1's census table lists 13 rows; Section 5 documents 13 screens (SCR-01..SCR-13). MATCH. (Note the 13th "page" is app/cockpit/page.tsx, a UI-less redirect, documented as SCR-13.)
- API routes: 60 route.ts files found (55 under app/api/admin, 5 under app/api/review). Section 1 assigns API-01..API-60; 07-api-backend.md documents all 60. MATCH.
- The full fresh page list is identical to Section 1.3's table (verified path-by-path; no additions or removals since Phase A).

## 6.2 Routes with no documented screen

None. Every page.tsx maps to a SCR id, every route.ts to an API id.

## 6.3 Cockpit-related files not wired into any route (dead / in-progress / orphaned)

| File | Status | Evidence |
|---|---|---|
| app/cockpit/ReviewCard.tsx | ORPHANED (legacy Phase-8 review card) | grep: no file imports it; the only historical renderer, app/cockpit/page.tsx, is now a pure redirect |
| app/cockpit/actions.ts | LEGACY, reachable only from the orphan | grep: its sole importer is app/cockpit/ReviewCard.tsx. Its four server actions (approveThing, rejectThing, runPipeline, signOut) are compiled and callable but no live UI invokes them. Consequence: the live console has no sign-out control at all (signOut exists but nothing renders it) |
| app/admin/TabStub.tsx | DORMANT scaffolding | grep: no importers. Kept per its own comment ("Placeholder view for a cockpit tab whose build lands in a later phase.") |
| lib/pipeline.ts (runNightly) | LEGACY in-app pipeline | still imported by app/cockpit/actions.ts and app/api/cron/nightly/route.ts; the real ingest now runs in GitHub Actions (see 07-api-backend.md background jobs) |
| components/ui/FeaturedLabel.tsx | Out of scope in practice | untracked new file in the shared ui directory; not exported by components/ui/index.ts, imported by no scoped file |

## 6.4 Count reconciliation statement

Census (Section 1): 13 pages + 60 API routes. Screen inventory (Section 5): 13 screens. Endpoint inventory (Section 8): 60 endpoints. No discrepancies. The only asymmetries are intentional and labeled: SCR-13 renders nothing (redirect), and SCR-12 (/cockpit/login) is the single unauthenticated page.
