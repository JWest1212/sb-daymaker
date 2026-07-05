# W3b Build Spec — Edition v1: the twice-a-week email that actually sends

`Doc W3b · for Claude Code (with a founder preface for Jim) · run after Wave 1 (hard dependency: verified Resend domain) · written against commit caa7302 + Docs 18/19`

---

# Founder preface — for Jim (read before starting the session)

**What this builds.** A fifth cockpit surface where, twice a week, you press "Draft edition," review a hero + 4–6 picks assembled from your already-approved content, swap anything you don't love, and press "Approve & send." It emails your confirmed subscribers, records the edition in the database, and takes about three of your fifteen daily minutes on send days. No AI writes anything — the email is your approved blurbs, assembled.

**Hard prerequisite:** the Resend domain verification from Wave 1 §1.2 must be DONE (`RESEND_FROM` set to a real `@sbdaymaker.com` sender in Vercel env vars). You do not send a reader product from a sandbox address. If it isn't done, do that first — it's ~15 minutes of DNS.

**One decision to make now (tell Claude Code at session start):** the cadence windows. My recommendation, encoded below as the default: **Thursday edition = "The weekend ahead" (covers Fri–Sun) · Sunday edition = "The week ahead" (covers Mon–Thu).** Override if you prefer different days.

**The scrappy pilot (optional but smart, and it needs no code):** before or during this build, hand-write one edition in Resend's own composer — hero + four picks, copied from your live cards — and send it to your subscriber list. Then take that real artifact into your first sponsorship conversation. An hour of work, and it means the V1 build below gets informed by a real reader/sponsor reaction instead of guesses. The build is worth doing either way; the pilot just de-risks it.

---

# For Claude Code

## What this is

Three phases: the assembly logic, the cockpit surface, the send path. The schema has been waiting since the base contract: `editions {id, edition_date unique, status, approved_at}`, `edition_picks {edition_id, thing_id, slot hero|secondary, position}` with the exactly-one-hero partial unique index, both with public-read-when-published RLS. `subscribers` carries per-row `unsubscribe_token`. `hero_pins` exist (founder pre-decisions) and should be honored.

## §0 · Ground rules

1. Read `CLAUDE.md` first; reconcile paths against the live repo. **No DDL** — the tables exist; if you believe otherwise, stop and flag.
2. **The Never rule, restated because this build is where it bites: NO AI-written digest synthesis.** The edition assembles founder-approved content verbatim (titles, blurbs, facts already on published things). Zero Anthropic imports anywhere in this build. Any "wouldn't it be nice if Claude wrote an intro line" instinct is a violation — the intro is a hardcoded template or founder-typed text.
3. All cockpit routes admin-gated (`getAdminUser`) + audit-logged; writes via service role — the established pattern.
4. PII: subscriber emails are the existing allowed boundary. Never log an email or token; the send loop's logging is counts only.
5. Determinism: the draft assembler is a pure function of (date, published things, hero_pins) — same inputs, same draft.
6. **Idempotence & the double-send guard are load-bearing** (see W3b.3).
7. Email HTML uses inline styles with token-mirroring hexes (email clients can't read CSS vars — mirror how the existing subscribe/digest emails do it); every email carries the recipient's unsubscribe link.
8. Voice: subject lines and template copy are the knowing local friend. Stop-and-show after each phase. Doc 14 entries at wave close.
9. **Out of scope:** a public `/edition/[date]` web page (the RLS supports it later — note it, don't build it); scheduled auto-sending (V1 is founder-triggered); sponsor slots of any kind; subscriber management UI beyond what exists.

## PHASE W3b.1 — Assembly logic (`lib/editionServer.ts`, server-only)

```ts
export type EditionDraft = {
  editionDate: string;            // ISO date (SB calendar)
  windowLabel: string;            // "The weekend ahead" | "The week ahead"
  hero: Thing;
  picks: Thing[];                 // 4–6, positioned
  candidates: Thing[];            // the swap rail (next ~15 by the same ranking)
};
export async function assembleEditionDraft(editionDate: string): Promise<EditionDraft>
```

Rules:
- **Window:** Thursday → Fri–Sun; Sunday → Mon–Thu (constants `EDITION_WINDOWS`, overridable by Jim's cadence decision). Any other date → nearest upcoming cadence date's window (so a Wednesday draft previews Thursday's edition).
- **Hero:** if a valid `hero_pins` row exists for a date inside the window (validated exactly as `lib/heroServer.ts` does — published, `hero_eligible`, occurs on that date), the earliest such pin wins. Else `pickAutoHero`-style selection over Tier-1 things occurring in the window (reuse/share the W2.1a helper if Wave 2 has landed; otherwise soonest-first — detect which world you're in and say so at stop-and-show).
- **Picks:** the next 4–6 Tier-1 things in the window by the site's own `cascade()` ordering (never a forked ranker), excluding the hero, at most 2 per SB day for spread; backfill from Tier-2 things whose schedules occur in the window if Tier-1 runs short (reuse the W1.3a day-match helper). `candidates` = the next ~15 by the same rule.
- **Sponsor-blind by construction:** the assembler reads no `is_featured`/`sponsor_id`; add the same adversarial-fixture test used in W2.1a.
- Pure-logic parts extracted and unit-tested (window math incl. SB-timezone boundaries; per-day spread; hero-pin precedence; short-supply backfill).

## PHASE W3b.2 — Cockpit surface (`/admin/edition`)

- New tab "Edition" in `CockpitTabs` (follow the existing tab/count pattern; count badge = 1 when the next cadence date has no published edition, else 0 — a gentle "one is due" signal).
- Page shows: the next cadence date + window; **Draft** button → `POST /api/admin/edition/draft` `{edition_date}` → runs the assembler, upserts an `editions` row `status='draft'` for that date and replaces its `edition_picks` (hero slot + secondaries with positions). Re-drafting a draft replaces picks; **drafting is refused (409) if that date's edition is already `published`.**
- Draft view: rendered preview (hero card + picks, using existing card idioms + cockpit CSS); a swap rail of `candidates` — swap-in/swap-out via `POST /api/admin/edition/update` (validates the replacement is published + in-window; maintains one-hero invariant; audit-logged); a founder-typed optional intro line (plain text, stored on the edition — if `editions` lacks a column for it, do NOT add one: keep the intro in the email template step as request payload… **correction, simpler and stateless:** the intro is entered at send time and lives only in the sent email; nothing stored, no schema pressure. Implement that.)
- Buttons/keyboard/a11y per cockpit standards; everything admin-gated.

## PHASE W3b.3 — Approve & send

`POST /api/admin/edition/send` `{edition_date, intro?}`:

1. Load the draft + picks; **guard:** edition must exist and be `status='draft'` — if `published`, 409 "already sent" (this is the double-send lock; flipping status to `published` and setting `approved_at` happens **before** the send loop, so a crash mid-send cannot cause a full duplicate blast on retry — document this tradeoff in a comment: partial sends are recoverable manually at current list size, duplicate blasts are not).
2. Fetch subscribers `status='confirmed'` (service role). For each: render the HTML (shared template function: header wordmark text, optional intro, hero block with photo/title/blurb/when-where, pick rows, footer with the trust line and that subscriber's `/unsubscribe?token=…` link; all links absolute to `NEXT_PUBLIC_SITE_URL`; every thing links to `/thing/[id]`) and `sendEmail`. Sequential loop is fine at current scale; count successes/failures; **log counts only.**
3. Subject template: `SB Daymaker — {windowLabel}: {hero.title}` (Jim can veto wording at stop-and-show).
4. Response `{ok, sent, failed}`; UI shows a confirm dialog **before** ("Send to N confirmed subscribers?") and the result after.
5. `audit_log` (`action:'edition_send'`, payload counts). Confirmed-subscriber count of 0 → send is a no-op with a clear message (still marks published? **No** — refuse with "no confirmed subscribers"; keep the draft).

**Testing the full path safely:** use a dev/test subscriber row (Jim's own email) — never a fabricated third-party address. Show Jim the received email on a phone-width client at stop-and-show.

### Acceptance (final stop-and-show)

- [ ] Draft → preview → swap → send works end-to-end; Jim receives a real edition at his own address; unsubscribe link in it works.
- [ ] Re-pressing send returns 409; re-drafting a published date returns 409; drafting twice pre-send replaces cleanly.
- [ ] `editions` + `edition_picks` rows correct (one hero, positions ordered); the one-hero DB constraint never trips in normal flow.
- [ ] Assembler unit tests green incl. the sponsor-blind fixture; zero Anthropic imports in the new code (grep proof).
- [ ] No email/token in any log; `npm run test` + `npx next build` clean; cockpit checked at ~1280px and the email at phone width; Doc 14 entries appended.

*End of Doc W3b.*
