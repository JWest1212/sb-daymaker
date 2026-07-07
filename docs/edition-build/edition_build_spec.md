# SB Daymaker · Edition / Digest · Build Spec (Phase 6)

`Implementation handoff for Claude Code. Governing contract: CLAUDE.md. Design artifacts this derives from: edition_anatomy_and_field_map_v3.md, edition_copy_kit_v2.md, edition_themed_mockup_v3.html (zoned-bands direction).`

This spec is authoritative for the reader edition. It does not restate CLAUDE.md; where they touch, CLAUDE.md governs and live code is truth. Build in the order in §1. Nothing here introduces AI at send time, end-user accounts, or sponsor-aware ranking.

---

## 0. Hard invariants (never violate)

1. **No AI synthesis at send.** Every string is a reused `things` field, a pure-function derivation of one, fixed template chrome, or a hand-authored static-pool line. No model call sits in the draft-render-send path. (Batch AI, if any, stays in the nightly pipeline.)
2. **Sponsor-blind selection.** The drafter and every ranker it calls never read `is_featured` or `sponsor_id`. Enforce in the SQL/query layer, not just by convention.
3. **Confirmed subscribers only.** Send only to `subscribers.status = 'confirmed'`. Honor unsubscribe and suppression on every send.
4. **No em dashes anywhere in the digest.** Applies to the assembled output, including reused fields. Batch drafting must not emit them; the renderer runs a final normalization pass (see §6.6).
5. **WCAG 2.2 AA** for the email and the permalink. Semantic structure, alt text, contrast per the token rule (small text only Ink / Ink-2 / Pacific).
6. **Renders once, with overrides.** The shared render is byte-identical per recipient except the unsubscribe link. Editorial overrides are applied at draft time, not per recipient. (The per-recipient personalization slot is not built in V1; it is a reserved design position only.)
7. **15-minute operator ceiling.** The only required human action is a one-tap approve in the cockpit. If unapproved by send time, the draft auto-sends (§7.2).

---

## 1. Scope and suggested build order

In V1: the drafter, the candidate slate, the editions/overrides data layer, the cockpit "Edition Draft" module (review, edit, swap, approve, archive), the renderer (email + permalink), the send path, deliverability, and native tracking.

Recommended sequence:
1. Data layer migrations (§2).
2. Drafter + candidate slate + image pipeline (§3), runnable on demand, writing a draft.
3. Renderer + permalink (§6, §9), so a draft can be previewed as real HTML.
4. Cockpit "Edition Draft" module (§5).
5. Send path + suppression + tracking (§7).
6. Schedule wiring (§3.1, §7.1) and deliverability finalization (§8).
7. State matrix hardening (§10), tests (§11), rollout (§11.3).

---

## 2. Data layer

Add via migration. Preserve existing `editions` and `edition_picks`; extend them. All timestamps stored UTC; all schedule logic computed in `America/Los_Angeles`.

### 2.1 `editions` (extend)
- `edition_type` enum: `weekend` (Thursday) | `week_ahead` (Sunday).
- `status` enum: `draft` | `approved` | `sent` | `skipped` | `failed` (extend existing).
- `subject`, `preheader`, `greeting` (text): the selected static-pool lines, stored at draft time so they are reproducible and editable.
- `scheduled_send_at` (timestamptz), `approved_at`, `sent_at` (nullable).
- `resend_broadcast_id` (text, nullable).
- `sent_count`, `open_count`, `click_count` (int, default 0): updated from Resend webhooks (§7.5).
- `skip_reason` (text, nullable): set when `status='skipped'|'failed'`.
- Permalink slug = `edition_date` (unique already). Public route `/edition/{edition_date}`.

### 2.2 `edition_picks` (extend)
- `slot` enum: `hero` | `secondary` | `nonevent` | `anchor` (extend; keep the single-hero partial unique index).
- `position` (int): order within slot.
- Edition-only overrides (all nullable; render uses `override_* ?? thing.field`): `override_title`, `override_blurb`, `override_when`, `override_neighborhood`, `override_local_note`, `override_image_url`.
- `cached_image_url` (text): the hosted hi-res image from the pipeline (§3.5).
- `is_manual` (bool, default false): true when the operator swapped or edited this pick (bypasses cooldown; records editorial intent).

### 2.3 `edition_candidates` (new)
The ranked bench per slot, so the cockpit swaps without re-running the ranker.
- `id`, `edition_id` (fk), `slot` enum (`hero`|`secondary`|`nonevent`|`anchor`), `thing_id` (fk), `rank` (int, 0 = best), `selected` (bool).
- Written by the drafter. `selected=true` rows mirror the current `edition_picks` lineup. Unique on `(edition_id, slot, thing_id)`.

### 2.4 Suppression / subscribers
- Extend `subscribers.status` (or add a `suppressed_at`) to cover `bounced` and `complained`. Suppressed and unsubscribed addresses are excluded from every send.

### 2.5 Storage
- Supabase Storage bucket `edition-media` (public read). Cached edition images live at `edition-media/{edition_date}/{slot}-{thing_id}.{ext}`.

---

## 3. The drafter

A deterministic, sponsor-blind assembler. Reuses existing rankers; does not fork them.

### 3.1 Trigger
- Runs at **19:00 America/Los_Angeles the night before each send** (Wednesday for Thursday, Saturday for Sunday). Fold into the existing nightly GitHub Action gated to those nights, not a new scheduler.
- Idempotent: re-running for the same `edition_date` refreshes the draft only while `status='draft'`. Once `approved` or `sent`, it does not overwrite.

### 3.2 Window and edition type
- `weekend` (Thursday): things occurring Fri–Sun. `week_ahead` (Sunday): things occurring Mon–Thu. Clean tile, no overlap. Use existing `occursOnDate` / `whenString` helpers.

### 3.3 Selection (per slot, all sponsor-blind, reusing `cascade()` from explore.ts and things.ts)
- **Hero:** `hero_pins` for the date wins; else the top hero-eligible ranked candidate; else the hand-written evergreen fallback (parallel `heroServer.ts`, do not fork it). Never blank.
- **Secondaries (3):** the top-ranked qualifying in-window things after the hero. **Qualifying = Tier 1 dated OR Tier 2 recurring.** Ordered chronologically for render.
- **Non-event (1):** the First Look / New-This-Week selection (freshness via `created_at` / `last_confirmed`); extensible to a `guides` corner once seeded. Labeled per edition type (see copy kit).
- **Anchor:** Tier 3 `hero_eligible` evergreen. **Conditional** on Thursday (fires only when < 3 qualifying secondaries exist). **Standing** on Sunday.

### 3.4 Candidate slate (for the cockpit swap UI)
For each slot, write the auto-pick plus a ranked bench into `edition_candidates`: **hero ~5, secondary bench ~6, nonevent ~4, anchor ~3** (tunable constants). Sponsor-blind ranking; exclude things already `selected` in another slot. The cockpit reads these for its swap control; a swap promotes a candidate into `edition_picks` and flips `selected`.

### 3.5 Image pipeline (highest quality available, cost accepted)
For each selected pick (and lazily for candidates on demand):
- Resolve the best source: prefer the highest-resolution Google Places photo (max width the API allows) or a stored original over a small `photo_url`.
- Fetch at retina resolution, upload to `edition-media`, store the public URL in `edition_picks.cached_image_url`. Email and permalink reference the hosted URL (absolute, non-expiring); never a Places URL that can expire.
- Record attribution for alt text. If no source clears a minimum size/quality bar, leave `cached_image_url` null and let the state matrix (§10) handle it.
- Cost note: per-photo API fetches and storage add a small recurring cost; acceptable per the product owner. Cache by `thing_id` to avoid refetching across editions.

### 3.6 Cooldown (repeat suppression)
- Exclude from **auto-selection** any `thing_id` that appeared in `edition_picks` of the **last 12 editions** (both types combined). Exceptions: an explicit `hero_pin`, and any operator manual swap (`is_manual=true`) may override cooldown. Ensure the evergreen pool is large enough to satisfy a 12-edition memory; if it cannot, surface a warning in the ops digest.

### 3.7 Copy selection
- Choose subject / preheader / greeting from the edition-type pool via `index = stableHash(edition_id) % eligible_pool.length`, honoring the eligibility filter (token / safe / evergreen) in edition_copy_kit_v2.md. Store the resolved strings on `editions` (editable in cockpit). Substitute only allowlisted tokens; use null-safe variants when a token is missing or the hero is an evergreen fallback.

### 3.8 Determinism and writes
- Given DB state at draft time, selection is deterministic (ranker order, cooldown, tie-break by `thing_id`). Writes: one `editions` row (`status='draft'`), its `edition_picks` (with `cached_image_url`), and `edition_candidates`. Wrap in a transaction.

### 3.9 Skip vs thin (record + enforce)
- **Thin** (few qualifying picks): never skip; evergreen anchor / non-event fill.
- **Failure** (cannot assemble hero + at least 1 real pick, or image/data integrity broken): set `status='failed'`, `skip_reason`, do not send, and alert via the existing ops digest. Silence beats a broken email.

---

## 4. Editions and overrides model

- The render reads each field as `override_* ?? thing.field`, and the image as `override_image_url ?? cached_image_url ?? (branded fallback)`.
- Overrides are **edition-scoped**: editing a draft never mutates the canonical `thing`. Editing marks `is_manual=true`.
- Subject / preheader / greeting overrides live on the `editions` row.

---

## 5. Cockpit "Edition Draft" module

New module in the existing cockpit (the one carrying `hero_pins`). Two views.

### 5.1 Draft reviewer (for `status='draft'`)
- Renders a live preview of the edition (reuse the renderer, §6) beside editable controls.
- **Every field editable:** hero and each pick's title, blurb, when-string, neighborhood, local-note, and image; the subject, preheader, greeting; pick order.
- **Per-slot swap control:** for hero, each secondary, and the non-event slot, a picker listing the ranked `edition_candidates` (with thumbnail + title), plus a **search-all** fallback to insert any `published` thing. Swapping updates `edition_picks` and `edition_candidates.selected`, and triggers the image pipeline for the newly selected thing.
- **Image editing:** choose from the thing's available photos, upload a new image (to `edition-media`), or paste a URL. Stored as `override_image_url`.
- **Approve** sets `status='approved'`, `approved_at`. A **Reject / hold** action can set `skipped` with a reason.
- All edits write overrides only; canonical things untouched.

### 5.2 Archive (past editions)
- A list of all `sent` (and `skipped`/`failed`) editions: date, type, subject, status, sent/open/click counts, and a **permalink** to `/edition/{date}`. Sorted newest first. This is the operator's record of what went out.

---

## 6. The renderer

Single template, two configs (weekend / week_ahead). Source of visual truth: edition_themed_mockup_v3.html (zoned bands).

### 6.1 Output
- **Multipart:** an HTML part and an auto-generated **plain-text** part (required for deliverability and accessibility, not optional).
- Input: one `editions` row + its `edition_picks` (+ overrides + cached images) + resolved copy strings. No per-recipient data except the unsubscribe token injected at send.

### 6.2 Structure (from the anatomy, zoned-bands treatment)
Masthead (wordmark + sun glyph + gold horizon band + dateline + greeting) → Hero "THE MOVE" (image, eyebrow, title, when, locator, blurb, conditional Local's Secret, CTA) → "Also this weekend/week" band (3 secondary rows with thumbnails) → non-event band ("New this week" / "Worth exploring") → anchor band ("Always worth it"; standing Sunday, conditional Thursday) → footer (forward loop, reason, cadence, unsubscribe, address).

### 6.3 Email-safe implementation
- Convert the mockup to **table-based layout with inline styles** (email clients strip `<style>` and modern CSS). Keep the zoned-band effect via table cell background colors.
- Web-font fallbacks: Fraunces → Georgia/serif, Inter → system sans, JetBrains Mono → monospace. Design must hold with fallbacks.
- Max width ~600px, centered, single column; fluid to mobile.
- Colors from tokens only (no raw hex duplication where avoidable); honor the small-text contrast rule.

### 6.4 Dark mode
- Provide `prefers-color-scheme: dark` overrides so clients that auto-invert do not mangle the cream/terracotta palette. Supply a tested dark mapping (dark ground, light ink, adjusted accents preserving AA).

### 6.5 Copy and tokens
- Subject/preheader/greeting come from `editions` (already resolved). Chrome strings and labels per edition_copy_kit_v2.md. Alt text = `title` or `title (photo: attribution)`.

### 6.6 Em-dash normalization
- Final pass over every assembled string (including reused blurbs and overrides) replaces any em dash with an appropriate substitute (period/comma/colon per context, or a safe default of a comma or period). Ranges render with "to", not en dashes.

---

## 7. Send path

### 7.1 Schedule
- Send **Thursday and Sunday at 07:00 America/Los_Angeles**. Wire into the existing pipeline / a scheduled job. Only editions with `status IN ('approved','draft')` for that date are eligible (see 7.2).

### 7.2 Auto-send if unapproved
- At send time, if the edition is `approved`, send it. If still `draft` (operator did not act), **auto-send the draft as-is** (it is already quality-gated and sponsor-blind), then set `status='sent'`. If `skipped`/`failed`, do not send. This protects the twice-a-week promise. (Leave a per-account "require explicit approval" toggle stubbed for later.)

### 7.3 Recipients and suppression
- To `subscribers.status='confirmed'` only. Exclude `unsubscribed`, `bounced`, `complained`/suppressed. Inject the per-recipient unsubscribe link (`/unsubscribe?token=...`).

### 7.4 Delivery
- Send via Resend (`RESEND_API_KEY`) using batch send. Include **one-click unsubscribe headers** (`List-Unsubscribe`, `List-Unsubscribe-Post`), which are effectively required by Gmail/Yahoo for bulk senders. Store `resend_broadcast_id` / message ids.

### 7.5 Feedback loop
- Handle Resend webhooks for bounces and complaints: suppress those addresses. Update `sent_count`, and (from open/click events, native Resend tracking enabled) `open_count` / `click_count` on the `editions` row for the archive view.

---

## 8. Deliverability

- **From:** `no-reply@` the verified sending domain (configured in Resend). **Reply-to:** no-reply for V1.
- Domain + SPF / DKIM / DMARC verified in Resend (owner confirms ready). Replace any `resend.dev` sandbox usage.
- Native Resend open/click tracking enabled for V1.
- Physical mailing address (CAN-SPAM), present in footer: `78 Brandon Drive, Goleta, CA 93117`.

---

## 9. Permalink pages

- Public route `/edition/{edition_date}` (Next.js, ISR, revalidate ~600s), reusing the renderer's HTML for `sent` editions (and a preview for `draft`/`approved`, gated to the cockpit).
- Serves as the "view in browser" link and makes forwarded copies self-explaining (masthead + subscribe CTA present).
- Linked from the cockpit archive (§5.2) and, optionally, a small "view online" link in the email header.

---

## 10. State matrix (Phase 5, folded in)

| Case | Behavior |
|---|---|
| Missing / weak hero image | Branded golden-hour gradient with the title set over it (never blank, on-brand). |
| Missing secondary thumbnail | Branded gradient tile placeholder, so the band stays even. |
| Dark mode | `prefers-color-scheme` mapping (§6.4). |
| Local's Secret quality | Show only if `local_note` is substantive (~40+ chars); else omit. |
| Thin week | Evergreen fill engages when < 3 qualifying (Tier 1 + Tier 2) secondaries. Never skip. |
| Assembly failure | Cannot make hero + ≥1 real pick → `status='failed'`, skip send, alert ops. |
| Long titles / blurbs | Wrap gracefully; no truncation that drops meaning; test 2–3 line titles. |
| Duplicate content | Cooldown (§3.6) prevents repeats across 12 editions; within an issue, no thing appears twice. |
| Unsubscribe | One-click headers + footer link; immediate suppression. |
| Plain-text | Always generated; readable, links intact, no layout artifacts. |
| Em dashes | Normalized out of all assembled text (§6.6). |

---

## 11. Testing, acceptance, rollout

### 11.1 Tests
- Drafter unit tests: window selection, tier qualification, hero fallback chain, cooldown exclusion, candidate ranking, determinism (same state → same draft), sponsor-blindness (a sponsored thing never gains rank).
- Renderer tests: token substitution + null-safe variants, em-dash normalization, missing-image and thin-week and failure states, plain-text generation, AA contrast checks.
- Send tests: confirmed-only targeting, suppression, unsubscribe token correctness, one-click headers present.

### 11.2 Acceptance criteria
- A draft appears in the cockpit by 19:00 PT the night before, with a working preview, editable fields, per-slot alternates, and approve.
- Editing a field or swapping a pick changes only the edition, never the canonical thing.
- An approved (or unapproved) edition sends at 07:00 PT to confirmed subscribers, renders correctly in Gmail/Apple Mail/Outlook (light and dark), passes an email spam/deliverability check, and contains zero em dashes.
- The permalink renders the same edition; the archive lists past sends with permalinks and counts.
- No sponsored item ever influenced selection order.

### 11.3 Rollout
- Verify domain and send a seed test to an internal list.
- Ship in `draft`-only mode for the first 1–2 real editions (operator approves manually) before relying on 07:00 auto-send.
- Enable auto-send once the drafter has earned trust.

---

## 12. Non-goals (explicitly out of V1)

- No AI synthesis at send. No per-recipient personalization fill (the "your saved picks" slot is a reserved design position only, no scaffolding). No sponsor content or sponsor-aware ranking. No end-user accounts or preference center. No per-pick share tokens (forward-the-issue loop only). No pick-level editorial override beyond hero pinning and the cockpit swap. No SMS/push.

---

## 13. Real-world preconditions / env

- Verified sending domain + SPF/DKIM/DMARC in Resend (owner: ready).
- Env: `RESEND_API_KEY`, `SUPABASE_URL` / `SUPABASE_SECRET_KEY` / `SUPABASE_ANON_KEY` (+ `NEXT_PUBLIC_SUPABASE_URL`), the existing Google Places API key used by the photo pipeline. Do not hardcode secrets; read from env.
- Create the `edition-media` Storage bucket (public read).
- Confirm the physical address above is the one to use.
