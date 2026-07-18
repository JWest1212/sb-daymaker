# GATE 5 — Loops, Sharing & Polish (making "find it, save it, share it" true)

`Build: Elevation v1 · Gate 5 of 6 · target: 2–3 sessions`
`Prereq: Gate 2 (OG infra + slugs) for share cards; Gate 1 (data) for saved-list quality.`

---

## Why this gate exists

The tagline is "find it, save it, **share it**," yet there is no share mechanism anywhere on the site, saves are a dead end (device-local with no way to share, plan, or move them), the newsletter has no proof it's worth joining, and the submit page — quietly the sharpest supply-side asset on the site — collects new items but never corrections. This gate turns one-way consumption into loops: shareable things, shareable saved lists, a newsletter with evidence, and a supply side that grows itself. It also batches the accessibility and image-pipeline debt that's been accumulating.

**Read before coding:** `SavesProvider.tsx`, `SavedClient.tsx`, `shares.ts`, `shared_states` (schema), the `opengraph-image` route, `CLAUDE.md` §4 (Resend), §6 (WCAG), §8 (PII boundaries — saved-list shares store no recipient contact info).

**Decisions locked:** sharing = **share buttons + per-thing OG cards** · plan permalinks (built in Gate 4) · keep the **device-local, no-account** saves stance (a real differentiator — defend it loudly) · revenue loops **on hold** (do not build monetization; leave clean seams).

---

## G5.1 — Share buttons on things (and guides)

**Task:**
- Add a **Share** action to the detail-page action row (the Save/Share/Directions row laid out in Gate 1). Use the Web Share API where available (`navigator.share({ title, text, url })` → native share sheet on mobile), with a clipboard-copy fallback on desktop ("Link copied").
- The shared URL is the slug URL (Gate 2); the preview is the per-thing OG card (Gate 2 G2.4). Together these make a shared thing render as a designed card in iMessage/Slack/etc. instead of the generic brand tile.
- Add the same to guide pages (coordinate with the separate guides project — wire the button, don't restyle the guide).

**Acceptance test A5.1:** tapping Share on mobile opens the native sheet with the slug URL; desktop copies the link; the pasted link previews as the thing's OG card; guides shareable too.

---

## G5.2 — Saved list: share + turn-into-plan + optional restore

**Evidence:** Saves are device-local (keep this) but a total dead end — no share, no export, no way to become a plan, no cross-device path. Lens 4/5 (a couple planning together, a week-long visitor on phone + laptop) are structurally locked out.

**Task (all consistent with no-accounts / no-PII):**
1. **Share a saved list:** reuse the existing `shared_states` `shared_list` kind (already in the enum + `shares.ts`). "Share my list" writes the payload (the saved thing IDs) and returns a view-only link; a friend opens it, sees the picks, and can save their own copy. **No recipient PII stored** (§8). This is Option A from `CLAUDE.md` v10 — it may already be partly built; finish/verify it.
2. **Saved → Plan:** wire the existing "Build a day from your saved →" entry atop Saved into the Gate 4 engine, seeding the candidate pool from saved items (saved-first, exactly as `buildDraft` intends).
3. **Restore via magic link (optional, already-sanctioned):** the magic-link save-restore is an existing V1 feature (§9) — verify it works so a visitor can move their saves phone→laptop without an account (the one sanctioned PII boundary).

**Acceptance test A5.2:** a saved list produces a working view-only share link that opens on another device with no login and no stored recipient PII; "Build a day from saved" seeds a plan from saved items; magic-link restore moves saves across devices.

---

## G5.3 — Newsletter with proof (the crown-jewel revenue line's top of funnel)

**Context:** the digest is the highest-value revenue line and currently has zero inventory (per the founder's own notes, no edition has ever been assembled/sent, and the send path is unbuilt per §10). Revenue is on hold this build, but the **subscribe surface** should earn signups so the list exists when monetization turns on.

**Task (demand-side only — do not build the send path here; that's a separate founder priority):**
- Upgrade the "The weekend, in your inbox" block: add a **one-line sample** of what an issue contains, a link to a **sample issue / archive** (even a single static example page at `/digest/sample`), and keep the honest "no wall, unsubscribe anytime" line.
- Surface the smart supply-side hook demand-side too: "The best submissions get featured in the weekend digest" — it's already on /submit; echo it near the subscribe box to signal the digest has real, local content.
- Double-opt-in infra already exists (`subscribers` table, RPCs per founder notes) — wire the subscribe box to it correctly (confirmed/pending states), but **do not** build the assembler or send path in this gate.

**Acceptance test A5.3:** the subscribe box writes a `subscribers` row in `pending` and triggers the existing double-opt-in; `/digest/sample` shows a representative issue; the value proposition is visible without a sample being required to subscribe.

---

## G5.4 — Submit page: corrections, photos, business-claim, expectations

**Evidence:** /submit is quietly good (the "paste an Instagram caption and we'll pull details" field is a genuine insight about where SB event data lives). Gaps: no expectation-setting, no photo upload, no business-claim path, no correction path for *existing* entries, no tip-submission for existing things.

**Task:**
1. **Expectation-setting:** a line on what happens next ("We review submissions within a few days; the best ones make the weekend digest") and the selection criteria in one sentence.
2. **Correction path:** point the "something wrong" flow (Gate 3 G3.6) here for richer corrections, or accept a "fix an existing listing" mode that writes a `content_flags` row with detail. (Keep the one-tap flag on detail pages as the fast path; /submit is the verbose path.)
3. **Business-claim seam:** an "Is this your venue? Keep your info fresh" entry that captures the business + contact into `submissions` (kind `business`) for Jim to action. This is also the clean seam for the future enhanced-profile revenue line — build the intake, not the monetization.
4. **Tip submission for existing entries:** let a local suggest a Local's Secret for a thing that already exists (routes to review; feeds your best future secrets — the audit noted your best secrets are in users' heads).
5. **Photo upload:** accept an optional image on submission (stored for review; not auto-published — operator-submitted photos are Phase 2 per §9, so this is intake-only, clearly queued).

**Acceptance test A5.4:** the submit page sets expectations, accepts a business claim and an existing-entry tip (both landing in the review queue), and accepts an optional photo as intake-only; no submitted content auto-publishes.

---

## G5.5 — Accessibility batch (WCAG 2.2 AA is the floor, not a finish)

**Evidence:** effectively all images carry empty/absent `alt`; the search overlay (Gate 3) needs focus management; the flag/share sheets need trap+return.

**Task (sweep, per `CLAUDE.md` §6):**
- Meaningful `alt` on every content image (the thing title + type is a reasonable default: `alt="Stearns Wharf, Santa Barbara"`); decorative images get `alt=""`.
- Every interactive control: visible `:focus-visible` ring (Pacific), keyboard-operable, ≥44×44px.
- The save heart: `aria-label="Save {title}"` / `"Saved {title}"` (already specified — verify).
- All sheets/overlays (search, flag, share fallback): focus trap on open, focus return on close, Esc to close.
- All looping animations (sun pulse, freshness dot, heart pop) honor `prefers-reduced-motion` with a static fallback.

**Acceptance test A5.5:** an automated a11y pass (axe or Lighthouse) on home / detail / plan / saved shows no critical violations; keyboard-only navigation completes a save, a search, a flag, and a share; images have meaningful alt.

---

## G5.6 — Image pipeline compliance + motif fallback hardening

**Evidence + risk:** most photos are hotlinked `lh3.googleusercontent.com` Places URLs at `s4800`; Google rotates those tokens (link-rot) and the ToS requires attribution + forbids long-lived caching. Gate 0 nulled the *broken* images; this hardens the *system*.

**Task:**
- Confirm Google-sourced photos follow the schema's own rule (§ schema comment: "Google = place_id only; the photo is fetched live, never cached"). If any `photo_url` is a raw cached Google URL rather than a live resolve from `place_id`, fix the resolver so Google photos are fetched fresh per the existing image-resolver design (§3 architecture doc) within the monthly call cap.
- Verify attribution renders on detail pages for photos that require it (the credit line exists; ensure it's the real author, not license boilerplate — Gate 0 caught the boilerplate).
- Harden the **motif fallback** so any thing with `photo_source='placeholder'` (including Gate 0's nulled images and Google-photo OG fallbacks from Gate 2) renders a clean, on-brand motif by type — never a broken image icon.

**Acceptance test A5.6:** no published thing hotlinks a cached Google photo URL (Google photos resolve live from `place_id` within the cap); attribution shows real authorship where required; every placeholder-source thing renders a clean motif.

---

## G5.7 — Revenue seams (build the seams, not the revenue)

**Decision:** revenue on hold. But leave clean, labeled seams so turning it on later is a small change, not a refactor — and so it never corrupts curation (the load-bearing trust rule: the ranker never reads sponsor status, §2).

**Task (seams only, all inert this build):**
- **Affiliate-ready outbound:** the outbound-link builder (Gate 1 G1.4) should route through a single `lib/links/outbound.ts` so affiliate params (AXS/Eventbrite) can be added later in one place. Add none now.
- **Featured-slot rendering:** ensure `is_featured` (already in schema) has a clearly-labeled, structurally-separate render path stubbed (a "Featured" label component that isn't wired to any paid flow) so labeled placement can ship later without touching the ranker.
- **Business-profile intake:** the claim seam (G5.4) is the intake for enhanced profiles.
- Document these seams in `CLAUDE.md` or a `docs/revenue-seams.md` so the future work is obvious.

**Acceptance test A5.7:** outbound links route through one module; a "Featured" label component exists but is wired to nothing paid; the ranker provably does not read `sponsor_id`/`is_featured` (grep + a test asserting ranking output is identical with/without a featured flag).

---

## Gate 5 acceptance summary

- [ ] **A5.1** Share works on things + guides (native sheet / copy), previews as OG card.
- [ ] **A5.2** Saved list shares view-only (no PII); saved→plan works; magic-link restore works.
- [ ] **A5.3** Subscribe writes pending + double-opt-in; `/digest/sample` exists; no send path built.
- [ ] **A5.4** Submit sets expectations, takes business-claim + existing-entry tip + intake photo; nothing auto-publishes.
- [ ] **A5.5** Automated a11y pass clean on 4 core screens; keyboard-only save/search/flag/share; meaningful alt.
- [ ] **A5.6** No cached Google photo hotlinks; real attribution; clean motif fallback everywhere.
- [ ] **A5.7** Outbound routed through one module; inert Featured label exists; ranker proven blind to sponsor status.

**Definition of done for Gate 5:** "find it, save it, share it" is finally literally true — every thing, list, and plan is shareable as a designed artifact; the newsletter can earn its list; the supply side grows itself; the site meets its own accessibility floor; and the revenue seams are clean enough to switch on later without ever touching the ranker.
