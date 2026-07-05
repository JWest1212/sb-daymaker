# 06 — Crown Jewels (verbatim load-bearing files)

**Repo:** sb-daymaker · **branch:** main · **commit:** caa73028f1fb2bde2f3a50a62a999417ec3e5c65 (`caa7302`) · **snapshot:** 2026-07-03 · **Next.js** 16.2.9 · **React** 19.2.4

Each file below is a **verbatim copy** of a load-bearing source file, preceded by a `/* CROWN JEWEL … */`
header comment describing its role and the audit focus. The criterion for inclusion: *an auditor must read this
exact code.* Original paths are noted in each header. Nothing was edited below the header block.

| Copy | Original path | Role |
|---|---|---|
| `explore.ts` | [lib/explore.ts](../../../lib/explore.ts) | Cascade feed assembly + ranking (trust-rule & determinism focus) |
| `heroServer.ts` | [lib/heroServer.ts](../../../lib/heroServer.ts) | Daily hero pick + never-blank evergreen fallback |
| `things.ts` | [lib/things.ts](../../../lib/things.ts) | Core Supabase query layer for happenings |
| `run.ts` | [ingest/run.ts](../../../ingest/run.ts) | Nightly ingestion orchestrator (GitHub Action entry) |
| `images.ts` | [ingest/images.ts](../../../ingest/images.ts) | Image resolver waterfall + Google Places cost cap |
| `dedupe.ts` | [ingest/dedupe.ts](../../../ingest/dedupe.ts) | Cross-source dedupe |
| `enrich.ts` | [ingest/enrich.ts](../../../ingest/enrich.ts) | Batch AI enrichment — the only Claude call site |
| `SavesProvider.tsx` | [components/saves/SavesProvider.tsx](../../../components/saves/SavesProvider.tsx) | Save/been client module (localStorage `sbd.saves.v1`) |
| `ExploreClient.tsx` | [components/explore/ExploreClient.tsx](../../../components/explore/ExploreClient.tsx) | Explore page client shell + filter state |
| `Hero.tsx` | [components/explore/Hero.tsx](../../../components/explore/Hero.tsx) | Golden-hour hero component |
| `CascadeFeed.tsx` | [components/explore/CascadeFeed.tsx](../../../components/explore/CascadeFeed.tsx) | Three-tier cascade UI + Build-a-day CTA |
| `Card.tsx` | [components/ui/Card.tsx](../../../components/ui/Card.tsx) | Primary happening card primitive |
| `shares.ts` | [lib/shares.ts](../../../lib/shares.ts) | View-only share-link handler (`shared_states`) |
| `review.ts` | [lib/review.ts](../../../lib/review.ts) | Cockpit review-queue logic (pure helpers) |
| `reviewServer.ts` | [lib/reviewServer.ts](../../../lib/reviewServer.ts) | Cockpit server core — admin auth guard + queue/overlay assembly |
| `approve-route.ts` | [app/api/review/approve/route.ts](../../../app/api/review/approve/route.ts) | The single write path to `thing_status='published'` |
| `restock.ts` | [ingest/restock.ts](../../../ingest/restock.ts) | Cockpit coverage/restock directives |
| `SavedClient.tsx` | [components/saved/SavedClient.tsx](../../../components/saved/SavedClient.tsx) | Saved surface — **holds the been-marking regression** (see 05) |
| `pipeline.ts` | [lib/pipeline.ts](../../../lib/pipeline.ts) | Legacy admin-gated pipeline — the one AI-import-reachable request path (see 05, C3) |

**Final set: 19 files.** Expanded past the base list so the copy set covers each specific finding an auditor must
read: `reviewServer.ts` + `approve-route.ts` (the real cockpit write path, per 02), `SavedClient.tsx` (the
been-marking regression, per 05), and `pipeline.ts` (the Constraint-3 AI-reachability nuance, per 05). The
magic-link/opt-in handler lives in [app/api/subscribe/route.ts](../../../app/api/subscribe/route.ts) and the restore page in
[app/r/[token]/page.tsx](../../../app/r/%5Btoken%5D/page.tsx) — small and covered inline in 02, so not copied here.
