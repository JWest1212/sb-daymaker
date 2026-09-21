# R1 Wave 7: Saved, Share, Offline, Forms, Metadata

Purpose: finish the loops around the core verbs. Saved counts and labels agree, the recipient of a share knows what they are looking at, Saved works offline, forms validate honestly, the confirmation email looks like the site, and every page previews with its own title and image. Requires Wave 6.

Findings closed: SAV-003, SAV-005, SHR-002 (context part), SHR-003, SHR-004 (Saved part), FRM-001, FRM-002, EML-001, CON-002, META-001, META-003, DET-013, A11Y-002, A11Y-005 (landmarks), TP-A5-02, TP-A6-04, TP-C1-06 (Near Me button), TP-C3-03, TP-C3-04, plus the subscribe notes in the audit's COV 5.2 and 5.3.

## W7.1 Saved counts and labels

- The tab badge counts Want to go only; the Been count shows inside Saved. One line under the toggle explains: "N to go, M been" (SHR-003, TP-A5-02).
- "Did you make it?" card label from the event's own time: "This morning", "Last night", "Yesterday", "On Saturday"; the section header and the card do not both carry the prompt (SAV-003).
- Empty state: keep the heart copy, add two links, "Browse today" to / and "Read a guide" to /discover; the emoji becomes the icon-set heart (SAV-005).
- Saved cards get the stretched link on the top region and the action row stays separate, documented as the intended model (TP-A6-04). Near Me button 44px tall (TP-C1-06).
- Saved copy stops promising a map or a memory (SHR-004 Saved part): "Your map starts here" becomes "Your Santa Barbara, so far". The meta description names what exists: "Save what you want to do, mark what you did, share a list, or build a day from it."

## W7.2 Places on Saved

- Evergreen and recurring saves (no `starts_at`) group under "Places and regulars" with the series meta from Wave 6.

## W7.3 Recipient pages (/s, /p, /r)

- Add the wordmark, one line "A friend's picks from SB Daymaker, what's worth doing in Santa Barbara", and a persistent "Open SB Daymaker" link. Hearts start empty (already correct). Past items carry the Wave 2 "already happened" line. Meta description per page: "N picks shared from SB Daymaker" (SHR-002).

## W7.4 Offline (public/sw.js)

- The service worker caches the app shell for /saved, /plan, and /thing/* and serves it offline. /saved renders from localStorage with a "You're offline, showing your saved list" line; item details that were never fetched show title only. Detail and Plan pages fall back to the /offline page rather than the generic error boundary (TP-C3-03, TP-C3-04).

## W7.5 Submit form (components/submit)

- Required fields marked; submitting empty shows inline messages and scrolls to the first; the button disables during send (FRM-001).
- Success copy sets timing: "Thanks, got it. A local reads every submission within a few days. The best ones get featured in the weekend digest." Icon-set check, no party emoji.
- Page title "Suggest an event or business · SB Daymaker" and a real meta description (FRM-002).

## W7.6 Subscribe

- Inline validation in the site's styling, not only the browser bubble. Success keeps the address visible with "Not you? Try another." so a typo can be fixed. The duplicate-address response stays identical to first-time (correct today).

## W7.7 Confirmation email (lib/email.ts templates)

- The confirm, restore-link, and unsubscribe emails use the digest template: wordmark, Plaster background, Fraunces heading, one Pacific button, the mailing address footer. Text alternative preserved. Subject "Confirm your SB Daymaker digest" stays; body cadence copy comes from the single string in Wave 8 (EML-001).

## W7.8 Metadata

- `og:title` and `og:image` per page for /, /saved, /discover, /plan, /submit, /weekend, /s, /p, /r (META-001). Descriptions for /submit and /s (FRM-002). /digest/sample gets description, canonical, and the title suffix (CON-002). Guide not-found title "Guide not found · SB Daymaker" (DET-013). robots.txt adds /p/ (META-003). Saved gets an h1; every page exposes header, main, nav, and footer landmarks (A11Y-002, A11Y-005).

## Acceptance

1. Flip one item to been: the tab badge drops by one, and the line reads "N to go, 1 been".
2. A past 11 AM event saved today shows "This morning" on the card; the prompt appears once.
3. Empty /saved shows two working links and no emoji.
4. Open a /s link in a fresh profile: wordmark, explainer line, empty hearts, past items marked.
5. Go offline after one visit: /saved renders the list; /thing/[id] and /plan show the offline page, not "This page couldn't load".
6. Submit empty: inline errors appear. Submit complete: success copy with timing.
7. Subscribe "notanemail": site-styled error. Subscribe a valid address: address stays visible.
8. The confirmation email renders with the digest template in Gmail.
9. View source on nine routes: unique og:title per page; /submit and /s have descriptions; /digest/sample has description and canonical; Saved has one h1.
10. Tests green.

Commit: `feat(r1-w7): saved counts and labels, recipient context, offline shell, form validation, branded emails, per-page metadata`
