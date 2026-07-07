# SB Daymaker — Edition · Issue Anatomy & Field Map (v3 · final)

`Phase 2 deliverable, final · design-stage content model (not a renderer spec — that's Phase 6)`

## Settled

- **Skeleton:** Hero ("THE MOVE") + 3 secondaries + **1 fixed non-event segment**. Evergreen anchor: **filler on Thursday, standing feature on Sunday**.
- **Two issues, one template, one block order** — they diverge only by *config*, never layout:
  - **Thursday — event-forward.** Window Fri–Sun. "The weekend ahead."
  - **Sunday — discovery-forward.** Window Mon–Thu. "The week ahead — and a corner of SB worth exploring."
- **Voice without synthesis:** subject / preheader / greeting = hand-authored static templates + reused-field substitution. No model call at send.
- **WOM:** the **forward-the-issue loop** only (per-pick sharing cut for V1).

## What changed from v2

1. **Sunday now has its own identity** (discovery-forward) — expressed through config + copy + the anchor's role, not a second layout.
2. **Wildcard rotation removed** → a single fixed non-event segment ("New this week" / "Worth exploring").
3. **"Send a pick to a friend" cut** — hero keeps one primary CTA; the forward loop is the sole WOM mechanic.
4. **Evergreen anchor role split:** conditional filler (Thu) vs standing feature (Sun).
5. **Skip-on-failure recorded**, personalization slot tightened to position-only, Local's Secret gets a quality guard, plain-text reframed as deliverability.

---

## 1. One template, two configs

Identical block order; these are the only values that differ:

| Aspect | Thursday (event) | Sunday (discovery) |
|---|---|---|
| Window | Fri–Sun | Mon–Thu |
| `window_label` | "the weekend ahead" | "the week ahead" |
| Section label (secondaries) | "Also this weekend" | "Also this week" |
| Non-event segment label | "New this week" | "Worth exploring" |
| Evergreen anchor | conditional filler (thin weeks) | **standing feature** (every issue) |
| Copy pools (subject/preheader/greeting) | event-forward pool | discovery-forward pool |

> **Why this fixes thin-Sunday:** Sunday's weekday window is genuinely event-sparse. Rather than let it read as a thin events list, its identity is "here's SB worth exploring this week" — so the standing anchor and the "Worth exploring" segment are the point, not an apology. Thursday stays event-forward and keeps the anchor as emergency-only.
>
> **Tier clarification (load-bearing for the Phase-6 drafter):** "discovery-forward" is **not** a tier filter. Sunday's hero + secondaries are selected **tier-agnostically, events-first** (via the same `cascade()` ranker, which orders Tier 1 → 2 → 3) from the Mon–Thu window — so real dated events (Tier 1) lead the Sunday issue whenever they exist. The discovery skew is only *emphasis + a reliable safety net*, never event exclusion. **Sunday is never events-excluded.**

---

## 2. Anatomy, top to bottom

Tags: **[reused]** = published `things` field · **[derived]** = pure function of approved fields · **[chrome]** = authored once, identical/fixed-pair · **[static]** = finite hand-authored library, deterministic selection (§4).

### Preheader
| Element | Source | Provenance |
|---|---|---|
| Preview text | template + `{hero_title}` | **[static]** + **[reused]** |

### Masthead
| Element | Source | Provenance |
|---|---|---|
| Wordmark + sun mark | template | **[chrome]** |
| Dateline | `window_label` + `editions.edition_date` | **[chrome]** + **[derived]** |
| Greeting | greeting pool (per edition-type) + optional reused slots | **[static]** + **[reused]** |

### Hero — "THE MOVE"  (`edition_picks.slot='hero'`)
Selection parallels `heroServer.ts`: `hero_pins` → ranker auto-pick (`cascade()`) → evergreen fallback. **Sponsor-blind.**

| Element | Source | Provenance |
|---|---|---|
| Eyebrow — "THE MOVE" | template | **[chrome]** |
| Image + alt | `photo_url` + `title`/`photo_attribution` | **[reused]** |
| Title | `things.title` | **[reused]** |
| When-string | `whenString(starts_at / recurring)` | **[derived]** |
| Locator | `things.neighborhood` | **[reused]** |
| Blurb | `things.blurb` | **[reused]** |
| **Local's Secret** *(conditional — shown only if `local_note` is substantive)* | `things.local_note` | **[reused]** |
| CTA "See it →" → `/thing/{id}` | template + id | **[chrome]** + **[derived]** |

*One primary CTA now (send-a-pick removed). Golden-hour flavor lives in the sun mark, not the eyebrow. Local's Secret: quality/length-guarded — genuinely good, or absent. Graceful absence is fine; we don't engineer for guaranteed presence.*

### Section rule + label → 3 secondary picks  (`slot='secondary'`, `position` 0–2)
Section label per §1. Each pick:

| Element | Source | Provenance |
|---|---|---|
| Eyebrow day-label | weekday from `starts_at` / `recurring_schedules.label` | **[derived]** / **[reused]** |
| Title / When / Locator / Blurb | `title` / `whenString` / `neighborhood` / `blurb` | **[reused]** / **[derived]** |
| CTA "See it →" → `/thing/{id}` | template + id | **[chrome]** + **[derived]** |

### Non-event segment — fixed, single (no rotation)
One slot, labeled per §1. Source: the existing **First Look / New-This-Week** selection over `things` (freshness via `created_at` / `last_confirmed`); extensible to a `guides` corner once guides are seeded — but selected by a simple rule, **not** a per-issue rotation engine.

| Element | Source | Provenance |
|---|---|---|
| Label ("New this week" / "Worth exploring") | template pair | **[chrome]** |
| Title / Copy / Locator | `title` / `blurb` or `reason_to_go` / `neighborhood` | **[reused]** |
| CTA → `/thing/{id}` | template + id | **[chrome]** + **[derived]** |

### Evergreen anchor — "Always worth it"
**Thursday:** conditional — fires only when the window returns < 3 secondaries, filling short slots.
**Sunday:** standing — an intentional feature of the discovery issue.

| Element | Source | Provenance |
|---|---|---|
| Label "Always worth it" | template | **[chrome]** |
| Title / Copy / Locator | `title` / `reason_to_go` / `neighborhood` | **[reused]** |
| CTA → `/thing/{id}` | template + id | **[chrome]** + **[derived]** |

### Personalization slot — RESERVED (design-position only)
A documented position in the anatomy for a future per-recipient "your saved picks this week" block. **No renderer scaffolding, no data plumbing, no conditional code in V1** — it renders absent, full stop. When built (later phase): assembled from the recipient's own magic-link save-restore saves, filtered to the window — reused content only, PII inside the existing subscriber boundary. It is the one deliberate exception to "renders once," and it doesn't exist in code yet.

### Sponsor slot — PLACEHOLDER (deferred; empty in V1)
After all picks, before the footer.

| Element | Source | Provenance |
|---|---|---|
| Label "Sponsored" | template | **[chrome]** |

> **Trust rule:** the drafter selecting hero / secondaries / non-event segment runs with zero knowledge of sponsor status. Sponsor slot filled independently, labeled, structurally separate.

### Footer
| Element | Source | Provenance |
|---|---|---|
| Reason-for-receiving + "Two a week, no more." | template | **[chrome]** |
| **Forward loop** — "Know someone new to SB? Forward this →" + one-line what-this-is + **Subscribe** CTA | template + subscribe URL | **[chrome]** |
| **Unsubscribe** | `/unsubscribe?token={subscribers.unsubscribe_token}` | **[reused]** — *the only per-recipient value in the shared render* |
| Physical mailing address (CAN-SPAM) | template | **[chrome]** |

---

## 3. The no-synthesis proof (holds)

1. **[reused] / [derived]** — titles, blurbs, when-strings, neighborhoods, images, `local_note`, `reason_to_go`, non-event content, links, unsubscribe token.
2. **[chrome]** — wordmark, "THE MOVE" / segment labels / "Always worth it" / "Sponsored" / forward-loop / footer legal.
3. **[static]** — subject, preheader, greeting (finite pools, deterministic selection, reused-field slots only).
4. **AI-generated at send — none.** Every element lands in buckets 1–3.

---

## 4. Subject / preheader / greeting mechanism

Finite hand-authored pools **per edition-type** (event-forward vs discovery-forward) · deterministic `index = stableHash(edition_id) % pool.length` · allowlisted substitution tokens only (`{hero_title}` · `{hero_neighborhood}` · `{hero_when}` · `{edition_weekday}` · `{window_label}` · `{pick_count}`) · null-safe variants in every pool, **including an evergreen-hero variant** so a quiet-week hero never over-promises a marquee event. Real copy is **Phase 3**.

---

## 5. Failure vs thinness (recorded now; handled in Phase 5)

Two different rules, not one:
- **Thinness** (few real events in the window) → **never skip**; fill with evergreens / lean on the anchor + non-event segment.
- **Failure** (drafter can't assemble a minimum viable issue — hero + ≥1 real pick, or images/data broken) → **skip the send.** Better silence than a broken email. The state matrix (Phase 5) defines the exact threshold and behavior.

---

## 6. Shared vs per-recipient

Byte-identical for everyone except the unsubscribe link. The reserved personalization slot is the one designed exception, opt-in-by-behavior, later phase. V1 stays inside the 15-min / renders-once model.

---

## 7. Deferred / flagged

- **Non-event segment** leans on First Look until Discover guides are seeded.
- **Plain-text alternative** → Phase 5, but treat as a **deliverability requirement** (multipart affects spam scoring), not a11y polish.
- **Derived per-pick signal** (e.g. "Free," "Tonight") → optional **Phase 4** visual experiment; cut if it clutters.
- **Secondary thumbnails, hero crop, missing-image / single-pick / dark-mode / a11y markup** → Phase 4 / 5.
- **Personalization fill, hash impl, renderer, send wiring, verified domain, tracking** → Phase 6.

---

**This closes Phase 2.** Next: **Phase 3 — the voice & copy kit** — the real subject/preheader/greeting pools (both edition-types) and every fixed chrome string, in the knowing-local-friend voice. No Phase-4 pixels until the copy's settled.
