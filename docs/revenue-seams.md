# Revenue seams (Elevation v1 · Gate 5 · G5.7)

`Status: seams only. Nothing is monetized in this build. Revenue is on hold.`

This documents the clean, labeled seams left in the code so monetization can be
switched on later as a small change, never a refactor, and **without ever touching
the ranker**. The load-bearing trust rule (CLAUDE.md §2.8): the hero/feed ranker
never reads sponsor status. Curation must never be corrupted by money.

## 1. Affiliate-ready outbound links

- **Single module:** `lib/links/outbound.ts`. Every rendered outbound
  ticketing/reservation/website link resolves through `resolveOutbound(thing)`.
- **The one switch:** `withAffiliate(href)` (currently identity) + `AFFILIATE_ENABLED`
  (currently `false`). When affiliate deals are signed, add per-host params
  (AXS/Eventbrite partner ids) **inside `withAffiliate` and nowhere else**, then
  flip `AFFILIATE_ENABLED`.
- **Label logic** stays in `lib/format/outboundLink.ts` (`outboundLink` +
  `isTicketingUrl`), which `lib/links/outbound.ts` wraps. Card CTAs
  (`components/explore/derive.ts` `heroCta`) and the detail action row both key off
  the shared `isTicketingUrl`, so there is one host list.
- **Render sites routed through it today:** the thing detail action row
  (`app/(app)/thing/[id]/page.tsx`). Any new outbound render site must import from
  `lib/links/outbound.ts`, not build an `<a>` from `buy_url` directly.

## 2. Labeled featured placement (structurally separate from ranking)

- **Component:** `components/ui/FeaturedLabel.tsx` (`<FeaturedLabel />`) is an inert,
  clearly-labeled badge. It is wired to nothing and rendered nowhere yet.
- **Schema fields:** `things.is_featured` and `things.sponsor_id` exist
  (schema comment: "labeled placement (Phase 2)").
- **The rule, proven by tests:** the ranker never reads `is_featured`/`sponsor_id`.
  - `lib/explore.test.ts` asserts `cascade` and `pickAutoHero` output is identical
    when those fields are set adversarially.
  - `lib/tiles.test.ts` asserts `tilesFor` (place/vibe/activity) is identical too.
- **When it ships:** choose the featured slot **outside** the ranker (a separate,
  labeled row/slot), render `<FeaturedLabel />` on it, and keep the organic feed
  untouched. `editorial_weight` remains the only sanctioned curation input to
  ranking; it is founder curation, not paid placement.

## 3. Business-profile intake (enhanced-profile line) — DEFERRED

- The business-claim ("Is this your venue?") intake is **not built**. It was
  intentionally deferred (2026-07-20) to sit inside a future monetization strategy
  layer rather than shipping as a bare intake now.
- **Groundwork already in the DB (applied, currently inert):** a `business_claim`
  value exists on the `submission_kind` enum and the `submit_thing` RPC accepts it.
  Nothing in the app sends that kind, so it is harmless and ready for the future
  work. (Postgres cannot drop an enum value without recreating the type, so the
  value stays; the RPC guard could be tightened back to `event`/`business` only if
  you want to reject a hand-crafted `business_claim` request in the meantime.)
- When the enhanced-profile line is designed, wire the claim intake to that
  `business_claim` submission kind and action it in the review queue. Build the
  intake there; never the monetization in the ranker.

## What is deliberately NOT built

No prices, no checkout, no sponsor wiring, no affiliate params, no featured render.
Just the seams above.
