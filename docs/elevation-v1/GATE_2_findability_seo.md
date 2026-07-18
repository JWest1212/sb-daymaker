# GATE 2 — Findability (SEO plumbing, the only free growth channel)

`Build: Elevation v1 · Gate 2 of 6 · target: 1–2 sessions · parallelizable with Gate 3`
`Prereq: Gate 1 closed (you want to rank pages that don't disappoint). Slugs depend on quality tiers existing.`

---

## Why this gate exists

The site is built to win exactly the queries it is currently invisible for: "things to do in Santa Barbara this weekend," "gabriel iglesias santa barbara bowl," "free movies santa barbara courthouse," "MOXI hours." Every `/thing` page shares the identical title "Detail — SB Daymaker," there is one sitewide OG image and description, URLs are opaque UUIDs, and there is no Event schema. This gate is zero-to-one on organic discovery and social sharing — cheap plumbing with outsized, compounding payoff. It is pointless before Gate 1 (you'd rank pages that let visitors down), which is why it sits here.

**Read before coding:** Next.js App Router metadata API (`generateMetadata`), `app/thing/[id]/`, `app/discover/[id]/`, `CLAUDE.md` §4 (stack), the `opengraph-image` route already in the tree.

**Decisions locked:** URLs = **full slugs + 301 redirects**; JSON-LD = **Event + Business (LocalBusiness) + Breadcrumb**; per-thing OG images = yes (also in Gate 5's sharing scope).

---

## SCHEMA CHANGES (additive only — Jim applies by hand)

```sql
-- ============================================================================
-- GATE 2 DDL — additive only. Paste into Supabase SQL editor.
-- ============================================================================

-- Slugs for semantic URLs. Unique, stable, human-readable.
alter table things add column if not exists slug text;
alter table guides add column if not exists slug text;

create unique index if not exists things_slug_uidx on things(slug) where slug is not null;
create unique index if not exists guides_slug_uidx on guides(slug) where slug is not null;

-- Redirect map: old UUID paths (and merged-dupe paths) -> canonical slug.
-- Powers 301s so existing links and shares never break.
create table if not exists url_redirects (
  from_path   text primary key,       -- e.g. '/thing/9efd51ca-2d17-5c45-945b-221273ff1b3e'
  to_path     text not null,          -- e.g. '/thing/free-summer-cinema-courthouse'
  created_at  timestamptz not null default now()
);
```

---

## G2.1 — Slug generation + backfill

**Task:**
1. Write `lib/slug/makeSlug.ts` — deterministic: lowercase, strip diacritics, spaces→hyphens, drop stopwords lightly, append a short disambiguator only on collision (e.g. `-fz` or a 4-char hash). Examples: "Free Summer Cinema: Say Anything…" → `free-summer-cinema-courthouse`; "The Lark" → `the-lark`; the two SBMA rows would have collided — the survivor from Gate 0's merge gets `santa-barbara-museum-of-art`.
2. Backfill script `ingest/slugs/backfill.ts`: assign slugs to all `things` and `guides`. For each row, also insert a `url_redirects` row mapping the **old** `/thing/<uuid>` path to the new `/thing/<slug>` path. For Gate 0's archived duplicates, map their UUID path to the survivor's slug.
3. New rows get a slug at publish time (in enrich/publish path), never null when `status='published'`.

**Acceptance test A2.1:** every published thing/guide has a unique slug; the backfill produced a redirect row per old UUID path; slugs are stable across re-runs (idempotent).

---

## G2.2 — Route on slug, 301 the old UUID paths

**Task:**
1. Change `/thing/[id]` and `/discover/[id]` to resolve by **slug first**, falling back to UUID for safety.
2. Add middleware (`middleware.ts`) or a route handler that checks `url_redirects`: if the incoming path matches a `from_path`, issue a **301** to `to_path`. This preserves any shared links, Google's index, and merged-dupe URLs.
3. Canonical `<link rel="canonical">` on every detail page points at the slug URL.

**Acceptance test A2.2:** visiting an old `/thing/<uuid>` 301-redirects to `/thing/<slug>`; the slug URL returns 200 with a self-referential canonical; a merged-dupe UUID redirects to the survivor.

---

## G2.3 — Per-page metadata (`generateMetadata`)

**Evidence:** all 12 sampled `/thing` pages returned the title "Detail — SB Daymaker" and one sitewide description/OG. The guides already prove per-page titles work in this stack ("The Funk Zone — Discover SB — SB Daymaker").

**Task:** Implement `generateMetadata` for `/thing/[slug]` and `/discover/[slug]`:
- **Title:** `<Thing title> — <what/where> — SB Daymaker`, e.g. "Gabriel 'Fluffy' Iglesias at the Santa Barbara Bowl — SB Daymaker"; "Free Summer Cinema at the Courthouse — SB Daymaker."
- **Description:** the thing's real blurb (the what-it-is sentence from Gate 1), truncated ~155 chars — never the sitewide default.
- **OpenGraph + Twitter:** unique title/description + the per-thing OG image (G2.4).
- **Canonical:** the slug URL.
- Homepage, `/discover` index, `/plan`, `/saved` each get their own hand-written title + description (not the shared default).

**Acceptance test A2.3:** five sampled pages each return a unique `<title>` and `<meta name="description">` reflecting their content; none says "Detail — SB Daymaker."

---

## G2.4 — Per-thing dynamic OG images

**Task:** Extend the existing `opengraph-image` route to a **dynamic per-thing** variant (`app/thing/[slug]/opengraph-image.tsx` using Next's `ImageResponse`). Render a branded card: the thing's photo (or motif) as background, title in Fraunces, the key line (price · daypart · zone), and the SB Daymaker mark. Guides get the same treatment. This makes a shared link render a real preview instead of the generic brand card, activating the "share it" loop the tagline promises.
- Respect image rights: if `photo_source='google'`, do **not** bake the Google photo into a cached OG image (ToS + the no-cache rule in `CLAUDE.md`); fall back to a motif-background OG for Google-sourced photos. Owned/wikimedia/pexels are fine to composite.

**Acceptance test A2.4:** pasting a `/thing/<slug>` link into a link-preview tester shows a unique card with the thing's title and details; Google-photo things fall back to a motif OG (no baked Google image).

---

## G2.5 — JSON-LD structured data (Event + LocalBusiness + Breadcrumb)

**Task:** Emit `<script type="application/ld+json">` server-side on detail pages:
- `type='event'` → **Event** schema: `name`, `startDate`/`endDate` (from `starts_at`/`ends_at`), `location` (Place with `address`), `offers` (with `url`=`buy_url`, `price`/`priceCurrency` when known, `availability`), `image`, `description`, `eventStatus`, `organizer`.
- `type='place'` → **LocalBusiness** (or the most specific subtype: `Restaurant`, `Museum`, `BarOrPub`, `TouristAttraction`) with `address`, `geo` (lat/lng), `openingHoursSpecification` (from Gate 1 `hours`), `priceRange`, `image`, `url`.
- Every detail page → **BreadcrumbList** (Home › Explore/Discover › Thing).
- Validate against Google's Rich Results Test structure (correct required fields, ISO 8601 dates, absolute URLs).

**Acceptance test A2.5:** the Event JSON-LD for a sampled event passes structural validation (required fields present, valid dates); the LocalBusiness JSON-LD for a restaurant includes address + hours + priceRange; breadcrumbs present on all detail pages.

---

## G2.6 — SSR the guide stop content (currently client-rendered)

**Evidence:** guide stop bodies show "Click to discover these stops" in the served HTML — your best prose (the chaptered walks, "The Take" rankings, Know-Before-You-Go) is invisible to crawlers.

**Task:** Server-render guide `guide_stops` (label + note + the chapter prose) into the initial HTML for `/discover/[slug]`. Interactivity (tap-to-expand, ✓-Been marking) can hydrate on top, but the text must exist in SSR. This is both an SEO fix and a prerequisite for the guides ranking for "funk zone santa barbara guide" style queries.
- **Note:** the founder is actively reworking guides in a separate project. Coordinate: this task is **SSR-only** (make existing stop content crawlable). Do not restructure guide content or layout — that's the other project's scope. If the guide component is mid-rework, flag and defer rather than colliding.

**Acceptance test A2.6:** View Source on a guide page shows the stop labels and notes in the initial HTML (not just "Click to discover"); no layout/content change beyond SSR.

---

## G2.7 — Sitemap + robots + "this weekend" landing surface

**Task:**
1. Generate `app/sitemap.ts` — all published thing slugs, guide slugs, and the core routes, with `lastModified` from `updated_at`.
2. `robots.txt` allowing crawl, pointing at the sitemap.
3. Ensure the **"This weekend"** view from Gate 4 has a crawlable URL (`/weekend`) with its own metadata targeting "things to do in Santa Barbara this weekend" — the single highest-intent local query. (The filter itself is Gate 4; this note reserves the URL + metadata so both gates align.)

**Acceptance test A2.7:** `/sitemap.xml` lists published slugs with lastmod; `/robots.txt` references it; `/weekend` (once Gate 4 lands) has bespoke metadata.

---

## Gate 2 acceptance summary

- [ ] **A2.1** Unique stable slugs on all published things/guides; redirect rows created; idempotent.
- [ ] **A2.2** Old UUID paths 301 to slugs; slug pages 200 with self canonical; dupes redirect to survivor.
- [ ] **A2.3** Unique per-page titles + descriptions; none is the sitewide default.
- [ ] **A2.4** Dynamic per-thing OG images render; Google-photo things use motif OG.
- [ ] **A2.5** Event + LocalBusiness + Breadcrumb JSON-LD present and structurally valid.
- [ ] **A2.6** Guide stop prose present in SSR HTML; no content restructure.
- [ ] **A2.7** Sitemap + robots live; `/weekend` URL reserved with metadata.

**Definition of done for Gate 2:** every page is uniquely addressable, uniquely titled, richly previewable when shared, and legible to Google's event/business crawlers — turning the one free growth channel from off to on. Coordinate the guide-SSR task with the separate guides project.
