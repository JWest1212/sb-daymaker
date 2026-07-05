# W3a — Seed Discover SB

`Doc W3a · two audiences · Part 1 is for Jim (review & edit the guide content) · Part 2 is the Claude Code spec that seeds whatever Part 1 says after Jim's edits`

---

# PART 1 — For Jim: the five guides, drafted for your review

**Why you're reading this.** Discover SB — a full third of your app — currently shows an empty state to every visitor, while all the code to render guides sits finished. The only missing ingredient is content. Below are five drafted guides in the house voice, built from things already published in your live catalog (every stop below appeared in the live pool at snapshot time). **Your job:** read them like an editor, not an engineer. Cross out stops, rewrite lines that don't sound like you, add local notes only you know. Then hand this whole file to Claude Code — Part 2 tells it exactly what to do with your edited version.

**What these are (and aren't).** These are the *plain* v1 guides — kicker, intro, ordered stops with notes. The sketch-map/passport/stamps Discover v3 experience is a later build and loses nothing by these shipping first; if anything, the passport needs guides to stamp. Neighborhood guides also automatically surface live happenings in their zone; theme guides surface live happenings matching their tag — that part is already built and free.

**How to edit.** Change any text directly. To cut a stop, delete its line. To add one, add a line with the thing's exact title as it appears on the site (Claude Code matches stops to the database by title — exact titles matter; everything drafted below uses them). If you want a stop for something not yet in the catalog, mark it `[NEW — not in catalog]` and Claude Code will flag it back to you rather than invent it.

---

### Guide 1 · Neighborhood — The Funk Zone (zone: funk)

**Kicker:** Wine, art, and salt air in twelve walkable blocks
**Intro:** The old industrial blocks between the tracks and the beach turned into Santa Barbara's most concentrated good time — tasting rooms in warehouses, murals around every corner, and the ocean two minutes away when you need air. Park once (on Anacapa, not in the Zone — the lots are a trap) and do the whole thing on foot.

| # | Stop (exact catalog title) | Your note to the reader |
|---|---|---|
| 1 | Pali Wine Co. | Start easy: small-lot Pinot in a relaxed room, no ceremony. |
| 2 | Santa Barbara Wine Collective | One roof, many local producers — the efficient way to find your favorite. |
| 3 | Corks n' Crowns | Cozy and fireside; the move when the fog rolls in. |
| 4 | Topa Topa Brewing Co. | Beer break in the airy Waterline space; good for mixed wine/beer groups. |
| 5 | Live Music at Lama Dog | If it's a music night, end here — check the rhythm on the guide's live list below. |
| 6 | MOXI, The Wolf Museum of Exploration + Innovation | The with-kids (or kids-at-heart) anchor at the Zone's edge. |

---

### Guide 2 · Neighborhood — Downtown (zone: downtown)

**Kicker:** State Street and the blocks that reward wandering off it
**Intro:** Downtown works best a block off State — the courthouse gardens, the bookstores, the food hall. Give it an unhurried afternoon: climb one tower, browse two shops, graze one hall, and let the arcades and paseos do the rest.

| # | Stop | Note |
|---|---|---|
| 1 | Santa Barbara County Courthouse | Climb the clock tower first — the best free view in town, hand-painted ceilings on the way up. |
| 2 | Santa Barbara Museum of Art | Compact and genuinely good; an hour here is a full experience, not a sampler. |
| 3 | The Book Den | One of the oldest bookstores in the West; the sci-fi section earns its reputation. |
| 4 | Paradise Found | Books, incense, tarot — downtown's most browseable curiosity shop. |
| 5 | Santa Barbara Public Market | The graze: Thai, tacos, a wine bar, and a bakery under one roof. |
| 6 | SB Biergarten | Finish on the patio at 11 Anacapa; community nights most weeks. |

---

### Guide 3 · Neighborhood — The Waterfront (zone: waterfront)

**Kicker:** The wharf, the sand, and the long way around
**Intro:** Santa Barbara's waterfront is one continuous good idea: a working wooden wharf, a string of beaches each with its own personality, and a paved path connecting all of it. Rent wheels or just walk — either way, go the long way.

| # | Stop | Note |
|---|---|---|
| 1 | Stearns Wharf | California's oldest working wooden wharf — go early, before the parking fills. |
| 2 | East Beach | The classic: volleyball courts, lifeguards, calmer water east of the wharf. |
| 3 | Leadbetter Beach | The family beach — sheltered water, fire pits, tide pools by the harbor. |
| 4 | Shoreline Park | The clifftop finish: grass, a playground, and the whale-watching bench view. |

---

### Guide 4 · Theme — Date Night (tag: date_night)

**Kicker:** Golden hour to last pour
**Intro:** The dependable Santa Barbara date has three acts: something golden, something delicious, something slow. Here's the repertoire — mix, match, and check the live list below for what's on tonight.

| # | Stop | Note |
|---|---|---|
| 1 | Butterfly Beach | Act one: the sunset beach. West-facing, Montecito-quiet, arrive forty minutes before golden hour. |
| 2 | Boathouse at Hendry's Beach | Dinner on the sand with patio heaters — book ahead on weekends. |
| 3 | Lure Fish House | The polished alternative on upper State: oysters and hot sourdough. |
| 4 | Corks n' Crowns | Act three, fireside. |
| 5 | Santa Barbara Wine Collective | Or act three, industrial-chic — pick your mood. |

---

### Guide 5 · Theme — Free Santa Barbara (tag: free_sb)

**Kicker:** The best of this town costs nothing
**Intro:** Santa Barbara's greatest hits are free: the courthouse view, the beaches, the clifftop parks, thousand-year-old rock art in the hills. Here's the no-wallet circuit — and below it, whatever's free around town right now.

| # | Stop | Note |
|---|---|---|
| 1 | Santa Barbara County Courthouse | The tower, the gardens, the murals — all free, all remarkable. |
| 2 | Shoreline Park | Clifftop grass and the best casual whale-spotting odds in town. |
| 3 | Arroyo Burro Beach (Hendry's) | The locals' beach — driftwood, tide pools, and the dog-friendly stretch. |
| 4 | Chumash Painted Cave State Historic Park | Ten minutes up the pass: vivid Chumash pictographs behind a grate. Worth the winding road. |
| 5 | Santa Barbara Saturday Farmers Market | Free to wander, dangerous to your grocery budget. |

---

**Two decisions for you before handing this to Claude Code (answer inline here):**

1. **Cover images:** guides can carry a `cover_url`. Options: (a) reuse a stop's existing photo per guide, (b) leave covers empty for now (cards render without them; verify), or (c) hold covers for the motif library. My recommendation: **(a) for now** — Claude Code picks the most on-theme stop photo per guide and you veto at stop-and-show. Your call: ______
2. **Chaucer's Books** was drafted out of Downtown (it's Loreto Plaza, not downtown) — confirm you're fine leaving it for a future "Upper State" or bookstore-theme guide. Your call: ______

When you've edited, save this file into the repo (suggested: `docs/discover-seeding/W3a_guides.md`) and start a Claude Code session with Part 2 below as the kickoff.

---

# PART 2 — For Claude Code: the seeding spec

**Precondition:** Jim has edited Part 1 above. **Part 1 as edited is the approved content.** Your job is to land it in the database and prove it renders. This is a data-only task: **no schema changes, no application code changes** (one exception in step 4).

1. **Read** `CLAUDE.md`, `lib/guides.ts`, `app/(app)/discover/*`, and the `guides`/`guide_stops` schema (Doc 03 of the platform snapshot describes them: `guides {id,title,kicker,intro,kind,zone,tag,cover_url,status}` with `guide_scope_ck`; `guide_stops {guide_id,position,thing_id,label,note}` unique on `(guide_id,position)`).
2. **Resolve stops → thing ids.** For every stop in Part 1, look up the published thing by exact title (service-role read). Any miss: try a trigram-loose match, and if still ambiguous or absent, **stop and report it to Jim** — never guess, never create things. `[NEW — not in catalog]` markers are reported, not seeded.
3. **Write the seed** as both (a) `seed_guides.sql` committed to the repo (idempotent: deterministic uuids or `on conflict do nothing`) for provenance, and (b) apply it via a small `tsx` script using the service-role client (data insert only — this is DML, which the worker does routinely; the human-DDL rule is not triggered). Guides land `status='published'`; stops carry Part 1's notes as `note` and titles as `label`; neighborhood guides set `zone` and null `tag`, theme guides the reverse (the check constraint enforces this — respect it).
4. **Covers per Jim's decision** in Part 1. If (a): set each guide's `cover_url` to the chosen stop's `photo_url`. Verify `GuideCard` renders gracefully with AND without a cover; if a missing cover renders broken, a minimal fix to the card's empty-cover state is the one permitted code change (tokens only).
5. **Verify rendering:** `/discover` shows both groups (3 neighborhood, 2 theme); each `/discover/[id]` shows intro, ordered stops with notes, and the live-happenings cascade scoped correctly (funk-zone guide shows funk-zone happenings; `date_night` guide shows tagged happenings). ISR note: pages revalidate at 600s — use the dev server or wait it out; do not add revalidation machinery.
6. **Stop-and-show:** screenshots of `/discover` and all five guide pages at ~390px and ~1280px; the list of resolved thing-ids per guide; any misses/ambiguities; Doc 14 entry appended ("Discover SB seeded — 5 guides, N stops").

**Out of scope:** the Discover v3 passport/map/stamps experience; editing any guide *rendering* logic beyond the single permitted cover fix; adding guides beyond Part 1.

*End of Doc W3a.*
