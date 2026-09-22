# R1 Final

Recorded 2026-09-22 at the end of Wave 8, on branch `remediation-r1` (not pushed: see "Blocked"). Read next to [BASELINE.md](BASELINE.md).

## Tests

| | Baseline | Final |
|---|---|---|
| Test files | 59 | 77 |
| Tests | 864 | 1,098 |
| Failing | 1 (date-dependent, fixed at setup) | 0 |

`tsc --noEmit` is clean apart from the pre-existing `lib/venuePool.test.ts:67`, which does not block the build. `next build` passes and now runs the dash check first (D9).

## Lighthouse, mobile preset (390x844, DPR 2)

| Route | Performance | Accessibility | Best practices | SEO | LCP | FCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 74 | **100** | 73 | 100 | 9.0 s | 1.8 s | 20 ms | 0.02 | 1.8 s |
| `/saved` | 91 | **100** | 96 | 100 | 3.5 s | 1.1 s | 0 ms | 0 | 1.1 s |
| `/plan` | 86 | **100** | 96 | 100 | 4.1 s | 1.7 s | 10 ms | 0 | 1.7 s |
| `/thing/beck-ride-lonesome-tour` | 88 | **100** | 73 | 100 | 3.9 s | 1.1 s | 10 ms | 0 | 1.1 s |

Baseline on `/` (production): Performance 34, Accessibility 93, LCP 16.0 s, TBT 1,220 ms, FCP 3.7 s, Speed Index 11.4 s, CLS 0.015.

How to read these:

- **Measured against the local production build, not the deployed site.** The baseline was production; the push is blocked, so no deployed preview exists to measure. Direction is comparable, absolute numbers are not.
- **LCP on `/` is the one number still over target** (4 s). Wave 6 applied all three remedies the spec names, and showed that payload is not the cause: a 72 percent smaller document did not move it, and a real browser under emulated slow 4G and 4x CPU paints the LCP element, the hero skyline, at 1.2 s. The gap is Lighthouse's simulation against localhost. The honest measurement is on a deployed preview.
- **Best practices 73** on `/` and the listing page: the Vercel Analytics script 404s locally (it is injected only on Vercel) and Wikimedia photographs set third-party cookies. Neither is present in, or fixable from, the app code.
- **CLS 0.02 on `/`** is the first-visit welcome strip appearing after hydration (Lighthouse is always a first visit). Well under the 0.1 threshold.
- Accessibility reached 100 on all four by fixing, over Waves 6 to 8: the Build-a-day sub-line contrast, the tour dots' real tap size, the outbound button (now large text, which the token rule always required), and the logo's accessible name (it now contains its visible text).

## Acceptance, Wave 8

1. Vocabulary grep on the built site: zero UI hits for Place (the where-concept), Vibe, "Where to?", "Clear filters", "replay". "Night" appears only inside a listing title ("Monday Night Football Watch Party"), not our copy. Pass.
2. "Twice a week, Thursday and Sunday" appears identically on `/`, `/confirm`, `/unsubscribe`, `/digest/sample` and in both emails. Pass.
3. First visit: the page and pick are visible and tappable behind a dismissible strip; `sbd.tour.v1` is absent until the strip is closed; "How it works" opens the tour; an unclosed strip returns on visit 2. Pass.
4. No emoji in tags, Saved, Discover or not-found pages. Pass.
5. The build fails when a U+2014 is introduced (proved with a planted dash); documented in CLAUDE.md v11 §8 rule 11. Pass.
6. The Discover index names the next guide, or shows no notice (none is set today). Pass.
7. CLAUDE.md v11 and the Doc 14 entries: written, shown at CP5.
8. Full suite green; this Lighthouse table. Pass.

## Retracted or not defects, recorded not built

Per the index (line 93), these audit items were retracted or found not to be defects, and nothing was built for them: EXP-018, EXP-023, EXP-037, SAV-004 (the auditor's own formal retraction, audit log line 149), META-004 (the extension's own GoTrueClient, TP-B-02), A11Y-003 (the focus ring is drawn on the card, correct; TP-C9-01), TP-B-02, TP-B-04 (a harness artifact), and the hearts part of SHR-002 (recipient hearts already started empty).

## Deferred, noted for later

- XC-006 pill labels: cards and the recipient page still show the short occasion pill ("Arts") while Saved shows "Arts & Culture". Dropping the short form needs the 90px no-wrap pill redesigned.
- EXP-035 remainder: /digest/sample is always framed as the weekend edition, even when the next send is Sunday's Monday-to-Thursday issue.
- The big-type card fallback prints the legacy zone code as its big word.

## Blocked

- **`git push`**: iCloud has evicted most of the repo's loose git objects, so the branch exists only locally and no Vercel preview can be built. Fix: move the repo out of `~/Documents` (a non-synced path).

## Decided by Jim after R1 (2026-09-22)

- **Curation and process claims removed.** The site is largely automated, so nothing says a person curates, reviews, writes or hand-picks: the hero sub-line, the home and weekend descriptions, the submit page and its success line, the newsletter block and emails, the edition copy pools, and the guides' "WRITTEN BY A LOCAL" stamp.
- **The Gmail check passed** (Jim saw the confirmation email).
- **"Today" keeps events from earlier in the day** (it already did; the feed keys on the calendar day). The headings are now plain: Today, Tomorrow, This Weekend, Next Weekend, This Week, This Month.
- **Picker tiles have artwork.** 26 generated SVGs (`scripts/gen-tile-art.mjs`), a line icon on the picker's own colour, replacing photographs that were never shipped.

## Still open for Jim

- The hero line "Everything worth doing in Santa Barbara, in one place" stays (W8.2). The gap to know about: 86 percent of upcoming events are Downtown, and Waterfront, the Mesa and Upper State have none.
- Plan's parking tip for the Funk Zone ("park once in the lot off Garden") contradicts the Funk Zone guide ("the lots are a trap").
- The push: move the repo out of iCloud (steps given 2026-09-22), then push and remeasure LCP on a preview.
