# R1 Wave 8: Names, Voice, Welcome, Canon

Purpose: one name for each idea, copy that promises only what exists, a welcome flow that does not block the page, remaining polish, and canon brought up to date with what shipped. Requires Wave 7.

Findings closed: XC-001, XC-004, XC-006, MAP-002, MAP-003, EXP-035, EML-002, DSC-005, DSC-009 (naming part), PLN-005 (any remainder), DET-012, DSC-002 (policy), EXP-020, TP-C2-01 to TP-C2-03, TP-C8-05, and the retracted items recorded as such.

Decisions in force: D8, D9, D10, D11.

## W8.1 Vocabulary module (lib/strings.ts)

- One exported string per concept, imported everywhere it appears. Final choices:
  - Area concept: "Area". Door label "Area", sheet heading "Which part of town?", detail field "Area", nearby heading "Nearby in [Short area]". The word Place is retired from the UI; the URL param is `area`.
  - Reason concept: "Occasion" (door and sheet "What's the occasion?"), "Activity" (door and sheet "What do you want to do?"). The word Vibe is retired from the UI.
  - Clearing filters: "Reset" everywhere, including the empty state and Plan.
  - The list: page title "Saved", tabs "Want to go" and "Been", summary "N on your list".
  - The intro: one control name, "How it works", used in the footer, on the empty Saved screen, and in the tour's own closing line.
  - Adding: "Suggest an event or business" in the footer, the heading, and the page title.
  - Parts of day: Morning, Afternoon, Evening everywhere.
  - Newsletter: one cadence string, "Twice a week, Thursday and Sunday", used in the signup block, the sample footer, the confirm page, the unsubscribe page, and the emails. The block heading becomes "Santa Barbara, twice a week" (EXP-035, EML-002).
- Category labels: one casing on cards and sheets (Title Case on both; the eyebrow style handles uppercase visually via CSS, not different strings) and one label per category ("Arts & Culture" everywhere) (XC-006).

## W8.2 Promises audit (XC-004)

- Remove or replace copy that the product does not keep: "learns your Santa Barbara" and "quietly start remembering" (the product stores saves on the device; say "Everything you save and mark stays on this phone"), "Your map starts here" (Wave 7 already), "Sort by neighborhood" (Wave 7), "You can replay this anytime from the footer" (becomes "Find this again under How it works"), "A handful of taps" (Wave 3), "Every stop is open when we schedule it" (becomes "Open when we schedule it, as far as we know; check before you go").
- "Everything worth doing in Santa Barbara, in one place" stays; after Waves 1 to 5 it is close to true. Flag any remaining gap to Jim rather than softening the line.

## W8.3 Welcome flow (D8)

- The blocking modal becomes a dismissible strip above the pick on the first visit: "New here? Tap a heart to save it. Mark what you did. How it works." with a close control. `sbd.tour.v1` is written on dismiss, not on mount (TP-C2-02). The three-panel tour stays available under "How it works" and teaches on the real pick if one exists, otherwise on a labeled example (MAP-003).
- The first-three-visits hero rule is not built (D10); remove any dormant code and record it in canon.

## W8.4 Icons and dashes

- Replace emoji in tags, Saved, Discover, and not-found pages with the icon set; the compass and magnifier become icons (DET-012).
- Dash policy per D9 enforced at render time: a build-time check fails on U+2014 anywhere in `app`, `components`, `lib`, and the email templates; the pipeline's existing em-dash purge extends to en dashes in prose while allowing a hyphen in numeric ranges (DSC-002).

## W8.5 Discover index copy

- "More guides are on their way" becomes a specific line naming the next guide and month, from a `guides.upcoming` field Jim can edit in the cockpit; hidden when empty (DSC-005). Eyebrow "Guides" instead of "By neighborhood" while a street-based guide exists. One name for the State Street guide across the index, page title, and heading (DSC-009).

## W8.6 Remaining polish

- WHEN pills carry no counts (correct today, TP-C8-05); the sheet tiles keep theirs. Landmark and heading checks from Wave 7 verified sitewide. The Directions link on detail pages wraps at 320.

## W8.7 Canon

- CLAUDE.md to v11: four sections as shipped; Plan described as the seven-step concierge day; Explore doors Area, Occasion, Activity; search exists; the six-pill WHEN row; Near Me is on Saved only (D11); the first-visit strip replaces the overlay; the first-three-visits rule is dropped (D10); civic rows exist but never publish (D3, D14); retirement policy (D2); the series display rule (D6); the dash policy (D9); the string module as the vocabulary source of truth.
- Doc 14 (14_SBDaymaker_Build_Deltas.md) gains one dated entry per wave citing this folder, newest first.
- §10 known-open list updated: remove items this build closed, add the deferred series data-model consolidation and the civic surface as tracked, not forgotten.
- CP5: show both diffs and wait for Jim's go before committing.

## Acceptance

1. Grep the built site for "Place", "Vibe", "Where to?", "Clear filters", "Night" as a part of day, and "replay": zero hits in UI copy.
2. The cadence string appears identically in the signup block, the sample footer, /confirm, /unsubscribe, and both emails.
3. First visit: the page and pick are visible and tappable behind a dismissible strip; `sbd.tour.v1` is absent until the strip is closed. "How it works" opens the tour.
4. No emoji in tags, Saved, Discover, or not-found pages.
5. The build fails when a U+2014 is introduced into a component; the check is documented in CLAUDE.md.
6. The Discover index names the next guide or shows no notice.
7. CLAUDE.md v11 and the Doc 14 entries reflect every decision in the ledger; diffs were shown.
8. Full test suite green; a final Lighthouse run on /, /saved, /plan, one detail page recorded in docs/remediation-r1/FINAL.md next to BASELINE.md.

Commit: `feat(r1-w8): vocabulary module, promises audit, first-visit strip, icons and dash policy, canon v11`
