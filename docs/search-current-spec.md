# SB Daymaker — Current Search Functionality Spec

Read-only investigation of the search feature **as it actually exists in the codebase**
on branch `elevation-v1-gate0`. Every claim below is grounded in a named file. Where the
code doesn't answer a question, it says so with `UNVERIFIED:`.

Search was built for the "Home Rework spec" (`docs/hero_picker_search/15_SBDaymaker_Home_Rework_Spec.md`,
§9). The code repeatedly cites that spec's section numbers and the constraint **"C3: no
Claude call, ever."**

---

## 1. Entry point & UI

**Trigger.** A magnifier icon button, top-right of the global brand header, across from
the wordmark. Component: [SearchButton.tsx](../components/explore/SearchButton.tsx) —
renders `<button class="sbd-search-btn" aria-label="Search">` with an `SBIcon name="search"`.

- **No keyboard shortcut.** There is no `/`, `Cmd+K`, or any global keydown that opens
  search. The only way in is tapping the magnifier. (Grep of the search components shows
  keydown listeners only for **Escape-to-close** inside the open panel, not for opening.)

**Where it's available.** The trigger lives in [BrandHeader.tsx](../components/BrandHeader.tsx),
which mounts `<HeaderSearch />`. BrandHeader is rendered once in the `(app)` route-group
layout, so search appears on **every browse page in the `(app)` group** — Explore (home),
Saved, Discover SB, and `/thing/[id]` detail screens. The header comment states search is
"reachable from every page, not just Explore."

**Form factor.** It is a **full-width slide-down overlay panel**, not an inline bar and not
a dedicated route.
- [SearchPanel.tsx](../components/explore/SearchPanel.tsx) is the overlay. It renders a
  fixed-position panel (`position: fixed; top:0; left:0; right:0; z-index:121`) that
  animates from `translateY(-100%)` to `translateY(0)` via the `.is-open` class
  ([components.css:6367](../app/components.css#L6367)). A dimming scrim
  (`.sbd-search-scrim`) sits behind it.
- The panel contains: a pill-shaped input field with an inline magnifier icon, a **"Cancel"**
  text button, a `aria-live` meta line ("N matches for …"), and a results `<ul>`.

**Component wiring.**
[HeaderSearch.tsx](../components/explore/HeaderSearch.tsx) owns the open/closed state and
composes `SearchButton` + `SearchPanel`. Notably it gates the panel behind an `everOpened`
flag (see §7) so the panel is not in the SSR output until first opened.

**Shared components.** The overlay does **not** share a component with the Explore filter
sheets (Vibe/Place/Activity). Those are separate (rendered inside `ExploreClient`, class
`sbd-sheet`). The **one** shared primitive is the focus-trap hook
[useFocusTrap.ts](../lib/useFocusTrap.ts) (`LC-7`), which the SearchPanel reuses and which
is also used by the admin Venues sheet. SearchPanel is otherwise bespoke.

---

## 2. What it searches over

All matching lives in one pure function, `searchThings()` in
[lib/search.ts](../lib/search.ts). It produces **three independent result groups**:

| Group | Source | Field(s) matched |
|-------|--------|------------------|
| **Events** | published `things` | `thing.title` **only** |
| **Venues** | the `venues` table (`display_name`), joined to things via `venue_id` | `venue.display_name` |
| **Tags** | the two controlled display vocabularies in code | `OCCASIONS[].label` (Vibe) + `DOOR_ZONES[].label` (Place) |

**Important limits on field coverage:**
- Events match against **`title` and nothing else**. `blurb`, `blurb_long`, `local_note`,
  `reason_to_go`, `happening_category`, `neighborhood`, `nearby_zone`, `address`, and the
  `tags[]` array are **not** searched. (Confirmed by reading `searchEvents()` — it only
  reads `t.title`.)
- Venues match against the venue's `display_name` (from `getVenueNames()` in
  [lib/venues.ts](../lib/venues.ts), which selects `id, display_name` from `venues`). A
  venue only appears if it has at least one published thing attached via `venue_id`.
- "Tags" are **not** database tags. They are the hardcoded label strings of the 9 occasions
  ([lib/occasions.ts](../lib/occasions.ts) — Date Night, Family Day, Nightlife, Catch a Show,
  Arts & Culture, Outdoors & Active, Wine & Food, Free in SB, Hosting Visitors) and the 8
  door zones ([lib/doorZones.ts](../lib/doorZones.ts) — Downtown & State Street, Funk Zone,
  Waterfront & Harbor, The Mesa, Mission & Riviera, Uptown & Upper State, Goleta & Isla
  Vista, Montecito · Summerland · Carpinteria).

**Tables searched.** Effectively **`things`** (events + places) and **`venues`** (name
only). **Not searched:** guides / Discover SB content, and there is no separate `events`,
`recurring`, or `guides` search path. (Recurring/happy-hour data rides on `things` rows but
only the `title` is matched.)

**Full dataset vs. subset.** The query runs over the **full published set**, not just the
cards currently on screen. The API route calls `getPublishedThings()`
([lib/things.ts:184](../lib/things.ts#L184)), which selects the **entire** `things` table
(ordered by `happening_tier`), then filters out only `quality_tier === 3` (quarantined).
There is no horizon/date/lens filter applied before search. So a title that is *not*
currently visible in the feed is still findable.
- UNVERIFIED (exact count): the DB reportedly holds ~265 things; the code doesn't cap the
  fetch, so the effective corpus is "all published, non-quarantined things." I did not query
  the live DB to confirm the number.

---

## 3. How matching works

**Algorithm: case-insensitive substring match with a 2-level prefix/substring rank.**
There is **no** full-text search, **no** trigram, and **no** fuzzy/typo tolerance. The whole
matcher is ([lib/search.ts:35](../lib/search.ts#L35)):

```ts
/** 0 = exact prefix match, 1 = substring match, null = no match. Case-insensitive. */
function matchRank(label: string, q: string): 0 | 1 | null {
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 0;
  if (l.includes(q)) return 1;
  return null;
}
```

The query is normalized first (`normalizeQuery` = `raw.trim().toLowerCase()`), so matching is
**case-insensitive** (both sides lowercased).

**Typo tolerance — proven absent.** `matchRank` uses only `String.startsWith` / `String.includes`.
A query of `"loqita"` produces `"loquita".includes("loqita")` → **`false`** (the stored
string has a `u` the query lacks; `includes` requires a contiguous substring). So **"loqita"
does NOT match "Loquita".** Any missing/transposed/extra character breaks the match. This is
exact-substring, full stop.

**Ranking / ordering** (per group):
- **Events:** exact-prefix hits (rank 0) before substring hits (rank 1); within the same
  rank, soonest `starts_at` first, and undated things sort **last**
  ([search.ts:52](../lib/search.ts#L52)).
- **Venues:** rank 0 before rank 1; ties broken **alphabetically** by name
  ([search.ts:84](../lib/search.ts#L84)).
- **Tags:** rank 0 before rank 1; ties broken **alphabetically** by label
  ([search.ts:104](../lib/search.ts#L104)).
- Each group is **capped at 5** (`CAP = 5`); anything beyond is reported as an overflow count
  ("+N more"), not shown.

The three groups always render in a fixed order in the UI: **Events, then Venues, then Tags**
(SearchPanel builds `rows` in that sequence).

---

## 4. Where it runs

**Server-side route, invoked from a debounced client fetch.**
- Client: `SearchPanel` fires `fetch(/api/search?q=…)` from a `useEffect`, debounced **180 ms**
  after the last keystroke, with `AbortController` cancellation of the in-flight request
  ([SearchPanel.tsx:50](../components/explore/SearchPanel.tsx#L50)).
- Server: [app/api/search/route.ts](../app/api/search/route.ts) — a `GET` handler, `export
  const dynamic = "force-dynamic"`. It loads `getPublishedThings()` + `getVenueNames()` fresh
  from Supabase on **every request** (in parallel via `Promise.all`) and runs the same pure
  `searchThings()` from `lib/search.ts`. So the matching logic is shared, but for the live
  site the filtering executes **on the server** against a freshly-fetched full dataset — it
  is not filtering already-loaded client data.

**AI at request time: NONE.** This is explicit and load-bearing. `lib/search.ts`'s header
says "Pure matching logic, no AI, no network." The route header says "deterministic, no AI."
`SearchPanel`'s effect comment says "Debounced deterministic search, no Claude call, ever
(constraint C3)." No Anthropic/Claude call, no embedding call, no external service is invoked
anywhere in the search path.

**Debounce / rate limit:**
- Debounce: 180 ms client-side (above).
- Rate limit: server-side, **per-IP, in-memory**, 40 requests / 10 s window
  ([route.ts:16](../app/api/search/route.ts#L16)). Over the limit returns HTTP **429**
  `{ error: "rate_limited" }`. The code itself notes this is a soft per-instance guard
  (resets on cold start, keyed off `x-forwarded-for`/`x-real-ip`), "not a security boundary."
  There are no accounts/sessions to key off.
- The route short-circuits an empty/whitespace `q` to an all-empty result **before** doing
  any DB read.

---

## 5. Results & navigation

**What a result row shows.** Minimal: a small **kind chip** ("Event" / "Venue" / "Tag") plus
the **label text**. That's it — **no image, no neighborhood, no price, no date, no blurb.**
Row markup is `<SearchRowTag>` + `<span class="sbd-search-row__name">{label}</span>`
([SearchPanel.tsx:143](../components/explore/SearchPanel.tsx#L143)). Chips are color-coded in
CSS (event = pacific, venue = sage, tag = plaster).

**What tapping does:**
- **Event hit** → Next `<Link>` to `/thing/{thing.id}`. The id is the **`things.id` value**
  (a UUID from the DB, passed straight through — `href: \`/thing/${r.t.id}\``). **Not a slug.**
- **Venue hit** → `<Link>` to `/thing/{targetId}`, where the target is resolved in
  `searchVenues()`: prefer the venue's own `type === "place"` card; else its **soonest dated
  event**; else the first thing at that venue ([search.ts:85](../lib/search.ts#L85)). Again a
  `things.id` UUID.
- **Tag hit** → **not** a link. It's a `<button>` that calls `onTagSelect(filter)`; there is
  no `href`. `HeaderSearch` handles it by `router.push('/?vibe=<key>')` or `'/?place=<key>'`.
  `ExploreClient` reads those params on mount, applies the Vibe/Place filter, then
  `router.replace('/')` to clear them ([ExploreClient.tsx:82](../components/explore/ExploreClient.tsx#L82)).
  This is how a tag hit tapped from any page (Saved, detail, etc.) still lands on a filtered
  Explore. (Per `search.ts`, an "activity" tag dimension is noted as **not yet wired** —
  "added once Phase 4 gives ExploreClient an `activity` filter to set.")
- Selecting any row calls `close()`, which resets the query and closes the panel.

**Empty / no-results state.** The `aria-live="polite"` meta line renders:
- With a query and ≥1 hit: `` `N match(es) for "query"` ``.
- With a query and 0 hits: `` `No matches for "query".` ``.
- With no query: nothing (null). No results list, no suggestions, no recent-searches, no
  "did you mean". ([SearchPanel.tsx:132](../components/explore/SearchPanel.tsx#L132))

---

## 6. Accessibility

Reporting only what's in the code:

- **Input label:** yes — the `<input>` has `aria-label="Search events, venues, tags"` (plus a
  matching visible `placeholder`). The panel container has `role="search"` and
  `aria-label="Search events, venues, and tags"`.
- **Focus trap:** yes — `useFocusTrap(panelRef, open)` traps Tab within the panel while open,
  cycling first↔last focusable ([useFocusTrap.ts:25](../lib/useFocusTrap.ts#L25)). On open it
  focuses the first focusable in the panel.
  - UNVERIFIED (subtle): the first focusable is whatever `querySelectorAll` returns first in
    DOM order — the text input precedes the Cancel button in markup, so the **input** should
    receive initial focus. The `inputRef` is declared but the component relies on the trap
    (not an explicit `inputRef.current.focus()`) for autofocus. Worth a manual check that the
    input, not the Cancel button, is focused on open.
- **Focus return on close:** yes — `useFocusTrap` stashes `document.activeElement` when it
  activates and calls `triggerRef.current?.focus()` in its cleanup, returning focus to the
  magnifier button when the panel closes.
- **Esc to close:** yes — a `keydown` listener calls `close()` on `Escape`
  ([SearchPanel.tsx:74](../components/explore/SearchPanel.tsx#L74)).
- **Keyboard-navigable results:** yes — each result is a real `<Link>` (event/venue) or
  `<button>` (tag), so they're tab-focusable and Enter/Space-activatable, with a
  `:focus-visible` outline in CSS.
- **Additional dismiss behaviors:** clicking the scrim closes; **scrolling the feed closes**
  (the scroll listener arms ~350 ms after open to avoid mobile autofocus-scroll immediately
  dismissing it).
- **Reduced motion:** the slide/scrim transitions are disabled under
  `prefers-reduced-motion: reduce` ([components.css:6544](../app/components.css#L6544)).
- **Live region:** the match-count line is `aria-live="polite"`.
- **Tap targets:** input, Cancel, and rows are all `min-height: 44px`.

---

## 7. Known quirks / dead code

- **"Cancel" SSR-leak mitigation (`G0.8`).** `HeaderSearch` deliberately does **not** render
  `SearchPanel` until the user first opens it, guarded by an `everOpened` state set in the
  click handler ([HeaderSearch.tsx:21](../components/explore/HeaderSearch.tsx#L21)). The
  comment explains the intent: keep the overlay — and specifically its "Cancel" control — out
  of the server-rendered HTML of every page. So on SSR there is **no panel and no stray
  "Cancel" in the markup**; it mounts on first open and then stays mounted (so the slide
  transition can replay). This looks like a fix for a prior bug where "Cancel" leaked into
  SSR. Not dead code, but the exact quirk you'd want to watch for is handled here.
- **Separate admin search — different implementation.**
  [app/api/admin/editions/[id]/search-things/route.ts](../app/api/admin/editions/%5Bid%5D/search-things/route.ts)
  is an **unrelated, admin-gated** search used by the edition/swap picker cockpit. It is
  **not** part of public search and behaves differently:
  - It queries Supabase directly with `.ilike("title", "%q%")` (a real DB case-insensitive
    substring), `status = 'published'`, `limit 15`, min query length 2, admin auth required.
  - Do not conflate this with the public path; they share nothing but the `things` table.
- **`inputRef` declared but not explicitly used to focus** (SearchPanel) — autofocus is left
  to the focus trap. Minor; noted above under §6.
- **Activity tag dimension is stubbed** — `search.ts` and `SearchHit.filter` only support
  `vibe` and `place`; activity tags are explicitly deferred ("once Phase 4 gives
  ExploreClient an `activity` filter"). So activity is a partially-designed but unwired branch.
- **No half-built duplicate search UI found.** The only search components are
  `SearchButton`, `SearchPanel`, `HeaderSearch` (all wired and used). I found no orphaned/
  disabled public search component.

---

## 8. File inventory

Public search path:

| File | Role |
|------|------|
| [components/explore/SearchButton.tsx](../components/explore/SearchButton.tsx) | The header magnifier trigger button. |
| [components/explore/HeaderSearch.tsx](../components/explore/HeaderSearch.tsx) | State owner; composes button + panel; gates panel behind `everOpened`; routes tag hits via `?vibe=/?place=` query params. |
| [components/explore/SearchPanel.tsx](../components/explore/SearchPanel.tsx) | The overlay UI: input, Cancel, debounced `fetch('/api/search')`, results list, Esc/scroll/scrim dismiss, focus trap. |
| [components/BrandHeader.tsx](../components/BrandHeader.tsx) | Global header (server component) that mounts `<HeaderSearch />` on every `(app)` page. |
| [lib/search.ts](../lib/search.ts) | Pure, shared matching logic: `searchThings`, `normalizeQuery`, `matchRank`, per-group ranking + 5-cap. Types `SearchHit` / `SearchResults`. **No AI, no network.** |
| [app/api/search/route.ts](../app/api/search/route.ts) | Public `GET /api/search?q=` route: per-IP rate limit, fetches published things + venue names, runs `searchThings`. `force-dynamic`. |
| [lib/things.ts](../lib/things.ts) | `getPublishedThings()` — the full published, non-quarantined corpus the search reads. |
| [lib/venues.ts](../lib/venues.ts) | `getVenueNames()` — `venue_id → display_name` map for the Venue group. |
| [lib/occasions.ts](../lib/occasions.ts) | `OCCASIONS[]` — Vibe tag vocabulary + labels matched by the Tags group. |
| [lib/doorZones.ts](../lib/doorZones.ts) | `DOOR_ZONES[]` — Place tag vocabulary + labels matched by the Tags group. |
| [lib/useFocusTrap.ts](../lib/useFocusTrap.ts) | Shared focus-trap hook (also used by the Venues admin sheet); powers the panel's trap + focus return. |
| [components/explore/ExploreClient.tsx](../components/explore/ExploreClient.tsx) | Consumes `?vibe=/?place=` params a tag hit pushes and applies the corresponding filter, then clears the param. |
| [app/components.css](../app/components.css#L6334) | `.sbd-search-*` styles (button, scrim, panel, field, cancel, meta, results, rows, chips; reduced-motion block). |
| [lib/search.test.ts](../lib/search.test.ts) | Unit tests for `searchThings`/`normalizeQuery` (rank, tie-break, cap, routing, venue/tag behavior). |

Related but **separate** (not public search):

| File | Role |
|------|------|
| [app/api/admin/editions/[id]/search-things/route.ts](../app/api/admin/editions/%5Bid%5D/search-things/route.ts) | Admin-only cockpit title search using Supabase `.ilike`; unrelated to the public feature. |

Reference doc the implementation cites:

| File | Role |
|------|------|
| `docs/hero_picker_search/15_SBDaymaker_Home_Rework_Spec.md` | The "Home Rework spec" §9 that defines the search feature the code implements. |

---

## Summary (one paragraph)

Public search is a deterministic, exact-substring, case-insensitive matcher — **no fuzzy/typo
tolerance, no AI, no full-text index**. It's triggered only by the header magnifier (no
keyboard shortcut), opens a full-width slide-down overlay available on every `(app)` page,
and hits a debounced (`180 ms`) server route `/api/search` that rate-limits per IP and runs
the shared pure `searchThings()` over the **full** published, non-quarantined `things`
corpus plus the `venues` name map. It matches **event `title` only**, **venue `display_name`**,
and the **hardcoded Vibe/Place tag labels** — never blurb, category, neighborhood, or DB
tags. Results are capped at 5 per group (Events → Venues → Tags), show only a kind chip +
label, and route to `/thing/{UUID}` (or, for tags, push a `?vibe=/?place=` filter onto
Explore). Accessibility is solid (labels, focus trap, focus return, Esc, live region). The
notable historical quirk — a "Cancel" control leaking into SSR — is deliberately mitigated by
not mounting the panel until first open.
