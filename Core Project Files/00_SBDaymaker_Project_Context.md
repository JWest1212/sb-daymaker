# SB Daymaker — Project Context & Full Overview

`Status: v9 canon · last updated 2026-06-21 · supersedes all earlier pre-rename material`

> **Purpose of this file.** Master context for the **SB Daymaker** project. Drop it into a project directory so any new Claude chat has complete, current context — without re-explaining from scratch. Read this first before helping with anything SB-Daymaker-related.
>
> **v9 note (current — the three-section cut). This is the binding shape of the app.** SB Daymaker is now **three sections: Explore · Saved · Discover SB.** The **Map screen and the My Plan itinerary builder are removed.** In their place:
> - **Near Me** is an in-view **sort** (by neighborhood), available on Explore and Saved — not a map, not a screen.
> - **Sharing** is a **view-only saved-list link** (Option A): a friend opens the link, sees the picks, and can save their own copy. One item or a multi-select batch. No recipient PII stored.
> - **One Perfect SB Day** is an **Explore card** that seeds a hand-curated lineup into the saved list (deterministic; no AI at tap time).
> - **Discover SB** holds two guide groups — **neighborhood** guides + **theme** guides — each surfacing the live happenings scoped to it.
> - The positioning line ends on **"share it."**
> - **Removed — do NOT build, even where an older passage describes it:** the Map screen · the My Plan / timeline / itinerary builder · the drum-roll time picker · `.ics` calendar export. **Mapbox leaves the V1 stack** (full map → Phase 2). Where any passage below still shows five tabs, a Map, or My Plan, this note and the wireframe win.
>
> **Earlier history (for reference).** *v3 (post-audit):* integrated the 26 pre-build decisions from Document 5. *v4 (post-UX-review):* integrated the 16 Locked UX Decisions + 7 follow-on decisions and reframed the spine from flat place-first to a happenings-first cascade. The authoritative build artifacts are now **`sbdaymaker_schema.sql`** (data contract), **`sbdaymaker_tokens.css`**, the **wireframe** (canonical UI), and **Documents 4–6**.

---

## 0. How to use this document (for Claude)

- This captures a product that has been thoroughly designed *and* taken through a production-grade pre-build audit. **Treat the decisions here as settled** unless I explicitly reopen one.
- Build on the framing below; don't re-derive strategy.
- I value **honest, critical assessment over optimistic cheerleading.** If something is weak, say so and why. Stress-test ideas.
- I'm a **visual learner** and prefer **structured, evidence-based, comprehensive deliverables with professional visual quality.** Match the SB Daymaker aesthetic (§17 + `sbdaymaker_tokens.css`).
- The authoritative documents are listed in §19. Stay consistent with them; the **16 Locked UX Decisions + the 7 follow-on decisions (this v4) take precedence** where they revise an earlier choice, then Document 5, then the rest.

---

## 1. The one-paragraph essence

**SB Daymaker is a mobile-first daily companion for Santa Barbara, CA** that you open like you check the weather. It answers one human question — *"what's worth doing in Santa Barbara today?"* — then helps you **find it, save it, and share it**, with the warmth and judgment of a knowing local friend rather than the cold completeness of a calendar. It's **happenings-first** (the spine is *what's actually happening* around town — ranked in a three-tier cascade so the screen is never empty, even on a quiet Tuesday — the defensible lane Yelp/Google/TripAdvisor structurally can't own), **tunable** (occasion tags retune the app to what you're up to), and **frictionless** (no accounts — saving lives on-device, with an optional magic-link backup). It runs **remarkably cheaply** (~$45/mo in platform fees plus metered photo cost — see §14) and is operable by **one person**.

**Positioning line:** *Find what's worth doing in Santa Barbara today — find it, save it, share it.*

---

## 2. What SB Daymaker is

A two-sided web application:

1. **The consumer app** — a mobile-first **installable PWA** the public uses: a daily-ritual surface (the hero), a personalized discovery experience, and a personal **save → share** layer.
2. **The admin cockpit** — a private dashboard (just for me) where I approve and maintain content in ~15 minutes a day. The app cannot run day-to-day without it; they are **co-equal MVP deliverables.**

Operating model: **"AI drafts, I approve."** An AI editorial engine generates content (blurbs, daily picks, persona tags); I approve or tweak it.

---

## 3. Who it's for

**Both residents and visitors, served by one unified experience** (no separate modes). The occasion tags let each person tune the app to what they're up to.

- **Residents** settling into SB's rhythm — what's new, what's on this week, where to go tonight.
- **Visitors** living SB like a local — the evergreen Tier-3 depth shines, and ~6.5M annual South Coast visitors (mostly Californian; ~80% of overnighters likely to return) are a constantly-replenishing audience. ~64% are day-trippers — served by the One Perfect SB Day entry point.

The audience is a **barbell, not a single demographic** (corrected in the UX review): affluent retirees/second-home owners at one end; UCSB students (~26k next door), young locals, and a ~36% Latino community at the other; time-poor 25–54 professionals and families in the fat middle (the largest cohort); and ~6.5M mostly-Californian visitors layered on top — ~64% of them day-trippers, ~80% of overnighters likely to return. The older/simplicity-seeking core is real but it's ~⅕ of the city, not the whole. Accessibility-as-floor (**WCAG 2.2 AA**) remains exactly right — it serves everyone, including seniors (see §17, §20). Designing *only* for the older simplicity-seeker would under-serve the largest, most return-prone cohorts; the feature set below now reflects students/nightlife, hosts, foodies, solo-goers, and day-trippers explicitly.

---

## 4. Positioning & the core bet

### The gap
Every existing SB resource is either a **static calendar** (Visit SB, DowntownSB, the city, santabarbara.com) or a **weekly publication** (the Independent, Edible SB). None is a daily-ritual app that compiles *what's actually happening*, with a personal save layer and a curated point of view.

### The core bet
SB Daymaker can't out-discover Yelp/Google/TripAdvisor on "what restaurants/bars/shops exist." Its defensible edge is compiling **what's actually happening** around town — and helping you turn it into your day. The national product closest to this — **DoStuff** (Do512, DoLA, etc.) — is email-led, curated-not-algorithmic, and **isn't in Santa Barbara**. SB Daymaker owns that vacant territory with a curated **happenings-first cascade** over a quality-filtered pool, plus the personal save/share layer no calendar offers.

### The moat (reordered — happenings leads)
1. **The happenings compilation** — surfacing *what's actually happening* (the three-tier cascade), the thing the directories structurally can't do. *(the spine)*
2. **Editorial voice + curation at scale** — the AI-drafts-I-approve engine; a point of view, not an algorithm.
3. **The evergreen floor** — Tier-3 always-available, activity-framed reasons-to-go keep the city "on" and solve the "empty app" risk. *(was "place-first depth"; now insurance for the spine, not a competing moat)*
4. **The personal layer + tuning** — on-device two-state saves, the **Near Me** sort, **shareable saved lists**, and occasion tags that tune the cascade to what you're up to today. *(the Lens lives here now — a supporting feature, not the headline)*

*Supporting advantages (how it scales/stays defensible, not what differentiates it):* local focus a mile deep in one city; the submission engine (being the destination organizers *want* to post to); the public trust promise (the ranker never reads sponsor status — now said out loud, not kept internal).

### Positioning line
*"Find what's worth doing in Santa Barbara today — find it, save it, share it."*

### Voice
The knowing local friend: warm, specific, never breathless, never corporate. Insider texture ("park on Anacapa, the Funk Zone lots are a trap"). This voice extends to **empty and error states** — an empty screen is an invitation to act, errors never apologize or go vague (see §5.11).

---

## 5. The product — full feature set

### 5.1 The daily ritual (the hero) — the signature surface
- A living **golden-hour hero** where the sun tracks the **real time of day**, with live conditions (weather, surf, sunset). Two-layer design:
  - **Sky strip:** date + live conditions pills only (no greeting). Sky gradient and sun position change with time of day and weather.
  - **Living editorial pick card:** surfaces from the mountain-silhouette SVG. Gradient image panel (left) + editorial content (right): context-aware eyebrow, title, venue + time, CTA. Two badges only (context tag + heart). No blurb in the hero (it lives on the detail screen).
- **Context-aware eyebrow:** "✨ Tonight's pick" / "This afternoon's pick" / "This morning's move" / "☁️ Gray day move."
- One curated "today" — a place/experience **or** an event. Auto-drafted nightly; founder-approved.
- **Fallback:** a hand-written evergreen "perfect SB day" card if the draft fails or the day is quiet. The hero is **never blank.**

### 5.2 Occasion tags (the Lens) — a strong supporting feature
- Reframed from six identity personas to **occasion/intent tags** ("**what are you up to?**"): a compact tag control opening a bottom-sheet grid. Tap → bottom sheet → the app filters. **Demoted from "headline differentiator" to a supporting feature** — the real edge is the happenings spine + curation + ritual + local depth.
- **Orthogonal to the cascade:** the tag sets *what* is shown; the happenings cascade always sets *order*. No tag is wired to a tier (e.g. Nightlife naturally returns event-heavy results because those things are dated, not via a special rule).
- **The ten tags:** Date Night · Family Day · Nightlife / After Dark · Catch a Show · Arts & Culture · Outdoors & Active · Wine & Food · Free in SB · Hosting Visitors · Solo. (Plus **One Perfect SB Day** as a separate day-tripper *entry point* — an Explore card, not a tag — see §5.4.) Stored on the `thing_tags` junction (confidence + provenance); pure content labeling, **no per-request AI.**
- **First-run:** a gentle overlay banner rises from the bottom while the app is usable behind it. Dismissible ("Just show me everything →"). **Shows once per device; re-entry via a "set your vibe" control; never nags.**

### 5.3 Time horizons
- **Today** — the singular curated ritual. **This Week** — a day-by-day rail. **This Month** — kept **lightweight** (a simple, clean marquee-events list; glance-once "when should I come," mostly visitor-planning + SEO — not gold-plated).
- Horizons are **time-filters over the one happenings model** (the same cascade), not separate systems. Three orthogonal controls never collide: **Horizon = when · Tag = what you're up to · Filter = mood.**

### 5.4 The personal layer — the moat (runs client-side)
**Save** anything → persists in device `localStorage`. **No account, no login, zero friction.** Each saved item carries one of **two states — "want to go" (default) or "been"** — one tap to flip; the Saved screen leads with "want to go." (Top requested feature on comparable apps; matters more now that **the saved list is the unit you share**.)

**Durability + sync without accounts (decisions B8 + the magic-link cluster):** iOS Safari can evict `localStorage` for non-installed sites after ~7 idle days. Mitigations: (1) **installable PWA** with a gentle home-screen install nudge (durable storage + the future push channel); (2) a **passwordless magic-link save-restore** — "email me a link to restore my saves" writes a one-off snapshot to `shared_states` and restores it on any device. **No password, no login wall** — sync without becoming the account gate SB Daymaker refuses. The user's *own* email is the only PII (sits in the existing subscriber boundary). Full accounts stay deferred.

**The Saved screen** — auto-groups by time relevance (Tonight · This Week · Happy Hours · Places & Experiences), leads with "want to go," with type-filter chips. Carries the **Near Me** sort and the **share** affordance (below). Empty state in voice.

**Near Me (v9) — an in-view sort, not a screen.** A control on **Explore and Saved** that re-orders the current view by proximity: **geolocation first** → on grant, the user's neighborhood floats to the top; on deny/unavailable, default to an SB center (downtown/State St.) **and** surface a short neighborhood picker (one-tap re-anchor, changeable anytime). Reuses `nearby_zone` + lat/lng — **no map tiles, no Mapbox.** (The old standalone "Nearby"/Map screen is retired; the full Mapbox map is Phase 2.)

**Share (v9) — the viral artifact (decision: Option A, view-only saved-list link).** From Saved, the user shares **one item or a multi-select batch**. This writes a snapshot to `shared_states` and produces a **real view-only link**: anyone can open it to **see the list and save their own copy** (no account to view). Delivered via the **native share sheet** (user picks iMessage/WhatsApp/email/etc.; **no recipient PII stored, no send cost**). Not real-time co-editing (that needs accounts — out of scope). *This replaces the retired My Plan plan-link.*

**One Perfect SB Day (v9) — an Explore card.** A one-tap, hand-curated morning-to-sunset lineup that **seeds the saved list** (deterministic; reuses existing `things`) so the visitor can tweak it and share it — the front door for the ~64% of visitors here for the day. Mostly content/packaging.

> **Retired in v9 (do not build):** the My Plan tab and its 4-phase wizard · the drum-roll time picker · durations/chained start-times/timeline · the haversine travel estimate · deterministic gap-fill · **`.ics` calendar export** · the screenshot "plan" share card. The saved-list share-link is the surviving, simpler social artifact.

### 5.5 First Looks + New This Week — the emotional engine & freshness
New openings + "opening soon." A "Just Opened" rail with a pulsing freshness dot and per-card heart buttons. Curated/high-touch: confirm from local press facts → AI drafts in my voice → I approve. **Elevated** — low complexity, high value, the growth flywheel.
- **New This Week in SB** — a dedicated surface gathering new openings, newly added places, and notable additions (visible freshness is a primary weekly return driver). **Feeds the 2×/week email** (which also carries upcoming events, not just new places — see §5.12).

### 5.6 Discover SB — the guides (the evergreen soul)
The third section. **Two groups of single-page editorial guides:**
- **Neighborhood guides** — The Funk Zone · Downtown & State St. · The Waterfront · Montecito · The Mesa. Each is scoped to an area.
- **Theme guides** — Funk Zone Afternoon · Free SB · First-Timer's SB · SB with Kids · Rainy Day in SB.

**Each open guide surfaces the live happenings scoped to it** — neighborhood guides match by area, theme guides by occasion tag — as savable cards above the editorial stops, so a guide is never just static prose. The Lens-matched theme guide renders with a "✦ For you" badge. **Served with ISR** for SEO. Guide stops can link to real `things` (deep-link + savable).

### 5.7 Happy Hour — ships LIGHT at launch (live version → Phase 2)
Live countdowns are the **most operationally expensive feature to maintain** (constant re-confirmation; stale data erodes trust). **V1 ships a curated "happy hours around town" list with honest "last confirmed" dates — no live countdowns/urgency.** The live version (real-time countdowns off the `happy_hour_windows` schedule, with venue-assisted freshness) moves to **Phase 2**, alongside the full map. Lower launch dependency on precise location, too.

### 5.8 Near Me — an in-view sort (full map → Phase 2)
**There is no standalone Nearby or Map screen in v9.** Near Me is a **sort/filter** that lives inside Explore and Saved (specified in §5.4): geolocation first → sort by the user's neighborhood; on deny/unavailable, default to an SB center (downtown/State St.) **and** a one-tap neighborhood picker. Reuses `nearby_zone` + lat/lng; **no map canvas, no Mapbox, no clustering** in V1. The **full Mapbox map** (clustering, sub-tabs, lens/horizon/filter sync) → **Phase 2.**

### 5.9 Weather-reactivity
Assertive on bad days, invisible on nice ones. Gray day: hero tag → "☁️ Gray day move," indoor pick, the secondary feed filters to indoor-only ("The gray day playbook").

### 5.10 Submission forms (public)
**"Submit your event"** (can paste an Instagram caption; AI parses it) and **"Claim / update your business."** Inbound lands in a **`submissions` table** (raw payload + submitter contact + consent) *before* parsing into a draft `thing`. **Hardened:** captcha + rate-limit, input sanitization, and pasted captions treated strictly as untrusted data (prompt-injection mitigation).

### 5.11 Empty, error & loading states (decision A4/C1)
Defined across every surface: **skeletons, not spinners** (perceived speed); **in-voice, actionable errors** ("Couldn't load that just now. Tap to try again."); empty states as invitations (Saved, Happy Hours, First Looks, location-denied, offline, no-match); clamp/truncation rules; branded placeholder + lazy-load for missing images.

### 5.12 Email — a first-class channel, 2× per week (was: optional weekend-only)
**The single biggest retention lever in local discovery** (6AM City ~45–50% open; DoStuff email-led) — promoted from optional/weekly/secondary to **first-class, sending 2× per week**, still **never a wall**:
- **Midweek "What's On" (Wed):** tonight's pick → out this week (Tier-1 dated, ≤4) → just opened (New This Week). Act-now energy.
- **Weekend "The Local's Weekend" (Fri):** this weekend's marquee (Tier-1, ≤3) → the week ahead (Tier-1, ≤3) → always worth it (rotating Tier-2/3 evergreen) → from the guides (1 ISR guide). Plan-ahead energy.
- Both **AI-assemble from the already-approved cascade** (no net-new editorial at send time — AI-written *synthesis* stays deferred); founder **auto-sends with veto** (inside the ~15-min/day budget). New-vs-upcoming balance is **structural** (midweek leads new+now, weekend leads upcoming+evergreen). Empty-safe via the Tier-3 floor.
- **Double opt-in → confirmed; one-click unsubscribe + List-Unsubscribe header; SPF/DKIM/DMARC on the sending domain.** Subscriber emails (and the magic-link save-restore address) are the only stored end-user PII — one boundary.

### 5.13 Analytics & success metrics (decision A1)
**Vercel Web Analytics** (cookieless — no consent banner). **WAU = unique device-days over a rolling 7 days** (a device proxy, honestly imperfect with no accounts). Events: `app_open, lens_select, save, share, near_me, ticket_handoff, guide_open, digest_signup, submit`. KPIs: WAU (north star), returning-user rate (the habit signal), save rate, **share rate**, ticket hand-offs.

---

## 6. The content model — the unified "thing"

Everything is a **"thing"** in one table with a `type` discriminator (`place · event · firstlook · happyhour`), now classified by a **happenings tier** that drives the whole-app cascade. One pool feeds the hero, the feed, the **Near Me** sort, the guides, and the **saved list**.

**The happenings-first cascade (the spine).** Every thing carries a stored **`happening_tier` (1/2/3)** + a **`happening_category`** (one of 16) + a **`reason_to_go`** framing:
- **Tier 1 — discrete, dated happenings** (this show, festival, gathering). Leads; owns the hero pick when one exists.
- **Tier 2 — recurring rhythms** (Monday tasting menu, first-Thursday art walk), via a **`recurring_schedules`** table (mirrors `happy_hour_windows`); a thing surfaces as Tier 2 on its scheduled days.
- **Tier 3 — evergreen, activity-framed reasons-to-go** (dog beach, farmers market, sunset hike). The anti-empty floor. **No bare places** — a Tier-3 thing always carries a "reason to go" or it routes to Content Review.
- **Tier is derived from structure** (has-date → 1, has-schedule → 2, else 3) and stored; the AI proposes only the *category*. **Lead-and-blend:** Tier-1 leads (cap ~4), Tier-2/3 always backfill to a minimum feed length (~12) so the screen is full on quiet *and* busy nights. The hero pick stays separate (best Tier-1 if one exists, else the evergreen fallback).

`type` still distinguishes the unit; `place` is no longer "the priority" so much as the **evergreen Tier-3 floor**; `event` is no longer "thin" — dated happenings *lead* the cascade. Ticketing still hands off to AXS/TM (SB Daymaker never transacts).

**The hardened schema is the source of truth — see `sbdaymaker_schema.sql`.** Key tables beyond `things`: **`thing_tags`** (junction — occasion tag + confidence + provenance; was `thing_personas`), **`recurring_schedules`** (Tier-2 rhythms), `happy_hour_windows`, `guides` + `guide_stops`, `editions` + `edition_picks`, **`submissions`**, **`subscribers`**, **`shared_states`** (magic-link save-restore + shareable saved-list links), `sponsors` (Phase 2), `audit_log`.

**Identity model:** there is **no end-user *account* table** — saves live on-device (now two-state: "want to go" / "been"). Stored end-user PII is limited to the user's *own* email — digest opt-in (`subscribers`) and the optional magic-link save-restore delivery address (`shared_states`) — treated as **one PII boundary**. Saved-list view-links store *no* recipient contact info. (Earlier drafts said "no users table"; that was imprecise.)

---

## 7. Data sources & ingestion

The ticketed-event APIs are the easy ~10%. The other ~90% comes from a portfolio of sources. All ingestion pulls **facts** — never source marketing copy; the AI writes original prose (copyright-clean).

**Sourcing posture (decision B3): scrape facts, with guardrails.**
- Check each source's `robots.txt` + ToS before scraping it; the civic gov calendar is lowest-risk, the commercial venue/tourism sites are higher-risk.
- **Never create an account or click through a ToS** to reach data (the contract risk hiQ established).
- **Reach for an official API / iCal / RSS feed first** even within this posture; scrape rendered pages only where no feed exists.
- Good-citizen scraping (honest User-Agent, rate limits, off-peak); facts only.
- Build per-source adapters that **fail gracefully and alert**, with the submission engine + manual curation as the fallback.
- **Pre-launch IP/tech attorney review** of the sourcing posture (high-value de-risking).

Submission forms are the scaling channel — content comes to me. **Direct FB/IG scraping remains out of scope** (ToS breach via cookies; designed out).

---

## 8. The AI layer — the editorial engine

The Claude API is **invisible infrastructure serving curation.** **Three nightly Tier-1 jobs** (the live app itself is fully deterministic — no per-tap AI; see §5.4):

1. **Editorial blurbs** — facts + house-voice prompt → original copy.
2. **Hero ranking** — candidates + signals → proposed hero + picks.
3. **Persona tagging** — facts → persona tags + confidence.

**Contracts (decision B4):** structured outputs (tool use) for tagging/ranking/parsing, validated; plain text for blurbs, length- and repetition-checked. **Model pinning** (exact IDs, never "latest"). **Tiered models:** Haiku for blurbs/tagging/submission-parse, Sonnet for ranking. Every call: **timeout + 1 retry + fallback** (skip & flag; hero falls back to evergreen).

**Negative-rule layer as code** (runs after the model, before any write): `is_21_plus` → strip `family`; `price_band ≠ free` → strip `free`; confidence `< 0.6` → don't publish, route to Content Review; `tag_source = founder` overrides. The trust-sensitive surface is protected by code, not prose.

Runs in the **nightly batch** (one orchestrated run) → trivial cost, reviewable, fast app.

---

## 9. The image pipeline

A **resolver** picks the cheapest legal source per context, in order: **owned → Pexels (curated SB query, free) → Wikimedia (landmarks, free, attributed) → Google Places Photo (metered) → branded placeholder.** Resolved URLs + the query are stored (`photo_url`, `photo_query`); Google stores only `place_id` (the photo is fetched live and never cached).

**Google fetch path (decision B6): a referrer-restricted client key** (locked to our domain) — *not* a server proxy. Maps keys are designed for client use with referrer restrictions, so this avoids per-photo function cost/latency while keeping the key safe. Build on **Places API (New)**; re-confirm the Place Photo SKU + caching terms at billing setup.

**Safeguards (all in the build):** lazy-load every image (the cost lever — Google photos can't be cached); a hard Google billing cap + alert (~$50/mo); resolution order (free sources first). Confirmed cost: **$7 / 1,000 after 1,000 free/mo** (Enterprise Place Photo SKU).

---

## 10. The two-sided product — the admin cockpit

Private, password-protected (Supabase Auth) **+ 2FA + login rate-limiting** (decision B10), responsive for desktop **and** mobile. Pattern: **AI proposes, I approve**, with **auto-publish-with-veto.**

**Six surfaces:** Daily Approval · Content Review (drafts + low-confidence tags + form submissions) · Staleness board · First Looks composer · Evergreen place manager · Guides editor. One reusable review-and-approve component pointed at six content types.

---

## 11. Technology stack

Boring-on-purpose, modern, solo-operable.

| Layer | Tech | Notes |
|---|---|---|
| Build env | **VS Code + Claude Code** | Primary build driver (agentic); Cursor optional as a file cockpit |
| Framework | **Next.js** (App Router) | UI + API routes + server actions + SSR/ISR for guides |
| UI | **React + Tailwind** | Tokens in `sbdaymaker_tokens.css` |
| Hosting / edge | **Vercel Pro** | Precise cron + Fluid Compute for the pipeline |
| Database | **Supabase (Postgres)** | Free in dev; **Pro by launch** (backups, no 7-day pause) |
| Auth | **Supabase Auth + 2FA** | Admin only |
| Storage | **Supabase Storage** | Operator photos (Phase 2) |
| Intelligence | **Claude API** | Blurbs, ranking, tagging (tiered Haiku/Sonnet) |
| Location | **Browser Geolocation + static neighborhood lookup** | Powers the **Near Me** sort — **no map tiles in V1** (Mapbox → Phase 2) |
| Weather | **OpenWeather** | Weather-reactivity + conditions |
| Email | **Resend** | Digest + "edition ready" nudge (email, not push) |
| Analytics | **Vercel Web Analytics** | Cookieless |
| Scheduling | **Vercel Cron (Pro)** | One orchestrator + a weekly digest cron |

**Deliberately NOT in the stack:** separate backend server, Kubernetes, Redis, queue, microservices, end-user auth, **and — as of v9 — Mapbox** (the full map is Phase 2; Near Me is a sort, so V1 needs no map SDK or token).

### Nightly pipeline (decision B2) — a single orchestrator on Vercel Pro
One scheduled function runs the steps **in sequence** (race-free), with Fluid Compute for duration headroom: Ingest (TM API + venue/civic facts via the guardrailed posture; receive submissions) → normalize/dedupe/geocode (cache lat/lng) → enrich (Claude blurbs + tags; negative rules) → staleness check → draft edition (Claude ranks; weather-aware) → notify me by email ("edition ready"; auto-publishes by veto). The **weekend digest is a separate weekly cron.** Graceful degradation throughout (hero → evergreen fallback).

---

## 12. Data architecture / schema

**The schema is specified and runnable — see `sbdaymaker_schema.sql`.** It supersedes the earlier illustrative sketch. Highlights: constrained enums (no free-text drift), the **happenings classification** (`happening_tier` / `happening_category` / `reason_to_go`) + the **`recurring_schedules`** Tier-2 table, the **`thing_tags`** occasion-tag junction (was `thing_personas`), real `happy_hour_windows`, a `submissions` intake table, a `subscribers` table + the **`shared_states`** token store (double opt-in / magic-link PII), reserved `sponsors`/`is_featured` (Phase 2 monetization), `guide_stops` and `edition_picks` junctions, and RLS so the public reads only `status='published'`.

---

## 13. Monetization & growth

Monetization is optional, local-first, trust-protecting (featured listings, digest sponsorship, enhanced profiles, later affiliate). **The data layer is reserved now** (`is_featured`, `sponsor_id`, `sponsors`); **one clearly-labeled placement slot**, and **the hero ranker NEVER reads sponsor status** (the trust rule). Full placement logic is Phase 2. **The trust promise is now made public** (messaging only, nothing to build): an about/"why trust us" note + a small "our picks are never paid for" reassurance near anything labeled sponsored — best-in-class curators (The Infatuation, DoStuff) market this; SB Daymaker had kept it internal.

Growth is organic: shareable artifacts (hero, digest, the **shared saved-list link**), SEO via the ISR guides, local seeding, the business-relationship flywheel, and the submission engine. Trajectory unchanged (illustrative): 0→100→500→1,000+ weekly, with SB's ~443k residents + ~6.5M annual visitors making even 10k weekly users low-single-digit penetration.

---

## 14. Cost model (re-derived — decision B12)

The old "$0–40/mo, mostly free" line assumed free tiers **plus the Google $200 umbrella credit, which ended Feb 28 2025.** The honest picture:

- **Fixed platform (reliable build):** Vercel Pro ~$20 + Supabase Pro ~$25 (by launch) = **~$45/mo.**
- **Variable:** Google Places photos (lazy-loaded, $7/1k after 1k free) dominate — ~$43/mo at 100 weekly users, ~$245 at 500, ~$497 at 1,000 (before the operator-photo program bends it down). Claude batch ~$1–10. Geocoding, Mapbox, weather, email all sit inside free tiers at these scales.
- **All-in:** ~$45/mo at launch; ~$93 at 100 weekly; ~$300 at 500; ~$557 at 1,000.

Still remarkably cheap and one-person-operable — just not literally "$0." (See Document 5 §04 for the full table.)

---

## 15. Key architectural & product decisions (the record)

The original decisions stand; these are the ones **updated or added** by the pre-build audit (full list in Document 5):

| Decision | Rationale |
|---|---|
| **Happenings-first cascade** (supersedes flat place-first) | The defensible lane vs. Yelp/Google is *what's happening*; a 3-tier cascade keeps the anti-empty guarantee via the Tier-3 evergreen floor |
| **Email first-class, 2×/week** | The proven retention engine in local discovery; assembled from approved content, founder veto — stays in budget |
| **Occasion tags replace identity personas** | Intent tags ("what are you up to?") beat 6 broad identities; pure labeling, no per-request AI; Lens demoted to supporting |
| **Three sections; My Plan retired (v9)** | Map + My Plan removed; Near Me became an in-view sort and the saved-list share replaced plan-sharing — less to build, same job done |
| **Magic-link save-restore + saved-list share-link** | Sync + social sharing without an account wall; one `shared_states` store; only the user's own email is PII |
| **Near Me sort (V1) / full map (P2); light Happy Hour (V1) / live (P2)** | Trim the heaviest-to-build and heaviest-to-maintain surfaces; Near Me needs only geolocation + a neighborhood lookup |
| **Hardened, specified schema** | The illustrative sketch couldn't carry the real features; `sbdaymaker_schema.sql` is now the contract |
| **Vercel Pro + single orchestrator pipeline** | Hobby cron can't sequence 6 dependent jobs; one orchestrated run is race-free; ~$20/mo is immaterial |
| **Scrape facts, with guardrails** | hiQ shows ToS/contract — not copyright — is the real risk; feeds-first + no-account + attorney review de-risk it |
| **Live app fully deterministic** | Keeps "batch AI only" true; every section renders from pre-computed data — no per-tap AI |
| **Referrer-restricted photo key (no proxy)** | Maps keys are built for client use; avoids per-photo function cost |
| **Installable PWA + save export** | Protects the on-device "moat" against iOS storage eviction without adding accounts |
| **Email for the edition nudge** | iOS web push needs a home-screen install; email is simpler and platform-independent |
| **WCAG 2.2 AA floor** | The audience is broad (incl. older/simplicity-seeking); accessibility is core value + ADA-prudent. Palette usage rule enforces contrast |
| **Vercel Web Analytics + WAU defined** | "Prove the ritual" needs a measurable target; cookieless keeps the low-PII posture |
| **Mapbox → Phase 2 only** | V1 Near Me uses geolocation + a neighborhood lookup; no map SDK or token at launch |
| **Reliable-tier cost (~$45/mo)** | The "$0" framing assumed a dead Google credit; this is the honest, still-cheap floor |

---

## 16. Explicitly out of scope / deferred

**Never:** in-app ticketing/payment · reviews/ratings · Visitor-vs-Local modes · full account system (the magic-link replaces it) · AI-written digest *synthesis* (editions assemble pre-approved content only).

**Deferred to Phase 2 (committed, sequenced):** **web push for installed users** (early fast-follow — triggers: tonight's pick, saved-event reminder, big First Look; installed-only, ≤1/day, never Tier-2/3) · **full Mapbox map** (clustering, sub-tabs, filter-sync) · **live Happy Hour** (real-time countdowns + venue-assisted freshness) · **full Spanish-language layer** (AI drafts in-voice, founder spot-checks; content + UI; fallback = bilingual cultural *happenings* first) · operator-submitted photos (resolver pre-built) · account-based cross-device sync.

**Still out of scope:** follow-graphs · ticket giveaways · natural-language search · anonymous social proof · full real-time collaborative multi-day itinerary builder (the saved-list share-link is the low-cost middle) · live crowding/parking.

---

## 17. Design system / brand

**Aesthetic:** Spanish Colonial Revival meets a daily broadsheet/postcard. Warm, editorial, local. **The single source of truth is `sbdaymaker_tokens.css`** — palette (with AA-safe text variants), type scale, 4px spacing, radius/shadow, the motion spec (with a `prefers-reduced-motion` override), breakpoints, and the component-variant contract. (The UX review identified **no new color/type/motion needs** — tokens unchanged through the v9 wireframe.)

**Palette:** Plaster `#F6F1E7`, Plaster2 `#EFE7D8`, Paper `#FCFAF5`; Ink `#241C16`, Ink2 `#4a4038`; Pacific `#16586A`, Pacific Dark `#0E3C49`; Terracotta `#C0532E`, Tile Light `#E08A5B`; Gold `#E0A82E`; Sage `#7E8B6B`, Line `#D8CDB8`; accents purple `#9C6B9E`, forest `#3E7C5A`.

**Accessibility usage rule (load-bearing):** small text uses only **Ink / Ink2 / Pacific**; accent colors are for large headings, badges, icons, and fills; **Gold and Tile Light never carry text on a light background.** Build against the *semantic* tokens so contrast stays enforced.

**Type:** **Fraunces** (display) + **Inter** (body/UI) + **JetBrains Mono** (data/code). Minimum body 16px; minimum touch target 44×44.

**Signature element:** the golden-hour hero. **Micro-interactions** honor reduced-motion.

**Responsive (decision C3):** mobile-first base; tablet 600–1023; desktop ≥1024; wide ≥1280; defined desktop treatment for the cockpit.

---

## 18. Founder & working preferences

- **Solo founder**, building in **VS Code with Claude Code** (Cursor optional as a file cockpit), based in the **Santa Barbara / Goleta** area. AI/digital-strategy background.
- Wants it runnable as a beloved hobby or grown into a small business on the same architecture.
- **How I like Claude to work:** honest/critical over optimistic; structured, evidence-based, visual deliverables; act as a thoughtful PM/partner with options + a recommendation; ground claims in real research where it matters; stay consistent with the documents and Document 5's decisions.

---

## 19. Existing project documents

The canon, in reading order. Versions live in each file's `Status:` header line, not in the filename.

1. **`01_SBDaymaker_Business_Plan.html`** — product overview, value prop, GTM, growth/cost/revenue, risks, roadmap.
2. **`02_SBDaymaker_Product_Bible.html`** — every screen + annotations, IA, content model, flows, the cockpit. *(Reference; for any UI conflict the wireframe wins — see the v9 note at the top of this file.)*
3. **`02b_SBDaymaker_Wireframe.html`** — the interactive prototype. **Canonical for UI layout/flow.** The three-section (Explore · Saved · Discover SB) v9 cut.
4. **`03_SBDaymaker_Platform_Architecture.html`** — the full technical/data architecture: happening-tier + recurring-schedule model, the nightly pipeline, the image resolver, magic-link/share-link infra, the Near Me anchor.
5. **`04_SBDaymaker_PreBuild_Audit.html`** — the 26-finding gate-review audit.
6. **`05_SBDaymaker_PreBuild_Decisions.html`** — every gap resolved + dependency matrix + re-derived cost model.
7. **`06_SBDaymaker_Critical_UX_Assessment.html`** — the evidence-based UX review; the **rationale record** behind the locked UX decisions.
8. **`07_SBDaymaker_Innovation_Differentiation.html`** — the innovation & differentiation study ("Your Santa Barbara").
9. **`08_SBDaymaker_Build_Plan.md`** — the phased, Claude Code-led build runbook (the capstone that turns this canon into the app).
10. **`sbdaymaker_schema.sql`** — the data contract. **`sbdaymaker_tokens.css`** — the design system. **`CLAUDE.md`** — the always-loaded build context.

> **Decision records:** the **`SBDaymaker_Locked_UX_Decisions_handoff.md`** (the locked UX decisions) + the follow-on decisions are integrated into this file and Documents 5–6.

---

## 20. Glossary — key terms (updates)

- **The thing** — the unified content unit (`place / event / firstlook / happyhour`), now classified by a happening tier.
- **Happenings cascade** — the whole-app spine: a 3-tier ranking (discrete-dated → recurring → evergreen) that orders the hero + feed; horizons are time-filters over it.
- **`happening_tier` / `happening_category`** — the stored tier (1/2/3, derived from structure) + one of 16 categories (AI-proposed) on every thing. **`reason_to_go`** — the required Tier-3 activity framing ("no bare places").
- **`recurring_schedules`** — Tier-2 recurring-rhythm schedules (mirrors `happy_hour_windows`).
- **Occasion tag / `thing_tags`** — intent tags ("what are you up to?", the 10) that set *what* is shown (cascade sets *order*); junction with confidence + provenance (was `thing_personas`).
- **`shared_states`** — one token→payload store for the magic-link save-restore (user's own email) + the shareable **saved-list view-link** (no recipient PII; shared via native share sheet).
- **Two-state saves** — each saved item is "want to go" (default) or "been," client-side.
- **`submissions`** — intake table for raw public-form payloads + submitter PII + consent, before parsing.
- **`happy_hour_windows`** — real day-of-week + start/end schedules; live countdown is **Phase 2** (V1 ships a "last confirmed" list).
- **Negative-rule layer** — code that overrides the model (e.g. 21+ → never `family_day`; non-free → never `free_sb`; Tier-1 needs a date; Tier-3 needs a `reason_to_go`).
- **Orchestrator** — the single nightly Vercel function that runs the pipeline steps in sequence.
- **WAU** — unique device-days over a rolling 7 days (the ritual's north-star metric).
- **Accessibility floor** — WCAG 2.2 AA, enforced via the palette usage rule + aria/focus/keyboard/reduced-motion.
- **Reliable tier** — the ~$45/mo platform floor (Vercel Pro + Supabase Pro) for a production-grade build.

---

*End of SB Daymaker project context. Latest cut: v9 — the three-section app (Explore · Saved · Discover SB). Keep this current as decisions evolve.*
