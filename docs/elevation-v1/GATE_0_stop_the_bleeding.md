# GATE 0 — Stop the Bleeding (trust-critical fixes)

`Build: Elevation v1 · Gate 0 of 6 · target: same-day / 1–2 sessions`
`Prereq: none. This gate ships first and alone. Do not start Gate 1 until every acceptance test here passes.`

---

## Why this gate exists

Every defect below is discoverable by a casual visitor in under two minutes, and each one directly falsifies the homepage's headline claim — *"Everything worth doing in Santa Barbara, in one place… curated by someone who knows the town."* These are not polish items. They are the difference between "curated" reading as true or as marketing. Nothing downstream (SEO, planner, sharing) compounds until these are gone, because we'd just be driving traffic to pages that expose the machinery.

**Read before coding:** `CLAUDE.md` §2 (constraints), §5 (aesthetic), `sbdaymaker_schema.sql` (the `things`, `recurring_schedules` tables). All fixes here are **data + render fixes**; no schema changes in this gate.

**House rules for all work in this gate:** **THE GOLDEN RULE — zero em dashes (`—`), anywhere, ever** (see G0.9; enforced at build, write, and render time); plain `$` signs; no hardcoded hex (use tokens); every change verified on the running dev server before you declare a task done.

---

## G0.1 — Purge editorial QA notes from published `blurb` / `reason_to_go` / secret fields

**Evidence (live site):** The Funk Zone Art Walk detail page renders this as its "Local's secret":
> "Bi-monthly (~every 8 weeks) on a FRIDAY evening, 5–8pm — NOT weekly; confirm the specific date on funkzone.net before publishing."

That is an internal note to the operator, shipped verbatim to users. It is almost certainly not the only one.

**Task:**
1. Write a one-off audit script (`ingest/audits/qa_note_scan.ts`) that scans **all published** `things` rows across `blurb`, `blurb_long`, `reason_to_go`, and any field feeding the "Local's secret" block, plus `recurring_schedules.label` and `guide_stops.note`, for operator-note signatures. Flag rows where the text contains any of: `before publishing`, `confirm`, `verify`, `NOT weekly`, `TODO`, `FIXME`, `check the`, `double-check`, `placeholder`, `(?)`, `??`, `xxx`, ALL-CAPS words of 3+ letters that aren't known acronyms (`SB`, `MOXI`, `AXS`, `TM`, `PWA`, `UC`), or parenthetical hedges like `(~every`.
2. Output a review table (id, title, field, offending snippet) to stdout and to `ingest/audits/qa_note_scan.out.md`.
3. Do **not** auto-delete. Hand the table to Jim. He supplies corrected copy per row; you apply it.
4. Add the scan to the nightly pipeline as a **non-blocking warning** so future notes are caught before a human sees them on the site.

**Severity:** Critical. **Acceptance test A0.1:** the scan runs clean (zero flagged rows) against `status='published'` before this gate closes.

---

## G0.2 — Fix daypart hallucinations (descriptions that contradict their own time field)

**Evidence:** "UC Master Gardeners… Free **evening** talk" at 10 AM. "LOTG | Oak Park — Evening community gathering" at 10 AM. "Coast Village Pop-Up… happens **late**… A **late-night** event" at 4 PM. "Family Garden Exploration… **evening** light" at 11 AM. "Santa Barbara Antique & Vintage Show… **evening** marketplace" at 11 AM. "Friday Night Swing… **Late-night** swing dancing" at 7 PM. The blurbs were generated without reading the event's `starts_at`.

**Task (two parts — fix the data now, fix the generator so it can't recur):**

1. **Data sweep.** Script `ingest/audits/daypart_conflict_scan.ts`: for every `type='event'` row with a `starts_at`, derive the true daypart from the local hour (morning <12, afternoon 12–16:59, evening 17–20:59, late ≥21). Scan `blurb` + `blurb_long` for daypart words (`morning`, `afternoon`, `evening`, `night`, `late-night`, `late night`, `sunset`, `golden hour`, `nightcap`) that contradict the true daypart. Emit a review table. Jim approves regenerations; you re-run enrich on approved rows only.

2. **Generator guard (the real fix).** In `ingest/enrich.ts`, the blurb-generation prompt must **receive the resolved local daypart string as an input** and be instructed to never contradict it. Add a **post-generation validator**: if the returned blurb contains a daypart word inconsistent with `starts_at`, reject the generation, retry once with an explicit correction, and if it still conflicts, drop the daypart sentence rather than ship the conflict. Log rejections to `audit_log` (`action='daypart_reject'`).

**Severity:** Critical (as a class). **Acceptance test A0.2:** `daypart_conflict_scan` returns zero conflicts on published events; a unit test feeds enrich a 10 AM event and asserts the output contains no evening/night/late tokens.

---

## G0.3 — Reconcile card-vs-detail time mismatches (single source of truth)

**Evidence:** Free Summer Cinema — card "Fri 8 PM," detail "8:30 PM." Wine Festival — card "6 PM," detail "6:30 PM." The feed card and the detail page format the same `starts_at` differently (one is rounding or reading a different field).

**Task:** Find the two render paths (`Card.tsx` and the `/thing/[id]` detail component). Both must format from the **same** `starts_at` value through **one shared formatter** (`lib/format/eventTime.ts` — create if absent). No rounding, ever. If a card currently shows a coarse time, it shows the exact one now. Delete any second time field or local reformatting.

**Severity:** Major. **Acceptance test A0.3:** for three sampled events, the time string on the Explore card is byte-identical to the time string on the detail page.

---

## G0.4 — Merge the duplicate Santa Barbara Museum of Art entries

**Evidence:** SBMA exists as two `things` rows (two UUIDs: `921caa91-…` and `ee877878-…`), different tags, different blurbs, one carrying a broken hero image.

**Task:**
1. Script `ingest/audits/dupe_scan.ts` using the existing `things_title_trgm_idx` (trigram) to surface near-duplicate titles among published rows (similarity ≥ 0.6), plus exact `place_id` collisions. Output a review table.
2. For confirmed dupes: keep the richer row, re-point any `guide_stops.thing_id`, `edition_picks`, `thing_tags`, and saved-references to the survivor, then `archive` the loser (never hard-delete — preserves any inbound links; the 301 layer in Gate 2 will redirect it).
3. Flag the FigMtn pair ("Live Music — Figueroa Mountain Brewing" event vs. "Figueroa Mountain Brewing Co." venue) for Jim's judgment: these are defensibly event-vs-venue. If kept separate, they must **cross-link** (handled in Gate 3); if judged dupes, merge per above.

**Severity:** Critical (SBMA) / Major (FigMtn). **Acceptance test A0.4:** `dupe_scan` shows no unresolved same-entity pairs among published rows.

---

## G0.5 — Kill broken / mismatched hero images (blank beats wrong)

**Evidence:** Shoreline Park → scanned 1980 Federal Register PDF page. One SBMA → 1960 exhibition-catalog PDF page. Paradise Found (vintage shop) → Granada Theatre photo. LOTG (Oak Park event) → downtown Central Library photo credited to "You may select the license of your choice." (license boilerplate scraped into the author field).

**Task:**
1. Script `ingest/audits/image_sanity_scan.ts`: flag any `things.photo_url` that (a) points at a `.pdf` or a Wikimedia `…/page1-…pdf.jpg` derivative, (b) has a `photo_attribution` containing license boilerplate rather than a name ("You may select", "CC BY", "public domain" **as the whole author field**), or (c) is a Wikimedia commons file whose filename shares no token with the thing's title (weak heuristic — flag for human, don't auto-act).
2. For every confirmed bad image: **null the `photo_url` and set `photo_source='placeholder'`** so the existing motif fallback renders. Do not attempt to auto-find a replacement in this gate. Blank/motif is the acceptable state; wrong is not.
3. Jim curates real replacements later (or via the Gate 1 photo-pool work).

**Severity:** Major. **Acceptance test A0.5:** no published `thing` renders a PDF-derived image or a license-boilerplate credit line; flagged rows fall back to motif cleanly.

---

## G0.6 — Move Funk Zone Art Walk out of "Every week"

**Evidence:** The homepage "Every week" section lists the Art Walk, which the site's own leaked note (G0.1) says is bi-monthly. The site contradicts itself about its own inventory.

**Task:** This is a `recurring_schedules` data correctness issue, not a code change. The Art Walk is bi-monthly (~every 8 weeks) on a Friday, 5–8pm — it does not belong in a weekly rhythm. Options, in order of preference:
- **Preferred:** reclassify it as a **dated event** (Tier 1) with the confirmed next date, so it flows through the dated feed with a real date. This requires Jim to confirm the next occurrence.
- **Fallback:** if it must stay recurring, the recurrence model needs a cadence beyond weekly — but that is Gate 1 work (`recurrence_cadence`). For Gate 0, pull it from "Every week" and place it as a single dated instance.

**Severity:** Critical. **Acceptance test A0.6:** the Art Walk no longer appears under any "every week / weekly" heading; it appears once, with a correct date.

---

## G0.7 — Kill placeholder values leaking to users (`Other`, `—` on required fields)

**Evidence:** Lizard's Mouth "Where: Other." MOXI / SBMA / Wine Festival / Chaucer's "Price: —" (the Wine Festival is a premium ticketed tasting; "—" there is worse than nothing). Old Mission "Setting: Indoor" for a mission whose own secret recommends its garden picnic lawn.

**Task (render-layer guardrails + data fixes):**
1. **Never render the literal string "Other" as a location.** In the detail component, if `nearby_zone`/`neighborhood` is unknown, show nothing for that row rather than "Other." (Lizard's Mouth's real zone is Goleta-adjacent backcountry; Jim can set `nearby_zone='goleta'` or leave the row hidden.)
2. **Price display logic:** if `price_band` is null, render nothing where a paid item would show `$$`, but for known-ticketed events render "Check site" linked to `buy_url`. Never render a bare "—" as if it were a price. (Free items keep the "Free" label from the `free` generated column.)
3. **Setting (indoor/outdoor):** the `indoor` boolean is a single bit and can't represent "both." For entries where it's misleading (Old Mission), either correct the bit or suppress the "Setting" row when it would mislead. Full indoor/outdoor nuance is a Gate 1 data item; for Gate 0, suppress obviously-wrong labels.

**Severity:** Major. **Acceptance test A0.7:** no published detail page shows "Where: Other," a bare "—" in the price slot, or a Setting label contradicted by its own copy.

---

## G0.8 — Remove the stray "Cancel" leaking into SSR

**Evidence:** A stray "Cancel" renders near the top of nearly every server-rendered page (homepage, detail pages) — a search/overlay control leaking into the SSR output. It is literally among the first words of the page.

**Task:** Find the overlay/search component whose trigger or dismiss control ("Cancel") is rendering unconditionally in the server tree. Gate it behind its open state so it only exists in the DOM when the overlay is open (or is visually hidden until invoked). Verify via View Source that "Cancel" is no longer in the initial HTML.

**Severity:** Minor (polish) but trivial and visible. **Acceptance test A0.8:** "Cancel" does not appear in the raw SSR HTML of `/`, `/thing/[id]`, or `/discover`.

---

## G0.9 — THE GOLDEN RULE: eradicate em dashes and enforce zero forever (existential)

**This is a load-bearing, permanent site rule, not a cleanup task.** No em dash (`—`, U+2014) may ever appear anywhere on the SB Daymaker site: not in a blurb, title, secret, guide, button, meta tag, email, alt text, slug, code comment, or database row. It ranks with the §2 constraints. It ships in Gate 0 because it must be true from the first commit of this build forward, and it protects every later gate's copy.

**Task — implement all three enforcement layers plus the one-time purge:**

1. **One-time content purge.** Script `ingest/audits/emdash_purge.ts` scans every text column across `things` (`title`, `blurb`, `blurb_long`, `reason_to_go`, `practical_note`), `guides` (`title`, `kicker`, `intro`), `guide_stops` (`label`, `note`), `recurring_schedules.label`, `editions`, and `submissions` for `—`. Output a review table (id, table, column, snippet). Auto-fix is allowed here because the transform is safe and mechanical: replace `—` with the context-appropriate substitute (prefer recasting; else `, ` / `. ` / `: ` / ` to ` for numeric ranges). Jim spot-checks the diff; you apply.

2. **Build-time gate (CI).** Add a check (a lint rule or a simple CI grep step in the GitHub Actions workflow and/or a pre-commit/`lint` script) that **fails the build** if `—` (U+2014) appears in any site source: `.ts`, `.tsx`, JSX string literals, email templates, and any `.md` that renders to the site. Wire it so `npm run lint` (or the CI job) is red on any em dash. Document the rule at the top of the lint config so future contributors see it.

3. **Write-time sanitizer.** In `ingest/enrich.ts` and the ingest write path, add a `stripEmDash(text)` normalizer applied to **every** AI-drafted or scraped string before it is written to the database. Additionally, the AI prompts must explicitly instruct the model to never use em dashes. Log any normalization to `audit_log` (`action='emdash_normalized'`) so recurrences are visible.

4. **Render-time guard (defense in depth).** Add `stripEmDash` to the shared text-render helper used by cards, detail pages, guides, and emails, so even if a bad string somehow exists, the user never sees an em dash. This is the last line, not the first, but it guarantees the visible invariant.

**Replacement guidance:** recast the sentence first; otherwise comma, period, colon, parentheses, or "to" for ranges ("5 to 8pm," never "5—8pm"). Avoid en dashes in ranges too, for the same reason. When in doubt, there is no em dash.

**Severity:** Critical (existential site rule). **Acceptance test A0.9:** (a) `emdash_purge` reports zero `—` across all listed tables after the purge; (b) the CI/lint check fails a test commit that introduces a `—` and passes once removed; (c) a unit test asserts `stripEmDash('5—8pm')` returns an em-dash-free string; (d) grep of the built site output (`.next` render or a crawl of key routes) finds zero `—`.

---

## Gate 0 acceptance summary (all must pass)

- [ ] **A0.1** QA-note scan runs clean on published rows; scan added to nightly as non-blocking warning.
- [ ] **A0.2** Daypart-conflict scan returns zero; enrich has a daypart input + post-gen validator with a passing unit test.
- [ ] **A0.3** Card time === detail time for 3 sampled events, via one shared formatter.
- [ ] **A0.4** No unresolved same-entity duplicate pairs among published rows; SBMA merged.
- [ ] **A0.5** No PDF-derived images or license-boilerplate credits on published things; motif fallback clean.
- [ ] **A0.6** Art Walk appears once with a correct date; gone from any weekly heading.
- [ ] **A0.7** No "Where: Other," no bare "—" price, no self-contradicting Setting label on published pages.
- [ ] **A0.8** "Cancel" absent from initial SSR HTML on `/`, `/thing/[id]`, `/discover`.
- [ ] **A0.9** THE GOLDEN RULE: em-dash purge clean; CI gate fails on a `—` and passes without; `stripEmDash` unit test passes; built-site crawl finds zero `—`.

**Definition of done for Gate 0:** a skeptical first-time visitor can browse the homepage and five detail pages without encountering a single factual self-contradiction, broken image, operator note, or placeholder value. Report to Jim with the list of what changed and the three URLs to spot-check.
