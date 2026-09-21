# R1 Wave 3: Plan Integrity

Purpose: make Plan keep its own promises. A food bank is not lunch, a one-stop day gets an honest note, the chosen area is honored or the widening is stated, the horizon matches Explore, and the badge component stops welding itself to text. Requires Wave 2 (civic flag, retirement).

Findings closed: PLN-001, PLN-002, PLN-004, PLN-005, PLN-007, DSC-003, DSC-009 (badge part), TP-A9-01 to TP-A9-07. PLN-003 and PLN-006 are finished in Wave 4 once the area module exists; this wave lands the "we widened" note that both need.

Decisions in force: D3. Area vocabulary waits for D5 in Wave 4.

## W3.1 Food classification (lib/plan/meals.ts isFood, ingest enrich)

- `isFood()` requires a food place or a food event that sells or serves a meal. Exclude: any `is_civic` row, titles matching "food distribution", "food bank", "pantry", "meal service", any `library` source row, and any row with `price_band = 'free'` whose category is `food_drink_event` unless it is a market or tasting (keep a small allowlist: farmers market, tasting, pop-up).
- Data pass: recategorize the four Food Distribution rows and `LOTG | Samarkand` out of `food_drink_event`. No checkpoint; list the rows in the run summary.
- Unit tests for each exclusion.

## W3.2 Minimum viable day (lib/plan/buildDraft.ts, lib/plan/validate.ts)

- A draft with fewer than two stops, or with a selected meal unfilled, always surfaces a note. Route both `meals.ts` and `validate.ts` through one `notes` reducer so the two messages cannot disagree; keep the existing copy for both.
- When a selected part of day has no candidate, render the empty slot with "Nothing found for [afternoon] yet. Add a stop or widen the plan." rather than dropping the slot.
- Regenerate never returns the identical draft when alternatives exist; if the pool has only one candidate, say so in the note.

## W3.3 Area honored or stated (lib/plan/hardFilter.ts, PlanResults)

- Keep the rule that unknown-zone candidates are not violations, but when the visitor picked an area, prefer known-zone matches first and cap unknown-zone stops at one per draft.
- If the draft could not fill from the chosen area, add a note: "We widened beyond [Funk Zone] to fill the day." The chosen area appears in the summary chips.
- On foot, an unknown-zone candidate is allowed only if it has an address within the chosen area's bounding box (use lat/lng when present; otherwise treat as unknown and cap as above).

## W3.4 Horizon alignment (PlanSetup date picker)

- Accept any date within 31 days (Explore's Month reach). Copy: "any day in the next month".

## W3.5 Badge component (the shared label or badge used by Plan stops and guide chapter headings)

- Find the component that renders "dinner", "NOW", and similar badges inline. Render the badge as its own element with spacing and an `aria-label`, never concatenated into the text node. Fixes "Cookingdinner", "AFTERNOONNOW", "THE CORENOW" in one change.

## W3.6 Copy

- Intro: "A handful of taps" becomes "Seven quick questions". Part-of-day label "Night" becomes "Evening" to match the site's greeting vocabulary. Suggested and Saved: a stop drawn from the visitor's saves shows one badge, "From your saves"; a planner choice shows "Suggested".

## W3.7 Analytics

- `plan_built` gains a `stops` count and a `notes` count (integers only, no free text). No new events.

## Acceptance

1. Rebuild plan A: Today, Afternoon, Couple, Anywhere, On foot, Middle with one splurge, Just lunch. The draft has at least two stops or shows the honest note; no Food Distribution stop appears; a lunch stop is a real food place or the "couldn't find an open lunch spot" note shows.
2. Rebuild plan B: Tomorrow, Morning and Evening, Friends, Funk Zone, On foot, Cheap, Lunch and Dinner. Every stop is in the Funk Zone, or the "widened beyond Funk Zone" note shows and the Funk Zone chip is in the summary.
3. A stop titled "Healthy Flavors: Celebrating Latin Heritage Through Nutritious Cooking" renders its meal badge as a separate element with a space; the two guide chapter headings render "AFTERNOON" and "NOW" as separate elements.
4. The date picker accepts a date 25 days out.
5. No stop shows both "Suggested" and "Saved".
6. Tests green, including the new isFood and notes-reducer tests.

Commit: `fix(r1-w3): plan honors meals and area, honest notes, badge component, horizon to 31 days`
