# Guide 2 · State Street (First-timer) · Claude Code Build Spec (v1)

`Living Postcard arc, Phase 5 (guide scale-out), guide 2 of 8. Authority chain: CLAUDE.md (v10 + §5 caption exception) -> Ledger v4 (D-21 to D-25) -> Phase1_Content_Model_FunkZone_Paper v1.1 (as-built) -> Doc 14 (through 2026-07-05). Companion mockup: State_Street_Guide_Mockup_v8.html (canonical copy + sketch artwork). House law binds every seeded word and pixel.`

---

## 0. Scope and guardrails (read first)

**This is a SEED, not a migration.** The Phase-1 additive columns already shipped live with the Funk Zone guide (`guides.stamp_code / refreshed_on / now_note / now_note_on / content jsonb`; `guide_stops.chapter / sub / maps_query`). State Street needs **no DDL**. Everything below is DML into `guides` + `guide_stops` and one repo asset in `lib/guide-art.ts`.

- **DML only.** Seed via an idempotent SQL block or a service-role script (upsert by a stable natural key, e.g. `stamp_code = 'DT'`, so re-runs do not duplicate). DDL would be Jim's hands only, and none is needed.
- **Publish gate.** Seed with `status = 'draft'`. It stays draft until Jim approves at stop-and-show. Do not publish.
- **Tolerant render is already proven.** `parseGuideContent` renders a plain v1 guide when `content` is empty; this guide fills `content` fully, so it renders as the full Living Postcard.
- **Deferred, do not build:** Phase 3 (passport been-loop, stamps, gold ring, postcard reveal) and Phase 4 (hub passport spread). Ship `check Been` static and the passport slab at zero state, exactly as Funk Zone does today.
- **Jim's exclusives (never Claude's to finalize):** the planted ✵ wrong detail, the launch `now_note` (+ its date), and the publish approval. See §8.

**House law (restate in the PR):** no em dashes in any seeded copy (commas / semicolons / colons / periods; en-dash numeric ranges like `7–1` or `$15–25` are fine) · no AI at tap time · no invented facts (the single founder-authored ✵ is the only exception) · sponsor-blind ranking untouched · locked v9 tokens, zero new hex · WCAG 2.2 AA (terracotta permitted only on ≤9px all-caps mono decorative sketch-caption micro-labels) · reuse the live component vocabulary, do not reinvent it.

---

## 1. The `guides` row

| Column | Value | Notes |
|---|---|---|
| `title` | `State Street (First-timer)` | The guide's canonical name. **Derived short label** (strip the parenthetical) = `State Street`, used by the sticky bar (`who`) and the passport (`Your State Street`), exactly as the v8 mockup renders it. See §8 if you would rather store the short form separately. |
| `kicker` | `State Street and the blocks that reward wandering off it` | Hub card, and the identity header when non-null. |
| `intro` (the deck) | `State Street gets the postcards, but its best hours happen a block off it, in the courthouse gardens, the old bookstores, and the tiled arcades. Walk it downhill from the upper theaters to the old Presidio, and let the side streets do the work.` | The two-line standfirst under the title. |
| `kind` | `neighborhood` | |
| `zone` | `downtown` | `nearby_zone` enum value. Satisfies `guide_scope_ck` (neighborhood ⇒ zone set). |
| `tag` | `null` | Neighborhood guide, no occasion tag. |
| `stamp_code` | `DT` | Passport + postcard stamp. Matches the catalogue (D-23). |
| `refreshed_on` | `2026-07-01` | Renders `REFRESHED JUL 2026` in the colophon + meta. |
| `now_note` | **Jim authors** (placeholder below) | See §8. Placeholder in the mockup: `The long July evenings are the reward down here. Do the sights while it is light, then let the walk end slow on a Presidio patio as the heat lets go.` |
| `now_note_on` | **Jim authors** (e.g. `2026-07-05`) | Dated honesty on the "Right now" block. |
| `cover_url` | (hub card art, optional) | Not required to ship the guide page. |
| `status` | `draft` | Publish only on Jim's approval. |

---

## 2. `guides.content` jsonb

Full object below. Shape and validation follow the `GuideContent` type in `lib/guides.ts` (same as Funk Zone).

### 2.1 meta
```jsonc
"meta": { "distance_mi": 1.0, "plan_hrs": [5, 7] }
```
Roughly a mile of mostly downhill walking; a first-timer doing the whole arc (coffee through dinner) should plan 5 to 7 hours.

### 2.2 chapters (index = `guide_stops.chapter`)
```jsonc
"chapters": [
  { "k": "Stops 1–3 · Upper State", "name": "The top of the street",
    "sum": "Coffee across from the Arlington, a graze at the market, then point downhill.",
    "tod": "morning" },
  { "k": "Stops 4–6 · The core", "name": "A block off State",
    "sum": "Lose an hour in the stacks, climb the tower, then cut through the arcade.",
    "tod": "afternoon" },
  { "k": "Stops 7–9 · The evening", "name": "The old fort, a pour, then dinner",
    "sum": "The 1782 fort before it closes, a courtyard cocktail at golden hour, then supper under the neon dove.",
    "tod": "evening" }
]
```
`tod` drives the deterministic "Now" tag from clock time. Chapter 3 is `evening`.

### 2.3 asides ("From a local"; `after_chapter`, 0 = before ch.1)
```jsonc
"asides": [
  { "after_chapter": 1,
    "text": "The Courthouse tower is free and rarely has a line before noon. Go up while it's early, the view is the best in town and costs you nothing." },
  { "after_chapter": 2,
    "text": "State Street's real trick is the paseos, the tiled passages cutting between the main drag and the side streets. When the street feels busy, duck into one; you come out somewhere quieter and prettier." }
]
```

### 2.4 take
```jsonc
"take": {
  "h": "Best hour on State Street, ranked.",
  "items": [
    { "b": "The tower climb", "rest": " at the Courthouse: the best free view in town, and you paid nothing for it." },
    { "b": "The old Presidio", "rest": ": the 1782 adobes and a hushed courtyard, the city at the spot where it began." },
    { "b": "A slow browse at the Book Den", "rest": ": go in for a minute, lose twenty." }
  ],
  "landing": "Three very different hours, all a short walk apart. String them together and you have done State Street right."
}
```

### 2.5 know_before (four rows, verbatim from the mockup)
```jsonc
"know_before": [
  { "k": "Parking", "v": "Use the city structures off State, not the street meters; the first 75 minutes are free and you are a block from every stop." },
  { "k": "Budget", "v": "The headline sights (the tower, the gardens, the Presidio, the arcade) cost little or nothing. Budget for one meal, one round, and whatever the Book Den talks you into." },
  { "k": "Restrooms", "v": "Reliable restrooms at the Public Market, the Courthouse, and Paseo Nuevo; plan around those three." },
  { "k": "Timing", "v": "This is a Wednesday to Sunday walk (Paloma is closed Mondays and Tuesdays). Start late morning: the Courthouse tower and El Presidio both close by 4:30, so see them while it is light, then the Palihouse courtyard and Paloma's dinner (from 5) carry the evening." }
]
```

### 2.6 postcard_captions (static buckets 3 / 6 / 8 / 9, no AI at tap time)
```jsonc
"postcard_captions": {
  "b1_3": "The top of the street, done.",          // DRAFT, Jim to bless
  "b4_6": "Off State and into the good part.",      // DRAFT, Jim to bless
  "b7_8": "One pour from the finish.",              // DRAFT, Jim to bless
  "b9":   "Nine stops. One of them keeps its own time."  // LOCKED wink (pairs with the ✵)
}
```
`b9` is the chosen wink and is load-bearing: it points at the ✵ (see §8). The three earlier captions are house-voice drafts pending Jim's blessing.

### 2.7 secret_tease + sketch
```jsonc
"secret_tease": "Somewhere on this walk, one detail is wrong on purpose.",
"sketch": { "kind": "sketch", "asset": "state-street", "no": 2 }
```
`no: 2` is metadata only, never rendered.

---

## 3. The nine `guide_stops`

`position` 1–9, `chapter` per band. **`sub` and `maps_query` are label-only fallbacks.** For any stop that resolves to a live `thing`, leave `sub` NULL and let the sub-line auto-derive (street · category · price) from thing data, and let directions build from the thing's `lat`/`lng`. Populate the authored `sub`/`maps_query` below **only** for stops that end up label-only after resolution (§4). `note` is always seeded.

| pos | ch | label | resolve-by-title (see §4) | fallback `sub` | fallback `maps_query` |
|---|---|---|---|---|---|
| 1 | 1 | Caje | Caje | `1316 State St · Coffee · $` | `Caje Coffee 1316 State St Santa Barbara` |
| 2 | 1 | The Arlington Theatre | The Arlington Theatre | `1317 State St · Historic theater` | `Arlington Theatre 1317 State St Santa Barbara` |
| 3 | 1 | Santa Barbara Public Market | Santa Barbara Public Market | `38 W Victoria St · Food hall · $$` | `Santa Barbara Public Market 38 W Victoria St` |
| 4 | 2 | The Book Den | The Book Den | `15 E Anapamu St · Bookstore · $` | `The Book Den 15 E Anapamu St Santa Barbara` |
| 5 | 2 | Santa Barbara County Courthouse | Santa Barbara County Courthouse | `1100 Anacapa St · Landmark · Free` | `Santa Barbara County Courthouse 1100 Anacapa St` |
| 6 | 2 | La Arcada Courtyard | La Arcada / La Arcada Courtyard | `1114 State St · Courtyard · Free` | `La Arcada 1114 State St Santa Barbara` |
| 7 | 3 | El Presidio de Santa Barbara | El Presidio de Santa Barbara | `123 E Canon Perdido · Historic park · $` | `El Presidio de Santa Barbara 123 E Canon Perdido St` |
| 8 | 3 | Palihouse | Palihouse / Palihouse Santa Barbara | `915 Garden St · Cocktail bar · $$` | `Palihouse Santa Barbara 915 Garden St` |
| 9 | 3 | Paloma | Paloma | `702 Anacapa St · Californio · $$$` | `Paloma 702 Anacapa St Santa Barbara` |

**Stop notes (`note`), verbatim from the v8 mockup:**

1. **Caje** · Start with a coffee from Caje, in the fountain courtyard across from the Arlington. Order it to go; the walk runs downhill from here.
2. **The Arlington Theatre** · The Moorish movie palace with a tiled courtyard and a ceiling painted like a night sky. Peek in even if nothing is showing.
3. **Santa Barbara Public Market** · One roof, many kitchens: Thai, tacos, a wine bar, a bakery. A good place to graze or regroup before you drop into the core.
4. **The Book Den** · California's oldest used bookstore, founded in 1902 and tucked just off the plaza on Anapamu across from the library. The stacks reward a slow browse; leave more time than you think.
5. **Santa Barbara County Courthouse** · Climb the clock tower for the best free view in town, with hand-painted ceilings on the way up and the sunken gardens waiting below. *(This is the ✵ stop; see §8. Jim plants one deliberately wrong detail here.)*
6. **La Arcada Courtyard** · The Spanish courtyard hiding off State: fountains, bronze figures tucked in corners, and a handful of small shops. The prettiest shortcut on the street.
7. **El Presidio de Santa Barbara** · The 1782 Spanish fort where the city began, restored adobe by adobe. Wander the chapel and the shady courtyard, plan on under an hour. It closes at 4:30, so make this the last stop in daylight, then it is a short walk to the evening's first drink.
8. **Palihouse** · A craft cocktail in the Palihouse courtyard, a fountain, pale pink umbrellas, and market lights strung overhead. The prettiest place to catch golden hour, tucked a few steps off the beaten path in the Presidio blocks, and an easy walk on to dinner.
9. **Paloma** · Dinner on the corner of Ortega under the old neon dove, wood-fired Californio cooking in a room that has fed this block for a century. Closed Mondays and Tuesdays; the patio is the seat to want.

---

## 4. Title resolution against the live catalog (`things`)

Resolve each label against `things.title` (case-insensitive, trigram-assisted). **Miss ⇒ REPORT, never invent.** Do not fabricate a thing, a lat/lng, or an address. For each miss, either (a) Jim adds the thing to the catalog (preferred, so the sub-line and directions auto-derive), or (b) the stop ships **label-only** (`thing_id = NULL`) using the authored `sub` + `maps_query` fallback from §3.

Report resolution as a table: label -> matched `thing.id` (+ matched title) or `MISS`.

**Expected resolutions (flag anything different):**
- Likely present in the downtown pool: Caje, The Arlington Theatre, Santa Barbara Public Market, The Book Den, El Presidio de Santa Barbara, Paloma.
- Possible label-only landmarks if absent: Santa Barbara County Courthouse, La Arcada Courtyard.
- **Palihouse (915 Garden St) is the most likely MISS** (a hotel bar, probably not yet ingested). If missing, flag it for Jim; it ships label-only until he adds it. Also see the open item in §8 about its public bar hours.

---

## 5. Sketch artwork -> `lib/guide-art.ts`

Add a `state-street` entry following the funk-zone pattern (markers layer keyed by `position` + a `secretMark`), **tokens-only palette, zero raw hex**. The canonical artwork is the sketch-plate SVG in `State_Street_Guide_Mockup_v8.html` (viewBox `0 0 360 330`): the light street grid (State / Anacapa / Chapala verticals; Victoria / Anapamu / Figueroa / Canon Perdido / Ortega crosses), the hand-drawn landmarks (Arlington marquee, Courthouse clock tower, La Arcada arch + fountain, Book Den book, El Presidio adobe + bell, Paloma neon dove, Palihouse cocktail glass), the three palms, the lower-left beach vignette, the "the mountains" / "the Pacific" scripts, the compass, and the terracotta sketch-caption micro-labels. Port it as-is, swapping the mockup's raw hex for the equivalent v9 token variables (the mockup hexes map 1:1 to locked tokens: ink `#241C16`, terracotta `#C0532E`, plaster `#FCFAF5`, gold `#7A5E13`, etc.).

**Marker coordinates (viewBox units), route order:**

| pos | stop | x | y |
|---|---|---|---|
| 1 | Caje | 136 | 74 |
| 2 | The Arlington Theatre | 182 | 68 |
| 3 | Santa Barbara Public Market | 70 | 94 |
| 4 | The Book Den | 208 | 122 |
| 5 | Santa Barbara County Courthouse | 256 | 140 |
| 6 | La Arcada Courtyard | 156 | 148 |
| 7 | El Presidio de Santa Barbara | 236 | 210 |
| 8 | Palihouse | 298 | 216 |
| 9 | Paloma | 256 | 260 |

**secretMark (✵):** viewBox `(271, 114)`, beside the Courthouse clock tower (stop 5). This is the visual anchor of the secret; keep it near the tower.

**Route path (dashed spine), for reference:** `M136 74 Q158 62 182 68 Q120 78 70 94 Q140 118 208 122 Q235 128 256 140 Q206 156 156 148 Q196 178 236 210 Q272 206 298 216 Q284 244 256 260`.

The terracotta caption micro-labels are the ratified CLAUDE.md §5 exception (≤9px all-caps mono decorative). "Sketch Nº" does not render in the colophon (as-built deviation).

---

## 6. Companion change (OPTIONAL, Jim's call) · Funk Zone chapter-card treatment

For cross-guide visual consistency, adopt the chapter-card treatment ratified this session on the live Funk Zone page too, so both guides read identically:
- **Collapsed:** full terracotta fill (token equivalent of `#C0532E`), white chapter title/summary; the "Now" tag as a white pill with terracotta text.
- **Open:** light `plaster2` fill, terracotta-red chapter title (`.nm`); the "Now" tag in the gold style.
- Chapters still start **collapsed** in production, with the floating hint pill.

This is not required to ship State Street; it is a consistency pass. Leave it out if Jim wants to defer. If included, it is a pure CSS/token change to the shared chapter-band component, no data change.

---

## 7. Verified facts appendix (copy source-of-truth)

Web-verified this planning cycle. Use these for any freshness check and as the anchor for the ✵ (§8). Hours change; re-confirm at seed time if stale.

| Stop | Address | Hours / key facts |
|---|---|---|
| Caje | 1316 State St | Daily ~7 AM–1 PM (mornings only). Fountain courtyard across from the Arlington; signature drinks dine-in only; dog-friendly. |
| The Arlington Theatre | 1317 State St | Exterior/courtyard viewable anytime; interior only on show nights. Moorish movie palace. |
| SB Public Market | 38 W Victoria St | Daily ~8 AM–9 PM (Thu–Sat to 10). Food hall, many vendors. |
| The Book Den | 15 E Anapamu St | Mon–Sat 10–6, Sun 11–5. California's oldest used bookstore, founded 1902 (moved to SB 1933). |
| SB County Courthouse | 1100 Anacapa St | Mon–Fri 8–5, weekends 10–5; **no entry after 4:30**, tower closes ~30 min before the building. Free. First 75 min free at Lot 7 across Anacapa. Restrooms on floors 1–2. |
| La Arcada Courtyard | 1114 State St | Open-air courtyard anytime; shops ~10–6. |
| El Presidio de Santa Barbara | 123 E Canon Perdido St | Daily 10:30 AM–4:30 PM. $5 adult; ~20–40 min. 1782 Spanish fort; El Cuartel is the second-oldest building in California. |
| Palihouse | 915 Garden St | Boutique hotel (former Spanish Garden Inn), Presidio neighborhood, ~5-min walk from El Presidio, 3 blocks off State. Garden Café & Cocktail Bar + lobby lounge; Mediterranean courtyard, fountain, pale pink umbrellas, market lights. Reviews confirm afternoon/evening cocktail service. **Public walk-in hours to confirm (§8).** The free 5–6 PM drink is a hotel-guest perk, not the public offer. |
| Paloma | 702 Anacapa St (at Ortega) | **Closed Mon and Tue.** Dinner from 5 PM (Wed/Thu/Sun to 9, Fri/Sat to 10); happy hour ~4–6:30. Acme Hospitality; wood-fired Californio/Mexican; vintage neon dove. |

**Route timing (10 AM start, Wed–Sun):** Caje 10:00 · Arlington 10:30 · Public Market 10:45 · Book Den 11:45 · Courthouse 12:30 · La Arcada 1:45 · El Presidio 3:00 (under an hour, well clear of the 4:30 close) · Palihouse 4:30 · Paloma 5:30. Every stop is open on arrival with buffer; the evening three sit within a few blocks in the Presidio cluster.

---

## 8. Open items and Jim's exclusives (blockers to publish, not to seed-as-draft)

1. **The ✵ wrong detail (founder-authored).** The `b9` wink is locked: "Nine stops. One of them keeps its own time." It pairs with a deliberately wrong **time** detail near the Courthouse clock tower (stop 5). Jim plants the exact wrong detail silently as a copy edit to the stop-5 `note`; it is never marked, never questioned, never "corrected." The ✵ on the sketch already sits by the tower at (271,114). *Do not invent this detail; wait for Jim's edit.*
2. **`now_note` + `now_note_on`.** Jim finalizes and blesses (placeholder in §1).
3. **Publish approval.** Jim flips `status` draft -> published at stop-and-show. Not Claude Code's call.
4. **Palihouse verification.** Confirm the Garden Café & Bar's public walk-in cocktail hours (afternoon/evening service is confirmed by reviews; exact public hours warrant a phone check), and confirm/add its catalog presence (likely a MISS in §4).
5. **Title vs derived short label.** Recommended: `title = "State Street (First-timer)"`, with the sticky/passport stripping the parenthetical to "State Street" (as the v8 mockup does). If that derivation is awkward in the renderer, the fallback is `title = "State Street"` plus a small `content.qualifier = "First-timer"` field. Jim's call; default to the recommended form.

---

## 9. Acceptance and stop-and-show

- Seed `guides` + 9 `guide_stops` as **draft**; add the `state-street` art entry to `lib/guide-art.ts`.
- Prove additivity: an un-migrated / empty-content guide still renders as a plain v1 page (no regression).
- Screenshots at ~390px and ~1280px of `/discover/[id]` for the new guide.
- Append a Doc 14 entry (what was seeded, resolution results from §4, any label-only fallbacks used, and the optional §6 companion status).
- Report the §4 resolution table and any MISS to Jim. Then hold for Jim's ✵ edit, `now_note`, and publish approval.

*End of spec v1. Companion artwork + copy: State_Street_Guide_Mockup_v8.html.*
