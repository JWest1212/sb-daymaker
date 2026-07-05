# Phase 1 Spec — Guides Content Model (Living Postcard arc)

`Claude Code kickoff doc · 2026-07-04 · authority chain: CLAUDE.md (v10) → Ledger v4 addendum (D-21→D-25) → Phase1_Content_Model_FunkZone_Paper.md (approved by Jim, all three judgment calls settled) · this spec implements that paper verbatim`

**Settled calls this spec encodes:** sub-lines auto-derive from thing data (`sub` column = label-only-stop fallback ONLY) · `now_note` is a first-class column · the Part-B surface→home mapping is approved as written.

**Standing rails (restated per canon):** no AI at tap time · no invented facts · sponsor-blind ranking untouched (`rankThings` and `matchGuideThings` are not touched by this spec) · locked v9 tokens, zero new hex (no UI changes in this phase at all) · WCAG 2.2 AA n/a this phase · **DDL is Jim's hands only** · code is truth; append Doc 14 when done.

---

## 1 · Read first

`CLAUDE.md` · `lib/guides.ts` · `app/(app)/discover/*` · `supabase/migrations/` (latest state) · the approved paper doc (committed alongside this spec — see §6).

## 2 · Migration — ▶ JIM RUNS THIS (you write it, you never run it)

Write **two** migration files (enum values cannot safely share a transaction with statements that might use them; keep the enum change isolated):

**`supabase/migrations/20260704_rainy_day_tag.sql`**
```sql
alter type occasion_tag add value if not exists 'rainy_day';
```

**`supabase/migrations/20260704_guides_content_model.sql`** — idempotent throughout:
```sql
alter table guides
  add column if not exists stamp_code   text,
  add column if not exists refreshed_on date,
  add column if not exists now_note     text,
  add column if not exists now_note_on  date,
  add column if not exists content      jsonb not null default '{}'::jsonb;

do $$ begin
  alter table guides add constraint guides_stamp_code_ck
    check (stamp_code is null or stamp_code ~ '^[A-Z]{2}$');
exception when duplicate_object then null; end $$;

create unique index if not exists guides_stamp_code_uq
  on guides (stamp_code) where stamp_code is not null;

alter table guide_stops
  add column if not exists chapter    smallint not null default 1,
  add column if not exists sub        text,
  add column if not exists maps_query text;

do $$ begin
  alter table guide_stops add constraint guide_stops_chapter_ck
    check (chapter >= 1);
exception when duplicate_object then null; end $$;
```

No new RLS policies (new columns ride existing row policies). No other indexes (`content` is never queried into). **Present both files to Jim in the stop-and-show; he pastes them. Do not run DDL yourself under any circumstances.** Data reads to verify post-migration state (information_schema checks via service role) are fine.

## 3 · `lib/guides.ts` — types + helpers (code, no UI)

1. **`GuideContent` type + parser.** Encode the approved jsonb shape exactly (meta, chapters[], asides[], take, know_before[], postcard_captions, secret_tease, sketch). Write `parseGuideContent(raw: unknown): GuideContent` — tolerant (missing keys → empty defaults, unknown keys ignored, never throws). An empty `{}` parses to a value that renders a plain v1 guide; this is the additivity guarantee.
2. **`deriveStopSub(stop, thing)`** — the Call-1 rule:
   - `thing_id` present → build from thing data: short street (first comma-segment of `address`, house number stripped) · `category` · price glyph (`free` → "Free"; else `price_band` rendered as $/$$/$$$). Omit segments whose source field is null — never render a placeholder.
   - `thing_id` null → return the stored `sub` verbatim (or null; the card renders sub-less).
   - Pure function, unit-tested with: full thing, thing with null category, thing with null address, label-only stop with sub, label-only without.
3. **`directionsUrl(stop, thing)`** — `maps_query` set → `https://maps.google.com/?q={encoded query}`; else thing `lat`/`lng` → `https://maps.google.com/?q={lat},{lng}`; else null (card renders no ⌖ link). Pure, tested.
4. **Sketch asset registry scaffold** — `lib/guide-art.ts` (or match repo conventions): a typed registry keyed by asset id → `{ kind: 'sketch'|'emblem', Component, markers: Record<position, {x,y}>, secretMark?: {x,y} }`. Ship it EMPTY except types + a lookup that returns null for unknown ids (renderer will fall back gracefully in Phase 2). The funk-zone SVG itself is Phase 2 work — do not draw art in this phase.
5. **Touch nothing else.** `getPublishedGuides` / `getGuide` may widen their select lists to the new columns; `matchGuideThings`, ranking, cascade logic stay byte-identical.

## 4 · Tests

Vitest (match repo test conventions): `parseGuideContent` (empty, full, malformed), `deriveStopSub` (five cases above), `directionsUrl` (three branches). No E2E this phase — there is no UI change to test.

## 5 · Prove additivity (the phase gate)

With migration applied (after Jim pastes): insert nothing; confirm `/discover` and a `/discover/[id]` route render **byte-identically** to pre-migration (guides table is empty in prod, so verify on a local/dev seed of one plain guide: create a draft plain guide via service-role DML — DML is routine worker work, not DDL — render, screenshot, delete it or leave draft-status so RLS hides it). If anything renders differently, the phase fails its own gate — stop and report.

## 6 · Stop-and-show + ledger

- Commit the approved paper doc to `docs/discover-living-postcard/Phase1_Content_Model_FunkZone_Paper.md` for provenance.
- Show Jim: the two migration files (for him to paste) · test output · the byte-identical render proof at ~390px and ~1280px.
- Append Doc 14: "Living Postcard Phase 1 — guides content model migration written (rainy_day enum + 5 guides cols + 3 guide_stops cols), lib parsers + sub/directions derivation, additivity proven; DDL pasted by Jim [date]."

**Out of scope (later phases):** any page rendering, the funk-zone sketch SVG, seeding content, passport/stamps state, cockpit editing UI for `now_note`, the enrich-prompt rainy_day vocabulary (scheduled with Phase 5).

*End of Phase 1 spec.*
