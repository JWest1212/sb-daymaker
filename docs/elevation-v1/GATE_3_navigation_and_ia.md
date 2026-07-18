# GATE 3 — Navigation, Search & Information Architecture

`Build: Elevation v1 · Gate 3 of 6 · target: 2 sessions · parallelizable with Gate 2`
`Prereq: Gate 1 (fields), benefits from Gate 2 (slugs for links). Search reads quality tiers.`

---

## Why this gate exists

The site has depth it doesn't surface (75 shown, "+264 more" teased), no way to find a named place, no "this weekend" construct despite a "weekend, in your inbox" newsletter, and no cross-linking between its two content tiers (things ↔ guides). This gate makes the existing inventory findable and connected.

**Read before coding:** `ExploreClient.tsx`, `CascadeFeed.tsx`, `explore.ts`, `things.ts`, `SavedClient.tsx`, `BottomNav` (note: a dormant Plan icon already exists there per `CLAUDE.md` §3), `CLAUDE.md` §9 (V1 scope — Near Me is a sort, not a map).

**Decisions locked:** Search **and** Weekend filter on Explore · recurring events get their **own section with computed next-dates** · one-tap flag → review queue (table built in Gate 1) · **the "Build your day" CTA banner is untouched this build** (do not move or restyle it) · **no `/about` page this build.** Nav stays three tabs.

---

## G3.1 — [OUT OF SCOPE] "Build your day" CTA placement

**Removed from this build by founder decision.** Do **not** move, restyle, or otherwise touch the "Build your day" CTA banner in this build. Leave its current placement, styling, and destination exactly as they are. The Saved-page "Build a day from your saved →" entry is likewise untouched. (This item was previously specced as moving the banner above the feed; that change is explicitly cancelled.)

---

## G3.2 — Search

**Evidence:** no search exists; with 75 shown and ~265 in the DB, "I heard about a place called Loquita" has no path but scrolling.

**Task:**
- Add a search entry in the header (the expanding-icon pattern already hinted by the stray "Cancel" overlay Gate 0 cleaned up — reuse that overlay, now correctly gated).
- Query `things` by title (the `things_title_trgm_idx` trigram index already exists — use it for fuzzy match) plus `blurb`/`category`/`nearby_zone`. Deterministic, server-side; no AI (constraint §3).
- Results are a simple ranked list (Tier 1 above Tier 2; Tier 3 excluded), each linking to the slug URL.
- Empty state: "No matches — try a neighborhood or a vibe" with the occasion chips as fallback.
- Accessible: input has a label, results are keyboard-navigable, focus is trapped in the overlay and returns on close (WCAG 2.2 AA per §6).

**Acceptance test A3.2:** searching "loquita" returns Loquita; "funk zone" returns Funk Zone things; a typo ("loqita") still matches via trigram; Tier-3 things never appear; keyboard-only operation works with correct focus return.

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
- [ ] **A3.2** Search works (fuzzy, tier-filtered, keyboard-accessible, focus-managed).
- [ ] **A3.3** "This weekend" horizon + `/weekend` URL with correct in-window content.
- [ ] **A3.4** Recurring cards show real next-dates or honest "check schedule"; no false cadence.
- [ ] **A3.5** Thing↔guide links both directions; nearby/pairs-with on Tier-1 pages.
- [ ] **A3.6** One-tap flag writes `content_flags`, no PII, rate-limited; cockpit Flags view resolves them.
- [ ] **A3.7** ~~/about page~~ — **out of scope this build.**
- [ ] **A3.8** Horizon vs door axes visually separated; live results count; /plan chips grouped.

**Definition of done for Gate 3:** the depth already in the database is findable (search, weekend, recurring next-dates), the two content tiers reinforce each other (cross-links), the product's front door leads with its differentiator, users can correct what's wrong, and the site finally says who's behind the taste it asks you to trust.
