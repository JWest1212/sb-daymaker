# Section 14 - Recent Activity and Fragility Signals

Commands run (exactly as specified, at commit b9e1b17):

```
git log --since="90 days ago" --pretty=format:"%h %ad %s" --date=short -- app/admin app/cockpit app/api/admin app/api/review
git log --since="90 days ago" --name-only --pretty=format: -- app/admin app/cockpit app/api/admin app/api/review | sort | uniq -c | sort -rn | head -25
```

Framing: these are signals of what is actively evolving (and therefore where a UI change is most likely to collide with in-flight behavior), not a definitive risk assessment.

## 14.1 Recent commits touching the Cockpit scope (all 41 in the window, newest first)

The full output; the Cockpit is 26 days old (first commit e9ea0de "Phase 8: nightly enrichment pipeline + admin cockpit", 2026-06-23) and has been reworked at high frequency ever since:

```
b9e1b17 2026-07-18 feat(elevation-v1): Gate 3 (Navigation, Search & IA)
3651506 2026-07-18 feat(elevation-v1): Gate 1 (Trust Infrastructure) + Gate 2 (Findability/SEO)
a835e4b 2026-07-18 feat(elevation-v1): Gate 0 - Stop the Bleeding (trust-critical fixes)
86178fe 2026-07-18 feat(data-arch): generic AI extraction lane (Doc 25) + dedup upgrade with canonical event identity (Doc 26)
c39a8c6 2026-07-16 feat(data-arch): Queue confidence display + reclaimed-time metrics (Doc 24 Phase 4)
c9a3457 2026-07-15 feat(data-arch): sources-as-data, parity dedupe, health baselines, alerts + cockpit management (Doc 23)
81f706b 2026-07-15 feat(data-arch): recurring rhythms table, Occasion tags (Rainy Day + Dog Friendly), Place-8 search wiring
c70884b 2026-07-14 feat(coverage): Neighborhood Sweep - venue dictionary, resolver, triage cockpit
b01bb01 2026-07-11 feat(queue): wire the image-fetch stub to the real free resolver
ff36452 2026-07-11 feat(images-desk): coverage accelerators - locate, pool-build, Google-all, bulk motif
b32ba90 2026-07-11 feat(cockpit): Images desk - image-assignment backlog worker
ce61f30 2026-07-11 feat(venues): a11y + governance sweep (V-13 through V-16)
7932cda 2026-07-10 feat(venues): pool + linkage management (V-7, V-8, V-9, V-11, V-12)
9f89041 2026-07-10 feat(venues): no-match catcher (V-1 through V-6)
67472c2 2026-07-10 feat(cockpit): Live Catalog bulk actions
91d057b 2026-07-10 feat(cockpit): queued re-enrich directive (batch-AI-only)
9a839d8 2026-07-10 feat(cockpit): live-catalog photo workflow (Apply best + Undo, Search wider)
5bffc41 2026-07-10 feat(cockpit): image budget visibility, honest free/paid photo split
5b8fec3 2026-07-10 fix(images): complete Card Imagery Phase 2/3 wiring; cockpit Phase 1 fixes
e2e56ff 2026-07-10 feat(admin): venues tab, catalog image picker, motif visuals
bda461b 2026-07-08 feat(edition): move drafter to 6am PT, remove collapse/expand from cockpit panels
85c7a16 2026-07-08 feat(edition): move drafter to 7am PT the day before, not 7pm the night before
aefd0be 2026-07-08 feat(edition): Reset to draft action in the cockpit
51dc5a5 2026-07-08 feat(edition): approving an overdue held edition sends it immediately
095953f 2026-07-07 fix(edition): Hold actually stops the send; draft/approved both still send
921484f 2026-07-07 fix(edition): hold never blocks editing or sending; remove the rollout gate
1179b2a 2026-07-07 fix(edition): swap left stale title/blurb in the editor fields
a601513 2026-07-07 feat(edition): cockpit blurb fixes, hero blurb_long, guaranteed images/blurbs, AI-assisted editing
2e66673 2026-07-07 feat(edition): reader edition digest - drafter, renderer, cockpit, image pipeline, send path
9c71185 2026-07-04 feat(wave-2): feed quality - editorial weight, tag rules, image variety
caa7302 2026-07-02 feat(cockpit): Cockpit v2 admin redesign (Queue · Coverage · Catalog · Hero) + live-hero override
2fa6da8 2026-06-30 feat(ingest): Wave 4 - 4 adapters (seatgeek, newVic, sbcountyArts, allevents)
c60b620 2026-06-30 feat(ingest): Wave 3 - 7 new adapters (nightlife rhythms, outdoor operators, arts venues)
9133f4f 2026-06-30 feat(ingest): Wave 2 data source expansion - 11 new adapters
c34d7f1 2026-06-30 feat(ingest): Wave 1 data source expansion - 5 new adapters + cockpit polish
6eedcf8 2026-06-25 Cockpit fixes: persist image pick on Save; revalidate public pages on approve/edit/reject
fed1a50 2026-06-25 Phase 12: inline editing in the cockpit (blurb, long blurb, neighborhood, tags)
b7f44e9 2026-06-25 Phase 12 fix: 'view source' links to the full source URL, not the bare host
bcbbff7 2026-06-25 Phase 12: review cockpit at /admin/review (prioritized queue, trust chips, image picker)
e9ea0de 2026-06-23 Phase 8: nightly enrichment pipeline + admin cockpit
```

(Original commit subjects contain em-dashes; they are reproduced here with hyphens per the spec's house style. The hashes are exact for anyone needing the originals.)

## 14.2 Churn table (touch count per file, top 25; the count-39 blank line is the format's group separator)

| Touches | File |
|---|---|
| 16 | app/admin/review/cockpit.css |
| 10 | app/admin/review/ReviewQueue.tsx |
| 9 | app/admin/review/ReviewCard.tsx |
| 9 | app/admin/edition-draft/EditionDraftView.tsx |
| 7 | app/admin/venues/VenuesView.tsx |
| 7 | app/admin/catalog/CatalogView.tsx |
| 6 | app/admin/review/SourceHealth.tsx |
| 6 | app/admin/coverage/CoverageView.tsx |
| 6 | app/admin/CockpitTabs.tsx |
| 5 | app/api/review/approve/route.ts |
| 5 | app/api/admin/editions/[id]/route.ts |
| 4 | app/api/admin/venues/photos/remove/route.ts |
| 4 | app/api/admin/venues/edit/route.ts |
| 4 | app/api/admin/editions/[id]/swap/route.ts |
| 4 | app/api/admin/catalog/edit/route.ts |
| 4 | app/admin/review/ImagePicker.tsx |
| 4 | app/admin/coverage/page.tsx |
| 4 | app/admin/catalog/CatalogImagePicker.tsx |
| 3 | app/api/review/reject/route.ts |
| 3 | app/api/admin/venues/photos/reorder/route.ts |
| 3 | app/api/admin/images/ack/route.ts |
| 3 | app/api/admin/editions/[id]/picks/[pickId]/route.ts |
| 3 | app/api/admin/editions/[id]/picks/[pickId]/image/route.ts |
| 3 | app/api/review/image-fetch/route.ts |

## 14.3 Reading the signals [INFERRED throughout]

- cockpit.css (16 touches) is the single hottest file: every feature wave appends style blocks to it. It is now a 664-line append-only stylesheet with section banners; a restyle will touch every feature's history at once.
- The Queue trio (ReviewQueue/ReviewCard/approve route) churns constantly AND is the operator's core daily path - the highest-risk place to break something silently.
- The edition module went through a rapid fix cycle (four "fix(edition)" commits in two days around Hold/send semantics). The current "Hold is the one thing that stops it" copy encodes hard-won behavior; treat that flow's wording and status logic as freshly stabilized, not incidental.
- The Venues/Images/Catalog imagery stack landed in one intense week (07-08..07-11) and shares helpers across three screens; changes to one picker likely affect the other two.
- Everything here is at most four weeks old. There is no "settled legacy" layer except app/cockpit/*; assume any screen may still be evolving and check git blame before assuming intent.
