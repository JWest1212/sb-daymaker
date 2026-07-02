# SB Daymaker — Build Deltas Ledger

Canon amendments recorded as builds diverge from or extend the v9 canon
(`Core Project Files/CLAUDE.md`). Each entry cites the driving spec so canon and
code stay reconcilable. Newest first.

---

## 2026-07-02 — Explore Hero: "One Front Page" (Phases 1–2)

Source: `docs/hero-visual-update/hero-one-front-page-spec.md` (v3 FINAL). Built and
approved at the spec §4 checkpoint. Amendments per spec §6:

1. **Reversed** — Phase 7 lock "top-banner feature lead retained for the Today
   opening card" → Today now opens in the standard left-rail `ListCard` format;
   the hero pick is the **sole marquee**. (Doc 18, Assessment Option B.)
2. **Restored** — hero pick card canon dress: context-aware eyebrow, venue + time
   meta line, CTA affordance, and the condition-chip freshness row. This corrects
   build drift; it is not a new decision.
3. **Added** — the signature Santa Barbara skyline SVG (`public/hero/sb-skyline.svg`,
   final art v3: faithful Mission, lawn + paseo foreground, dense Riviera hillside,
   Lil' Toot easter egg) extends the CLAUDE.md §5 signature element. Its fixed scene
   hexes are sanctioned as **non-token scene art** (full palette in spec §3.4) and
   must not migrate into `sbdaymaker_tokens.css`. Sun corridor + card-zone reserve
   rules per spec §3.2–3.3.
4. **Superseded** — canon's 96px hero-card image panel → the built **84px**
   body-driven panel stands (Hero Dimension Audit; code is truth on this dimension).
   Hero `min-height` canon value updated **228 → 352px**.

**Deferred, on the record (spec §6.5):** the Editor's Line (Phase 3 — gated, requires
Jim's explicit go + a separate delta spec) · the Shifting Pick (revisit after "Did You
Make It?") · the full Masthead layout (declined; the golden-hour countdown chip shipped
instead).

**Implementation reconciliations (repo is truth for paths):**
- Skyline served as an external `<img>` asset rather than inlined; spec §3.5 sanctioned
  either, and an external asset keeps the baked scene colors fully out of CSS.
- Spec §2.2 eyebrow used wireframe `cat` shorthand (`music`/`arts`/`happyhour`) with no
  literal in the 16-value `happening_category` enum. **Resolved to the site's true enums**
  (Jim's call): "Catch a show" ← `live_music`; "Arts & culture" ← `arts_theater` /
  `recurring_arts`; "Happy hour" ← thing `type === 'happyhour'` (no happy-hour category
  exists). Spec §2.2.1 amended to match.
