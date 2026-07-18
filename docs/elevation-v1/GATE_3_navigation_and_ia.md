# GATE 3 — Navigation, Search & Information Architecture

`Build: Elevation v1 · Gate 3 of 6 · target: 2 sessions · parallelizable with Gate 2`
`Prereq: Gate 1 (fields), benefits from Gate 2 (slugs for links). Search reads quality tiers.`

---

## Why this gate exists

The site has depth it doesn't surface (75 shown, "+264 more" teased), a solid search that has drifted from the live door taxonomy and matches too narrowly, no "this weekend" construct despite a "weekend, in your inbox" newsletter, and no cross-linking between its two content tiers (things ↔ guides). This gate makes the existing inventory findable and connected.

**Read before coding:** `ExploreClient.tsx`, `CascadeFeed.tsx`, `explore.ts`, `things.ts`, `SavedClient.tsx`, `BottomNav` (note: a dormant Plan icon already exists there per `CLAUDE.md` §3), `CLAUDE.md` §9 (V1 scope — Near Me is a sort, not a map).

**Decisions locked:** Search already exists and is **reconciled + extended, not rebuilt** (see G3.2; four scoped changes only) · Weekend filter on Explore · recurring events get their **own section with computed next-dates** · one-tap flag → review queue (table built in Gate 1) · **the "Build your day" CTA banner is untouched this build** (do not move or restyle it) · **no `/about` page this build.** Nav stays three tabs.

---

## G3.1 — [OUT OF SCOPE] "Build your day" CTA placement

**Removed from this build by founder decision.** Do **not** move, restyle, or otherwise touch the "Build your day" CTA banner in this build. Leave its current placement, styling, and destination exactly as they are. The Saved-page "Build a day from your saved →" entry is likewise untouched. (This item was previously specced as moving the banner above the feed; that change is explicitly cancelled.)

---

## G3.2 — Search (RECONCILE AND EXTEND — do not rebuild)

**Search already exists and is well-built.** A full read of the live implementation (documented in `docs/search-current-spec.md`) shows a solid, deterministic, no-AI search feature. This task is NOT a rebuild. It keeps everything that works and makes four scoped changes. Read `docs/search-current-spec.md` in full before touching anything.

### What already exists — LEAVE IT ALONE

Do not rebuild, restyle, or re-architect any of this; it already meets the build's requirements:
- **Entry + overlay:** header magnifier (`SearchButton.tsx`) opening a full-width slide-down panel (`SearchPanel.tsx`), state owned by `HeaderSearch.tsx`, available on every `(app)` page via `BrandHeader.tsx`.
- **Server route:** `GET /api/search?q=` (`app/api/search/route.ts`), `force-dynamic`, per-IP in-memory rate limit (40 req / 10s → 429), debounced 180ms client-side with `AbortController`.
- **Deterministic matcher, no AI:** pure `searchThings()` in `lib/search.ts` (constraint C3, "no Claude call, ever" — this aligns with our §3 invariant; keep it).
- **Three result groups:** Events / Venues / Tags, each capped at 5 with "+N more" overflow, fixed render order.
- **Tier-3 already excluded:** search reads `getPublishedThings()` which already filters out `quality_tier === 3`. (Our Gate 1 tier work is already respected here — no change needed.)
- **Accessibility is already solid:** `role="search"`, labelled input, `useFocusTrap` (trap + focus return to trigger), Esc-to-close, `aria-live` match count, 44px targets, reduced-motion handling. Do not regress any of this.
- **The "Cancel" SSR leak is already fixed** here via the `everOpened` gate in `HeaderSearch.tsx` (this is Gate 0's G0.8 concern — it's handled; coordinate, don't duplicate).

### CHANGE 1 — Extend event match to neighborhood/zone (not full blurb)

**Today:** `searchEvents()` in `lib/search.ts` matches `thing.title` ONLY. A neighborhood or vibe word returns nothing.
**Change:** extend event matching to also match `neighborhood` / `nearby_zone`, with **title still ranked above** a neighborhood-only match. Do NOT add `blurb`/`blurb_long` matching (decision: title + neighborhood/zone only — blurb matching produces noisy, hard-to-explain hits and disconnects the bare result row from the query). Keep the existing prefix-over-substring rank; a title hit outranks a zone hit at the same rank tier.

### CHANGE 2 — Add light fuzzy / typo tolerance

**Today:** `matchRank()` is pure `startsWith`/`includes`, so "loqita" does NOT match "Loquita" (proven in the current spec). 
**Change:** add lightweight typo tolerance inside the existing pure function (the corpus is ~265 rows, so this stays in-memory; do NOT introduce trigram, a DB full-text index, or any network/AI call — preserve C3 and §3). A small bounded edit-distance (e.g. Levenshtein ≤1 for tokens ≥4 chars, or a similar cheap approach) is sufficient. **Ranking rule:** exact prefix (rank 0) and substring (rank 1) hits must still sort ABOVE fuzzy hits (introduce a rank 2 for fuzzy). Fuzzy must never reorder or displace an exact match. Cap and group behavior unchanged.

### CHANGE 3 — Re-sync ALL THREE door vocabularies to the LIVE taxonomy, and wire Activity

**Today:** the Tags group matches two hardcoded vocabularies (`lib/occasions.ts`, `lib/doorZones.ts`) that have **drifted from the live site**, and the Activity dimension is stubbed/unwired. This must be corrected to the exact live door labels (confirmed from the live site, July 2026):

- **Place (8)** — `DOOR_ZONES`: Downtown & State Street · Funk Zone · Waterfront & Harbor · The Mesa · Mission & Riviera · Uptown & Upper State · Goleta & Isla Vista · Montecito · Summerland · Carpinteria.
- **Occasion (8)** — `OCCASIONS` must be re-synced to EXACTLY these 8: Date Night · Family Day · Nightlife · Hosting Visitors · Solo · Free in SB · Rainy Day · Dog Friendly. **Remove the stale labels no longer on the live Occasion door** (Catch a Show, Arts & Culture, Outdoors & Active, Wine & Food — these moved into the Activity door).
- **Activity (10)** — NEW searchable vocabulary: Live music · Arts & galleries · Food & drink · Outdoors · Markets · Family & kids · Film & talks · Wellness & fitness · Nightlife · Community & Festivals.

Requirements:
- The search vocabularies must read from the **same single source of truth** the doors render from (import the live taxonomy arrays; do not re-hardcode a second copy that can drift again). If the live doors are defined in canonical files, `lib/search.ts` imports those, so re-sync is structural, not a manual copy.
- **Wire the Activity tag route end-to-end.** Tag hits currently route via `?vibe=` / `?place=`; add `?activity=<key>` and have `ExploreClient` read and apply it (mirroring the existing vibe/place handling, then clear the param). **Gate this on the Activity filter existing** — an Activity tag hit must land on a working Activity-filtered Explore, never a dead tap. If `ExploreClient` has no activity filter setter yet, add it as part of this change.

### CHANGE 4 — Door labels on tag rows + slug links

- **Overlapping tag labels get a door label.** "Nightlife" exists in BOTH the Occasion and Activity doors (and "Family Day" / "Family & kids" are near-duplicates). Decision: **keep both, and label the door on each tag row** so the two Nightlife rows are distinguishable (e.g. a small "Occasion" vs "Activity" qualifier on the row, in addition to the existing kind chip). Do not merge or suppress duplicates. Extend the tag result row to carry its door origin.
- **Link results to slugs, not UUIDs.** Today event/venue hits link to `/thing/{UUID}`. After Gate 2 lands slugs, results must link to `/thing/{slug}` so search stops eating a needless 301. (Dependency: Gate 2. If Gate 2 isn't merged when this ships, leave UUID links and add a TODO referencing the slug switch.)

### What stays out of scope
- **Guides are not searchable** in this change (decision deferred). Search remains things + venues + tags.
- **Search stays horizon-agnostic** — it searches the full published corpus regardless of Today/Weekend/Month. "This weekend" is a filter concern (G3.3), not a search concern. Do not add date/horizon filtering to search.

**Acceptance test A3.2:** (a) "funk zone" returns Funk Zone things AND the Funk Zone Place tag; (b) a neighborhood-only query returns things in that zone even when the title lacks the word; (c) the typo "loqita" now matches "Loquita", and an exact "loquita" still ranks above any fuzzy hit; (d) the Occasion tag vocabulary matches exactly the 8 live labels (no stale Wine & Food / Catch a Show), Place matches 8, Activity matches 10; (e) searching "nightlife" returns two distinguishable rows labelled Occasion and Activity, each routing to its own filter; (f) an Activity tag hit lands on a working Activity-filtered Explore (no dead tap); (g) event/venue results link to slugs once Gate 2 is present; (h) all pre-existing accessibility behavior (focus trap, focus return, Esc, aria-live, reduced motion) and the no-AI/rate-limit/Tier-3-exclusion behavior are unchanged.

---

## G3.3 — "This weekend" as a first-class horizon

**Evidence:** the UI offers Today / Week / Month; the newsletter is literally "The weekend, in your inbox." "This weekend" is the most common visitor/date-night query intent and has no filter.

**Task:**
- Add a **"This weekend"** horizon alongside Today / Week / Month in the Explore horizon control. It resolves to Fri 5pm → Sun 11:59pm (or Sat–Sun if it's already the weekend), pulling dated events in-window plus recurring rhythms that fire this weekend plus weekend-appropriate evergreens.
- Give it the crawlable URL `/weekend` (coordinate with Gate 2's metadata reservation) so it can rank for "things to do in santa barbara this weekend."
- It is also the web twin of the newsletter — same content the digest will assemble.

**Acceptance test A3.3:** the "This weekend" horizon shows only in-window content; `/weekend` loads that view directly with its own metadata; recurring events correctly appear when their day falls in the window.

---

## G3.4 — Recurring events get their own section with computed next-dates

**Decision:** recurring events display in a dedicated section, each showing its **next occurrence**, not a vague "every week" label (which the Gate 0 Art Walk bug proved is dangerous).

**Task:**
- Nightly, compute `recurring_schedules.next_occurrence` from `cadence` + `day_of_week` + `nth_dow` (fields added in Gate 1 DDL). Weekly → next matching DOW; `monthly_nth_dow` → e.g. next "first Thursday"; `bimonthly` → track from a `last_confirmed` anchor.
- The Explore cascade's recurring tier renders as **"Recurring in SB"** (or keeps its section name) with each card showing **"Next: Fri Jul 24, 5pm"** rather than "every week."
- If `next_occurrence` can't be computed (irregular), the card shows "Check schedule ↗" linking out, never a false cadence.

**Acceptance test A3.4:** every recurring card shows a concrete next date or an honest "check schedule"; no card claims "every week" for a non-weekly cadence; the Art Walk (bimonthly) shows its true next date.

---

## G3.5 — Cross-linking flywheel (things ↔ guides ↔ nearby)

**Evidence:** The Lark's page doesn't link to the Funk Zone guide it stars in; guide stops don't deep-link to `/thing` pages; no "nearby," no "pairs well with." Zero internal linking — a UX dead-end, an SEO dead-end, and a wasted flywheel between the two content tiers.

**Task (three link types):**
1. **Thing → Guide:** on a detail page, if the thing is a `guide_stops.thing_id` in any published guide, show "Featured in: <Guide title>" linking to the guide. (The `guide_stops.thing_id` FK already exists — just query it.)
2. **Guide stop → Thing:** where a `guide_stops.thing_id` is set, the stop links to the thing's detail page (deep-link + saveable, exactly as the schema comment intends). Coordinate with the separate guides project so you don't collide on guide layout — this is a link-wiring task, not a redesign.
3. **Nearby / pairs-with:** on a detail page, show 2–3 "Nearby" things sharing the same `nearby_zone`, Tier-1 first. Deterministic (no AI). This is the "Grab X before the show" pairing the audit called for.

**Acceptance test A3.5:** The Lark links to the Funk Zone guide; the Funk Zone guide's Lark stop links back to The Lark; every Tier-1 detail page shows 2–3 nearby things in the same zone.

---

## G3.6 — One-tap correction flag UI ("something wrong?")

**Decision:** one-tap flag → review queue. The `content_flags` table was created in Gate 1.

**Task:**
- On every detail page (and guide page), a quiet "Something off? Let us know" affordance opens a tiny sheet with the controlled reasons: wrong time / closed now / wrong price / wrong location / bad photo / other, plus an optional one-line detail. **No contact fields** (PII boundary, §8).
- Submitting writes a `content_flags` row (`status='new'`) via a server action. Rate-limit per device to prevent abuse (localStorage token + server-side soft cap).
- Add a **Flags** view to the admin cockpit (`/admin/flags`) listing new flags with a link to the thing and resolve/dismiss actions (sets `status` + `resolved_at`). This closes the loop and crowdsources QA for free.

**Acceptance test A3.6:** flagging "wrong time" on a thing creates a `content_flags` row and shows a thank-you state; the cockpit Flags view lists it and can resolve it; no PII is collected; rate-limiting blocks rapid repeat flags.

---

## G3.7 — [OUT OF SCOPE] About / editorial-policy page

**Removed from this build by founder decision.** Do **not** build an `/about` page in this build. Leave the "How SB Daymaker works" link as-is (do not wire it to a new page). This may return in a later build, but it is explicitly out of scope here.

---

## G3.8 — Filter axis clarity (minor)

**Evidence:** filter chips mix Place / Occasion / Activity with Today / Week / Month with no visible state model; the /plan vibe row mixes mood ("Outdoors"), audience ("Showing Visitors"), and price ("Free SB") in one row.

**Task:** Visually separate the two axes on Explore: **horizon** (Today / Week / Weekend / Month) as one control, **doors** (Place / Occasion / Activity) as another, with a clear active-state indicator and a visible "X things found" count that demonstrably responds to changes. On /plan, group the vibe chips by kind or relabel so mood/audience/price aren't presented as one flat set. (Do not re-architect the taxonomy — the founder's Doc 22 three-door model stands; this is a legibility pass.)

**Acceptance test A3.8:** horizon and door controls are visually distinct with clear active states; the results count updates on every filter change; the /plan chip groups are legible.

---

## Gate 3 acceptance summary

- [ ] **A3.1** ~~Planner CTA placement~~ — **out of scope this build** (banner untouched).
- [ ] **A3.2** Search RECONCILED and EXTENDED (not rebuilt): event match adds neighborhood/zone; light fuzzy added with exact ranked above fuzzy; all 3 door vocabularies re-synced to live labels (Occasion=8, Place=8, Activity=10) with Activity wired end-to-end; overlapping tags (Nightlife) shown twice with door labels; results link to slugs post-Gate 2; existing a11y / no-AI / rate-limit / Tier-3-exclusion unchanged.
- [ ] **A3.3** "This weekend" horizon + `/weekend` URL with correct in-window content.
- [ ] **A3.4** Recurring cards show real next-dates or honest "check schedule"; no false cadence.
- [ ] **A3.5** Thing↔guide links both directions; nearby/pairs-with on Tier-1 pages.
- [ ] **A3.6** One-tap flag writes `content_flags`, no PII, rate-limited; cockpit Flags view resolves them.
- [ ] **A3.7** ~~/about page~~ — **out of scope this build.**
- [ ] **A3.8** Horizon vs door axes visually separated; live results count; /plan chips grouped.

**Definition of done for Gate 3:** the depth already in the database is findable (search, weekend, recurring next-dates), the two content tiers reinforce each other (cross-links), the product's front door leads with its differentiator, users can correct what's wrong, and the site finally says who's behind the taste it asks you to trust.
