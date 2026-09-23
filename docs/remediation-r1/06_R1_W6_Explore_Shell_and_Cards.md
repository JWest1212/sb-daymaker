# R1 Wave 6: Explore Shell and Cards

Purpose: rebuild the front door on the corrected catalog. Filter and horizon state in the URL, the locked WHEN row, one card anatomy that carries time, place, and category, series collapsed, phone-width layout that does not scroll sideways, search that tolerates a typo, readable links everywhere, and the load-time fix. Requires Wave 5.

Findings closed: EXP-011 to EXP-016, EXP-019, EXP-021, EXP-024 to EXP-029, EXP-034, EXP-036, OPP-002, OPP-003, MAP-001, DET-007, DET-015, DSC-004, EDG-001, META-002, A11Y-001, TP-A6-01 to TP-A6-03, TP-B-01, TP-B-05, TP-C1-01 to TP-C1-07, TP-C4-01, TP-C6-01, TP-C6-02, TP-C7-01, TP-C7-03, TP-C7-04, TP-C7-06.

Decisions in force: D6, D7. CP4: W6.4 is the one visual rebuild; stop after it, show the homepage at 390px in Today, Weekend, and Month, and wait for Jim's go before W6.5.

## W6.1 State in the URL (ExploreClient.tsx, app/(app)/page.tsx)

- Horizon, area, occasion, and activity live in `searchParams` (`?when=weekend&area=funk_zone&occasion=nightlife`). The page reads them on the server so the first paint matches. Changing a filter updates the URL with `replaceState`; the back button restores the previous full state including scroll (DET-015, EXP-019).
- /weekend becomes a canonical alias of `/?when=weekend` and is linked from the WHEN row (META-002).
- Filter sheets read the active value from the URL, so reopening shows the selection and changing one door never drops another (EXP-016).

## W6.2 The WHEN row (D7)

- Six pills in the locked order: Today, Tomorrow, Weekend, Next Wknd, Week, Month. Weekend semantics from the locked decision (Mon to Thu means the coming Fri to Sun; Fri to Sun means the weekend in progress). Next Wknd is the following one.
- The row wraps to two lines at narrow widths or scrolls with a visible fade; it never causes page overflow (TP-C1-01, TP-C6-01). Pill height 44px (EXP-021). `aria-label` on every pill, matching its visible text plus the date range.
- One date format for headings ("Tuesday, September 22") and one for card meta ("Tue 7 PM") from a single `formatWhen` in lib/format.ts, used sitewide including the digest (EXP-034).

## W6.3 Never-blank pick and chip row

- The pick renders above the feed in every state (Wave 2 rule). The chip row wraps; Reset is always reachable (EXP-014). Nightlife appears in one door only; the Activity door drops it and the Occasion door keeps it (EXP-013).

## W6.4 One card anatomy (components/ui/Card.tsx, components.css)

- One list card for every horizon: image left (motif or photo), category label, title, meta line "[Short area] · [Tue 7 PM] · [price]" in that fixed order, one-line blurb, save and share. Month cards use the same card; the photo-over-text variant is retired (EXP-025, EXP-026). If a "headliner" treatment is kept for the week's top item, it carries a token gradient scrim and the full meta line.
- Series: one card per `series_key` per horizon with meta "Every Sunday · next Sep 27" and a small "N dates" affordance linking to the detail page (D6).
- Category slot hides when empty (EXP-030). One placeholder tile style, caption at 12px minimum in the site's casing (EXP-027).
- Whole card is the link: keep `.sbd-stretch::after`, remove the dead top band (the section heading must not overlap the card; give headings their own block) and make the date line part of the link, with Save and Share as the only excepted controls (A11Y-001, TP-A6).
- Small text in accent colors moves to Ink-2 or Pacific; pill fills use the `-text` variants for their labels (EXP-028, TP-C7-06). Detail CTA and Build a day sub-line hit 4.5 to 1 using existing tokens (TP-C7-03, TP-C7-04).
- The hero cloud is a soft shape or removed (EXP-024).
- CP4: stop and show the homepage at 390px (Today, Weekend, Month) before W6.5.

## W6.5 Phone-width layout and zoom

- Fix the bottom nav and WHEN row overflow at 390 and 320 (TP-C1-01, TP-C1-02). Detail action row wraps at 320. Plan draft header wraps (TP-C1-03).
- At 200% zoom (195px effective width) every control is reachable: segments wrap, nav labels shrink or icons-only with `aria-label` (TP-C6).
- Tap targets: search 44x44, logo 44 tall, footer links 44 tall, guide map jump targets 44x44 hit area, plan back button 44 wide (TP-C1-04 to TP-C1-06).
- Text floor: nothing under 12px; body 16px; nav labels 12px minimum (TP-C1-07).

## W6.6 Search

- Dedupe results by `series_key` then title; label venue rows "Venue" and event rows by date (EXP-009). Exclude `is_civic` and archived (EXP-010). Add fuzzy matching (trigram or a small Levenshtein on title tokens) with exact matches ranked first, and a "Did you mean [Museum]?" line; sentence-case the no-results copy (EXP-011). Constrain the overlay to the content column (EXP-036).

## W6.7 Links and routes

- Every in-app link to a thing or guide emits the slug (MAP-001, DSC-004). Every UUID URL redirects to its slug with a 308 (DET-007); the slug generator drops the hash when the slug is unique.
- Root `app/not-found.tsx` renders the branded not-found page with header, nav, and a way back (EDG-001).

## W6.8 Guide hydration error (TP-B-01)

- Find the server-versus-client mismatch on guide pages (likely time-of-day or "NOW" badge computed from `Date.now()` during render). Compute it in an effect or pass it from the server. Both guides load with zero page errors.

## W6.9 Load time (TP-B-05, TP-C4-01)

- After Waves 1 and 2 the pool is roughly a third of its old size; remeasure Lighthouse mobile LCP on /. If it is still above 4 seconds: stream the hero first, defer the feed below the fold, and cut the per-row select to the fields the card renders. Do not add a cache layer or a new service.

## W6.10 Analytics

- `lens_select` fires for area, occasion, and activity with the key only. No new events.

## Acceptance

1. Set Weekend plus Funk Zone, open a card, press back: the same range, filter, and scroll position return. The URL carried the state. Sharing that URL opens the same view.
2. The WHEN row shows six pills in the locked order at 390 and 320 with no horizontal page scroll; at 200% zoom all six are reachable.
3. Today, Week, Weekend, Month all render the same card anatomy with area, time, and price in the same order; the Arts and Crafts Show is one card reading "Every Sunday".
4. Tapping the top band or the date line of a card opens the listing; Save and Share do not navigate.
5. Lighthouse accessibility on / is 100 for contrast and target size; no text under 12px.
6. Search "musuem" returns the museums with a "Did you mean" line; no duplicate rows; overlay stays in the column.
7. View source on / and /discover: no UUID hrefs. `curl -sI /thing/808c71a7-748d-5d3f-85a1-e197b937abdc` returns 308 to the slug.
8. `/this-page-does-not-exist` renders the branded page with nav.
9. Both guide pages load with zero console page errors.
10. Lighthouse mobile LCP on / under 4 seconds; report the number.
11. Tests green.

Commit: `feat(r1-w6): url state, six-pill when row, one card anatomy, series cards, phone layout, search, slugs, hydration and load fixes`
