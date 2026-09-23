# R1 Wave 5: Pipeline and Content Quality

Purpose: fix what the pipeline writes so the Wave 6 card rebuild renders clean data: titles, blurbs, series, dedupe, tags, prices, images, credits, alt text, the digest sample, and the guides' copy errors. Requires Wave 4. No checkpoints in this wave: every dry-run here is reviewed by Claude Code against the rules in each task and the samples go in the run summary.

Findings closed: EXP-005, EXP-006, EXP-008, EXP-009, EXP-030, EXP-031, EXP-032, EXP-033, DET-005, DET-006, DET-008, DET-010, DET-011, CON-001, CON-003, DSC-001, DSC-006, DSC-007, DSC-008, DSC-010, XC-002, XC-003, A11Y-005 (alt part), EXP-022, TP-A7-01 to TP-A7-04, TP-A8-04 (LOTG naming).

Decisions in force: D4, D6, D9, D12, D13. AI remains batch-only; every prompt change here runs in the nightly worker.

## W5.1 Title cleaning on import (ingest/clean.ts, run in `land` before enrich)

- Split "Title | Venue" into `title` and `venue_name`. Keep the venue in the card meta line, not the title.
- Expand a maintained acronym map (`ingest/data/acronyms.json`): LOTG becomes "Library on the Go"; SMHS, YA2 and similar expand or are dropped from the title when the expansion is the venue.
- Normalize casing on titles that are all caps or have a lowercase proper noun ("the genuine Article").
- Strip street addresses from blurbs into `address` when the row has none.
- Backfill over published rows; keep 30 before-and-after samples for the run summary. Slugs do not change for existing rows.

## W5.2 Series key and collapse (ingest/series.ts)

- `series_key` = normalized title plus venue plus weekday, computed for every row with `starts_at`. Rows sharing a key are one series.
- Backfill over published and archived rows; list the top 30 series and their counts in the run summary.
- `getPublishedThings()` returns every occurrence still (Explore needs exact dates), but exposes `series_key` so Wave 6 can render one card per series per horizon with "Every Sunday, next Sep 27". Detail pages of a series occurrence list the next five dates of the same key.
- Cross-source duplicates (Ticketmaster vs sbbowl.com, same title and date): `dedupe.ts` treats same normalized title plus same start date within 30 minutes as one thing, preferring the venue source. Backfill the 6 known groups by archiving the loser; list them in the run summary.

## W5.3 Enrich rules (ingest/enrich.ts system prompt and tool schema)

Add these as hard rules in the batch prompt and validate the output before landing:
- The blurb says what the thing is and why to go in one or two sentences. It never repeats the title. If the model cannot say what it is, it returns `needs_review` with a reason.
- The blurb's day and daypart must match `starts_at` (validate: if the blurb names a weekday that is not the start weekday, reject and flag).
- No street address in the blurb. No "nestled", "vibrant", "hidden gem", "something for everyone", "whether you're".
- `blurb_long` is required when the source has more than 200 characters of description; otherwise `blurb_long = blurb`.
- One description per series: rows sharing a `series_key` share the same blurb; enrich once per key.
- Tagging: "Solo" only for things a person plausibly does alone (classes, walks, cafes, museums); never on parent-and-baby groups. Every published row has at least one occasion tag or the card hides the slot (Wave 6 handles the hide).
- Re-run enrich over published rows whose blurb equals the title or is shorter than 40 characters. Batch only, Haiku. If the estimated cost exceeds $5, write the estimate to PROGRESS.md as Blocked and skip; otherwise run and report the count and cost.

## W5.4 Cards and metadata use the written copy (DET-008)

- Card blurb and meta description read `blurb`; detail body reads `blurb_long ?? blurb`. Where the current data has the good writing only in `blurb_long`, the W5.3 re-run copies a shortened version into `blurb`.

## W5.5 Price (DET-011)

- Add `price_note` (text, e.g. "$15 to $25", "Free, RSVP"). Cards show `price_note` when present, else the band. A tiny key on the detail page: "$ under 15, $$ 15 to 40, $$$ over 40". Nothing shows a blank price; missing renders "Check site".

## W5.6 Outbound button label (DET-005)

- Label from the destination: `buy_url` host maps to "Tickets at [Ticketmaster / AXS / venue name]"; a non-ticket `source_url` maps to "Event details at [host]"; free rows never say "Get tickets". Keep the arrow glyph.

## W5.7 Images, credits, alt (ingest/images.ts, Card, detail)

- Waterfall for `happening_tier = 1` events: owned, venue or source image, then the category motif. Never Wikimedia keyword search for events (EXP-008). Wikimedia stays in the waterfall for places and landmarks only.
- Credit format is one string: "[Photographer or organization], [license], [source]". If the source returns license boilerplate instead of an author, store the organization or drop the credit line (DET-006).
- `alt` on card and detail images is the listing title plus venue when known; the skyline and motifs are `alt=""`.
- Re-resolve images for any event currently on a Wikimedia photo (the category motif costs nothing); report the count.

## W5.8 Digest sample (app/digest/sample)

- Render from live data: the current send week's pick and three items from the pool, dated for the next send day, with the module area labels. No hand-dated content. Add a meta description and the title suffix.

## W5.9 Guides copy (guides table content, components/discover)

- Funk Zone: pick the real block count and use it in both places (DSC-001).
- Replace en dashes in guide copy per D9 (DSC-002).
- "Right Now" blocks render only while `updated_at` is within 45 days; otherwise the block is hidden and the stat line says "Refreshed [month]" (DSC-006).
- The happenings line inside a guide lists upcoming items only and links "+N more" to Explore filtered to that area (DSC-007).
- Per-guide walk line and stamp sentence; remove the shared "Tracks to sand" line from State Street (DSC-008).
- Retire the deliberate-error line per D13 (DSC-010).

## Acceptance

1. No published title contains a pipe, "LOTG", or all-caps words that are not initialisms; 30 before-and-after samples are in the run summary.
2. The Arts and Crafts Show has one `series_key` across its 17 rows; Recreation Swim has two (two pools).
3. The 6 cross-source duplicate groups are down to one published row each.
4. A sample of 30 re-enriched rows: none repeats its title, none names a wrong weekday, none contains the banned words.
5. "Beck: Ride Lonesome Tour" blurb names Tuesday.
6. Monday Night Football Watch Party shows a motif, not a car.
7. Every card image has a non-empty alt; the skyline has `alt=""`.
8. /digest/sample shows the coming send week, and its detail links are all upcoming.
9. Both guides: correct block count, no en dashes, Right Now hidden or fresh, "+N more" links, no deliberate-error line.
10. Tests green; Wave 5 added tests for clean.ts, series.ts, and the enrich validators.

Commit: `feat(r1-w5): title cleaning, series keys, enrich rules, price notes, image waterfall, digest from live data, guide copy`
