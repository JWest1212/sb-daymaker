# 23 — SB Daymaker Image Surface Inventory

**Status:** read-only research doc. No code, schema, or config was changed to produce this.
**Method:** seven parallel read-only code-search passes over the live repo (2026-07-15), plus one live read-only `SELECT` against the production Supabase DB using the repo's own existing credentials (no new access, no writes). Every claim below is cited `file:line`; where a sub-agent inferred rather than directly read something, that is flagged inline. Line numbers are as of the 2026-07-15 working tree and may drift by a line or two on future edits — re-grep before trusting a citation blindly on a stale checkout.

**Framing note:** the user's own project-file snapshot (`Core Project Files/`) is dated 2026-07-03 and predates several things the live code has already done: Pexels fetch/selection removed, a venue photo-pool ("Scenario D") system added, and a nightly Google resource-name refresh added. Every section below is built from the current code, not the snapshot. Section headers call out the specific deltas where they matter.

---

## 1. Render sites

Every place in the app that renders or resolves an image. **No component anywhere uses `next/image`** — every image in the app is a raw `<img>` tag (confirmed by a zero-hit grep across `app/` and `components/`). No `data:` URIs were found anywhere in the codebase.

| Surface | File:line | Src driver |
|---|---|---|
| Explore hero (skyline illustration) | `components/explore/Hero.tsx:54` | Hardcoded `/public` static asset: `public/hero/sb-skyline.svg`. Comment at `Hero.tsx:48-52`: "hand-styled Santa Barbara skyline… scene colors are baked into the asset by design… untouched, byte-for-byte." |
| PickCard (media band) | `components/ui/Card.tsx:117-119` | `photo` prop ← `thing.photo_url` / `pick.photo_url` DB column. No motif/bigtype fallback — if empty or `onError` fires (`usePhotoFallback`, `Card.tsx:32-36`), it drops to a plain toned `sbd-media--{tone}` div, nothing more. |
| ListCard (108px rail — Cascade feed, Lead-day rail, shared list) | `components/ui/Card.tsx:212-220` | `photo` prop ← `thing.photo_url`, passed by `LeadDayRail.tsx:53`, `CascadeFeed.tsx:128,390,426`, `SharedListView.tsx:44`. Full 3-tier fallback chain — see §5. |
| RockTile (Explore "Month" lead section) | `components/explore/RockTile.tsx:22-25` | Inline CSS `background-image: url(${t.photo_url})`, gated only by `t.photo_url` truthy. **No `onError` recovery** — unlike Card.tsx/DetailPhoto.tsx, a 404 here shows a broken CSS background with no client-side fallback to motif/gradient. |
| Thing/place detail page | `components/detail/DetailPhoto.tsx:17` | `photoUrl` prop ← `t.photo_url`, passed from `app/(app)/thing/[id]/page.tsx:69`. `usePhotoFallback` gates a toned-div fallback only (no motif/bigtype on the detail page). |
| Thing/place detail attribution line | `app/(app)/thing/[id]/page.tsx:70-72` | Not an image itself — renders `t.photo_attribution` text, gated on `photo_url` present, `photo_source !== "owned"`, and `photo_attribution` present. See §7. |
| Discover SB guide card (list) | `components/discover/GuideCard.tsx:8-12` | **No photo at all.** Pure CSS `linear-gradient`, keyed by `--theme`/`--hood` variant class (`app/components.css:4402-4407`) plus a dark scrim overlay (`:4408-4411`). |
| Discover SB "plain" guide hero | `app/(app)/discover/[id]/page.tsx:122-130` | Same gradient-only treatment, reusing the `GuideCard` tint classes. `.sbd-guide-hero` itself (`app/components.css:4513-4522`) carries no background rule of its own. |
| Discover SB "rich" guide sketch plate | `app/(app)/discover/[id]/page.tsx:195-201`, `components/discover/GuideWalkSection.tsx:110,168-198` | Hand-drawn inline `<svg>` neighborhood map, resolved via `getGuideArt(artId)` (`lib/guide-art.ts:74-77`) → `StateStreetSketch.tsx` / `FunkZoneSketch.tsx`. Depicts named real streets/landmarks (State Street, the Funk Zone) — not a generic illustration. If `artId` doesn't resolve: flat gray placeholder box (`GuideWalkSection.tsx:199-201`), not a photo. |
| Explore home doors (Place / Occasion / Activity) | `components/explore/DiscoveryDoors.tsx:47` | `background-image: var(--sbd-door-scrim-${d}), url(${meta.tile})` — `meta.tile` from `DOOR_META` (`DiscoveryDoors.tsx:12,19,26`): `/tiles/door/place.jpg`, `/tiles/door/vibe.jpg`, `/tiles/door/activity.jpg`. **These files do not exist in `/public`** — see §4. |
| Door bottom-sheet tiles | `components/explore/DiscoverySheet.tsx:45` | Same pattern per tile: `tile.image` from `lib/tiles.ts:27,48,57` → `/tiles/place/{zone}.jpg`, `/tiles/vibe/{occasion}.jpg`, `/tiles/activity/{key}.jpg`. Same missing-file caveat. |
| Passport stamp | `app/(app)/discover/[id]/page.tsx:257-283` | **Not an image.** `guide.stamp_code` renders as plain text (`sbd-gd-stampslot__code`); progress bar hardcoded `width: "0%"`. Comment: "static in Phase 2." No stamp graphic exists anywhere in the codebase. |
| Shared plan page | `app/p/[token]/SharedPlanView.tsx:122-131` | `<img src={s.photo_url}>` per stop, sourced from `Thing.photo_url` at plan-creation time (`components/plan/PlanResults.tsx:125`). No fallback beyond a null-check → plain toned div. |
| Shared list page | `app/s/[token]/SharedListView.tsx:34-47` | Reuses `ListCard` — inherits the full motif/bigtype/gradient fallback chain (§5). |
| "Living Postcard" | — | **Not a real feature.** `lib/guide-art.ts:1` uses "Living Postcard" only as an internal code-name for the guide sketch-map registry above. No shareable postcard-image export exists. |
| OG/share image | `app/opengraph-image.tsx:7-34` | `next/og`'s `ImageResponse` — fully generated at request time from hardcoded brand colors/copy. **One single global OG image for the entire site** — no per-thing or per-guide OG image route exists. |
| PWA icons | `app/manifest.ts:15-24`, `app/layout.tsx:52-55` | Hardcoded `/public` paths: `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`, `/apple-icon-180.png`. All present on disk. |
| Splash screen | — | **Not found.** No `apple-touch-startup-image` or splash-related markup anywhere. |
| Empty-state art | `components/ui/EmptyState.tsx:4-27` | Not an image — every call site passes an emoji string (e.g. `icon="🔍"`, `icon="🌙"`) or an `SBIcon` glyph component. No motif/photo art used for empty states. |
| Saved list card | `components/saved/SavedCard.tsx:51,69` | `thing.photo_url`, no `onError` fallback (native broken-image glyph on 404). Toned div only when absent. |
| Saved "did you make it?" prompt | `components/saved/SavedClient.tsx:270` | `c2Item.photo_url`; whole `<img>` block omitted if falsy, no fallback markup. |
| Plan stop card | `components/plan/SpineStopCard.tsx:41-49` | `thing.photo_url`, toned div fallback. |
| Add-stop sheet (live Plan flow) | `components/plan/AddStopSheet.tsx:83-87` | `r.thing.photo_url`, toned div fallback. |
| SwapSheet — **dead code** | `components/plan/SwapSheet.tsx:63-75` | Same pattern; file's own header comment says it's no longer used since Plan simplification (superseded by AddStopSheet). |
| PinPickerSheet — **dead code** | `components/plan/PinPickerSheet.tsx:70-82` | Same pattern; file's own header comment says it's no longer used (build-from-saved removed). Kept only to avoid broken imports. |
| Admin: edition-draft image editor | `app/admin/edition-draft/EditionImageEditor.tsx:61,71` | Curator tool — current pick + candidate option thumbnails, plus manual paste-URL/upload path. |
| Admin: catalog list | `app/admin/catalog/CatalogView.tsx:425` | `r.photo_url`, plain div fallback. |
| Admin: Images desk | `app/admin/images/ImagesView.tsx:682,798` | Assigned-this-session strip (emoji fallback, not art) and candidate-picker thumbnails. |
| Admin: venues photo pool | `app/admin/venues/VenuesView.tsx:46,97,861` | `p.serving_url` (Google Places "serving URL") — this is the human-facing surface for curating the Scenario D venue photo pool (§2). |
| Admin: shared photo-option picker | `app/admin/review/ImagePicker.tsx:28` | `opt.url` prop, used by PickEditor/SwapPicker. |
| Admin: review queue card | `app/admin/review/ReviewCard.tsx:141` | `dispPhotoUrl`, a derived display variant of the row's photo. |

---

## 2. Resolver pipeline (as it actually is now)

Read in full: `ingest/images.ts` (972 lines), `ingest/run.ts` (1388 lines), `ingest/imageRelevance.ts`, `lib/venuePool.ts`, `ingest/marqueeVenues.ts`, `ingest/adapters/googlePlaces.ts`, plus the relevant migrations and `.github/workflows/ingest.yml`.

### Current waterfall, per candidate (`resolveImages()`, `ingest/images.ts:758-972`)

0. **`image_cache` short-circuit** (`ingest/images.ts:774-831`) — keyed by `place_id` else normalized `title|neighborhood` (`cacheKey()`, `:83-87`). A non-`force` run with a cached row whose `photo_source !== 'placeholder'` uses it directly, unless a venue-pool override exists for the candidate. Tier-1 dated events still get overridden to a motif even on a cache hit (`:820-822`).
1. **Civic-meeting gate** (`:838`) — `isCivicImage()` skips network/venue-pool lookups entirely for civic items.
2. **Venue photo pool — "Scenario D"** (`:845-849`) — if the candidate matches an active `venues` row with ≥1 approved `venue_photos` row, `pickFromPool()` (`lib/venuePool.ts:40-43`, a deterministic day-hash rotation) picks one. Sets `skipRelevance = true`, bypassing the vision-relevance guard.
3. **Marquee-venue file pin** (`:851-856`) — checks a ~12-entry hardcoded registry (`ingest/marqueeVenues.ts`). **Documented no-op today**: every entry currently ships with an empty `pinnedPhoto` (`ingest/images.ts:844` comment, confirmed no entry sets it).
4. **Direct Google for food/drink venues** (`:862-870`) — `isDirectGoogleFoodCandidate()` (food/drink categories or `happyhour`) tries Google **before** Wikimedia, gated by the shared call cap.
5. **Wikimedia** (`:876-877`) — geosearch if lat/lng present, else title search; **never attempted for Tier-1 events** (`:374-375`).
6. **Google Place Photo fallback (paid)** (`:884-891`) — only if free tiers missed, not a Tier-1 event, gated by cap.
7. **Vision relevance guard** (`:902-919`) — one batched Claude Haiku vision call over fresh auto-picks (excludes Tier-1 events and pool/marquee picks); a `false` verdict forces placeholder.
8. **Motif / bigtype assignment** (`:947-950`) — deterministic, no network, never Pexels, never AI at runtime. See §5 for the assignment algorithm.
9. **Branded gradient** — the final client-side fallback inside `ListCard` if `visual` is somehow missing; not exercised inside `images.ts`/`run.ts` themselves.

Every resolution (real photo or motif) persists to `image_cache` (`:925-932`) before being applied.

### Is Pexels still present?

**Fetch and selection are fully dead; the string survives only as legacy/compat plumbing.**
- File header explicitly states `PEXELS_API_KEY is no longer read anywhere in this file` (`ingest/images.ts:25`), confirmed by a zero-hit grep for that env var in the file.
- `rankOptions()` actively filters out any `'pexels'` entry rather than ranking it (`ingest/images.ts:146`), confirmed by `ingest/images.test.ts:122-131`.
- **However**, `PEXELS_API_KEY` is still declared as a live GitHub Actions secret passthrough in `.github/workflows/ingest.yml:105` — dead env var, harmless, but drifted config worth cleaning up.
- **Live DB reality**: 12 of 584 published `things` still carry `photo_source = 'pexels'` (see §5's live query) — legacy rows from before retirement, still rendering today. Pexels is retired for *new* resolution, not purged from the catalog.

### Scenario D venue-pool inheritance — confirmed implemented

- Schema: `venues` + `venue_photos` tables, `supabase/migrations/20260709_card_imagery_phase2_venues.sql:8-36` (adds `things.venue_id` FK).
- Matching: `matchVenueForCandidate()` (`ingest/images.ts:746-754`) — `venue_id` if set, else exact `place_id`.
- Rotation: `pickFromPool(thingId, isoDate, poolLen)` (`lib/venuePool.ts:40-43`) — deterministic per-day hash, so the same thing shows the same pool photo all day and rotates day-to-day.
- **Overrides Tier-1 "no photo" default**: a pool match now shows a rotating real photo for dated events at pooled venues, instead of defaulting every such event to a motif (`ingest/images.ts:939-950`, explicit fix noted in-code for "~80-100 events at 18 curated venues").
- Render-time collision spreading (separate from ingest): `dedupeFeedVenuePhotos()` (`lib/venuePool.ts:80-119`) advances repeat same-venue cards within one feed render to the next unused pool slot before falling to motif — **not independently verified beyond its own file**, flagged as inferred from signature/comment.

### Per-place cache

`image_cache` table (`supabase/migrations/20260625_images.sql:22-29`), PK `place_key`. **No TTL, no expiry logic** — a cache hit is used indefinitely unless a `force` run is triggered. This is a permanent cache, not time-bounded.

### Nightly resource-name refresh — confirmed implemented

- Cron: `.github/workflows/ingest.yml:5-8`, daily `0 9 * * *` UTC, running `ingest/run.ts` `main()`.
- Called unconditionally (try/catch isolated) at `ingest/run.ts:1347-1361` → `refreshVenuePhotoServingUrls()`.
- Scope: only `venue_photos` rows with `source='google'`, `approved=true`, **and** currently displayed on a visible thing (`:894-895`) — not the whole pool.
- Staleness: 7-day threshold (`REFRESH_STALE_HOURS`, `:820`) before a refresh attempt; 14-day threshold (`CONFIRMED_DEAD_HOURS`) before treating a persistently-failing refresh as a dead photo.
- On success: updates `serving_url`/`refreshed_at`, propagates the new URL to every `things` row displaying the old one (`:934-940`).
- On confirmed-404: `handleDeadVenuePhoto()` (`:966-1022`) deletes the dead pool row, tries Wikimedia as a free replacement, else falls to a deterministic motif — every fallback surfaces in the nightly digest, never silent.
- **Known accepted gap**: ~14 legacy direct-Google `things` rows (pre-venue-pool) store only a raw `photoUri`, no `stable_ref` — explicitly out of scope for refresh (`ingest/run.ts:863-869`).

### Every point a PAID Google call can fire

| Call site | File:line | Path |
|---|---|---|
| `googlePhoto()` (Details + Photo media, 2 calls) | `ingest/images.ts:385-419`, fired from `:865` and `:886` | Nightly resolver — direct-food branch and generic fallback |
| `refreshGoogleMediaUri()` (1 billable media call) | `ingest/images.ts:441-453`, fired from `ingest/run.ts:909` | Nightly refresh loop |
| `businessStatus()` | `ingest/adapters/googlePlaces.ts:18-27`, called from `ingest/run.ts:1335` | **Currently dormant** — gated behind `CHECK_CLOSURES === '1'` (`googlePlaces.ts:14`), which is not set anywhere in `.github/workflows/ingest.yml`. In-code comment claims "the weekly run sets it" — no such wiring exists in the repo. **Flagging as a code/comment discrepancy**, not confirmed intentional. |
| `fetchGooglePhotoCandidates()` (per-candidate, Details + media) | `ingest/images.ts:555-591` | Not called from the nightly `main()` — used only by admin routes below |
| `searchPlaceByText()` / `searchNearbyNamedPlaces()` | `ingest/images.ts:475-538` | Free-tier lookup SKU; used by admin routes, negligible volume per code comment |
| `app/api/admin/images/auto-google/route.ts:243` | admin, human-triggered | 1 free Details + 1 billable media call per thing |
| `app/api/admin/images/pool-build/route.ts:73` | admin, human-triggered | `fetchGooglePhotoCandidates(..., 3)` |
| `lib/venueFetch.ts:72` | admin, human-triggered | `fetchGooglePhotoCandidates(..., 10)` |

### Spend cap

- Table: `image_spend` (`supabase/migrations/20260625_images.sql:15-20`) — `month` PK, `google_calls`, `over_cap`.
- Cap: `const CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1200)` (`ingest/images.ts:53`), set as a GitHub Actions **variable** (not secret) at `.github/workflows/ingest.yml:112`.
- **Drift found**: `ingest/adapters/googlePlaces.ts:16` independently reads the same env var but with a different fallback default: `?? 1400`. Only matters if the env var is ever unset (it currently isn't in CI), but the two files disagree.
- Enforcement: `calls < CAP` checked before every billable call site; when hit mid-run, the code degrades to the next-cheapest source rather than blocking the run, and counts an `over_cap` stat. Shared across the resolver, the refresh job, the closures checker, and every admin route.

---

## 3. Data model

### `photo_source` enum — 6 current values

Defined `Core Project Files/sbdaymaker_schema.sql:59` as `('pexels','wikimedia','google','owned','placeholder')`, extended by `supabase/migrations/20260710_card_imagery_phase3_motif.sql:9` to add `'motif'`. Cross-checked against the TS union `packages/shared/types.ts:39` and `ingest/run.ts:165`'s coverage-report source list — all three agree, no drift.

| Value | Set by | Notes |
|---|---|---|
| `google` | Resolver, admin routes | Live paid/free Google Places source |
| `wikimedia` | Resolver | Free source, geosearch or title search |
| `motif` | `assignVisual()` at ingest, or resolver fallback | Deterministic illustration, no photo |
| `owned` | Manual (no literal write site found in code — inferred to be founder-supplied) | Never shows attribution (see §7) |
| `placeholder` | Resolver / admin (e.g. `app/api/admin/catalog/photo/route.ts:58`) | No photo, no attribution |
| `pexels` | **Legacy only** — no live write site | Retired for new resolution (§2); 12 published rows still carry it |

### `things` table — image/photo columns

| Column | Type | Migration | Purpose |
|---|---|---|---|
| `place_id` | text | `sbdaymaker_schema.sql:153` | Google place_id |
| `photo_source` | `photo_source` enum, default `placeholder` | `sbdaymaker_schema.sql:154` | Provenance |
| `photo_url` | text | `sbdaymaker_schema.sql:155` | Resolved display URL |
| `photo_query` | text | `sbdaymaker_schema.sql:156` | Debug/re-resolve search term |
| `photo_attribution` | text | `sbdaymaker_schema.sql:157` | Credit line |
| `photo_options` | jsonb, default `[]` | `20260625_photo_options.sql:14` | Ranked alternates for cockpit picker |
| `venue_id` | uuid FK → `venues(id)` | `20260709_card_imagery_phase2_venues.sql:36` | Scenario D pool link |
| `visual_kind` | text (`'motif' \| 'bigtype' \| null`) | `20260710_card_imagery_phase3_motif.sql:10` | Fallback-visual tier |
| `visual_key` | text | `20260710_card_imagery_phase3_motif.sql:11` | Motif registry id (e.g. `wharf`) |
| `visual_seed` | integer | `20260710_card_imagery_phase3_motif.sql:12` | Deterministic render seed |
| `photo_ack` | boolean, default false | `20260711_images_desk.sql:7` | Images-desk "dismiss" flag |

### Other image-bearing tables

- **`image_spend`** (`20260625_images.sql:15-20`) — monthly Google-call budget tracker. See §2.
- **`image_cache`** (`20260625_images.sql:22-29`) — per-place resolution cache, keyed `place_key`. **Note:** `photo_source` here is plain `text`, not the enum type — nothing DB-level stops divergence, though code only ever writes the 6 known values.
- **`venues` / `venue_photos`** (`20260709_card_imagery_phase2_venues.sql:8-34`) — Scenario D pool. `venue_photos.stable_ref` stores the Google photo *resource name* (or Commons file title / owned URL) that expires; `serving_url` is the derived, refreshed hotlink; `approved` gates public display.
- **`edition_picks`** — `override_image_url`, `cached_image_url` (`20260706_edition_build.sql:71-72`), plus a Supabase Storage bucket `edition-media` (public read, same migration lines 125-127) for the email digest.
- **`guides.cover_url`** — `Core Project Files/sbdaymaker_schema.sql:255`. **No migration file creates this** (repo's own CLAUDE.md notes the migrations tree is known-incomplete), and it's a dead field in the render path: `lib/guides.ts` fetches it in every guide query but **no component reads it** — confirmed by a repo-wide grep. This is the closest thing to a "real guide photo" hook and it currently goes nowhere.
- **`thing_edits.payload`** (`20260702_cockpit_v2.sql:38-45`) — jsonb overlay that can transiently carry pending `photo_*` field edits before being applied to `things`.
- **`audit_log`** — logs `photo_url`/`photo_source` changes as an audit trail, not a live source of truth.

### Flagged conflict: schema.sql vs. live caching behavior

`Core Project Files/sbdaymaker_schema.sql:151-153`'s own comment says Google photos are "fetched live, never cached." This is **contradicted by the live `image_cache` table** (`20260625_images.sql`), whose header explicitly states it caches "the Google photoUri… keyed by place; re-runs reuse them," and `ingest/images.ts:925-932` does upsert Google photo URLs into `image_cache`. Per the user's instruction to treat migrations/code as truth: **the original "never cache Google" design intent was overridden by the Phase 13 image pipeline** — Google photo *URLs* are cached at the place level, even though the per-thing display path for pool-backed things still re-fetches/refreshes via `venue_photos.stable_ref` on its own nightly cycle.

---

## 4. The doors

**Direct answer: the doors are architected to carry photographic imagery, but none of that imagery exists on disk today — they currently render as gradient-tinted solid color tiles with text labels only.**

- `components/explore/DiscoveryDoors.tsx:47` and `components/explore/DiscoverySheet.tsx:45` both set a two-layer CSS `background-image`: a token-tinted gradient scrim (`var(--sbd-door-scrim-*)`) layered over `url(...)` pointing at a static JPG path (`/tiles/door/place.jpg`, `/tiles/place/{zone}.jpg`, `/tiles/vibe/{occasion}.jpg`, `/tiles/activity/{key}.jpg`, per `DOOR_META` and `lib/tiles.ts`).
- **`find public -type d` shows no `public/tiles/` directory exists at all** — every one of those URLs currently 404s.
- This is intentional, documented behavior, not a bug: `DiscoveryDoors.tsx:32-36` comment: *"if the photo 404s (true for every door until Jim supplies real photography…) the gradient layer alone still renders."* CSS confirms a `background-color` fallback exists specifically for this case (`app/components.css:2862-2873`).
- Aside from the background layer, the doors render only text (kicker + label spans, `DiscoveryDoors.tsx:51-52`) — no `<img>`, no icon glyph.

So today, visually, the doors read as solid/gradient color tiles with text — but the code path for real photography is fully live and will activate the moment JPGs land at those paths. **This is the single largest, most clearly pre-approved slot for new imagery in the entire app** — it's an intentionally empty photo slot, not a design decision to keep it text-only.

**Discover SB guide cards and heroes carry zero imagery, by a completely separate mechanism**, and are not even wired for a photo slot the way the doors are: `GuideCard.tsx` and the plain guide hero (`app/(app)/discover/[id]/page.tsx:122-130`) render pure CSS `linear-gradient`s (`app/components.css:4402-4411`) — no `url()`, no photo reference, no missing-file 404 pattern like the doors have. The one latent hook, `guides.cover_url`, is fetched from the DB but never rendered anywhere (§3) — if it were wired up, it would need its own render-site work, distinct from the doors' already-built photo-slot mechanism.

No shared component or CSS variable exists between the doors/tiles system and the Discover guide cards/heroes — they were built independently.

---

## 5. Fallback reality

### Render-time chain (`components/ui/Card.tsx:171-259`, `ListCard`)

Trigger: `nophoto = !photo || broken` (`Card.tsx:194`), where `broken` flips true on an `<img onError>` (client-side 404/403).

1. **Motif tier** — `nophoto && visual?.kind === "motif" && visual.key` → `MOTIFS[visual.key]`, one of 9 hand-drawn ink `<svg>` illustrations (`components/visuals/motifs.tsx`, keyed `stage`/`sunset`/`market`/`trail`/`wharf`/`mission`/`books`/`taproom`/`beach`).
2. **Bigtype tier** — `nophoto && !motif && visual?.kind === "bigtype"` → `BigTypeArt` (`components/visuals/BigType.tsx`), a large derived-text `<svg>` (day-of-week / `nearby_zone` / "SB").
3. **Gradient + icon tier (true last resort)** — `nophoto && !motif && !showBigType` → occasion-colored CSS gradient (`app/components.css:456-462`) + centered emoji/icon (`occ.icon` from `lib/occasions.ts:29-40`, or `SBIcon name="sparkle"` if no occasion at all). Per the code's own comment (`Card.tsx:165-169`), this only fires "if a `visual` is somehow missing" — every Tier-1 event and resolver miss is supposed to carry a `visual` since Phase 3.

### Assignment (deterministic, persisted at ingest — `lib/visualAssignment.ts:97-113`)

- `seed = hashString(thing.id)` — same thing always gets the same visual, not randomized per render.
- Venue-family override first (e.g. `old-mission` → `mission` motif, `stearns-wharf` → `wharf` motif).
- Else category → motif pool, picked by `pool[seed % pool.length]`.
- A seeded ~1-in-8 substitution (`seed % 8 === 0`) sends it to bigtype instead, for visual variety — still deterministic, not random.
- No category match → bigtype directly.
- Persisted to `things.visual_kind` / `visual_key` / `visual_seed` at ingest time, not computed fresh on every render.

### Live DB count — published things by `photo_source`

Executed as a read-only `SELECT` against the live production Supabase project during this research pass, using the repo's own existing `.env.local` credentials (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY`) via the same client pattern already used in `scripts/backfill_activities.mts:11-15`. No writes issued. Confirmed `status = 'published'` is the correct condition (the app's own live-catalog query uses it, `lib/catalogServer.ts:67`; `things.status` is a `thing_status` enum, `sbdaymaker_schema.sql:52,117`).

```sql
SELECT photo_source, count(*)
FROM things
WHERE status = 'published'
GROUP BY photo_source
ORDER BY count(*) DESC;
```

| photo_source | count | % of published |
|---|---:|---:|
| google | 373 | 63.9% |
| wikimedia | 168 | 28.8% |
| motif | 31 | 5.3% |
| pexels | 12 | 2.1% |
| **Total** | **584** | 100% |

No published row had a null `photo_source`. **Caveat**: this `motif = 31` count reflects only rows where the persisted `photo_source` column itself was written as `'motif'` — it's narrower than "everything currently rendering a motif/bigtype/gradient visual" client-side, since Tier-1 dated events get a `visual_kind`/`visual_key` pair independent of `photo_source` and can carry a different `photo_source` value while still displaying a fallback visual on cards (per §2 step 8's trigger conditions). If you want a true "what % of cards show a real photo vs. any fallback art" number, that requires reading `visual_kind IS NOT NULL` alongside `photo_source`, not `photo_source` alone — happy to give you that exact query on request.

---

## 6. Static/brand assets

`/public` inventory (confirmed via `find public -maxdepth 2`):

| Asset | Type | Classification | Reasoning |
|---|---|---|---|
| `public/icon.svg` | SVG source | **BRAND-STATIC — owned** | Bespoke geometric mark, project brand colors (Pacific teal, gold, terracotta). Source input for the PNG family below via `scripts/gen-icons.mjs`. **Orphaned at runtime** — no `app/`/`components/` reference, only consumed by the generation script. |
| `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-icon-180.png` | PNG | **BRAND-STATIC — owned** | Rasterized derivatives of `icon.svg` (`scripts/gen-icons.mjs:1-21`), flattened onto brand color `#16586A`. Wired into `app/manifest.ts:15-24` and `app/layout.tsx:52-55`. |
| `public/hero/sb-skyline.svg` | SVG, 204 lines | **BRAND-STATIC — owned** | Explicitly hand-styled per its own usage comment (`components/explore/Hero.tsx:48-52`) — Riviera hillside, Mission, Courthouse, wharf, "Lil' Toot" tugboat, all baked-in brand colors. |
| `app/favicon.ico` | ICO, 2 embedded sizes | **BRAND-STATIC — owned (probable)** | Next.js file-convention favicon; sized/paired consistently with the rest of the custom icon set, though not independently content-verifiable from the binary alone — flagged as inferred, not confirmed. |
| `app/opengraph-image.tsx` (dynamic, not a static file) | Generated PNG via `next/og` | **BRAND-STATIC — owned** | Pure typographic composition using brand hex values (`#F6F1E7`/`#16586A`/`#C0532E`/`#4A4038`) and the exact tagline copy — no photo, no DB read, one global image site-wide. |
| `public/sw.js` | JS | N/A (not an image) | PWA service worker, precaches `/icon-192.png`. |

**No generic/stock/default assets found anywhere in `/public`** — no default Next.js/Vercel logo, no generic placeholder image.

**Missing, referenced-but-absent** (cross-reference with §1/§4): `/tiles/door/{place,vibe,activity}.jpg` and the per-zone/occasion/activity tile paths under `/tiles/place/`, `/tiles/vibe/`, `/tiles/activity/` — none of these files or directories exist. This is the empty door-photography slot discussed in §4, not a bug.

---

## 7. Attribution

**Cards and feed rails never show attribution, by explicit design.** `lib/things.ts:50-51`'s own comment: *"Card Imagery Build Spec Phase 1 §4.3 — non-owned photo credit, rendered on the detail page only (never the card rail)."* The card feed query (`BASE_COLS`, `lib/things.ts:74-77`) doesn't even `SELECT` `photo_attribution` — only the detail query does.

**The only consumer-facing attribution UI** is the thing detail page:

```
app/(app)/thing/[id]/page.tsx:70-72
{t.photo_url && t.photo_source !== "owned" && t.photo_attribution ? (
  <p className="sbd-detail__attribution">{t.photo_attribution}</p>
) : null}
```

`photo_source`'s only role here is the single `!== "owned"` exclusion — owned photos never show a credit line. Everything else, it's just a plain `<p>` echoing a pre-formatted string (not a link, no per-source text/link-format branching at render time). The **attribution text itself** is constructed once, at ingest/admin time, per source:

| `photo_source` | Attribution string construction | Where |
|---|---|---|
| `wikimedia` | `` `${artist} · ${license} · Wikimedia Commons` `` | `ingest/images.ts:286-287` (also `app/api/admin/images/pool-build/route.ts:60`, `lib/venueFetch.ts:53`) |
| `google` | `` attr ? `${attr} (Google)` : 'Google' `` | `ingest/images.ts:413,416,582,585` |
| `owned` | Never set — suppressed at render regardless | — |
| `placeholder` / `motif` | Explicitly nulled | `app/api/admin/catalog/photo/route.ts:58`, `app/api/admin/venues/photos/remove/route.ts:72` |
| `pexels` | No live constructor found (legacy only) | — |

Email digest: attribution is used only inside `<img alt>` text (`"${title} (photo: ${attribution})"`, `lib/edition/render.ts:121-122`), not as a visible on-screen caption.

**Admin cockpit surfaces both `photo_source` and attribution to reviewers, extensively:**
- **Images desk** (`app/admin/images/ImagesView.tsx:726,795,804`) — raw `photo_source` label next to each item, attribution as a hover tooltip and as caption text under the selected candidate.
- **Review queue card** (`app/admin/review/ReviewCard.tsx:15-17,109-110,142`) — `SOURCE_CLASS` maps `photo_source` → a CSS styling class only (no text remap); a `src-pill` badge renders the raw value (`"google"`, `"pexels"`, etc.) verbatim.
- **Venues review** (`app/admin/venues/VenuesView.tsx:16-18,47,54,98,104`) — `sourceLabel()` title-cases the raw value for a pill; attribution caption shown on both approved and candidate photo cards.
- **Catalog image picker** (`app/admin/catalog/CatalogImagePicker.tsx:338`) — always renders an attribution span (empty if none).

**How a new `ai_generated` source would flow through today's labeling, if added:** it would need (1) a new `photo_source` enum value (`sbdaymaker_schema.sql:59`-style `ALTER TYPE`), (2) an entry in the `SOURCE_CLASS` map (`ReviewCard.tsx:15-17`) and `sourceLabel()` (`VenuesView.tsx:16-18`) for admin display, and (3) a decision on whether it's treated like `owned` (never shown to end users) or like `google`/`wikimedia` (a visible detail-page credit line) — the `!== "owned"` gate at `thing/[id]/page.tsx:71` is the one and only place that decision gets enforced today, so extending it is a one-line change, but it's a **decision**, not something the current code defaults for you.

---

## 8. Classification table

Every render site from §1, tagged for AI-imagery candidacy.

| Render site | Tag | Reason |
|---|---|---|
| Explore hero skyline (`Hero.tsx:54`) | **BRAND-STATIC — owned** | Hand-illustrated brand asset, not a place photo; out of scope. |
| PickCard photo (`Card.tsx:117-119`) | **REAL-PLACE — never AI** | Displays an actual venue/place photo (`photo_url`). |
| ListCard photo (`Card.tsx:212-220`) | **REAL-PLACE — never AI** | Same — direct venue photo. |
| ListCard motif fallback (`Card.tsx:196-199`, `motifs.tsx`) | **FALLBACK — AI-candidate** | Abstract hand-drawn illustration standing in for "no photo exists"; already non-photographic, a natural slot for AI-generated categorical art if the hand-drawn set needs expansion. |
| ListCard bigtype fallback (`BigType.tsx`) | **FALLBACK — AI-candidate** | Text-driven SVG art, same no-photo tier as motif — same reasoning. |
| ListCard gradient+icon last resort (`Card.tsx:204-235`) | **FALLBACK — AI-candidate** | Genuine last-resort no-photo state; safest possible AI slot since it's explicitly not tied to any real place. |
| RockTile background (`RockTile.tsx:22-25`) | **REAL-PLACE — never AI** | Direct venue photo, Explore Month lead section — highest-visibility real-place surface in the app. |
| Thing detail page photo (`DetailPhoto.tsx:17`) | **REAL-PLACE — never AI** | The canonical "is this really this place" surface — AI imagery here would actively mislead. |
| Discover SB guide card (`GuideCard.tsx:8-12`) | **CATEGORICAL — AI-safe** | Pure gradient today, themed/neighborhood-level abstraction, not a single named venue. Good AI candidate. |
| Discover SB "plain" guide hero (`discover/[id]/page.tsx:122-130`) | **CATEGORICAL — AI-safe** | Same reasoning — gradient-only, theme-level, not venue-specific. |
| Discover SB rich guide sketch plate (`StateStreetSketch.tsx`, `FunkZoneSketch.tsx`) | **REAL-PLACE — never AI** | Depicts named real streets and landmarks (State Street, the Funk Zone) with cartographic intent — AI generation risks inventing or mis-locating real local geography, which directly undercuts local authenticity. |
| Explore home doors — Place / Occasion / Activity (`DiscoveryDoors.tsx:47`) | **CATEGORICAL — AI-safe** | Abstract dimension tiles, not tied to any single venue; currently an empty photo slot (§4) — the single best-suited, already-pre-approved location for AI imagery in the whole app. |
| Door bottom-sheet tiles — occasion/activity (`DiscoverySheet.tsx:45`, `lib/occasions.ts`, `lib/activities.ts`) | **CATEGORICAL — AI-safe** | Abstract concepts (romantic, rainy day, hiking, etc.) — same reasoning as doors. |
| Door bottom-sheet tiles — place/zone (`lib/tiles.ts:27`, `lib/doorZones.ts`) | **CATEGORICAL — AI-safe, with caution** | Neighborhood-zone-level (not single-venue), so broader atmosphere/streetscape AI imagery is defensible — but avoid AI-inventing specific named landmarks within a real zone tile; keep it generic-atmosphere, not landmark-accurate. |
| Passport stamp | **N/A — not an image today** | Renders as text (`stamp_code`), zero-state, no graphic exists to classify. |
| Shared plan page thumbnails (`SharedPlanView.tsx:122-131`) | **REAL-PLACE — never AI** | Same underlying `photo_url` as the detail/card surfaces. |
| Shared list page (`SharedListView.tsx`) | **REAL-PLACE — never AI** (mirrors ListCard's own tiers) | Reuses ListCard wholesale — its fallback tiers inherit the ListCard classifications above. |
| OG/share image (`opengraph-image.tsx`) | **BRAND-STATIC — owned** | Typographic brand composition, no photo; out of scope. |
| PWA icons (`manifest.ts`, `layout.tsx`) | **BRAND-STATIC — owned** | Brand mark family; out of scope. |
| Splash screen | **N/A — not found** | No implementation exists to classify. |
| Empty-state art (`EmptyState.tsx`) | **N/A — not an image asset** | Emoji/icon glyphs only, not imagery in scope of this inventory. |
| Saved / plan thumbnails (`SavedCard.tsx`, `SavedClient.tsx`, `SpineStopCard.tsx`, `AddStopSheet.tsx`) | **REAL-PLACE — never AI** | All display `thing.photo_url` — actual venue photos, repeated across saved/plan surfaces. |
| Admin curation surfaces (`EditionImageEditor.tsx`, `CatalogView.tsx`, `ImagesView.tsx`, `VenuesView.tsx`, `ImagePicker.tsx`, `ReviewCard.tsx`) | **REAL-PLACE — never AI** | These *are* the human review surface for confirming real photos are actually correct for the place — the entire point of these screens is authenticity verification; AI imagery here would defeat their purpose. |

---

## Open items worth a decision, not just an inventory line

1. **The doors are the obvious first AI-imagery target.** They're already wired for photography, currently 404ing to a flat color, and the door/tile categories (Place, Occasion, Activity) are inherently non-venue-specific. This is lower-risk than anywhere else in the app.
2. **`guides.cover_url` is dead code waiting for a decision.** It's fetched, never rendered. If Discover guide cards get imagery, this is presumably the intended hook — worth deciding whether that photo (if ever populated) should be a real neighborhood photo or AI-generated theme art, since the guide card classification above assumed a gradient-only present state.
3. **Rich guide sketch plates (State Street / Funk Zone) are hand-drawn today and depict real geography.** If more neighborhood guides get built, decide up front whether new sketch plates stay hand-drawn (current standard) or could be AI-assisted — the authenticity risk is specifically about landmark accuracy, not "is it a photo."
4. **Pexels isn't fully gone from the catalog** — 12 published things still show Pexels-sourced photos. If the retirement is meant to be complete, those rows need a resolver re-run or manual reassignment, independent of any AI-imagery decision.
5. **`detectClosures()` looks dormant** (`CHECK_CLOSURES` never set in CI) despite an in-code comment implying a weekly run enables it — worth a quick confirm with whoever owns the closures feature, unrelated to imagery but found in the same file pass.
