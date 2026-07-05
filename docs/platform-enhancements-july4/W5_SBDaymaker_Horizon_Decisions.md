# W5 — The Horizon: Decisions, Not Builds

`Doc W5 · for Jim only — nothing here goes to Claude Code as-is · each item ends with exactly what to decide and what happens after you decide`

---

**How to use this.** Waves 1–4 are fixes with right answers. Wave 5 is different: these are *choices* — about scope, sequencing, and one conversation only you can have. Each section gives you the situation in plain terms, the options with honest tradeoffs, my recommendation, and the concrete next step for whichever way you decide. Work through it with a coffee; none of it is urgent this week, all of it matters this quarter.

---

## 5.1 · Happy Hour: feed it or cut it

**The situation.** The app has a "light Happy Hour" feature designed, coded, and rendering-ready — and `happy_hour_windows` has zero rows. So the feature exists in code and never in fact. That's the worst state: it's carrying maintenance weight and delivering nothing.

**Your options.**
- **Feed it (recommended):** one founder-research hour. Pick ~10 places you'd genuinely send a friend for happy hour, confirm each one's current days/times/deal from their own website or a phone call (the canon rule applies: real facts, never invented — and set `last_confirmed` honestly), and write them down in a simple list: place · days · start–end · the deal in one line. Hand that list to a short Claude Code session ("insert these `happy_hour_windows` rows, verify the rendering") — data-only, an hour of its time.
- **Cut it:** if you don't want to own keeping ten happy hours fresh (they *do* go stale — that's why the feature ships as "last confirmed," not live), have a Claude Code session remove happy-hour copy from V1 surfaces and park the feature. The schema and code stay; nothing is destroyed.

**Decide:** feed or cut. If feed: block one hour, make the list, and tell me — I'll write the two-paragraph Claude Code prompt. If cut: same, other direction.

## 5.2 · `weekly_special` — the empty category that might be worth money

**The situation.** Your Tier-2 taxonomy includes `weekly_special` (taco Tuesdays, oyster nights, industry Mondays) and it has zero supply. Normally I'd say "ignore it consciously." One thing changes the math: once the edition exists, weekly specials are *natural sponsor-adjacent inventory* — the kind of thing a restaurant would pay to have featured, cleanly labeled, without ever touching the ranker (your trust rule handles this by design: sponsored placement is labeled and structurally separate).

**Recommendation:** do nothing until Edition v1 has shipped and you've had the sponsor conversation (5.5). If that conversation shows appetite, seeding 8–10 real weekly specials (same founder-research pattern as 5.1) becomes the cheapest inventory build you'll ever do. Park this page until then.

**Decide:** nothing now — just don't forget it exists. Revisit after 5.5.

## 5.3 · The memory-moat features, now unblocked — sequencing

**The situation.** With been-marking fixed (Wave 1) and guides seeded (W3a), the relationship-layer roadmap is open: the Discover v3 passport/stamps, the "Your Santa Barbara" My-SB card, Regular status, Memory Lane. These are your differentiation — and they're design-led builds that go through your mockup-first process, not fix specs.

**One design question that now has a deadline.** The W4a archival sweep surfaced it: when a past event is eventually archived, a user's *been* mark survives on their device (we guaranteed that in W4a.5) but the thing's details leave the public pool — so a two-year-old memory can't fully render. The durable answer is a small **been-snapshot**: at the moment of marking been, store a tiny local copy (title, date, zone, photo ref) alongside the id, so Memory Lane never depends on the live pool. It's a modest change with one subtlety (localStorage size discipline), and it should land *before* Memory Lane is built, not after.

**Recommended sequence:** ① been-snapshot (small, one session, do it soon while W1.1's code is fresh) → ② Discover v3 passport (it compounds directly with the guides you just seeded, and it's your strongest share-loop artifact) → ③ My-SB card → ④ Regular status / Memory Lane. Each starts with a mockup round, per your standing process.

**Decide:** approve the sequence (or reorder), and tell me when you want the been-snapshot mockup/spec — that one I can produce without a design round, it's mostly invisible plumbing.

## 5.4 · The first-run tutorial

**The situation.** The freshest doc in your repo is a code-accurate survey of the frontend written *for* a first-run overlay that was never built. New visitors currently get no orientation on the Lens, horizons, saving, or Near Me.

**Recommendation:** build it **after Wave 2 lands**, so the tutorial tours a feed that's already curated and correctly tagged — you only get one first run per user, and right now it would be touring the committee meetings. When you're ready, this goes through mockup-first: I draft 3–4 overlay steps in the house voice, you approve the rendered look, then a spec. Keep it dismissible-forever in one tap and fully keyboard/reduced-motion clean; anything longer than four steps is a manual, not a welcome.

**Decide:** timing only. My suggestion: schedule it for the week after Wave 2's stop-and-shows clear.

## 5.5 · The sponsorship conversation — the highest-value hour in this document

**The situation.** Every plan document you have converges on the same validation step: one real conversation with a Santa Barbara business owner about sponsoring the weekend digest. After W3b (or the scrappy hand-sent pilot in its preface), you finally have the artifact to put on the table. No Claude Code involved — this one is yours.

**Who to talk to first:** a business that already appears in your catalog organically (so the trust story is visceral: "you're in here because you earn it; sponsorship is a labeled slot, never a ranking"), that skews toward your barbell audience, and that you have any warm path to. A Funk Zone tasting room or a downtown restaurant with a weekly special is the archetype.

**What to bring:** the live app on your phone, one real sent edition, and the trust promise stated out loud — the ranker never reads sponsor status; sponsorship buys a clearly-labeled presence in the edition and (later) featured placements, never position in the feed.

**What to ask (discovery, not pitch — do not name a price first):**
1. Where do you currently spend to reach locals and visitors, and what does it cost you? (anchors their frame, not yours)
2. If this edition went to N confirmed locals twice a week, what would being its named sponsor be worth to you — as a range?
3. What would make it a no-brainer — the digest slot, a featured card, the "weekly special" listing, an event boost around your slow nights?
4. What would make you say no?

**What you're listening for:** whether the number they volunteer clears your ~$45/month floor with one or two sponsors (it should, easily, if there's any appetite), and *which* inventory they reach for — that answer sequences 5.2 and the Phase-2 featured-placement work better than any analysis I can do.

**Decide:** who, and when. Then go have it. Bring me the notes afterward and we'll turn what you heard into the monetization sequencing.

## 5.6 · Rate limiting the two public email routes

**The situation.** `/api/subscribe` and (post-Wave-1) `/api/restore-link` can be made to send a fixed, harmless email to an arbitrary address. Accepted knowingly in Wave 1; the exposure grows only with the product's profile.

**Recommendation:** fold a simple per-IP guard into whichever Claude Code session follows the edition launch (the moment your email volume becomes reputationally meaningful). It's a half-phase, not a wave. Nothing for you to decide beyond "yes, when convenient" — consider this your reminder that it's parked deliberately, not forgotten.

---

## The one-page decision recap

| # | Decision | My default | Your call |
|---|---|---|---|
| 5.1 | Happy hour: feed or cut | **Feed** — one research hour, ten real windows | ______ |
| 5.2 | Weekly specials | **Park** until after 5.5 | ______ |
| 5.3 | Memory-layer sequence | been-snapshot → passport → My-SB → Memory Lane | ______ |
| 5.4 | First-run tutorial timing | The week after Wave 2 clears | ______ |
| 5.5 | Sponsor conversation | This month, with the pilot edition in hand | who: ______ when: ______ |
| 5.6 | Rate limiting | Bundle into the post-edition session | ok / defer |

Fill in the right column and send it back — for anything that becomes a build, I'll produce the spec in the standard format; for 5.5, I'll help you prep and then help you read the answers.

*End of Doc W5.*
