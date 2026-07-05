# Phase 2 Spec — The Funk Zone Page (Living Postcard arc)

`Claude Code kickoff doc · 2026-07-04 · authority chain: CLAUDE.md (v10) → Ledger v4 (D-21→D-25) → Phase1_Content_Model_FunkZone_Paper.md (approved; committed at docs/discover-living-postcard/) → Jim's content blessing of 2026-07-04 (four stop notes edited: em dashes → commas; encoded verbatim in §3) · Phase 1 is complete: schema live, parsers green`

**This phase closes D-21's gap:** when it ships, `/discover` shows its first real card and the empty state retires.

**House copy style (Jim, 2026-07-04, applies to ALL guide copy this arc and after):** no em dashes anywhere in guide content; replace with commas (or a semicolon/period where a comma misreads). En dashes in numeric ranges ($15–25, noon–6) are fine and stay. The seed in §3 is already swept; if Jim's stop-and-show edits arrive with em dashes, apply the rule to them too and confirm.

**Standing rails:** no AI at tap time · no invented facts (seed §3 verbatim; if Jim hands revised copy at stop-and-show, seed HIS version even if a detail looks wrong — D-25 means one wrong detail is intentional; never "correct" guide copy unprompted) · sponsor-blind ranking untouched · locked v9 tokens, ZERO new hex (the mockup's sketch hexes are all in the v9 set) · WCAG 2.2 AA (44px targets, AA contrast, accordion aria-expanded, sketch aria-label) · DDL: none in this phase (DML seeding only — routine worker work) · code is truth; append Doc 14.

---

## 1 · Read first
`CLAUDE.md` · `docs/discover-living-postcard/Phase1_Content_Model_FunkZone_Paper.md` (the content model + surface map) · `SBDaymaker_DiscoverSB_Mockup_v5.html` Frames 01–02 (the visual contract — ask Jim for the file if not in repo) · `lib/guides.ts` (Phase 1 parsers) · `lib/guide-art.ts` (scaffold) · `app/(app)/discover/[id]/*` · `sbdaymaker_tokens.css`.

## 2 · Resolve stops → things (before any seeding)
Look up published things by exact title, trigram-loose fallback, **miss ⇒ stop and report, never invent** (W3a rule): `Helena Avenue Bakery` · `MOXI, The Wolf Museum of Exploration + Innovation` · `Pali Wine Co.` · `Santa Barbara Wine Collective` · `Topa Topa Brewing Co.` · `Lucky Penny` · `The Lark`. Positions 3 and 9 are label-only by design (`thing_id` null).

## 3 · The seed (idempotent `seed_funk_zone.sql` committed + applied via tsx service-role script)

**guides row:** title `The Funk Zone` · kicker `Wine, art, and salt air in twelve walkable blocks` · intro `Six blocks of tasting rooms, murals, and repurposed fish warehouses between the tracks and the sand. The rare tourist district locals never surrendered.` · kind neighborhood · zone funk · tag null · stamp_code `FZ` · refreshed_on `2026-07-01` · now_note **null at seed** (Jim supplies the July line at stop-and-show; you then set it via DML with now_note_on = that date; the page MUST render cleanly with now_note null — no empty block, happenings toggle still shows) · status **draft until stop-and-show approval, then published**.

**content jsonb** exactly:
- meta `{distance_mi:1.3, plan_hrs:[3,5]}`
- chapters: `[{k:"Stops 1–3 · Morning", name:"Pastry, science, murals", sum:"The zone before the crowds, start with the croissant.", tod:"morning"}, {k:"Stops 4–6 · Afternoon", name:"The wine blocks", sum:"Two pours and a palate-cleansing pint.", tod:"afternoon"}, {k:"Stops 7–9 · Golden hour", name:"Pizza, dinner, the sand", sum:"The zone's best two hours.", tod:"golden"}]`
- asides: `[{after_chapter:2, text:"Tasting rooms hit capacity around 3 on Saturdays. Want the pourers chatty and the couches open? Come Sunday before noon."}, {after_chapter:3, text:"The train horn isn't an emergency, it's the neighborhood's grandfather clock. Locals set their pours by it."}]`
- take: h `Best bite in the zone, ranked.` · items `[{b:"The clam pie", rest:" at Lucky Penny, order it before you think about it."},{b:"The brussels sprouts", rest:" at The Lark, yes, really, the sprouts."},{b:"The breakfast sandwich", rest:" at Helena Avenue, gone by 11."}]` · landing `Disagree? Good. That's what the walk is for, go build your case.`
- know_before, the four Frame-01 rows with the house sweep applied (this text supersedes the mockup verbatim): Parking `Park once, on Anacapa above Yanonali, and forget the car exists. The Funk Zone lots are a trap, $3 every half hour adds up faster than the tasting fees.` · Budget `Tastings run $15–25 and most waive it with a bottle. Two flights and a pizza is a ~$70 afternoon; the murals and the sand are free.` · Restrooms `MOXI lobby if you're a ticket-holder; the public lot on Helena otherwise. Tasting rooms expect you to be a customer.` · Timing `Tasting rooms run roughly noon–6. The zone goes quiet by 9, this is a daytime neighborhood.`
- postcard_captions: `{b1_3:"Off and walking.", b4_6:"The wine blocks are next.", b7_8:"Two from the stamp.", b9:"Every stop. Even the wrong-way penny."}`
- secret_tease: `Somewhere on this walk, one detail is wrong on purpose.`
- sketch: `{kind:"sketch", asset:"funk-zone", no:1}`

**guide_stops (pos · ch · label · sub[label-only] · maps_query · note):**
1. 1·1·Helena Avenue Bakery · — · — · `Start where the zone starts its day. The breakfast sandwich is the order, it's gone by 11, which tells you everything about it.`
2. 2·1·MOXI · — · — · `Three floors of hands-on science that adults pretend is just for the kids. Go up to the Sky Garden, it's the best free harbor view in the zone.` (display label `MOXI`; thing resolves via full catalog title)
3. 3·1·The mural walls · sub `Off Helena & Gray Ave · Free` · maps_query `Funk Zone murals Helena Ave Santa Barbara` · `The alleys off Helena are an open-air gallery that repaints itself a few times a year. Free, always open, and the best backdrop in town for a photo.`
4. 4·2·Pali Wine Co. · — · — · `Start easy: small-lot Pinot in a relaxed room, no ceremony.`
5. 5·2·Santa Barbara Wine Collective · — · — · `One roof, many local producers, the efficient way to find your favorite.`
6. 6·2·Topa Topa Brewing Co. · — · — · `The palate-cleansing pint in the airy Waterline space; good for mixed wine/beer groups.`
7. 7·3·Lucky Penny · — · — · `The penny-clad pizza spot next to The Lark. Order the clam pie before you think about it; the copper wall makes the wait a photo op.`
8. 8·3·The Lark · — · — · `The zone's big-night table, communal seating, and yes, order the brussels sprouts. If you get one reservation in the neighborhood, this is it.`
9. 9·3·The sand · sub `End of Anacapa · Free` · maps_query `East Beach Santa Barbara at Anacapa Street` · `Walk Anacapa to its end and you run out of zone and into beach. No ticket, no pour list, just the payoff. This is where the walk was headed all along.`

## 4 · The funk-zone sketch asset
Lift Frame 01's plate SVG from the v5 mockup **as drawn** (streets, tracks, coastline, route dashes, ✵ at its mockup position, THE FUNK ZONE plate, compass, STEARNS WHARF →) into `lib/guide-art.ts` as the `funk-zone` registry entry: component + `markers` (the nine mockup cx/cy pairs keyed by position) + `secretMark`. Markers render as a layer over the base so Phase 3 can recolor per-stop (terracotta ↔ sage) without touching the art. Sketch caption row: JT-1 zero text `TAP A NUMBER TO JUMP · MARKED STOPS TURN SAGE` (the flip is Phase 3; hardcode zero state). Tap-a-number → smooth-scroll to the stop's chapter (open it) — deterministic, no state persisted.

## 5 · Build the page to Frames 01–02 (mobile-first)
Render order per Frame 01: sticky bar (`Funk Zone` · warm `9 STOPS · TRACKS→SAND`) → sketch plate + caption → title block (eyebrow `Neighborhood guide`, h2, deck, meta row `9 STOPS · ~1.3 MI · PLAN 3–5 HRS · REFRESHED JUL 2026` — stop count derived, never hardcoded) → now block (only if now_note present; happenings toggle = existing cascade, collapsed, top item + `+N more`) → passport slab **zero state** (`Your Funk Zone` / JT-3 `9 STOPS · 1 SECRET` / bar 0% / note with gold tease / dashed FZ stamp slot; ✓ Been marking is Phase 3 — render the slab static, no gold ring) → walk header → chapter accordion (bands with k/name/sum + `✓ 0/3` counts; tap to open; stop cards inside per Frame 02: number marker, h4 label, derived sub-line via `deriveStopSub` + JT-2 `⌖ DIRECTIONS` mono link via `directionsUrl`, note paragraph, heart-save wired to existing saves, **✓ Been button rendered disabled/static this phase**) → aside(s) at their after_chapter slots → the take card → know-before → colophon `WRITTEN BY A LOCAL · REFRESHED JUL 2026 · SKETCH Nº 1` → ⌖ Sketch pill (scroll-to-plate). Guides WITHOUT content (empty jsonb) must keep the plain v1 render — both renderers live behind one branch on `parseGuideContent` richness.

## 6 · Verify + stop-and-show
- Tests: chapter grouping, aside placement, meta derivation, null-now_note render, plain-guide branch untouched (extend Phase 1 suites).
- ISR: after publish flip, `revalidatePath` per the admin pattern or wait out 600s — no new machinery.
- Show Jim at ~390px and ~1280px: `/discover` (first real card, empty state gone) + the full `/discover/[id]` page, every section. Report: resolved thing ids, any title misses, the null-now_note state.
- **Collect from Jim at stop-and-show:** the July now_note line (+ seed it) · his final read of all copy (his planted wrong detail may arrive as an edit — seed his version verbatim, no questions) · publish approval (draft → published happens only on his word).
- Doc 14: "Living Postcard Phase 2 — Funk Zone seeded (9 stops, 7 resolved things, 2 label-only) and page built to Frames 01/02; published [date]."

**Out of scope:** ✓ Been marking, stamps, gold ring, postcard (Phase 3) · hub passport spread (Phase 4) · other seven guides (Phase 5) · ≥1024px reading state + FAQ (Phase 6) · cockpit now_note editor (later) · any ranking/cascade logic change.

*End of Phase 2 spec.*
