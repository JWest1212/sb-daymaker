# Phase 1 — Guides Content Model + Funk Zone on Paper

`Living Postcard arc · Phase 1 gate artifact · 2026-07-04 · references Ledger v4 (D-21→D-25) · APPROVAL DOC — no DDL runs until Jim approves this expression, then the Claude Code spec is written from it verbatim`

---

## Part A — The proposed model

**Design rule:** everything additive, nothing renamed, nothing dropped. The existing plain-guide renderer keeps working mid-migration (a guide with empty new fields renders as a plain v1 guide). Three kinds of home for content, chosen by one test each:

| Home | Test | Examples |
|---|---|---|
| **First-class column** | Cockpit edits it routinely, or a query/constraint needs it | `stamp_code`, `now_note`, `refreshed_on`, stop `chapter` |
| **`content jsonb`** | Render-only editorial blocks the app reads whole, never queries into | chapters copy, asides, the take, know-before, caption buckets, secret tease |
| **Repo asset** | Hand-drawn / hand-styled, versioned like code | sketch SVGs, theme emblems, ✵ placement, marker coordinates |

### A1 · `guides` — new columns (additive)

| Column | Type | Purpose |
|---|---|---|
| `stamp_code` | `text`, `unique` partial (where not null), `check (stamp_code ~ '^[A-Z]{2}$')` | FZ/DT/WF/MO/ME/DN/RD/FS — passport + postcard |
| `refreshed_on` | `date` | The editorial "REFRESHED JUN 2026" label + colophon + FAQ freshness. Distinct from `updated_at` (which bumps on any touch) |
| `now_note` | `text` | The "Right now" block body — the one time-sensitive line, edited in the cockpit inside the 15-min ceiling |
| `now_note_on` | `date` | Renders "updated Jun 28"; a stale date is visible honesty, not hidden staleness |
| `content` | `jsonb not null default '{}'` | Everything in A3 below |

Existing columns keep their jobs: `title` = the h2 · `kicker` = unused on the v5 page (hub-card only) · `intro` = **the deck** (the two-line standfirst under the title) · `kind`/`zone`/`tag` = scoping exactly as today · `cover_url` = hub card art · `status` = publish gate.

**One enum change (D-24):** `alter type occasion_tag add value 'rainy_day'` — ▶ JIM RUNS THIS, with the migration twin.

### A2 · `guide_stops` — new columns (additive)

| Column | Type | Purpose |
|---|---|---|
| `chapter` | `smallint not null default 1` | Which chapter band the stop belongs to (1-based). Grouping is data, not arithmetic — chapters can be uneven |
| `sub` | `text` | The editorial sub-line ("State St · Science museum · $$"). Authored, not derived — the mockup's short forms are voice, and label-only stops have no thing to derive from |
| `maps_query` | `text` | Directions deep-link override. Default behavior: things-backed stops build the maps URL from the thing's `lat`/`lng`; this column covers label-only stops ("The mural walls") and cases where the pin should differ from the thing's address |

Existing columns keep their jobs: `position` = the 1–9 number · `label` = stop title · `note` = the stop body paragraph · `thing_id` nullable = **label-only stops are already legal** (mural walls, the sand) — no change needed, which is the quiet win of this model.

### A3 · `guides.content` jsonb — the shape (documented in the spec as a TS type, validated in `lib/guides.ts`)

```jsonc
{
  "meta": { "distance_mi": 1.3, "plan_hrs": [3, 5] },   // meta row + Phase-6 FAQ source
  "chapters": [                                          // copy per chapter, index = guide_stops.chapter
    { "k": "Stops 1–3 · Morning", "name": "Pastry, science, murals",
      "sum": "The zone before the crowds — start with the croissant.", "tod": "morning" }
  ],                                                     // tod ∈ morning|afternoon|golden|evening → drives the "Now" tag deterministically from clock time
  "asides": [                                            // "From a local" cards
    { "after_chapter": 2, "text": "…" }                  // placement = after chapter N (0 = before ch.1)
  ],
  "take": { "h": "Best bite in the zone, ranked.",
            "items": [ { "b": "The clam pie", "rest": " at Lucky Penny — order it before you think about it." } ],
            "landing": "Disagree? Good. That's what the walk is for — go build your case." },
  "know_before": [ { "k": "Parking", "v": "…" } ],       // also the Phase-6 FAQ/structured-data source
  "postcard_captions": { "b1_3": "…", "b4_6": "…", "b7_8": "…", "b9": "…" },  // D-13: static buckets, no AI at tap time
  "secret_tease": "Somewhere on this walk, one detail is wrong on purpose.",   // D-25: existence only
  "sketch": { "kind": "sketch", "asset": "funk-zone", "no": 1 }               // → repo asset registry; themes use kind:"emblem"
}
```

**What deliberately has no schema:** the ✵'s wrong detail (lives invisibly inside editorial copy — D-25) · marker x/y coordinates and ✵ placement (inside the repo sketch asset module, keyed by `position`) · stamps/been state (client-side: been derives from `sbd.saves.v1`, pressed dates in `sbd.stamps.v1` — Phase 3) · chapter open/closed state (ephemeral UI).

**RLS/indexes:** no new policies needed (new columns ride existing row policies). No new indexes — `content` is never queried into, `stamp_code` is 8 rows.

---

## Part B — The Funk Zone, expressed in full

Provenance key: **[M]** = v5 mockup canonical · **[W]** = W3a substrate · **[P2]** = Jim authors at Phase 2 stop-and-show (drafted here only to prove the slot exists).

### `guides` row

| Field | Value |
|---|---|
| `title` | The Funk Zone **[M]** |
| `kicker` | Wine, art, and salt air in twelve walkable blocks **[W]** (hub card only) |
| `intro` (deck) | Six blocks of tasting rooms, murals, and repurposed fish warehouses between the tracks and the sand. The rare tourist district locals never surrendered. **[M]** |
| `kind` / `zone` / `tag` | neighborhood / funk / null |
| `stamp_code` | FZ |
| `refreshed_on` | 2026-06 **[M]** |
| `now_note` | June gloom is burning off by noon this week — do the murals and MOXI in the gray, save the wine for the sun. **[M]** |
| `now_note_on` | 2026-06-28 **[M]** |
| `status` | published (at Phase 2 close) |

### `content` — meta, chapters, asides

- `meta`: `{ distance_mi: 1.3, plan_hrs: [3,5] }` **[M]**
- `chapters`:
  1. "Stops 1–3 · Morning" · "Pastry, science, murals" · "The zone before the crowds — start with the croissant." · tod: morning **[M]**
  2. "Stops 4–6 · Afternoon" · "The wine blocks" · "Two pours and a palate-cleansing pint." · tod: afternoon **[M]**
  3. "Stops 7–9 · Golden hour" · "Pizza, dinner, the sand" · "The zone's best two hours." · tod: golden **[M]**
- `asides`:
  - after_chapter 2 · "Tasting rooms hit capacity around 3 on Saturdays. Want the pourers chatty and the couches open? Come Sunday before noon." **[M]**
  - after_chapter 3 (post-take slot) · "The train horn isn't an emergency — it's the neighborhood's grandfather clock. Locals set their pours by it." **[M]**

### `guide_stops` — nine rows

| pos | ch | label | thing? | sub | note |
|---|---|---|---|---|---|
| 1 | 1 | Helena Avenue Bakery | resolve by title | Helena Ave · Bakery · $$ **[P2]** | **[P2]** — take's "breakfast sandwich, gone by 11" is the raw material **[M]** |
| 2 | 1 | MOXI | resolve ("MOXI, The Wolf Museum…") **[W]** | State St · Science museum · $$ **[M]** | Three floors of hands-on science that adults pretend is just for the kids. Go up to the Sky Garden — it's the best free harbor view in the zone. **[M]** |
| 3 | 1 | The mural walls | **null — label-only** | Off Helena & Gray Ave · Free **[M]** · maps_query: "Funk Zone murals Helena Ave Santa Barbara" | The alleys off Helena are an open-air gallery that repaints itself a few times a year. Free, always open, and the best backdrop in town for a photo. **[M]** |
| 4 | 2 | Pali Wine Co. | resolve **[W]** | Anacapa St · Tasting room · $$ **[P2]** | Start easy: small-lot Pinot in a relaxed room, no ceremony. **[W]** |
| 5 | 2 | Santa Barbara Wine Collective | resolve **[W]** | Anacapa St · Tasting collective · $$ **[P2]** | One roof, many local producers — the efficient way to find your favorite. **[W]** |
| 6 | 2 | Topa Topa Brewing Co. | resolve **[W]** | Yanonali St · Brewery · $$ **[P2]** | The palate-cleansing pint **[M ch.2 sum]**; airy Waterline space, good for mixed wine/beer groups. **[W]** |
| 7 | 3 | Lucky Penny | resolve **[P2]** | Anacapa St · Pizza · $$ **[P2]** | **[P2]** — the take's clam pie is the anchor **[M]** |
| 8 | 3 | The Lark | resolve **[P2]** | Anacapa St · Dinner · $$$ **[P2]** | **[P2]** — the take's brussels sprouts **[M]** |
| 9 | 3 | The sand | **null — label-only** | End of Anacapa · Free **[P2]** · maps_query: "Santa Barbara East Beach at Anacapa" **[P2]** | **[P2]** — "the sand" close is mockup-canonical as the walk's destination **[M ch.3]** |

### `content` — take, know-before, captions, secret

- `take` **[M]**: h "Best bite in the zone, ranked." · 1 **The clam pie** at Lucky Penny — order it before you think about it. · 2 **The brussels sprouts** at The Lark — yes, really, the sprouts. · 3 **The breakfast sandwich** at Helena Avenue — gone by 11. · landing "Disagree? Good. That's what the walk is for — go build your case."
- `know_before` **[M]**: Parking / Budget / Restrooms / Timing — the four rows verbatim from Frame 01.
- `postcard_captions` **[M]**: b1_3 "Off and walking." · b4_6 "The wine blocks are next." · b7_8 "Two from the stamp." · b9 "Every stop. Even the wrong-way penny."
- `secret_tease` **[M]**: "Somewhere on this walk, one detail is wrong on purpose."
- `sketch`: `{ kind:"sketch", asset:"funk-zone", no:1 }` — the Frame-01 SVG becomes the first registry asset; marker coords for positions 1–9 and the ✵ placement live in that module.

### Fit check — every v5 surface has exactly one home

Sticky bar ✓ (derived: title + stop count + chapter names) · title block ✓ (title/intro/meta) · now block ✓ (now_note + happenings cascade, already built) · passport slab ✓ (stamp_code + secret_tease + client state) · chapter bands ✓ (chapter col + content.chapters) · stop cards ✓ (label/sub/note/thing_id/maps_query) · JT-2 directions ✓ (lat/lng or maps_query) · asides ✓ · take ✓ · know-before ✓ · colophon ✓ (refreshed_on + sketch.no) · postcard ✓ (captions + sketch asset + stamp_code) · Frame-05 emblem ✓ (sketch.kind:"emblem") · Frame-06 FAQ ✓ (meta + know_before). **No orphan content, no orphan columns.**

---

## Part C — What the Claude Code spec will contain once you approve

1. ▶ JIM RUNS THIS: one migration — `rainy_day` enum value + the five `guides` columns + three `guide_stops` columns (idempotent, migration twin committed).
2. `lib/guides.ts`: the `GuideContent` TS type + a parse/validate helper; plain guides (empty content) still render.
3. The sketch asset registry module (empty scaffold + the funk-zone asset slot; the actual SVG lands in Phase 2).
4. Doc 14 entry + stop-and-show: schema in place, `/discover/[id]` renders an un-migrated guide unchanged (proof of additivity).

**Open items carried to Phase 2, not blockers:** title-resolution of Helena Avenue Bakery / Lucky Penny / The Lark against the live catalog (W3a's rule applies — miss ⇒ report, never invent); the [P2] copy above is slot-proof only and awaits your authoring; the FZ ✵ wrong detail is yours to plant ("wrong-way penny" suggests you already know it).

*End of Phase 1 paper. Approve, adjust, or challenge any home — then the spec.*
