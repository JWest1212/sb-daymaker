# Section 8 - API / Backend Logic

All 60 Cockpit endpoints (API-01..API-60), documented from full reads of every route file and the lib helpers they call. Grouped by module in file order below: catalog + misc (API-01..08, 19, 31, 32, 33, 55), coverage + restock (API-09..18, 41, 42), editions (API-20..29), venues (API-43..54), images + review (API-34..40, 56..60). Shared facts, stated once:

- Auth: every endpoint checks `getAdminUser()` from lib/reviewServer.ts itself and returns 401 JSON when unauthenticated; per-endpoint quotes below. No middleware exists. Several routes named requireAdmin-style helpers also return 401 when the real failure is a missing SUPABASE_SECRET_KEY, which mislabels a config error as an auth error (flagged per route).
- Data client: every endpoint uses the service-role client (getAdminSupabase()); most return `{ error: "not configured" }`-style 500s when it is null, but API-07, API-40, API-54 and API-58 return empty 200 payloads instead (silent-degradation routes, cross-referenced in 10-observability.md).
- Audit: mutations write audit_log rows with actor "founder" inconsistently: publish/reject/update, hero flag, weight, redraft-queue, photo apply and most venue-photo mutations do; venue photo FETCH (API-51) and several others do not. audit_log insert errors are never checked anywhere.
- The publish trust chain: API-56 (approve) is the only path from needs_review to published in the Cockpit; it also stamps `last_confirmed` with today's date, applies pending edits/photo/hero, replaces thing_tags, assigns slugs + redirects (ensureSlugsForThings), and calls revalidatePublic() to refresh ISR pages.

## 8.0 Background jobs, scheduled tasks, and third-party integrations

Inside the app (Vercel Cron, schedules from vercel.json; all guarded by CRON_SECRET bearer):

- /api/cron/heartbeat - daily 12:00 UTC. The dead-man's-switch (its comment: "if the whole nightly job fails to start, nothing inside it can report that, only an independent watcher can"): if no source_runs row landed in 30 hours, emails DIGEST_TO via Resend: subject "SB Daymaker, nightly ingest did not run". If DIGEST_TO is unset it checks and then silently does nothing.
- /api/cron/send-edition - Sundays + Thursdays 14:00 UTC (07:00 PT): calls sendEdition() (lib/edition/send.ts) for today's edition_date. Send eligibility: status draft OR approved sends; skipped (Hold) and sent/failed do not. Reads confirmed subscribers (the email PII boundary; never surfaced in any screen), renders once, batch-sends via Resend (lib/email.ts, RESEND_API_KEY; sendEmail returns false instead of throwing when unconfigured), then marks the edition sent with sent_count.
- /api/cron/reaper - Mondays 08:00 UTC: deletes shared_states rows idle > 90 days (public-app share tokens; cockpit-adjacent only).
- /api/cron/nightly - DEPRECATED no-op kept so "a stray call can't re-run the retired duplicate pipeline"; the real nightly ingest moved to the GitHub Action worker (ingest/run.ts).

Outside the app:

- The nightly ingest worker: a GitHub Action running ingest/run.ts (Node 22) around 09:00 UTC [INFERRED from the heartbeat comment "nightly ingest's normal 09:00 UTC start"]. It writes everything the Queue reads (things, ingest_drops, source_runs), consumes restock_directives and enrich_directives, sends the founder's morning digest email, and applies the auto-publish confidence gate that writes the audit_log auto_publish/auto_hold rows SCR-01's metrics panel counts.
- Restock "Run now" (API-42): a GitHub workflow_dispatch POST to `https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/{GITHUB_WORKFLOW_FILE}/dispatches` using GITHUB_DISPATCH_TOKEN; falls back to tonight's queued directive when dispatch fails.
- Anthropic API: exactly one Cockpit endpoint (API-20, edition blurb rewrite) plus the worker's enrichment (out of app).
- Google Places API (GOOGLE_PLACES_KEY) and Wikimedia Commons: the image waterfall (ingest/images.ts, lib/venueFetch.ts); Google photo calls are capped monthly via the image_spend ledger (IMAGE_MONTHLY_CALL_CAP, default 1200), but API-48's Places Text/Nearby Search lookups bypass that ledger (flagged in its entry).
- Resend: all outbound email (editions, heartbeat alert) via lib/email.ts raw REST.

## 8.1 Endpoint reference
# API Endpoints - Batch A (admin catalog, dedupe, hero, image budget, weight)

Common auth mechanism note: every route in this batch calls `getAdminUser()` from lib/reviewServer.ts (lines 29-33), which resolves the cookie-bound Supabase auth session via `getServerSupabase()` (lib/supabaseServer.ts line 9, anon key + cookies) and returns the signed-in user or null. Data operations then use the service-role client from `getAdminSupabase()` (lib/supabaseAdmin.ts). `revalidatePublic()` (lib/reviewServer.ts lines 20-26) calls `revalidatePath` on "/", "/discover", "/saved", "/discover/[id]", "/thing/[id]".

### API-01 - POST /api/admin/catalog/bulk
- File: app/api/admin/catalog/bulk/route.ts (102 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 19: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ ids?: string[]; op?: "hero_on" | "hero_off" | "add_tag" | "remove_tag" | "set_weight" | "archive" | "unarchive"; tag?: string; weight?: number }`. `ids` required (non-empty). `tag` required for add_tag/remove_tag (add_tag additionally requires tag to be in OCCASION_TAGS). `weight` coerced via `Math.max(-5, Math.min(5, Math.round(Number(body.weight ?? 0))))`.
- Response: 200 `{ ok: true, applied: number }` (add_tag also returns `skipped: number`). Errors: 400 `{ error: "ids required" }`, 400 `{ error: "tag required" }`, 400 `{ error: "valid tag required" }`, 400 `{ error: "unknown op" }`, 401 `{ error: "unauthorized" }`, 500 `{ error: "not configured" }` when the service client is missing, 500 `{ error: <supabase message> }` on DB failure.
- Logic: one uniform bulk operation across many published rows (cockpit LC-3). hero_on/hero_off flips `things.hero_eligible`; remove_tag deletes matching thing_tags rows; add_tag re-checks negative-tag rules per row via `filterTags` (21-plus rows cannot get family_day, non-free rows cannot get free_sb), silently skips ineligible rows and counts them, and inserts only tags not already present; set_weight clamps to -5..+5 and sets `editorial_weight`; archive/unarchive toggles `status` between "archived" and "published" (reversible, supports client Undo). Every branch writes one audit_log row per id. remove_tag, add_tag, archive, unarchive call `revalidatePublic()`; hero toggles and set_weight do not.
- Complexity bar: yes (6 op branches plus per-row eligibility filtering; writes things, thing_tags, and audit_log). Verbatim, app/api/admin/catalog/bulk/route.ts lines 56-68:
```ts
    const { data: rows } = await sb.from("things").select("id, is_21_plus, price_band").in("id", ids);
    const eligible = (rows ?? []).filter(
      (r) => filterTags([tag], { is_21_plus: r.is_21_plus as boolean | null, price_band: r.price_band as string | null }).includes(tag),
    );
    const skipped = ids.length - eligible.length;
    if (eligible.length) {
      const eligibleIds = eligible.map((r) => r.id as string);
      const { data: existing } = await sb.from("thing_tags").select("thing_id").eq("tag", tag).in("thing_id", eligibleIds);
      const already = new Set((existing ?? []).map((r) => r.thing_id as string));
      const toInsert = eligibleIds.filter((id) => !already.has(id));
      if (toInsert.length) {
        const { error } = await sb.from("thing_tags")
          .insert(toInsert.map((thing_id) => ({ thing_id, tag, confidence: 1.0, tag_source: "founder" })));
```
- Tables: reads: things(id, is_21_plus, price_band) [add_tag only], thing_tags(thing_id) [add_tag dedup check]. writes: things(hero_eligible | editorial_weight | status), thing_tags(insert: thing_id, tag, confidence, tag_source; delete by tag + thing_id) , audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing ids, missing/invalid tag, unknown op, missing service client, and DB errors on the primary write. Not handled: audit_log insert errors are awaited but never checked [INFERRED]; add_tag's things/thing_tags reads ignore their error fields, so a failed read is treated as zero rows and every id counts as skipped [INFERRED]; unarchive sets status to "published" unconditionally, even for rows that were never published before archiving [INFERRED]; malformed JSON body throws and surfaces as an unhandled 500 [INFERRED].

### API-02 - POST /api/admin/catalog/delete
- File: app/api/admin/catalog/delete/route.ts (28 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 12: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string }`, required.
- Response: 200 `{ ok: true }`. Errors: 400 `{ error: "thing_id required" }`, 401 `{ error: "unauthorized" }`, 500 `{ error: "not configured" }`, 500 `{ error: <supabase message> }`.
- Logic: soft delete. Sets `things.status = "archived"` for the given id (row retained, reversible), writes an audit_log row (action "archive", payload `{ via: "catalog_delete" }`), then `revalidatePublic()` so it disappears from public surfaces immediately. Not a DB delete.
- Complexity bar: yes (writes two tables: things and audit_log). Verbatim, app/api/admin/catalog/delete/route.ts lines 19-27:
```ts
  const { error } = await sb.from("things").update({ status: "archived" }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "archive", actor: "founder",
    payload: { via: "catalog_delete" },
  });
  revalidatePublic();
```
- Tables: reads: none. writes: things(status), audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing thing_id, missing service client, DB update error. Not handled: no existence check, archiving a nonexistent id still returns `{ ok: true }` (the update matches zero rows) [INFERRED]; audit_log insert error unchecked [INFERRED].

### API-03 - POST /api/admin/catalog/edit
- File: app/api/admin/catalog/edit/route.ts (64 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 14: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string; payload?: EditPayload }` where EditPayload (lib/review.ts lines 146-152) is `{ title?: string; blurb?: string | null; blurb_long?: string | null; neighborhood?: string | null; tags?: string[] }`. Only fields present in the payload are applied.
- Response: 200 `{ ok: true, applied: thing_id }`. Errors: 400 `{ error: "thing_id + payload required" }`, 404 `{ error: "thing not found" }`, 400 `{ error: "only published things are editable here" }`, 400 `{ error: "Tag not allowed for this item: <tags>" }`, 401, 500 `{ error: "not configured" }`, 500 `{ error: <supabase message> }`.
- Logic: applies a founder edit directly to a live published row (no review queue). Builds a patch: always stamps `last_confirmed` with today's date; trims title; empty blurb/blurb_long become null; a neighborhood edit is validated against NEIGHBORHOODS (invalid becomes null) and triggers recomputation of `nearby_zone` via `deriveNearbyZone` (lib/geo.ts line 25: coordinates win, else neighborhood mapping) using the same rule as ingest landing. Tags are validated with `filterTags`; if the founder requested an occasion tag the negative rules forbid, the whole request 400s (unlike bulk add_tag which skips). On tags change, all thing_tags rows for the thing are deleted then re-inserted with confidence 1.0 and tag_source "founder". Writes audit_log (action "catalog_edit", payload lists changed fields) and calls `revalidatePublic()`. Start time is never editable here.
- Complexity bar: yes (per-field conditional patch building, tag legality check, nearby_zone recomputation, writes things + thing_tags + audit_log). Verbatim, app/api/admin/catalog/edit/route.ts lines 29-39:
```ts
  if (typeof payload.title === "string" && payload.title.trim()) { patch.title = payload.title.trim(); changed.title = patch.title; }
  if (payload.blurb !== undefined) { patch.blurb = (payload.blurb ?? "").toString().trim() || null; changed.blurb = patch.blurb; }
  if (payload.blurb_long !== undefined) { patch.blurb_long = (payload.blurb_long ?? "").toString().trim() || null; changed.blurb_long = patch.blurb_long; }
  if (payload.neighborhood !== undefined) {
    patch.neighborhood = payload.neighborhood && (NEIGHBORHOODS as readonly string[]).includes(payload.neighborhood) ? payload.neighborhood : null;
    changed.neighborhood = patch.neighborhood;
    // LC-6: a neighborhood edit can move the Near-Me/Coverage zone, recompute
    // with the same rule ingest/land.ts lands new rows with (lib/geo.ts).
    patch.nearby_zone = deriveNearbyZone(patch.neighborhood as string | null, row.lat, row.lng);
    changed.nearby_zone = patch.nearby_zone;
  }
```
- Tables: reads: things(is_21_plus, price_band, status, lat, lng). writes: things(last_confirmed, title, blurb, blurb_long, neighborhood, nearby_zone), thing_tags(delete all for thing_id; insert thing_id, tag, confidence, tag_source), audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing args, thing not found, non-published rows, illegal tags, primary update error. Not handled: the thing_tags delete + insert pair is unchecked and not transactional, a failed insert after a successful delete silently strips all tags [INFERRED]; audit_log insert unchecked [INFERRED].

### API-04 - POST /api/admin/catalog/find-more-images
- File: app/api/admin/catalog/find-more-images/route.ts (37 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 16: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string }`, required.
- Response: 200 `{ ok: true, options: ImageOption[] }` where ImageOption (ingest/images.ts lines 55-61) is `{ url: string; source: PhotoSource; width?: number; height?: number; attribution?: string }`. Errors: 400 `{ error: "thing_id required" }`, 404 `{ error: <supabase message or "not found"> }`, 401, 500 `{ error: "not configured" }`.
- Logic: read-only photo-widening for the catalog picker's "Search wider (free)" button. Loads the thing's title/neighborhood/happening_category/photo_options, builds a free-source search string with `imageQuery()` (ingest/images.ts line 123: title + neighborhood + category phrase + "Santa Barbara"), then `findMoreOptions()` (ingest/images.ts lines 594-604) runs a Wikimedia title search only (Pexels retired, never Google, so no paid cap risk), merges the single best hit with the thing's existing real options deduped by url, and re-ranks via `rankOptions`. Nothing is persisted; the founder applies a pick via API-05.
- Complexity bar: yes (4+ conditional guard/merge branches across handler and helper; feeds the photo-option ranking via rankOptions). Verbatim, ingest/images.ts lines 594-604:
```ts
export async function findMoreOptions(query: string, existing: ImageOption[]): Promise<ImageOption[]> {
  const existingReal = existing.filter((o) => o.url);
  const seen = new Set(existingReal.map((o) => o.url));
  const fresh: ImageOption[] = [];
  // No candidate object here (this action is query-string-only, on demand), always
  // title-search mode, gated exactly like the main resolver's fallback path.
  const wmBest = pickBestWikimedia(await wikimediaTitleSearch(query), { title: query });
  const wm = wmBest ? toWikimediaOption(wmBest) : null;
  if (wm && !seen.has(wm.url)) fresh.push(wm);
  return rankOptions([...existingReal, ...fresh]);
}
```
- Tables: reads: things(title, neighborhood, happening_category, photo_options). writes: none. External: Wikimedia Commons title-search API.
- Errors: handles missing thing_id and not-found. Notable: a genuine DB read error is also returned as status 404 (`error?.message ?? "not found"` at line 28), conflating server failure with not-found [INFERRED as unintended]; Wikimedia network failures inside the helper resolve to empty results rather than an error [INFERRED from the helper's fail-soft catch patterns].

### API-05 - POST /api/admin/catalog/photo
- File: app/api/admin/catalog/photo/route.ts (95 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 23: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string; url?: string | null; source?: string; attribution?: string | null; venue_photo_id?: string }`. thing_id + source required; url required unless source is "placeholder".
- Response: 200 `{ ok: true }`. Errors: 400 `{ error: "thing_id + source required" }`, 400 `{ error: "url required unless source is placeholder" }`, 401, 500 `{ error: "not configured" }`, 500 `{ error: <supabase message> }`.
- Logic: instant photo apply to the live row, no re-review. `source: "placeholder"` clears photo_url/photo_attribution to null (branded gradient fallback). If `venue_photo_id` is present (pick came from the venue-backed fetch, API-08) and that venue_photos row is unapproved, it is approved in the same request with the next sort_order appended to the venue's approved pool, plus its own audit_log row (action "photo_approved"), so the photo joins the venue's compliant auto-refresh pool. For non-placeholder picks the applied option is folded into `things.photo_options` (read-modify-write, dedup by url, new pick prepended) so a discovery survives closing the edit sheet. Then updates the thing's photo fields, writes audit_log (action "photo_set"), and calls `revalidatePublic()`.
- Complexity bar: yes (placeholder vs url vs venue-photo branches; writes venue_photos, things, and audit_log). Verbatim, app/api/admin/catalog/photo/route.ts lines 42-55:
```ts
  if (body.venue_photo_id && !isPlaceholder) {
    const { data: vp } = await sb.from("venue_photos").select("id, venue_id, approved").eq("id", body.venue_photo_id).maybeSingle();
    if (vp && !vp.approved) {
      const { data: maxSort } = await sb
        .from("venue_photos").select("sort_order").eq("venue_id", vp.venue_id as string).eq("approved", true)
        .order("sort_order", { ascending: false }).limit(1);
      const nextSort = ((maxSort?.[0]?.sort_order as number) ?? -1) + 1;
      await sb.from("venue_photos").update({ approved: true, sort_order: nextSort }).eq("id", body.venue_photo_id);
      await sb.from("audit_log").insert({
        entity_type: "venue_photo", entity_id: body.venue_photo_id, action: "photo_approved", actor: "founder",
        payload: { venue_id: vp.venue_id, via: "catalog" },
      });
    }
  }
```
- Tables: reads: venue_photos(id, venue_id, approved), venue_photos(sort_order), things(photo_options). writes: venue_photos(approved, sort_order), things(photo_url, photo_source, photo_attribution, photo_options), audit_log(entity_type, entity_id, action, actor, payload) (up to two rows: photo_approved and photo_set).
- Errors: handles missing thing_id/source, missing url for non-placeholder, DB error on the things update. Not handled: an invalid venue_photo_id is silently ignored (vp null, no approval) [INFERRED intentional fail-soft]; the venue_photos update, both audit_log inserts, and the photo_options read are unchecked [INFERRED]; the read-modify-write on photo_options is not concurrency-safe, acknowledged in the source comment as acceptable for a single admin.

### API-06 - POST /api/admin/catalog/redraft
- File: app/api/admin/catalog/redraft/route.ts (41 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 15: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string; ids?: string[] }`. Either a single thing_id or a bulk ids array; ids wins when both present and non-empty.
- Response: 200 `{ ok: true, queued: number, already_queued: number }`. Errors: 400 `{ error: "thing_id or ids required" }`, 401, 500 `{ error: "not configured" }`, 500 `{ error: <supabase message> }`.
- Logic: queues an enrich_directives row (status "queued") per id for tonight's batch worker (ingest/enrichDirectives.ts) to re-draft; fires no AI call itself. The worker later lands results as pending thing_edits overlays for normal review. Ids that already have a queued directive are skipped so re-clicking does not pile up redundant redrafts. One audit_log row per newly queued id (action "redraft_queued").
- Complexity bar: yes (single vs bulk input normalization, already-queued dedup branch; writes enrich_directives and audit_log). Verbatim, app/api/admin/catalog/redraft/route.ts lines 23-31:
```ts
  const { data: already } = await sb
    .from("enrich_directives").select("thing_id").eq("status", "queued").in("thing_id", ids);
  const alreadyQueued = new Set((already ?? []).map((r) => r.thing_id as string));
  const toQueue = ids.filter((id) => !alreadyQueued.has(id));

  if (toQueue.length) {
    const { error } = await sb.from("enrich_directives")
      .insert(toQueue.map((thing_id) => ({ thing_id, status: "queued" })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
```
- Tables: reads: enrich_directives(thing_id where status = "queued"). writes: enrich_directives(thing_id, status), audit_log(entity_type, entity_id, action, actor).
- Errors: handles empty input and insert failure. Not handled: the dedup read ignores its error field, a failed read means everything is treated as not-yet-queued and could double-queue [INFERRED]; no validation that the ids exist or are published [INFERRED]; audit_log insert unchecked [INFERRED].

### API-07 - GET /api/admin/catalog
- File: app/api/admin/catalog/route.ts (23 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 10: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: query string `?tier=&vibe=&zone=&q=&page=`. tier accepted only as 1, 2, or 3 (else ignored); vibe is an occasion tag; zone is a nearby_zone; q is a title substring; page is a number defaulting to 1.
- Response: 200 CatalogResult `{ rows: CatalogRow[], total: number, page: number, pageSize: 50 }`. CatalogRow includes id, title, blurb, blurb_long, neighborhood, is_21_plus, happening_tier, nearby_zone, price_band, hero_eligible, editorial_weight, photo_url, photo_source, photo_attribution, photo_options (retired sources stripped), tags, when, pending_edit, groupKey, groupLabel, place_id, lat, lng, venue_id. Errors: 401 only; DB failures inside loadCatalog are logged and returned as an empty 200 result.
- Logic: lists published things for the Live-catalog tab via `loadCatalog()` (lib/catalogServer.ts lines 51-129). Vibe filter resolves matching thing_ids through thing_tags first. Fetches up to 2000 matching rows so ordering is global, then sorts into buckets: today + future dated (chronological), recurring (alphabetical), evergreen (alphabetical), past dated at the bottom (newest first), paginates in-process at 50 per page, and flags rows that have a pending thing_edits overlay.
- Complexity bar: yes (loadCatalog has 4 filter branches plus the bucket/sort calculation that orders the catalog). Verbatim, lib/catalogServer.ts lines 16-26:
```ts
function bucketAndGroup(tier: number, starts_at: string | null, title: string, today: string) {
  if (tier === 1 && starts_at) {
    const day = sbDay(new Date(starts_at).getTime());
    const label = DAY_FMT.format(new Date(starts_at));
    if (day === today) return { bucket: 0, sortVal: starts_at, groupKey: day, groupLabel: `Today · ${label}` };
    if (day > today) return { bucket: 0, sortVal: starts_at, groupKey: day, groupLabel: label };
    return { bucket: 3, sortVal: starts_at, groupKey: `past_${day}`, groupLabel: `${label} · past` };
  }
  if (tier === 2) return { bucket: 1, sortVal: title.toLowerCase(), groupKey: "recurring", groupLabel: "Recurring, every week" };
  return { bucket: 2, sortVal: title.toLowerCase(), groupKey: "evergreen", groupLabel: "Anytime in SB" };
}
```
- Tables: reads: thing_tags(thing_id by tag) [vibe filter], things(id, title, blurb, blurb_long, neighborhood, is_21_plus, happening_tier, nearby_zone, price_band, hero_eligible, editorial_weight, photo_url, photo_source, photo_attribution, photo_options, place_id, lat, lng, venue_id, starts_at; status = "published") with embedded thing_tags(tag) and recurring_schedules(day_of_week, start_time, end_time, frequency, label), thing_edits(thing_id where status = "pending", page ids only). writes: none.
- Errors: DB read failure is swallowed (console.error, empty result with 200), so the client cannot distinguish "no rows" from "read failed" [INFERRED]; results silently cap at 2000 rows (`q.range(0, 1999)`), a larger catalog would truncate [INFERRED]; no missing-service-client 500, loadCatalog returns empty instead.

### API-08 - POST /api/admin/catalog/venue-photos/fetch
- File: app/api/admin/catalog/venue-photos/fetch/route.ts (110 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 30: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string; include_google?: boolean }`. thing_id required; include_google defaults to false (free sources only).
- Response: 200 `{ ok: true, venue_id, venue_created: boolean, venue_has_place_id: boolean, venue_has_coords: boolean, options: PhotoOption[], count, wikimediaCount, googleFetched, googleCount, capHit }` (last five spread from VenueFetchStats). PhotoOption entries carry `venuePhotoId` so API-05 can approve the pool row. Errors: 400 `{ error: "thing_id required" }`, 404 `{ error: <message or "thing not found"> }`, 401, 500 `{ error: "not configured" }`, 500 `{ error: <venue creation failure message> }`.
- Logic: thing-centric front end onto the compliant venue photo pool system. Attachment order: (1) thing already has venue_id, use that venue; (2) no venue_id but the thing's place_id exactly matches an active venue's place_id, attach to it (deterministic dedup, no fuzzy matching) and stamp things.venue_id + audit "venue_auto_attached"; (3) otherwise auto-create a venue seeded from the thing's title/place_id/lat/lng via `createVenue()` (lib/venuesServer.ts lines 278-306: slugged key, collision suffix from the thing_id, radius_m 150), attach it, audit "venue_auto_created". Then `fetchCandidatesForVenue()` (lib/venueFetch.ts lines 38-87) pulls up to 5 gated Wikimedia geosearch candidates (needs lat/lng, free, no cap impact) and, only when include_google is true and the venue has a place_id and the shared monthly cap (`CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1200)`, ingest/images.ts line 52) has budget, up to 10 Google Places photos, incrementing and persisting the image_spend counter and setting capHit when the budget is or becomes exhausted. Candidates are upserted as unapproved venue_photos rows deduped on (venue_id, stable_ref). Finally returns the venue's full option set, approved pool first, then unapproved candidates.
- Complexity bar: yes (3-way attachment branch, budget-gated Google fetch, writes things, venues, venue_photos, image_spend, audit_log). Verbatim, app/api/admin/catalog/venue-photos/fetch/route.ts lines 50-61:
```ts
  if (!venue && thing.place_id) {
    const { data } = await sb.from("venues").select("id, display_name, place_id, lat, lng")
      .eq("place_id", thing.place_id as string).eq("status", "active").maybeSingle();
    if (data) {
      venue = data as VenueRow;
      await sb.from("things").update({ venue_id: venue.id }).eq("id", thing_id);
      await sb.from("audit_log").insert({
        entity_type: "thing", entity_id: thing_id, action: "venue_auto_attached", actor: "founder",
        payload: { venue_id: venue.id, reason: "exact place_id match" },
      });
    }
  }
```
- Tables: reads: things(id, title, place_id, lat, lng, venue_id), venues(id, display_name, place_id, lat, lng; by id, or by place_id + status = "active", or by key for collision check), venue_photos(id, source, serving_url, attribution, approved, sort_order), image_spend(google_calls, over_cap). writes: things(venue_id), venues(insert: key, display_name, place_id, lat, lng, radius_m), venue_photos(upsert: venue_id, source, stable_ref, serving_url, attribution, approved), image_spend(upsert: month, google_calls, over_cap, updated_at), audit_log(entity_type, entity_id, action, actor, payload). External: Wikimedia geosearch, Google Places photos.
- Errors: handles missing thing_id, thing not found, venue creation failure (try/catch to 500), Google budget exhaustion (capHit flag, not an error). Not handled: things.venue_id updates, audit_log inserts, and the venue_photos upsert are unchecked [INFERRED]; if the thing's stored venue_id points at a missing/inactive venue, the code falls through to auto-creating a duplicate venue rather than reporting the dangling reference [INFERRED]; the final venue_photos read ignores its error field [INFERRED].

### API-19 - POST /api/admin/dedupe/unmerge
- File: app/api/admin/dedupe/unmerge/route.ts (42 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 14: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string }`, required; must reference a row whose `merged_into` is set.
- Response: 200 `{ ok: true }`. Errors: 400 `{ error: "thing_id required" }`, 400 `{ error: "not a merged row" }`, 401, 500 `{ error: "not configured" }`, 500 `{ error: <supabase message> }` (from the read or the update).
- Logic: reverses a dedupe merge (Data Arch Redesign 26 Phase 5). Merged rows were landed as status "archived" with `merged_into` pointing at the survivor, never deleted. This restores status to "needs_review" and clears merged_into so the row reappears in the review queue next to its survivor. Audits with the prior survivor id (payload `was_merged_into`), then `revalidatePublic()`.
- Complexity bar: yes (guard, read-validate, and writes to things plus audit_log). Verbatim, app/api/admin/dedupe/unmerge/route.ts lines 21-30:
```ts
  const { data: row, error: readErr } = await sb
    .from("things").select("id, merged_into, status").eq("id", thing_id).maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!row?.merged_into) return NextResponse.json({ error: "not a merged row" }, { status: 400 });

  const { error } = await sb
    .from("things")
    .update({ status: "needs_review", merged_into: null })
    .eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
```
- Tables: reads: things(id, merged_into, status). writes: things(status, merged_into), audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing thing_id, read error, non-merged rows, update error. Not handled: audit_log insert unchecked [INFERRED]; does not verify the survivor still exists or touch it in any way (by design, the survivor keeps its merged data) [INFERRED].

### API-30 - POST /api/admin/flags/[id]

- File: app/api/admin/flags/[id]/route.ts (32 lines)
- Auth: getAdminUser() from lib/reviewServer.ts; line 13: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` - unauthenticated requests receive 401 `{ "error": "unauthorized" }`.
- Request: JSON body `{ action?: string }` where action is "resolve", "dismiss", or "reviewing" (any other or missing value -> 400 `{ error: "bad_action" }`); the flag id comes from the path param.
- Response: 200 `{ ok: true }`; 400 bad_action; 500 `{ error: "not configured" }` (no service key) or `{ error: message }` (DB failure).
- Logic: maps the action to a content_flags status ("resolved" / "dismissed" / "reviewing"), sets resolved_at to now for the two terminal statuses (null for "reviewing"), and updates the row. Header comment: "Admin-gated resolve/dismiss for a content_flags row. Sets status + resolved_at." Note the "reviewing" action exists server-side but no Cockpit UI sends it (CMP-26 only sends resolve/dismiss).
- Complexity bar: no (single-table update; the status mapping is one chained ternary). No excerpt required.
- Tables: reads: none; writes: content_flags(status, resolved_at) - a DRIFT table (absent from all checked-in SQL; see 06-data-architecture.md 7.2).
- Errors: handles malformed JSON (`.catch(() => ({}))` -> bad_action 400), bad action values, missing config, DB error. Not handled: a non-existent flag id updates zero rows and still returns `{ ok: true }` [INFERRED from the update-by-eq pattern with no affected-row check].

### API-31 - POST /api/admin/hero-eligible
- File: app/api/admin/hero-eligible/route.ts (35 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 11: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string; hero_eligible?: boolean }`. Both required; hero_eligible must be a literal boolean.
- Response: 200 `{ ok: true, hero_eligible }`. Errors: 400 `{ error: "thing_id + hero_eligible required" }`, 401, 500 `{ error: "not configured" }`, 500 `{ error: <supabase message> }`.
- Logic: immediate metadata flag flip (build plan section 1.7): sets `things.hero_eligible` with no re-review round trip and no status change, then writes an audit_log row (action "hero_toggle"). Notably does NOT call `revalidatePublic()` (the flag only feeds future hero selection, not the current page render) [INFERRED rationale].
- Complexity bar: yes (writes two tables: things and audit_log). Verbatim, app/api/admin/hero-eligible/route.ts lines 19-24:
```ts
  if (!thing_id || typeof hero_eligible !== "boolean") {
    return NextResponse.json({ error: "thing_id + hero_eligible required" }, { status: 400 });
  }

  const { error } = await sb.from("things").update({ hero_eligible }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
```
- Tables: reads: none. writes: things(hero_eligible), audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing/invalid args and update error. Not handled: nonexistent thing_id still returns ok (zero-row update) [INFERRED]; audit_log insert unchecked [INFERRED].

### API-32 - GET, POST, DELETE /api/admin/hero-pins
- File: app/api/admin/hero-pins/route.ts (59 lines)
- Auth: local `requireAdmin()` (lines 8-11) wrapping `getAdminUser()` from lib/reviewServer.ts: `const user = await getAdminUser();` (line 9) then `return user ? getAdminSupabase() : null;` (line 10). All three methods check it, e.g. line 16: `if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`. Note: a missing service-role client also surfaces as this same 401, not a 500 "not configured" like the other routes [INFERRED consequence of the ternary].
- Request: GET: none. POST: JSON body `{ pin_date?: string; thing_id?: string }`, both required (pin_date is an SB "YYYY-MM-DD" string). DELETE: JSON body `{ pin_date?: string }`, required.
- Response: GET: 200 HeroPlan `{ days: HeroDay[], generatedAt }`; each HeroDay is `{ date, label, isToday, pin: { thing_id, title, tier, when, valid } | null, autoPick: HeroCandidate | null, candidates: HeroCandidate[] }`. POST: 200 `{ ok: true }`; 400 `{ error: "pin_date + thing_id required" }`; 400 with validatePin's message ("thing not found", "not published", "not hero-eligible (⭑), flag it first", "does not occur on that date", "not configured"); 500 `{ error: <supabase message> }`. DELETE: 200 `{ ok: true }`; 400 `{ error: "pin_date required" }`; 500 `{ error: <supabase message> }`. All: 401 `{ error: "unauthorized" }`.
- Logic: GET builds the next-14-days hero rail via `loadHeroPlan()` (lib/heroServer.ts lines 57-108): loads pins for those dates plus all published hero_eligible things, and per day filters candidates with `occursOnDate`, orders them with the site's own `cascade()` ranker, projects the public "Auto" pick with `pickAutoHero` (never forked from the live site's picker), and computes pin validity from the pinned row's current ground truth (published + hero_eligible + occurs that day). POST validates the pin with `validatePin()` then upserts hero_pins on pin_date (one pin per day) and audits "hero_pin"; DELETE removes the pin for a date (back to Auto) and audits "hero_unpin" with entity_id null. POST and DELETE call `revalidatePublic()` because a same-day pin changes the live Explore hero (via `getLiveHeroPinId`).
- Complexity bar: yes (validatePin has 4 rejection branches; loadHeroPlan performs the ranking projection; POST writes hero_pins and audit_log). Verbatim, lib/heroServer.ts lines 128-138:
```ts
export async function validatePin(pin_date: string, thing_id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getAdminSupabase();
  if (!sb) return { ok: false, error: "not configured" };
  const { data } = await sb.from("things").select(STAR_SELECT).eq("id", thing_id).single();
  const row = data as unknown as StarRow | null;
  if (!row) return { ok: false, error: "thing not found" };
  if (row.status !== "published") return { ok: false, error: "not published" };
  if (!row.hero_eligible) return { ok: false, error: "not hero-eligible (⭑), flag it first" };
  if (!occursOnDate(occThing(row), pin_date)) return { ok: false, error: "does not occur on that date" };
  return { ok: true };
}
```
- Tables: reads (GET): hero_pins(pin_date, thing_id), things(id, title, happening_tier, editorial_weight, starts_at, status, hero_eligible, photo_url; status = "published" and hero_eligible = true, plus a second fetch by pinned ids) with embedded recurring_schedules(day_of_week, start_time, end_time, frequency, label). reads (POST): things(same STAR_SELECT, by id, via validatePin). writes (POST): hero_pins(pin_date, thing_id; upsert onConflict pin_date), audit_log(entity_type, entity_id, action, actor, payload). writes (DELETE): hero_pins(delete by pin_date), audit_log.
- Errors: handles missing args, all four pin-validity failures, upsert/delete errors. Not handled: "not configured" from validatePin is returned as a 400 rather than a 500 [INFERRED]; DELETE returns ok even when no pin existed for that date [INFERRED]; audit_log inserts unchecked [INFERRED]; pin_date format is not validated (a malformed date simply never matches an occurrence, so validatePin rejects it indirectly) [INFERRED].

### API-33 - GET /api/admin/image-budget
- File: app/api/admin/image-budget/route.ts (20 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 13: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: none (GET, no query params).
- Response: 200 `{ used: number, cap: number, month: "YYYY-MM" }`. Errors: 401 `{ error: "unauthorized" }`, 500 `{ error: "not configured" }`.
- Logic: read-only cost visibility (LC-8/V-10). Returns the current UTC month key (`monthKey()`, ingest/images.ts line 647), the month's Google Places call count from the shared image_spend counter (`loadSpend()`, lines 650-653, defaults to 0 when no row exists), and the cap (`CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1200)`, line 52). The counter is only ever written by actual Google calls in lib/venueFetch.ts and ingest/images.ts, never here.
- Complexity bar: no.
- Tables: reads: image_spend(google_calls, over_cap; by month). writes: none.
- Errors: handles missing service client. Not handled: a failed image_spend read inside loadSpend resolves to zeros, so a DB outage reads as "0 used" rather than an error [INFERRED].

### API-55 - POST /api/admin/weight
- File: app/api/admin/weight/route.ts (39 lines)
- Auth: `getAdminUser()` from lib/reviewServer.ts. Line 14: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string; weight?: number }`. Both required; weight must be an integer in -5..+5 (checked with `Number.isInteger`, no rounding, unlike the bulk route's clamp).
- Response: 200 `{ ok: true, weight }`. Errors: 400 `{ error: "thing_id + integer weight in −5..+5 required" }` (verbatim, source uses a Unicode minus), 401, 500 `{ error: "not configured" }`, 500 `{ error: <supabase message> }`.
- Logic: the cockpit's up/down editorial nudge (W2.1c). Sets `things.editorial_weight` immediately, no re-review, no status change. editorial_weight is founder curation the ranker is allowed to read (the ranker never reads is_featured/sponsor_id). Writes audit_log (action "weight_set") and calls `revalidatePublic()` because a boost can change the live hero and section order.
- Complexity bar: yes (the write feeds the public ranking cascade, and it writes things plus audit_log). Verbatim, app/api/admin/weight/route.ts lines 22-27:
```ts
  if (!thing_id || typeof weight !== "number" || !Number.isInteger(weight) || weight < -5 || weight > 5) {
    return NextResponse.json({ error: "thing_id + integer weight in −5..+5 required" }, { status: 400 });
  }

  const { error } = await sb.from("things").update({ editorial_weight: weight }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
```
- Tables: reads: none. writes: things(editorial_weight), audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing/invalid args and update error. Not handled: nonexistent thing_id still returns ok (zero-row update) [INFERRED]; audit_log insert unchecked [INFERRED].
# API endpoints, batch B: admin coverage + restock

Shared auth note: every route in this batch calls `getAdminUser()` from `lib/reviewServer.ts` (lines 29-33), which resolves the Supabase session user via `getServerSupabase()` then `sb.auth.getUser()`. It checks only that a logged-in Supabase user exists; there is no role/claim check in the helper itself, so "admin" is enforced by who holds accounts, not by a role column [INFERRED]. Every route returns `401 {"error":"unauthorized"}` to an unauthenticated request. All routes export `dynamic = "force-dynamic"`.

### API-09 - GET /api/admin/coverage/cell
- File: app/api/admin/coverage/cell/route.ts (23 lines)
- Auth: `getAdminUser()` Supabase session check; line 11: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 with body `{"error":"unauthorized"}`.
- Request: query params `dim` (string, anything other than "zone" coerces to "vibe"), `key` (string, required), `window` (number, must be one of 7|14|30|45 via `COVERAGE_WINDOWS`).
- Response: 200 `{ items: CoverageCellItem[] }` where each item is `{ id, title, tier, when, occurrences }`. Errors: 400 `{"error":"key required"}`, 400 `{"error":"window must be 7|14|30|45"}`, 401 `{"error":"unauthorized"}`.
- Logic: drilldown for one heatmap cell. `loadCoverageCell` (lib/coverageServer.ts) queries published, non-Tier-3 things (zone dim filters `nearby_zone` at the DB; vibe dim filters tags in-process), computes each thing's occurrence count inside the window via `occurrencesInWindow` (lib/occurrences.ts), drops zero-occurrence things, and sorts Tier 1 first, then by descending occurrences, then title.
- Complexity bar: yes (calculation feeding a ranked list; 3+ branches). Verbatim, lib/coverageServer.ts lines 97-113:
```ts
  const items: CoverageCellItem[] = [];
  for (const t of things) {
    const tier = Number(t.happening_tier);
    const occurrences = occurrencesInWindow(
      { happening_tier: tier, starts_at: t.starts_at, recurring: t.recurring_schedules ?? [] },
      window, now,
    );
    if (occurrences <= 0) continue;
    items.push({
      id: t.id, title: t.title, tier,
      when: whenString(tier, t.starts_at, t.recurring_schedules ?? []),
      occurrences,
    });
  }
  // Tier 1 (soonest) first, then Tier 2 by descending frequency in the window.
  items.sort((a, b) => a.tier - b.tier || b.occurrences - a.occurrences || a.title.localeCompare(b.title));
```
- Tables: reads: things(id, title, happening_tier, starts_at, nearby_zone, status), thing_tags(tag), recurring_schedules(day_of_week, start_time, end_time, frequency, label). writes: none.
- Errors: handles missing key, out-of-vocab window, unauthenticated. DB read failure is swallowed in the helper (console.error, returns []), so a Supabase outage is indistinguishable from an empty cell to the client [INFERRED]. Missing service-role client also returns [] silently [INFERRED].

### API-10 - POST /api/admin/coverage/neighborhood-sweep/apply
- File: app/api/admin/coverage/neighborhood-sweep/apply/route.ts (15 lines)
- Auth: `getAdminUser()` Supabase session check; line 12: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: no body, no query params.
- Response: 200 `{ updated: number, remaining: number }` (`remaining` = things still needing triage). 401 for unauthenticated. Never returns a non-200 for DB failures (see Errors).
- Logic: Doc 19 Phase 4 "Apply resolved". Loads all published things plus the `venue_neighborhoods` dictionary, runs the pure `resolveNeighborhood` waterfall (ingest/adapters/_shared/resolveNeighborhood.ts, no DB access inside) per thing, and for every result where `autoWrites(result)` is true (confidence >= 0.75, lines 164-166 of that file) and the method is not "existing", writes `things.neighborhood` and a recomputed `things.nearby_zone` (via `deriveNearbyZone`). Updates are grouped by identical (neighborhood, nearby_zone) target and bulk-applied in chunks of 500 ids. Idempotent: unchanged rows resolve as "existing" and are skipped.
- Complexity bar: yes (calculation feeding a publish-affecting write; 3+ branches). Verbatim, lib/neighborhoodSweepServer.ts lines 179-191:
```ts
  for (const t of things) {
    const input: ResolvableThing = {
      title: t.title, address: t.address, place_id: t.place_id, source_url: t.source,
      lat: t.lat, lng: t.lng, neighborhood: t.neighborhood as ResolvableThing["neighborhood"],
    };
    const result = resolveNeighborhood(input, dictionary);
    if (!autoWrites(result)) { remaining++; continue; }
    if (result.method === "existing" || !result.neighborhood) continue; // already correct, nothing to write

    const nearbyZone = deriveNearbyZone(result.neighborhood, t.lat, t.lng);
    const key = JSON.stringify([result.neighborhood, nearbyZone]);
    (byTarget.get(key) ?? byTarget.set(key, []).get(key)!).push(t.id);
  }
```
- Tables: reads: things(id, title, address, place_id, source, lat, lng, neighborhood, status), venue_neighborhoods(name, name_norm, neighborhood, place_id, aliases). writes: things(neighborhood, nearby_zone).
- Errors: read failures and missing admin client return `{ updated: 0, remaining: 0 }` with status 200, and per-chunk write failures are logged then skipped while later chunks continue, so partial failure reports an inflated-looking success and the client cannot distinguish "nothing to do" from "DB down" [INFERRED]. No audit_log entry is written for this bulk mutation [INFERRED].

### API-11 - GET, POST /api/admin/coverage/neighborhood-sweep/dictionary
- File: app/api/admin/coverage/neighborhood-sweep/dictionary/route.ts (32 lines)
- Auth: `getAdminUser()` Supabase session check on both methods; line 13 (GET) and line 21 (POST): `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: GET has no params. POST body JSON `{ name: string, zoneKey: string }`; `zoneKey` must be a `DOOR_ZONES` key; malformed JSON is caught (`req.json().catch(() => null)`).
- Response: GET 200 `{ venues: DictionaryEntry[] }` (each: name, neighborhood, zoneKey, zoneLabel, aliases, createdBy). POST 200 `{ ok: true }` or 500 `{ ok: false, error }` (status derived from `result.ok`); 400 `{"error":"invalid name or zoneKey"}`.
- Logic: GET lists the `venue_neighborhoods` dictionary sorted by neighborhood then name, mapping each row's neighborhood to its door zone. POST is the direct "Add a venue" row: normalizes the name to `name_norm` (lowercase, non-alphanumerics to spaces), maps the zoneKey to its canonical neighborhood, and upserts on `name_norm` so a manual add and a triage add of the same venue never duplicate.
- Complexity bar: yes (3+ conditional branches across handler + helper). Verbatim, lib/neighborhoodSweepServer.ts lines 273-283:
```ts
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "name is required" };

  const name_norm = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const neighborhood = canonicalNeighborhoodForZone(zoneKey);

  const { error } = await sb
    .from("venue_neighborhoods")
    .upsert({ name: trimmed, name_norm, neighborhood, created_by: "founder" }, { onConflict: "name_norm" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
```
- Tables: reads: venue_neighborhoods(name, neighborhood, aliases, created_by). writes: venue_neighborhoods(name, name_norm, neighborhood, created_by) upsert on name_norm.
- Errors: handles malformed JSON, invalid name/zoneKey, whitespace-only name, upsert failure (500 with the Supabase message). GET swallows read errors to an empty list [INFERRED]. `created_by` is hardcoded to "founder", not the authenticated user's id [INFERRED].

### API-12 - GET /api/admin/coverage/neighborhood-sweep
- File: app/api/admin/coverage/neighborhood-sweep/route.ts (14 lines)
- Auth: `getAdminUser()` Supabase session check; line 11: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: none (no params; the handler calls `runNeighborhoodSweep({ dry: true })` unconditionally).
- Response: 200 SweepSummary: `{ total, resolved, unresolved, autoResolveRate, byMethod: [{ method, count }], byZone: [{ key, label, count }], triage: SweepTriageItem[], generatedAt }`.
- Logic: read-only dry-run sweep. Loads all published things and the venue dictionary in parallel, resolves each thing through the `resolveNeighborhood` waterfall (methods in order: place_id, venue_name, source, point_in_polygon, street, existing, unresolved), counts per method and per door zone for auto-writable results (confidence >= 0.75), and builds a triage list for the rest, each with a suggested zone/neighborhood and a plausibility-filtered venue-name guess (street-suffixed short guesses like "E Cabrillo Blvd" are suppressed). Writes nothing regardless of the `dry` flag.
- Complexity bar: yes (multi-branch classification feeding the cockpit's triage/apply flow). Verbatim, lib/neighborhoodSweepServer.ts lines 85-97:
```ts
    if (autoWrites(result)) {
      resolved++;
      const zoneKey = doorZoneForNeighborhood(result.neighborhood);
      if (zoneKey) zoneCounts.set(zoneKey, (zoneCounts.get(zoneKey) ?? 0) + 1);
    } else {
      triage.push({
        id: t.id, title: t.title, address: t.address, source: t.source,
        suggestedZone: doorZoneForNeighborhood(result.neighborhood),
        suggestedNeighborhood: result.neighborhood,
        confidence: result.confidence, method: result.method,
        venueNameGuess: t.address ? plausibleVenueName(extractVenueNameFromAddress(t.address)) : null,
      });
    }
```
- Tables: reads: things(id, title, address, place_id, source, lat, lng, neighborhood, status), venue_neighborhoods(name, name_norm, neighborhood, place_id, aliases). writes: none.
- Errors: read failure on either query (or missing admin client) returns an all-zeros empty summary with status 200, logged server-side only, so the UI would show "0 things" on a DB outage [INFERRED].

### API-13 - POST /api/admin/coverage/neighborhood-sweep/triage
- File: app/api/admin/coverage/neighborhood-sweep/triage/route.ts (26 lines)
- Auth: `getAdminUser()` Supabase session check; line 13: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ id: string, zoneKey: string, venueName?: string }`; `zoneKey` must be a `DOOR_ZONES` key or the literal "other"; malformed JSON caught to null.
- Response: 200 `{ ok: true, neighborhood, addedToDictionary }` or 500 `{ ok: false, neighborhood: null, addedToDictionary: false, error }`; 400 `{"error":"invalid id or zoneKey"}`.
- Logic: one-tap triage assignment for a single thing. Reads the thing's lat/lng, maps the chosen zone to its canonical neighborhood ("other" writes neighborhood "other" and nearby_zone null), derives `nearby_zone`, and updates the thing. If `venueName` is provided and the zone is not "other", checks the dictionary by `name_norm` and inserts the venue (created_by "triage") when absent so future things with that venue self-resolve.
- Complexity bar: yes (writes two tables: things and venue_neighborhoods). Verbatim, lib/neighborhoodSweepServer.ts lines 240-254:
```ts
  const { error: updErr } = await sb.from("things").update({ neighborhood, nearby_zone }).eq("id", input.id);
  if (updErr) return { ok: false, neighborhood: null, addedToDictionary: false, error: updErr.message };

  let addedToDictionary = false;
  if (input.zoneKey !== "other" && input.venueName?.trim()) {
    const name = input.venueName.trim();
    const name_norm = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const { data: existing } = await sb.from("venue_neighborhoods").select("id").eq("name_norm", name_norm).maybeSingle();
    if (!existing) {
      const { error: insErr } = await sb
        .from("venue_neighborhoods")
        .insert({ name, name_norm, neighborhood, aliases: [], created_by: "triage" });
      if (!insErr) addedToDictionary = true;
      else console.error("[neighborhoodSweep] triage dictionary insert failed:", insErr.message);
    }
  }
```
- Tables: reads: things(id, lat, lng), venue_neighborhoods(id, filtered by name_norm). writes: things(neighborhood, nearby_zone), venue_neighborhoods(name, name_norm, neighborhood, aliases, created_by).
- Errors: handles malformed JSON, invalid id/zoneKey, thing-not-found ("thing not found"), read/update failure (500 with message). A dictionary insert failure is logged but the call still returns ok: true with addedToDictionary: false, so the client is not told the venue add failed beyond that flag [INFERRED]. The existence check plus insert is not atomic; a concurrent add could race, relying on the name_norm unique constraint to reject the duplicate as a logged error [INFERRED].

### API-14 - PATCH /api/admin/coverage/recurring-rhythms/[id]
- File: app/api/admin/coverage/recurring-rhythms/[id]/route.ts (53 lines)
- Auth: `getAdminUser()` Supabase session check; line 18: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: path param `id` (rhythm row id); partial JSON body, any subset of: title, venue, address, reasonToGo, sourceUrl (strings), neighborhood (must be in NEIGHBORHOODS), category (RECURRING_CATEGORIES), frequency (RECUR_FREQUENCIES), day (`{ dow: number 0-6, start?: string|null, end?: string|null }`), occasionTags (array filtered against OCCASION_TAGS, non-array coerces to null), active (boolean). Only keys present are written.
- Response: 200 `{ ok: true }` or 500 `{ ok: false, error }`; 400 for `{"error":"invalid JSON"}`, `"invalid neighborhood"`, `"invalid category"`, `"invalid frequency"`, `"invalid day of week"`, `"active must be a boolean"`.
- Logic: partial edit of one `recurring_rhythms` row (edit fields or just flip `active` to pause/resume). The helper builds a patch containing only the provided keys plus `updated_at`, mapping camelCase to snake_case (reasonToGo to reason_to_go, sourceUrl to source_url, day to a one-element `days` array, empty occasionTags to null). The nightly recurring-registry adapter reads the table live, so changes take effect without a deploy.
- Complexity bar: yes (5+ validation branches). Verbatim, app/api/admin/coverage/recurring-rhythms/[id]/route.ts lines 27-40:
```ts
  if (body.category !== undefined && !CATEGORY_SET.has(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  if (body.frequency !== undefined && !FREQUENCY_SET.has(body.frequency)) {
    return NextResponse.json({ error: "invalid frequency" }, { status: 400 });
  }
  if (body.day !== undefined) {
    if (typeof body.day?.dow !== "number" || body.day.dow < 0 || body.day.dow > 6) {
      return NextResponse.json({ error: "invalid day of week" }, { status: 400 });
    }
  }
  if (body.active !== undefined && typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
  }
```
- Tables: reads: none (beyond the auth session). writes: recurring_rhythms(title, venue, address, neighborhood, category, reason_to_go, frequency, source_url, days, occasion_tags, active, updated_at).
- Errors: handles malformed JSON, vocab violations, bad dow, non-boolean active, DB update failure (500 with message). Unlike the POST route (API-15), `day.start`/`day.end` types are NOT validated here, and string fields (title, venue, etc.) are passed through without a typeof check, so a non-string title would throw on `.trim()` inside the helper and surface as an unhandled 500 [INFERRED]. An unknown `id` still returns ok: true because Supabase update-with-no-matching-rows is not an error [INFERRED].

### API-15 - GET, POST /api/admin/coverage/recurring-rhythms
- File: app/api/admin/coverage/recurring-rhythms/route.ts (49 lines)
- Auth: `getAdminUser()` Supabase session check on both methods; line 17 (GET) and line 26 (POST): `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: GET has no params. POST body JSON: title, venue, address, reasonToGo, sourceUrl (required strings), neighborhood/category/frequency (required, validated against NEIGHBORHOODS/RECURRING_CATEGORIES/RECUR_FREQUENCIES), day (`{ dow: number 0-6, start?: string|null, end?: string|null }`, start/end type-checked when non-null), occasionTags (optional array, filtered against OCCASION_TAGS, else null).
- Response: GET 200 `{ rhythms: RecurringRhythmRow[] }` (all rows, active first then by title). POST 200 `{ ok: true }` or 500 `{ ok: false, error }`; 400 for invalid JSON, the string-fields message, `"invalid neighborhood"`, `"invalid category"`, `"invalid frequency"`, `"invalid day of week"`, `"invalid start time"`, `"invalid end time"`.
- Logic: GET lists every `recurring_rhythms` row for the cockpit (active and inactive). POST adds a new rhythm: trims required strings, derives a `slug` via `slugifyVenueKey(title)`, wraps the single day into a `days` array, and inserts with `active: true` so the next nightly registry run picks it up with no deploy.
- Complexity bar: yes (8+ validation branches). Verbatim, app/api/admin/coverage/recurring-rhythms/route.ts lines 35-41:
```ts
  if (!NEIGHBORHOOD_SET.has(neighborhood)) return NextResponse.json({ error: "invalid neighborhood" }, { status: 400 });
  if (!CATEGORY_SET.has(category)) return NextResponse.json({ error: "invalid category" }, { status: 400 });
  if (!FREQUENCY_SET.has(frequency)) return NextResponse.json({ error: "invalid frequency" }, { status: 400 });
  if (typeof day?.dow !== "number" || day.dow < 0 || day.dow > 6) return NextResponse.json({ error: "invalid day of week" }, { status: 400 });
  if (day.start != null && typeof day.start !== "string") return NextResponse.json({ error: "invalid start time" }, { status: 400 });
  if (day.end != null && typeof day.end !== "string") return NextResponse.json({ error: "invalid end time" }, { status: 400 });
  const tags = Array.isArray(occasionTags) ? occasionTags.filter((t) => TAG_SET.has(t)) : null;
```
- Tables: reads: recurring_rhythms(all columns via `select("*")`). writes: recurring_rhythms(slug, title, venue, address, neighborhood, category, reason_to_go, frequency, source_url, days, occasion_tags, active).
- Errors: handles malformed JSON, missing/wrong-typed required strings, vocab violations, bad day shape, whitespace-only required fields (helper-level "title, venue, address, and source URL are required"), insert failure (500 with message). GET swallows read errors to an empty list [INFERRED]. Duplicate slugs are not checked before insert; behavior depends on whether the DB has a unique constraint on slug [INFERRED].

### API-16 - GET /api/admin/coverage
- File: app/api/admin/coverage/route.ts (14 lines)
- Auth: `getAdminUser()` Supabase session check; line 10: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: query param `dim` (string; anything other than "zone" coerces to "vibe").
- Response: 200 `{ dim, rows: [{ key, label, evergreen, windows: { 7, 14, 30, 45 } }], generatedAt }`.
- Logic: the Coverage heatmap aggregation. `loadCoverage` (lib/coverageServer.ts) runs one query over all published things (with tags and recurring schedules embedded), initializes a row per vocabulary key (occasion tags for vibe, zones for zone), then for each thing computes its occurrence count per window via `occurrencesByWindow` and adds it to every row the thing belongs to. Tier-3 things increment `evergreen` instead of window counts. Keys outside the fixed vocabulary are skipped. The red/amber/green shading itself happens client-side in `shadeColumn` (lib/coverage.ts) using column percentiles plus absolute floors (COVERAGE_FLOORS = { 7: 3, 14: 5, 30: 8, 45: 10 }).
- Complexity bar: yes (aggregation calculation feeding the restock/coverage decision surface; 3+ branches). Verbatim, lib/coverageServer.ts lines 62-74:
```ts
  for (const t of things) {
    const tier = Number(t.happening_tier);
    const occ = occurrencesByWindow(
      { happening_tier: tier, starts_at: t.starts_at, recurring: t.recurring_schedules ?? [] },
      now,
    );
    for (const key of thingKeys(dim, t)) {
      const row = rows[key];
      if (!row) continue; // a tag/zone outside the fixed vocabulary, skip
      if (tier === 3) { row.evergreen += 1; continue; }
      for (const w of COVERAGE_WINDOWS) row.windows[w] += occ[w];
    }
  }
```
- Tables: reads: things(id, title, happening_tier, starts_at, nearby_zone, status), thing_tags(tag), recurring_schedules(day_of_week, start_time, end_time, frequency, label). writes: none.
- Errors: DB read failure and missing admin client both return `{ dim, rows: [], generatedAt }` with status 200 (logged server-side), so the heatmap silently renders empty on an outage [INFERRED].

### API-17 - PATCH /api/admin/coverage/sources/[key]
- File: app/api/admin/coverage/sources/[key]/route.ts (37 lines)
- Auth: `getAdminUser()` Supabase session check; line 16: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: path param `key` (the sources row key); partial JSON body, any subset of: label (string), url (string|null), authority (number, helper-enforced 0-1), crawl_frequency (must be in SOURCE_FREQUENCIES: nightly|weekly|reserve), status (SOURCE_STATUSES: active|paused|retired|candidate), notes (string|null). Only keys present are written.
- Response: 200 `{ ok: true }` or 500 `{ ok: false, error }`; 400 for `{"error":"invalid JSON"}`, `"invalid status"`, `"invalid crawl_frequency"`, `"authority must be a number"`; helper-level 500 `"authority must be between 0 and 1"` (returned with status 500 because the route derives status from `result.ok`).
- Logic: partial edit of one `sources` row: rename, change URL, tune authority, change crawl frequency, or flip status (pause/resume/retire). `updateSource` builds a snake_case patch plus `updated_at` and updates by key. The nightly orchestrator and dedupe read this table live, so status/authority changes apply on the next run with no deploy.
- Complexity bar: yes (3+ conditional branches across handler + helper). Verbatim, lib/sourcesServer.ts lines 118-131:
```ts
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (edit.label !== undefined) patch.label = edit.label.trim();
  if (edit.url !== undefined) patch.url = edit.url?.trim() || null;
  if (edit.authority !== undefined) {
    if (edit.authority < 0 || edit.authority > 1) return { ok: false, error: "authority must be between 0 and 1" };
    patch.authority = edit.authority;
  }
  if (edit.crawl_frequency !== undefined) patch.crawl_frequency = edit.crawl_frequency;
  if (edit.status !== undefined) patch.status = edit.status;
  if (edit.notes !== undefined) patch.notes = edit.notes?.trim() || null;

  const { error } = await sb.from("sources").update(patch).eq("key", key);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
```
- Tables: reads: none (beyond the auth session). writes: sources(label, url, authority, crawl_frequency, status, notes, updated_at).
- Errors: handles malformed JSON, invalid status/crawl_frequency, non-number authority, out-of-range authority, DB update failure. The out-of-range authority case is a validation error but surfaces as 500, not 400 [INFERRED]. An unknown key returns ok: true (update matches zero rows without error) [INFERRED]. `label` is not typeof-checked, so a non-string label would throw on `.trim()` and produce an unhandled 500 [INFERRED].

### API-18 - GET, POST /api/admin/coverage/sources
- File: app/api/admin/coverage/sources/route.ts (38 lines)
- Auth: `getAdminUser()` Supabase session check on both methods; line 12 (GET) and line 21 (POST): `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: GET has no params. POST body JSON: key (string, helper-enforced `/^[a-zA-Z0-9_-]+$/`), label (string), url (optional string, "" allowed), authority (number, helper-enforced 0-1), lane (must be in SOURCE_LANES: structured|generic|render).
- Response: GET 200 `{ sources: SourceRow[] }` (14 columns per row). POST 200 `{ ok: true }` or 500 `{ ok: false, error }`; 400 for invalid JSON, `"key and label must be strings"`, `"authority must be a number"`, `"invalid lane"`, `"invalid url"`.
- Logic: GET lists every `sources` row for the management page, sorted so flagged rows surface first: an active source whose `sourceHealth()` is "below_baseline" sorts above everything, then by status group (active, paused, candidate, retired), then alphabetically by label. POST registers a candidate source: trims key/label, validates key charset and authority range, and inserts with `status: "candidate"`; the row is tracked but nothing crawls it until a code adapter or the future generic lane reads that key.
- Complexity bar: yes (health calculation feeding the ranked list; 3+ branches). Verbatim, lib/sourcesServer.ts lines 62-70:
```ts
  const groupOrder: Record<string, number> = { active: 0, paused: 1, candidate: 2, retired: 3 };
  return rows.sort((a, b) => {
    const aFlagged = a.status === "active" && sourceHealth(a) === "below_baseline";
    const bFlagged = b.status === "active" && sourceHealth(b) === "below_baseline";
    if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
    const byGroup = (groupOrder[a.status] ?? 9) - (groupOrder[b.status] ?? 9);
    if (byGroup) return byGroup;
    return a.label.localeCompare(b.label);
  });
```
- Tables: reads: sources(key, label, url, lane, parse_method, authority, crawl_frequency, expected_yield, last_yield, last_ok_at, consecutive_empty, reliability, status, notes). writes: sources(key, label, url, authority, lane, status).
- Errors: handles malformed JSON, wrong-typed key/label/authority/url, invalid lane, empty key/label after trim, bad key charset, out-of-range authority, insert failure (500 with message, which is also how a duplicate key surfaces via the DB constraint [INFERRED]). GET swallows read errors to an empty list [INFERRED].

### API-41 - GET /api/admin/restock/list
- File: app/api/admin/restock/list/route.ts (21 lines)
- Auth: `getAdminUser()` Supabase session check; line 10: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: none.
- Response: 200 `{ directives: [...] }` (newest 12 by requested_at, each: id, scope_kind, scope_key, window_days, status, run_note, requested_at). Degraded: 200 `{ directives: [] }` when no admin client, or 200 `{ directives: [], note: "restock_directives unavailable" }` on any query error.
- Logic: reads the 12 most recent restock directives for the cockpit rail, newest first. Deliberately degrades to an empty list instead of a 500 because the `restock_directives` table may not exist yet (migration pending).
- Complexity bar: yes (3 conditional branches, meeting the mechanical bar, though each is a simple guard). Verbatim, app/api/admin/restock/list/route.ts lines 11-20:
```ts
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ directives: [] });

  const { data, error } = await sb.from("restock_directives")
    .select("id, scope_kind, scope_key, window_days, status, run_note, requested_at")
    .order("requested_at", { ascending: false })
    .limit(12);
  // Table may not exist yet (migration pending), degrade to empty rather than 500.
  if (error) return NextResponse.json({ directives: [], note: "restock_directives unavailable" });
  return NextResponse.json({ directives: data ?? [] });
```
- Tables: reads: restock_directives(id, scope_kind, scope_key, window_days, status, run_note, requested_at). writes: none.
- Errors: handles missing admin client and any query error (including missing table) by returning an empty list with 200. Because ALL errors collapse to the same degraded response, a genuine DB failure is indistinguishable from the pending-migration case [INFERRED].

### API-42 - POST /api/admin/restock
- File: app/api/admin/restock/route.ts (88 lines)
- Auth: `getAdminUser()` Supabase session check; line 46: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated: 401 `{"error":"unauthorized"}`.
- Request: JSON body `{ scope_kind: "vibe"|"zone", scope_key: string, window_days: number, when: "tonight"|"now" }`. scope_key is validated against OCCASION_TAGS (vibe) or the ZONES zone keys (zone); window_days must be one of 7|14|30|45; any `when` other than "now" is treated as "tonight".
- Response: tonight path 200 `{ ok: true, id }`. now path success 200 `{ ok: true, id, dispatched: true }`; now path dispatch failure 502 `{ ok: false, id, queued: true, error }` (directive stays queued for tonight). Errors: 400 `{"error":"scope_kind must be vibe|zone"}`, 400 `` {"error":"unknown <kind> key"} ``, 400 `{"error":"window_days must be 7|14|30|45"}`, 500 `{"error":"not configured"}` (no admin client), 500 `{ error: <supabase message> }` on insert failure.
- Logic: queues a restock directive the ingest worker consumes, and optionally fires it immediately.
  - Tonight path (default): validates scope_kind/scope_key/window_days, inserts a `restock_directives` row with `status: "queued"`, writes an `audit_log` row (action "restock_request", actor "founder", payload with the scope and when), and returns the new id. The nightly ingest run consumes queued directives.
  - Now path (`when: "now"`, C2b): after the same insert + audit, calls `dispatchRunNow(directiveId)`, which POSTs to the GitHub REST API `https://api.github.com/repos/{repo}/actions/workflows/{workflow}/dispatches` with `{ ref, inputs: { directive_id } }` to trigger the ingest workflow's Run-now pass. Env vars: `GITHUB_DISPATCH_TOKEN` (required, server-only Bearer token; missing token returns a dispatch error without calling GitHub), `GITHUB_REPO` (default "JWest1212/sb-daymaker"), `GITHUB_WORKFLOW_FILE` (default "ingest.yml"), `GITHUB_WORKFLOW_REF` (default "main"). GitHub returning 204 counts as success: the directive is updated to `status: "running"` with `started_at`, and the client gets `dispatched: true`. Any dispatch failure (no token, non-204, network error) leaves the directive queued so tonight's run still consumes it, and returns 502 with the error text (GitHub body truncated to 180 chars).
- Complexity bar: yes (writes two tables plus a conditional third write; 6+ branches; external dispatch). Verbatim, app/api/admin/restock/route.ts lines 75-87:
```ts
  // Run-now: dispatch the workflow immediately. On success mark it running; on
  // failure leave it queued (tonight's run still consumes it) and tell the client.
  if (when === "now") {
    const dispatch = await dispatchRunNow(data.id);
    if (dispatch.ok) {
      await sb.from("restock_directives")
        .update({ status: "running", started_at: new Date().toISOString() }).eq("id", data.id);
      return NextResponse.json({ ok: true, id: data.id, dispatched: true });
    }
    return NextResponse.json({ ok: false, id: data.id, queued: true, error: dispatch.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: data.id });
```
- Tables: reads: restock_directives(id, via the insert's `.select("id").single()`). writes: restock_directives(scope_kind, scope_key, window_days, status; and on the now path status, started_at), audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles invalid scope_kind/scope_key/window_days, missing admin client, directive insert failure, missing dispatch token, GitHub non-204, and network errors during dispatch. Not handled: `await req.json()` at line 50 has no catch (unlike the other routes in this batch), so a malformed body throws and surfaces as an unhandled 500 instead of a 400 [INFERRED]. The audit_log insert result is not checked; an audit failure is silent [INFERRED]. If the post-dispatch status update to "running" fails, GitHub is already running the pass but the row still says queued, so tonight's run could consume it a second time [INFERRED]. Memory notes GITHUB_DISPATCH_TOKEN is not yet provisioned, so the now path currently always returns 502 with "GITHUB_DISPATCH_TOKEN is not configured on the server" [INFERRED].
# API endpoints, group C: admin edition cockpit (/api/admin/editions/*)

Shared auth mechanism for every route in this group: `getAdminUser()` from `lib/reviewServer.ts` (lines 29-33), which resolves the Supabase session user from cookies via `getServerSupabase().auth.getUser()`. There is no role check beyond "a logged-in Supabase user exists" [INFERRED: any authenticated Supabase user would pass; in practice the only account is the founder's]. All DB work then runs on the service-role client from `getAdminSupabase()` (`lib/supabaseAdmin.ts` lines 9-16, `SUPABASE_SECRET_KEY`), bypassing RLS. Several routes fold the two checks into one `requireAdmin()` helper that returns null for BOTH "not logged in" and "env not configured", so a missing `SUPABASE_SECRET_KEY` also surfaces as 401 on those routes (noted per route).

### API-20 - POST /api/admin/editions/[id]/picks/[pickId]/blurb-edit
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/[id]/picks/[pickId]/blurb-edit/route.ts (106 lines)
- Auth: `getAdminUser()`; line 54: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }`.
- Request: JSON body `{ instruction?: string; currentBlurb?: string }`. `instruction` is required (trimmed, non-empty); `currentBlurb` is optional and passed to the model as context (`"(empty)"` when absent). Path params: edition `id`, `pickId`.
- Response: 200 `{ ok: true, blurb: string }`. Errors: 400 `{ error: "an instruction is required" }`; 400 `{ error: "edition is <status>, no longer editable" }`; 404 `{ error: "edition not found" | "pick not found" | "thing not found" }`; 500 `{ error: "not configured" | "AI not configured" }`; 502 `{ error: "Claude did not return a revision" | "Claude returned an empty blurb" | "AI edit failed: <msg>" }`.
- Logic: AI-assisted blurb rewrite for one pick. Verifies the edition is still editable (status in draft/approved/skipped), loads the pick's slot and underlying thing (title + happening_category), then makes a single Anthropic call: model `claude-haiku-4-5` (line 9, const `MODEL`), key from `process.env.ANTHROPIC_API_KEY` (line 76, 500 "AI not configured" if unset), `max_tokens: 400`, `maxRetries: 1`, `timeout: 60_000`. The system prompt (lines 16-29) enforces the house voice ("a knowing local friend"), bans em dashes outright, forbids inventing facts, and instructs the model to apply ONLY the operator's instruction at a slot-dependent target length (`targetLengthFor`: hero gets "2 to 4 sentences", every other slot "1 to 2 sentences, about 24 words or fewer"). Output is forced through a strict tool call (`tool_choice: { type: "tool", name: "revise_blurb" }` with `strict: true` schema `{ blurb: string }`). The revised blurb is returned to the client only; NOTHING is written to the DB here - the cockpit UI is expected to save it via API-23's PATCH [INFERRED from the route writing no tables].
- Complexity bar: yes (6 conditional early-return branches plus the AI call). Verbatim excerpt, app/api/admin/editions/[id]/picks/[pickId]/blurb-edit/route.ts lines 81-94:
```ts
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      tools: [reviseBlurbTool],
      tool_choice: { type: "tool", name: "revise_blurb" },
      messages: [{
        role: "user",
        content: `Listing: "${thing.title}" (${thing.happening_category})\n` +
          `Slot: ${pick.slot}, target length: ${targetLengthFor(pick.slot as EditionSlot)}\n` +
          `Current blurb: ${currentBlurb?.trim() || "(empty)"}\n` +
          `Operator instruction: ${instruction.trim()}`,
      }],
    });
```
- Tables: reads: editions(status), edition_picks(slot, thing_id), things(title, happening_category); writes: none. External: Anthropic Messages API.
- Errors: handles missing instruction, non-editable/missing edition, missing pick, missing thing, missing API key, model returning no tool_use block or an empty blurb, and any thrown Anthropic error (caught, 502 with message). Not handled: malformed JSON body throws before validation and surfaces as an unhandled 500 [INFERRED]; the returned blurb is not scanned for em dashes server-side despite the prompt ban [INFERRED].

### API-21 - POST /api/admin/editions/[id]/picks/[pickId]/find-more-images
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/[id]/picks/[pickId]/find-more-images/route.ts (43 lines)
- Auth: `getAdminUser()`; line 17: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }`.
- Request: no body (the `Request` arg is `_req`, unread). Path params: edition `id` (unused beyond routing - the pick is looked up by `pickId` alone), `pickId`.
- Response: 200 `{ ok: true, photo_options: ImageOption[] }`. Errors: 404 `{ error: "pick not found" | "thing not found" }`; 500 `{ error: "not configured" }` or `{ error: <update error message> }`.
- Logic: on-demand image candidate discovery for a pick's underlying thing. Loads the pick's `thing_id`, then the thing's neighborhood/category/photo_options, and calls `discoverMoreImages()` (lib/edition/imageDiscovery.ts), which loops over `discoveryQueries()` angles and feeds each round into `findMoreOptions()` (ingest/images.ts line 594): a Wikimedia title search per query (free source only, no Google/Pexels), deduped against existing options and re-ranked by `rankOptions()`. The merged list is persisted onto the CANONICAL `things.photo_options` (deliberately catalog-wide, unlike the edition-scoped overrides everywhere else in this group - the file comment at lines 8-14 calls this out). Note: it does NOT check the pick belongs to the edition in the URL, and does not check edition status, so this works even on picks of sent editions [INFERRED, benign since it only widens the thing's option list].
- Complexity bar: yes (a discovery loop whose ranked result is persisted, plus 4 conditional returns). Verbatim excerpt, app/api/admin/editions/[id]/picks/[pickId]/find-more-images/route.ts lines 33-42:
```ts
  const options = await discoverMoreImages({
    neighborhood: thing.neighborhood,
    happening_category: thing.happening_category,
    photo_options: thing.photo_options ?? [],
  });

  const { error: upErr } = await sb.from("things").update({ photo_options: options }).eq("id", thing.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, photo_options: options });
}
```
- Tables: reads: edition_picks(thing_id), things(id, neighborhood, happening_category, photo_options); writes: things(photo_options). External: Wikimedia API (title search); no image_cache/image_spend involvement on this path.
- Errors: handles missing pick, missing thing, update failure. Not handled: a Wikimedia fetch failure inside `wikimediaTitleSearch` could throw and surface as an unhandled 500 [INFERRED]; no edition-status guard (see Logic) [INFERRED].

### API-22 - POST /api/admin/editions/[id]/picks/[pickId]/image
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/[id]/picks/[pickId]/image/route.ts (84 lines)
- Auth: `requireAdmin()` (lines 8-11 combine `getAdminUser()` + `getAdminSupabase()`); line 40: `if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }` (missing service-role env also 401s here, conflated).
- Request: content-type dispatch. JSON branch: `{ url?: string }`, must match `/^https:\/\//`. Multipart branch: `form-data` with a `file` field (a `File`), max 8MB (`MAX_BYTES = 8 * 1024 * 1024`), type must be one of image/jpeg, image/png, image/webp, image/gif (`EXT_BY_TYPE`). Any other content-type: 400.
- Response: 200 `{ ok: true, url: string }` (the hosted/public URL actually saved). Errors: 400 `{ error: "a valid https:// URL is required" | "file required" | "file too large (max 8MB)" | "unsupported image type (jpeg/png/webp/gif only)" | "unsupported content-type" | "edition is <status>, no longer editable" }`; 404 `{ error: "edition not found" }`; 500 `{ error: <supabase error message> }`.
- Logic: sets a pick's `override_image_url` one of two ways after the shared editable-status guard. JSON path: the pasted URL is re-hosted via `rehostImage()` (lib/edition/imageHost.ts) - it fetches the source (15s timeout), validates content-type and the same 8MB cap, uploads to the `edition-media` storage bucket at `sources/<sha256(sourceUrl) first 24 hex>.<ext>` (dedup by source-URL hash, `upsert: true`), and returns the public URL; on ANY failure (network, bad type, oversized, upload error) it returns the original URL unchanged, and the route falls back to storing the raw URL (`(await rehostImage(sb, url)) ?? url`), so a hotlink is accepted rather than blocking. URLs already under `/storage/v1/object/public/edition-media/` are passed through untouched. Multipart path: the uploaded file is written to `edition-media` at `<editionId>/<pickId>-<Date.now()>.<ext>` and its public URL stored. Both paths end in `setOverride()`, which updates `edition_picks` (scoped by both `pickId` AND `edition_id`) setting `override_image_url` and `is_manual: true`.
- Complexity bar: yes (dual-format branching, ~8 conditional branches, plus a storage write feeding the published email image). Verbatim excerpt, app/api/admin/editions/[id]/picks/[pickId]/image/route.ts lines 49-60:
```ts
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const { url } = (await req.json()) as { url?: string };
    if (!url || !/^https:\/\//.test(url)) {
      return NextResponse.json({ error: "a valid https:// URL is required" }, { status: 400 });
    }
    const hostedUrl = (await rehostImage(sb, url)) ?? url;
    const error = await setOverride(sb, editionId, pickId, hostedUrl);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, url: hostedUrl });
  }
```
- Tables: reads: editions(status); writes: edition_picks(override_image_url, is_manual). Storage: uploads to bucket edition-media (paths `sources/<hash>.<ext>` via rehostImage, or `<editionId>/<pickId>-<ts>.<ext>` for direct uploads).
- Errors: handles missing/invalid URL, missing/oversized/wrong-type file, unsupported content-type, non-editable/missing edition, upload and update failures; rehost failures degrade silently to the source URL. Not handled: a `pickId` that doesn't exist (or belongs to another edition) makes `setOverride` update zero rows but still returns `{ ok: true }` [INFERRED]; the SSRF surface of fetching an arbitrary admin-supplied https URL server-side is unmitigated beyond the scheme check [INFERRED, admin-only].

### API-23 - PATCH /api/admin/editions/[id]/picks/[pickId]
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/[id]/picks/[pickId]/route.ts (51 lines)
- Auth: `requireAdmin()` (lines 7-10); line 30: `if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }` (missing service-role env conflated into the same 401).
- Request: JSON body `PatchBody`: `override_title?`, `override_blurb?`, `override_when?`, `override_neighborhood?`, `override_local_note?`, `override_image_url?` (each `string | null`, null clears the override back to the thing's own field) and `position?: number`. Only keys present (`!== undefined`) are applied.
- Response: 200 `{ ok: true }`. Errors: 400 `{ error: "edition is <status>, no longer editable" }`; 404 `{ error: "edition not found" }`; 500 `{ error: <supabase error message> }`.
- Logic: edits one pick's edition-scoped overrides and/or render position. After the editable-status guard, builds an update object starting from `{ is_manual: true }` (any edit flips the manual flag), copies over only the whitelisted keys that appear in the body, and updates `edition_picks` scoped by `pickId` AND `edition_id`. The canonical `things` row is never touched (spec §4 comment, lines 22-24). Overrides are resolved at render time by `renderData.ts`'s `override_* ?? thing.field` pattern.
- Complexity bar: yes (status guard + per-key conditional copy loop + scoped write; 3+ branches). Verbatim excerpt, app/api/admin/editions/[id]/picks/[pickId]/route.ts lines 39-50:
```ts
  const body = (await req.json()) as PatchBody;
  const update: Record<string, unknown> = { is_manual: true };
  for (const key of [
    "override_title", "override_blurb", "override_when",
    "override_neighborhood", "override_local_note", "override_image_url", "position",
  ] as const) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { error } = await sb.from("edition_picks").update(update).eq("id", pickId).eq("edition_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
```
- Tables: reads: editions(status); writes: edition_picks(is_manual, override_title, override_blurb, override_when, override_neighborhood, override_local_note, override_image_url, position).
- Errors: handles missing/non-editable edition and DB update failure. Not handled: an empty body still writes `is_manual: true` (no "no fields" guard, unlike API-25) [INFERRED]; a nonexistent pickId updates zero rows and still returns `{ ok: true }` [INFERRED]; no type validation of field values (a non-number `position` would be rejected only by Postgres) [INFERRED]; malformed JSON surfaces as unhandled 500 [INFERRED].

### API-24 - GET /api/admin/editions/[id]/preview
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/[id]/preview/route.ts (29 lines)
- Auth: `getAdminUser()`; line 15: `if (!user) return new NextResponse("unauthorized", { status: 401 });`. Unauthenticated request receives 401 with plain-text body `unauthorized` (NOT JSON - this route returns HTML/text throughout).
- Request: no query or body; path param edition `id`.
- Response: 200, `content-type: text/html; charset=utf-8`, the full rendered edition email HTML. Errors: 404 plain text `not found` (edition id unknown, or its date fails to render); 500 plain text `not configured`.
- Logic: the cockpit iframe's live preview. Resolves the edition id to its `edition_date`, then calls `loadRenderableEdition(sb, ed.edition_date, { siteUrl }, true)` (lib/edition/renderData.ts) - the SAME loader+renderer the public permalink and the send path use, never forked (spec §5.1 per the file comment). The trailing `true` is `allowAnyStatus`, which drops the `status='sent'` filter so drafts preview; the admin gate is what makes that safe. The loader applies the `override_* ?? thing.field` fallback per pick, computes labels from `EDITION_CONFIG`, and `renderEditionEmailHtml()` (lib/edition/render.ts, pure, no DB) produces the HTML. `siteUrl` comes from `NEXT_PUBLIC_SITE_URL` defaulting to `https://www.sbdaymaker.com`. No unsubscribe token is passed, so the preview renders without a personal unsubscribe URL.
- Complexity bar: yes (the override-resolution calculation in the shared loader feeds publishing/sending). Verbatim excerpt, lib/edition/renderData.ts lines 90-104:
```ts
function toRenderPick(row: PickRow, siteUrl: string): RenderPick {
  const t = row.things;
  return {
    thingId: row.thing_id,
    title: row.override_title ?? t.title,
    blurb: row.override_blurb ?? blurbSourceFor(row.slot, t),
    when: row.override_when ?? whenString(t.happening_tier, t.starts_at, t.recurring_schedules ?? []),
    neighborhood: row.override_neighborhood ?? (t.neighborhood ? titleCaseNeighborhood(t.neighborhood) : null),
    localNote: row.override_local_note ?? t.local_note,
    imageUrl: row.override_image_url ?? row.cached_image_url,
    imageAttribution: t.photo_attribution,
    dayLabel: row.slot === "secondary" ? dayLabelFor(t) : null,
    href: `${siteUrl}/thing/${row.thing_id}`,
  };
}
```
- Tables: reads: editions(edition_date by id, then * by edition_date), edition_picks(slot, position, thing_id, override_title, override_blurb, override_when, override_neighborhood, override_local_note, override_image_url, cached_image_url) with embedded things(title, blurb, blurb_long, local_note, reason_to_go, neighborhood, starts_at, happening_tier, photo_attribution) and recurring_schedules(day_of_week, label, start_time, end_time, frequency); writes: none.
- Errors: handles missing edition (both lookups) and missing env. Not handled: a picks-select failure inside `loadRenderableEdition` throws (`renderData: picks select failed`) and surfaces as an unhandled 500 [INFERRED]; two editions could theoretically share id-vs-date lookups inconsistently only if edition_date were non-unique, which the loader's `.maybeSingle()` assumes it is [INFERRED].

### API-25 - GET, PATCH /api/admin/editions/[id]
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/[id]/route.ts (87 lines)
- Auth: `requireAdmin()` (lines 10-13); GET line 17 and PATCH line 44, identical: `if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }` (missing service-role env conflated into the same 401).
- Request: GET: none. PATCH: JSON body `PatchBody`: `subject?: string`, `preheader?: string`, `greeting?: string`, `status?: "approved" | "skipped" | "draft"`, `skip_reason?: string`.
- Response: GET: 200 `{ edition: EditionDraftDetail }` (full edition row fields plus `picks[]` and `candidates[]`, each with an embedded cockpit-shaped thing); 404 `{ error: "not found" }`. PATCH: 200 `{ ok: true }` or, when the approval triggers an immediate send, 200 `{ ok: true, sent: SendResult }` where SendResult is `{ ok, sent, skipReason? }`; 400 `{ error: "edition is <status>, no longer editable" | "invalid status" | "no fields to update" }`; 404 `{ error: "not found" }`; 500 `{ error: <supabase error message> }`.
- Logic: GET loads the full cockpit detail via `loadEditionDraftDetail()` (lib/edition/cockpitServer.ts): the edition row, its picks (ordered slot, position) and its ranked candidate bench (ordered slot, rank), each with the joined thing shaped by `toCockpitThing` (title-cased neighborhood, retired photo options dropped, `whenString` computed). PATCH edits chrome fields and/or moves status among draft/approved/skipped only ('sent' and 'failed' are immutable here). Approving stamps `approved_at`; resetting to draft clears `approved_at` AND `skip_reason` (a clean slate that also re-arms the automatic drafter, which only overwrites while status='draft'). Every successful PATCH appends an `audit_log` row (action `edition_<status>` or `edition_edit`, actor `founder`, payload = the update). The headline behavior: approving an edition whose normal send window (14:00 UTC on its own edition_date, `SEND_HOUR_UTC` in lib/edition/window.ts) has already passed triggers `sendEdition()` immediately in this request - otherwise it would wait forever, because the send cron only ever sends "today's" edition and never revisits a past date. `scheduledSendPassed` (window.ts lines 65-68) is: `const scheduledAt = Date.parse(`${editionDateKey}T${String(SEND_HOUR_UTC).padStart(2, "0")}:00:00Z`); return now >= scheduledAt;`. `sendEdition()` (lib/edition/send.ts) re-checks eligibility (only draft/approved send; skipped is an explicit hold), renders ONCE with an unsubscribe sentinel token, loads all `status='confirmed'` subscribers, sends in batches of 100 via Resend with per-recipient sentinel substitution and List-Unsubscribe headers, then marks the edition sent (status, sent_at, sent_count, resend_broadcast_id).
- Complexity bar: yes (status machine with 3+ branches, writes to editions + audit_log, and a send trigger). Verbatim excerpt, app/api/admin/editions/[id]/route.ts lines 73-86:
```ts
  const { error } = await sb.from("editions").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "edition", entity_id: id, action: body.status ? `edition_${body.status}` : "edition_edit",
    actor: "founder", payload: update,
  });

  if (body.status === "approved" && scheduledSendPassed(current.edition_date)) {
    const sendResult = await sendEdition(sb, current.edition_date);
    return NextResponse.json({ ok: true, sent: sendResult });
  }

  return NextResponse.json({ ok: true });
```
- Tables: GET reads: editions(*), edition_picks(id, slot, position, thing_id, override_* x6, cached_image_url, is_manual) with things join (id, title, blurb, blurb_long, neighborhood, photo_url, photo_options, happening_tier, starts_at) and recurring_schedules join, edition_candidates(slot, rank, selected, thing_id) with the same things join. PATCH reads: editions(status, edition_date); writes: editions(subject, preheader, greeting, skip_reason, status, approved_at), audit_log(entity_type, entity_id, action, actor, payload). When the immediate send fires, additionally via sendEdition/loadRenderableEdition: reads editions(id, status; then *), edition_picks + things + recurring_schedules (renderer columns), subscribers(email, unsubscribe_token where status='confirmed'); writes editions(status, sent_at, sent_count, resend_broadcast_id). External: Resend batch email API.
- Errors: handles missing/immutable edition, invalid status value, empty update, DB update failure; sendEdition degrades to a SendResult with `skipReason` rather than throwing for ineligible/unrenderable editions. Not handled: the audit_log insert error is ignored (unchecked) [INFERRED]; a Resend batch failure is silently reflected only in `resend_broadcast_id` id count while `sent_count` still records all recipients [INFERRED]; sendEdition re-reads the edition by date, so if the status update above set 'approved' the re-check passes, but a concurrent cron send could double-send in a race [INFERRED]; malformed JSON surfaces as unhandled 500 [INFERRED].

### API-26 - GET /api/admin/editions/[id]/search-things
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/[id]/search-things/route.ts (31 lines)
- Auth: `getAdminUser()`; line 14: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }`.
- Request: query string `?q=<string>` (trimmed; queries shorter than 2 chars short-circuit to an empty list). The `[id]` path param is awaited but unused ("present for route-shape consistency", line 15 comment).
- Response: 200 `{ things: [{ id, title, blurb, blurb_long, neighborhood, photo_url, happening_tier }] }` (max 15 rows, or `[]` for short queries); 500 `{ error: "not configured" }` or `{ error: <supabase error message> }`.
- Logic: search-all fallback for the swap picker (spec §5.1). Case-insensitive `ilike '%q%'` title match over `things` restricted to `status = 'published'`, limit 15. Results are deliberately NOT filtered against the edition's existing picks (comment lines 8-11: an operator may want to see what's already in; cross-slot duplicate prevention is not enforced silently).
- Complexity bar: no (guard clauses plus one read; no writes, no ranking calculation).
- Tables: reads: things(id, title, blurb, blurb_long, neighborhood, photo_url, happening_tier; filtered status='published'); writes: none.
- Errors: handles short query, missing env, DB error. Not handled: `%`/`_` in `q` act as extra ilike wildcards (not escaped; broadens matches, not injectable through the client library) [INFERRED]; no pagination beyond limit 15 [INFERRED].

### API-27 - POST /api/admin/editions/[id]/swap
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/[id]/swap/route.ts (118 lines)
- Auth: `requireAdmin()` (lines 10-13); line 30: `if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }` (missing service-role env conflated into the same 401).
- Request: JSON body `SwapBody`: `slot: "hero" | "secondary" | "nonevent" | "anchor"` (validated against `VALID_SLOTS`), `thingId: string` (required), `position?: number` (honored only for slot "secondary", defaults 0; forced to 0 for single-item slots).
- Response: 200 `{ ok: true }`. Errors: 400 `{ error: "slot + thingId required" | "thing not found or not published" | "edition is <status>, no longer editable" }`; 404 `{ error: "edition not found" }`; 500 `{ error: <supabase error message> }`.
- Logic: promotes a thing (bench candidate or ad-hoc search-all pick) into a slot position. After the editable guard and slot/thing validation (thing must be `status='published'`), it first runs `ensureBlurbs()` and `ensureImageOptions()` (lib/edition/draft.ts) on the single thing, because a swapped-in thing never went through draftEdition's initial pass: ensureBlurbs fills a genuinely missing blurb via the batch `enrich()` Claude Haiku call (ingest/enrich.ts, model `claude-haiku-4-5`, fail-soft, no-op without ANTHROPIC_API_KEY) and persists blurb/blurb_long to the CANONICAL things row plus `ai_draft` audit_log rows; ensureImageOptions widens `things.photo_options` to at least 6 non-retired options via Wikimedia discovery. The thing's photo_url is re-hosted into the edition-media bucket (`rehostImage`, best-effort). Then: if a pick already occupies (edition, slot, position) it is UPDATED in place - new thing_id, new cached_image_url, `is_manual: true`, and all six `override_*` columns reset to null (they belonged to the previous thing); otherwise a new edition_picks row is inserted. Candidate-bench bookkeeping follows: the displaced thing's `edition_candidates` row (if any) gets `selected: false`; the incoming thing's row gets `selected: true`, or if it was never on the bench a new row is inserted with `rank: -1` marking a manual insertion. Cooldown is deliberately NOT consulted - an explicit operator swap is the documented cooldown override (spec §3.6). Finishes with an `edition_swap` audit_log row (actor `founder`).
- Complexity bar: yes (writes to four tables plus storage, update-vs-insert and bench-flag branching). Verbatim excerpt, app/api/admin/editions/[id]/swap/route.ts lines 69-80:
```ts
  if (existingPick) {
    const { error } = await sb
      .from("edition_picks")
      .update({
        thing_id: thing.id,
        cached_image_url: hostedUrl,
        is_manual: true,
        override_title: null, override_blurb: null, override_when: null,
        override_neighborhood: null, override_local_note: null, override_image_url: null,
      })
      .eq("id", existingPick.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
```
- Tables: reads: editions(status), things(id, type, title, blurb, photo_url, photo_options, happening_tier, happening_category, neighborhood; status='published'), edition_picks(id, thing_id by edition/slot/position), edition_candidates(thing_id by edition/slot/thing); writes: edition_picks(update: thing_id, cached_image_url, is_manual, override_* x6 nulled; or insert: edition_id, slot, position, thing_id, cached_image_url, is_manual), edition_candidates(selected flag updates; or insert: edition_id, slot, thing_id, rank=-1, selected), audit_log(edition_swap row), and via helpers things(blurb, blurb_long via ensureBlurbs; photo_options via ensureImageOptions) plus audit_log(ai_draft rows via enrich's logDrafts). Storage: edition-media bucket uploads via rehostImage. External: Anthropic (enrich, only when the blurb is missing), Wikimedia (only when under 6 options).
- Errors: handles invalid slot/thingId, unpublished/missing thing, non-editable/missing edition, and pick write failures. Not handled: `ensureBlurbs`/`ensureImageOptions` THROW on their own update failures, surfacing as unhandled 500 [INFERRED]; the edition_candidates updates/inserts and the audit_log insert have unchecked errors [INFERRED]; no guard against a `position` outside the slot's rendered range for "secondary" [INFERRED]; the same thing can end up in two slots (duplicate prevention deliberately not enforced, per API-26's comment) [INFERRED].

### API-28 - GET /api/admin/editions/archive
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/archive/route.ts (15 lines)
- Auth: `getAdminUser()`; line 10: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }`.
- Request: none.
- Response: 200 `{ editions: ArchiveRow[] }` where each row is `{ edition_date, edition_type, status, subject, sent_count, open_count, click_count }`; 500 `{ error: "not configured" }`.
- Logic: the cockpit's archive list. `loadEditionArchive()` (lib/edition/cockpitServer.ts lines 131-140) selects editions with terminal status `sent` or `failed`, newest edition_date first, limit 100. Terminal-only by design: `skipped` (Hold) stays in the pending worklist because it remains editable and reversible.
- Complexity bar: no (auth guard + one read, no writes, no calculation).
- Tables: reads: editions(edition_date, edition_type, status, subject, sent_count, open_count, click_count; status in sent/failed); writes: none.
- Errors: handles missing env. A select failure inside the helper throws (`cockpit: archive select failed`) and surfaces as an unhandled 500 rather than a JSON error [INFERRED].

### API-29 - GET /api/admin/editions
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/editions/route.ts (19 lines)
- Auth: `requireAdmin()` (lines 8-11); line 16: `if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with JSON body `{ "error": "unauthorized" }` (missing service-role env conflated into the same 401).
- Request: none.
- Response: 200 `{ editions: EditionSummary[] }` where each row is `{ id, edition_date, edition_type, status, subject }`.
- Logic: the cockpit's pending worklist. `loadPendingEditions()` (lib/edition/cockpitServer.ts lines 55-63) selects editions with status draft, approved, or skipped, ordered by edition_date ascending. The route comment says "status draft|approved" but the helper deliberately includes `skipped` too - the helper's own doc comment (lines 50-54) explains skipped is the cockpit's non-terminal "Hold" state, fully editable, whose only real effect is that send.ts will not send it.
- Complexity bar: no (auth guard + one read, no writes, no calculation).
- Tables: reads: editions(id, edition_date, edition_type, status, subject; status in draft/approved/skipped); writes: none.
- Errors: none handled beyond auth/env. A select failure inside the helper throws (`cockpit: pending editions select failed`) and surfaces as an unhandled 500 rather than a JSON error [INFERRED].
# API Group D: Admin Venues (API-43 to API-54)

Shared auth pattern: every route in this group calls `getAdminUser()` from `lib/reviewServer.ts` (lines 29-33), which resolves the signed-in Supabase session user via `sb.auth.getUser()` on the cookie-backed server client. [INFERRED] Any signed-in Supabase auth user passes; there is no role/claim check inside `getAdminUser()` itself (the function's doc comment calls it "The signed-in admin user, or null", so admin-ness rests on sign-up being restricted, not on a code check). Every route also returns 500 `{"error":"not configured"}` when `getAdminSupabase()` (service-role client) is unavailable, except API-54 which silently returns empty data (noted there).

Shared side effect: `revalidatePublic()` (lib/reviewServer.ts lines 20-26) revalidates `/`, `/discover`, `/saved`, `/discover/[id]`, `/thing/[id]`.

---

### API-43 - GET /api/admin/venues/[id]/things
- File: app/api/admin/venues/[id]/things/route.ts (42 lines)
- Auth: `getAdminUser()` Supabase session check; line 21: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: path param `id` (string, venue id from `params`). No query params or body.
- Response: 200 `{ ok: true, things: AttachedThing[] }` where `AttachedThing = { id: string, title: string, happening_tier: number, when: string, status: string }` (`when` is a display string built by `whenString()` from tier, starts_at, and embedded recurring_schedules). Errors: 401 `{error:"unauthorized"}`, 500 `{error:"not configured"}`, 500 `{error:<db message>}`.
- Logic: Lazy loader for the venue detail sheet's attached-events list (Phase 7, V-7). Selects all things with `venue_id = id` (including archived-status things, deliberately) ordered by starts_at ascending with nulls last, and maps each row to a compact display shape.
- Complexity bar: no. Only the three uniform guard returns (auth, missing service client, db error); a single read, no writes, no ranking calculation (whenString is display formatting).
- Tables: reads: things(id, title, happening_tier, starts_at, status, venue_id) with embedded recurring_schedules(day_of_week, start_time, end_time, frequency, label). writes: none.
- Errors: handles unauthenticated (401), missing service client (500), db error (500). [INFERRED] No validation that `id` is a real venue: a bogus id returns `{ ok: true, things: [] }` rather than 404.

### API-44 - POST /api/admin/venues/ack
- File: app/api/admin/venues/ack/route.ts (27 lines)
- Auth: `getAdminUser()` Supabase session check; line 13: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string }`; `thing_id` required.
- Response: 200 `{ ok: true }`. Errors: 400 `{error:"thing_id required"}`, 401, 500 `{error:"not configured"}`, 500 `{error:<db message>}` on the update failing.
- Logic: "Leave on motif" dismissal (Phase 6, V-4). Sets `things.no_venue_ack = true` so the thing stops reappearing in the cockpit's no-match catcher, then writes an audit_log row. Deliberately no `revalidatePublic()` (cockpit-only flag, nothing public changes).
- Complexity bar: yes (writes to two tables: things + audit_log).

  app/api/admin/venues/ack/route.ts lines 17-26:
  ```ts
  const { thing_id } = (await req.json()) as { thing_id?: string };
  if (!thing_id) return NextResponse.json({ error: "thing_id required" }, { status: 400 });

  const { error } = await sb.from("things").update({ no_venue_ack: true }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "no_venue_ack", actor: "founder",
  });
  return NextResponse.json({ ok: true });
  ```
- Tables: reads: none. writes: things(no_venue_ack); audit_log(entity_type, entity_id, action, actor).
- Errors: handles missing thing_id (400) and update failure (500). [INFERRED] Malformed JSON body makes `req.json()` throw, surfacing as an unhandled 500. [INFERRED] The audit_log insert result is not checked, a failed audit write is silent. [INFERRED] A nonexistent thing_id succeeds (update matches zero rows) and still logs an audit row.

### API-45 - POST /api/admin/venues/create
- File: app/api/admin/venues/create/route.ts (54 lines)
- Auth: `getAdminUser()` Supabase session check; line 16: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ display_name?: string, place_id?: string | null, lat?: number | null, lng?: number | null, from_thing_id?: string }`; `display_name` required (trimmed, non-empty).
- Response: 200 `{ ok: true, venue: { id, key, display_name, place_id, lat, lng } }`. Errors: 400 `{error:"display_name required"}`, 401, 500 `{error:"not configured"}`, 500 `{error:<message>}` from createVenue throwing or the thing-attach update failing.
- Logic: Creates a venue via the shared `createVenue()` helper (lib/venuesServer.ts lines 279-306): slugifies the display name into `venues.key` (`slugifyVenueKey`, lowercased, non-alphanumerics to hyphens, max 60 chars, fallback "venue"), checks for a key collision and appends a suffix if found (first 8 chars of `from_thing_id` as a deterministic `dedupeSeed`, else 6 random base36 chars), then inserts the venue with `radius_m: 150`. If `from_thing_id` is present (Phase 6, V-3 "Create venue from here"), also attaches that thing (`things.venue_id`), logs action `venue_created_from_catcher`, and calls `revalidatePublic()`. Otherwise logs `venue_created` with no revalidation.
- Complexity bar: yes (writes to three tables: venues, things, audit_log; branching on from_thing_id).

  app/api/admin/venues/create/route.ts lines 38-51:
  ```ts
  if (body.from_thing_id) {
    const { error } = await sb.from("things").update({ venue_id: venue.id }).eq("id", body.from_thing_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: body.from_thing_id, action: "venue_created_from_catcher", actor: "founder",
      payload: { venue_id: venue.id, key: venue.key },
    });
    revalidatePublic();
  } else {
    await sb.from("audit_log").insert({
      entity_type: "venue", entity_id: venue.id, action: "venue_created", actor: "founder", payload: { key: venue.key },
    });
  }
  ```
- Tables: reads: venues(id) (key-collision check in createVenue). writes: venues(key, display_name, place_id, lat, lng, radius_m); things(venue_id) (only with from_thing_id); audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing display_name (400), createVenue throw (500), attach failure (500). [INFERRED] Malformed JSON is an unhandled 500. [INFERRED] The collision check is check-then-insert (TOCTOU): a concurrent create with the same key could still hit a unique-constraint error at insert time, surfaced as the generic 500. [INFERRED] If the attach fails after the venue insert succeeded, the venue exists but the response is a 500 (no rollback).

### API-46 - POST /api/admin/venues/detach
- File: app/api/admin/venues/detach/route.ts (29 lines)
- Auth: `getAdminUser()` Supabase session check; line 14: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string }`; `thing_id` required.
- Response: 200 `{ ok: true }`. Errors: 400 `{error:"thing_id required"}`, 401, 500 `{error:"not configured"}`, 500 `{error:<db message>}`.
- Logic: Clears `things.venue_id` to null (Phase 7, V-8). Deliberately leaves the thing's current photo fields untouched (the photo re-resolves on the next nightly pass rather than regressing to a gradient immediately). Writes an audit_log row (`venue_detached`) and calls `revalidatePublic()`.
- Complexity bar: yes (writes to two tables: things + audit_log).

  app/api/admin/venues/detach/route.ts lines 21-28:
  ```ts
  const { error } = await sb.from("things").update({ venue_id: null }).eq("id", thing_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "thing", entity_id: thing_id, action: "venue_detached", actor: "founder",
  });
  revalidatePublic();
  return NextResponse.json({ ok: true });
  ```
- Tables: reads: none. writes: things(venue_id); audit_log(entity_type, entity_id, action, actor).
- Errors: handles missing thing_id (400) and update failure (500). [INFERRED] Malformed JSON is an unhandled 500; audit_log insert result unchecked; a nonexistent thing_id is a silent success.

### API-47 - POST /api/admin/venues/edit
- File: app/api/admin/venues/edit/route.ts (56 lines)
- Auth: `getAdminUser()` Supabase session check; line 20: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ venue_id?: string, display_name?: string, radius_m?: number, name_patterns?: string[], status?: "active" | "archived", place_id?: string | null, lat?: number | null, lng?: number | null, dog_friendly?: boolean }`; `venue_id` required, all others optional (only fields present in the body land in the patch; an empty-string place_id is coerced to null to clear it).
- Response: 200 `{ ok: true }`. Errors: 400 `{error:"venue_id required"}`, 401, 500 `{error:"not configured"}`, 500 `{error:<db message>}`.
- Logic: Partial update of a venue row (rename, radius, name patterns, archive/unarchive, and per the 2026-07-10 addendum place_id/lat/lng, plus dog_friendly per Occasion Tags spec section 3). `updated_at` is left to the `trg_venues_updated` trigger. Archiving drops the venue from public RLS reads (public_read_venues filters on status='active') and from the matcher's active-venues load; already-attached things keep their venue_id and photo. Writes an audit_log row with the full patch as payload. Calls `revalidatePublic()` only when the edit is publicly visible: status archived, or any of place_id/lat/lng/dog_friendly touched.
- Complexity bar: yes (8 conditional field-patch branches plus a conditional revalidation; writes venues + audit_log).

  app/api/admin/venues/edit/route.ts lines 32-42:
  ```ts
  const patch: Record<string, unknown> = {};
  if (body.display_name !== undefined) patch.display_name = body.display_name;
  if (body.radius_m !== undefined) patch.radius_m = body.radius_m;
  if (body.name_patterns !== undefined) patch.name_patterns = body.name_patterns;
  if (body.status !== undefined) patch.status = body.status;
  if (body.place_id !== undefined) patch.place_id = body.place_id || null;
  if (body.lat !== undefined) patch.lat = body.lat;
  if (body.lng !== undefined) patch.lng = body.lng;
  // Occasion Tags spec §3, read at land/render time (things.venue_id -> here),
  // no thing_tags row to backfill; a flip here is live the moment revalidatePublic() fires.
  if (body.dog_friendly !== undefined) patch.dog_friendly = body.dog_friendly;
  ```
- Tables: reads: none. writes: venues(display_name, radius_m, name_patterns, status, place_id, lat, lng, dog_friendly, and updated_at via db trigger); audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing venue_id (400) and update failure (500). [INFERRED] Malformed JSON is an unhandled 500. [INFERRED] A body with only venue_id sends an empty patch object to `.update({})`, which is not guarded. [INFERRED] No server-side validation of radius_m ranges, lat/lng bounds, or status values beyond the TypeScript cast (a runtime `status: "banana"` would be passed through to the db). Audit insert result unchecked.

### API-48 - POST /api/admin/venues/lookup-place-ids
- File: app/api/admin/venues/lookup-place-ids/route.ts (115 lines)
- Auth: `getAdminUser()` Supabase session check; line 76: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ venue_id?: string, query?: string }`, both optional; malformed/absent JSON is tolerated (`req.json().catch(() => ({}))`). No `venue_id` = bulk mode over every active venue with a null place_id. With `venue_id` = single-venue mode regardless of current place_id state. `query` (meaningful only with venue_id) overrides the auto-built search text `"{display_name}, Santa Barbara, CA"`.
- Response: 200 `{ ok: true, strongMatches: StrongMatch[], weakMatches: WeakMatch[], noMatches: NoMatch[] }` where `StrongMatch = { venue_id, venue_key, venue_display_name, proposed_place_id, proposed_lat, proposed_lng, proposed_name, proposed_address }`, `WeakMatch = { venue_id, venue_key, venue_display_name, addressOnlyMatch: PlaceCandidate, nearbyCandidates: PlaceCandidate[] }`, `NoMatch = { venue_id, venue_display_name }`, `PlaceCandidate = { place_id, lat, lng, name, address }`. Errors: 401, 404 `{error:"venue not found"}` (single mode, unknown id), 500 `{error:"not configured"}`, 500 `{error:<db message>}`.
- Logic: For each target venue, runs a Google Places Text Search (New) (`searchPlaceByText`, ingest/images.ts lines 470-494: POST to `places.googleapis.com/v1/places:searchText`, field mask `places.id,places.location,places.displayName,places.formattedAddress`, Text Search Pro SKU, first result only). No result = noMatches. If the result's name starts with a digit (`isWeakPlaceMatch`, lib/venuePool.ts lines 216-218, "starts with a digit -> not a venue name, it's an address"), it geocoded a bare address back, so a follow-up Nearby Search (New) (`searchNearbyNamedPlaces`, same field mask/SKU) at a 75m radius / limit 5 around that point surfaces real named POIs (results that are themselves address echoes are filtered out). WRITES NOTHING: every result is a proposal for a human to apply via API-47 (/api/admin/venues/edit).
- Complexity bar: yes (3+ conditional branches: bulk vs single mode, no-result vs weak vs strong classification, per-venue loop).

  app/api/admin/venues/lookup-place-ids/route.ts lines 98-111:
  ```ts
    if (isWeakPlaceMatch(result.name)) {
      const nearby = await searchNearbyNamedPlaces(result.lat, result.lng, NEARBY_RADIUS_M, NEARBY_LIMIT);
      weakMatches.push({
        venue_id: v.id as string, venue_key: v.key as string, venue_display_name: displayName,
        addressOnlyMatch: toCandidate(result),
        nearbyCandidates: nearby.map(toCandidate),
      });
    } else {
      strongMatches.push({
        venue_id: v.id as string, venue_key: v.key as string, venue_display_name: displayName,
        proposed_place_id: result.placeId, proposed_lat: result.lat, proposed_lng: result.lng,
        proposed_name: result.name, proposed_address: result.formattedAddress,
      });
    }
  ```
- Tables: reads: venues(id, key, display_name) filtered status='active' and either id=venue_id or place_id is null. writes: none (db). External calls: Google Places Text Search (New) once per venue, plus Nearby Search (New) once per weak match; both are Text Search Pro tier ($32/1,000, 5,000 free/month per the helper's comment).
- Errors: handles unknown single venue_id (404), db read failure (500), malformed JSON (tolerated as empty body), missing GOOGLE_KEY and any Google/network error (helpers swallow to null/[] and the venue lands in noMatches rather than erroring). [INFERRED] These Places calls are NOT counted against the image_spend monthly cap that governs API-51's Google photo calls; bulk mode is also unbounded and sequential, so a large registry of place_id-less venues means one paid Text Search per venue in a single request with no cap or timeout guard.

### API-49 - POST /api/admin/venues/match
- File: app/api/admin/venues/match/route.ts (50 lines)
- Auth: `getAdminUser()` Supabase session check; line 18: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string, venue_id?: string }`; both required.
- Response: 200 `{ ok: true }`. Errors: 400 `{error:"thing_id + venue_id required"}`, 401, 500 `{error:"not configured"}`, 500 `{error:<db message>}` on the attach update.
- Logic: Founder approval of a fuzzy match, the ONLY path that persists a fuzzy match (the nightly resolver auto-attaches only on exact place_id hits). Writes `things.venue_id`. Then, if the venue has an approved photo pool, immediately applies today's deterministic rotation pick, `pickFromPool(thing_id, sbDay(now), pool.length)` (lib/venuePool.ts lines 40-43: `hashString(thingId|isoDate) % poolLen`, same thing + same SB-local day always picks the same index), writing photo_url/photo_source/photo_attribution so the founder sees the result immediately instead of waiting for the nightly run. Audit-logs `venue_match_approved` and calls `revalidatePublic()`.
- Complexity bar: yes (deterministic hash calculation feeding the published photo pick; writes things + audit_log).

  app/api/admin/venues/match/route.ts lines 28-42:
  ```ts
  const { data: pool } = await sb
    .from("venue_photos")
    .select("source, serving_url, attribution")
    .eq("venue_id", venue_id)
    .eq("approved", true)
    .order("sort_order", { ascending: true });
  if (pool?.length) {
    const idx = pickFromPool(thing_id, sbDay(Date.now()), pool.length);
    const picked = pool[idx];
    if (picked.serving_url) {
      await sb.from("things").update({
        photo_url: picked.serving_url, photo_source: picked.source, photo_attribution: picked.attribution ?? null,
      }).eq("id", thing_id);
    }
  }
  ```
- Tables: reads: venue_photos(source, serving_url, attribution) where approved=true, ordered by sort_order. writes: things(venue_id; conditionally photo_url, photo_source, photo_attribution); audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing ids (400) and attach failure (500). [INFERRED] Malformed JSON is an unhandled 500. [INFERRED] The pool read error and the photo-update error are both unchecked (destructured without error handling), so a failed photo apply still returns `{ ok: true }`. [INFERRED] No validation that venue_id exists; attaching to a bogus venue would fail only if a FK constraint catches it.

### API-50 - POST /api/admin/venues/photos/approve
- File: app/api/admin/venues/photos/approve/route.ts (35 lines)
- Auth: `getAdminUser()` Supabase session check; line 12: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ photo_id?: string }`; required.
- Response: 200 `{ ok: true }`. Errors: 400 `{error:"photo_id required"}`, 401, 404 `{error:<message or "not found">}` when the photo row is missing, 500 `{error:"not configured"}`, 500 `{error:<db message>}` on the update.
- Logic: Moves a fetched candidate into the venue's approved pool: reads the photo's venue_id, finds the current max sort_order among that venue's approved photos, and sets `approved = true, sort_order = max + 1` (appended to the end; -1 sentinel makes the first approval sort_order 0). No network call (the row already exists from the fetch step). Audit-logs `photo_approved`. No revalidation (approval alone assigns nothing to a public card).
- Complexity bar: yes (writes to two tables: venue_photos + audit_log; sort-order append calculation feeds the pool's publishing order).

  app/api/admin/venues/photos/approve/route.ts lines 22-28:
  ```ts
  const { data: existing } = await sb
    .from("venue_photos").select("sort_order").eq("venue_id", photo.venue_id as string).eq("approved", true)
    .order("sort_order", { ascending: false }).limit(1);
  const nextSort = ((existing?.[0]?.sort_order as number) ?? -1) + 1;

  const { error } = await sb.from("venue_photos").update({ approved: true, sort_order: nextSort }).eq("id", photo_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  ```
- Tables: reads: venue_photos(venue_id); venue_photos(sort_order) (max among approved). writes: venue_photos(approved, sort_order); audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles missing photo_id (400), missing row (404), update failure (500). [INFERRED] Malformed JSON is an unhandled 500. [INFERRED] Read-max-then-write is not atomic: two concurrent approvals for the same venue could compute the same nextSort. Audit insert unchecked.

### API-51 - POST /api/admin/venues/photos/fetch
- File: app/api/admin/venues/photos/fetch/route.ts (26 lines)
- Auth: `getAdminUser()` Supabase session check; line 13: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ venue_id?: string, include_google?: boolean }`; `venue_id` required, `include_google` coerced with `!!`.
- Response: 200 `{ ok: true, count: number, wikimediaCount: number, googleFetched: boolean, googleCount: number, capHit: boolean }` (the VenueFetchStats spread; `capHit` true means Google was requested but the shared monthly budget was already exhausted or ran out mid-fetch, so the caller can show "budget reached" instead of implying nothing exists). Errors: 400 `{error:"venue_id required"}`, 401, 404 `{error:<message or "venue not found">}`, 500 `{error:"not configured"}`.
- Logic: Thin wrapper over `fetchCandidatesForVenue()` (lib/venueFetch.ts lines 38-87). Wikimedia leg (free, runs whenever the venue has lat/lng): `wikimediaGeosearch` (ingest/images.ts lines 323-342) hits the Commons API within a 200m radius, limit 10; results are gated (min width 800px, aspect ratio 1 to 2.2, filename blocklist for maps/logos/scans, jpeg/png/webp only) and scored (+2 per keyword token overlapping the venue name, license bonus PD/CC0 +3, CC BY +2, CC BY-SA +1, minimum score 2) by `rankWikimediaCandidates`, top 5 kept. Google leg fires ONLY when the venue has a place_id AND `include_google` is explicitly true (LC-8: the free-fetch button can never spend a paid call): it checks the shared monthly budget in `image_spend` against `CAP` (`const CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1200);`, ingest/images.ts line 52), then `fetchGooglePhotoCandidates` (ingest/images.ts lines 549-585) makes 1 Place Details call (field mask `photos`, free Essentials SKU, still counted via `onCall`) plus one billable Place Photo media call per candidate (up to 10), stopping mid-loop the moment `hasBudget()` goes false, and the updated call count is persisted back via `saveSpend`. All results are upserted as UNAPPROVED venue_photos rows, deduped on (venue_id, stable_ref) so repeat fetches never duplicate rows.
- Complexity bar: yes (budget accounting calculation gating paid calls; writes to two tables: venue_photos + image_spend).

  lib/venueFetch.ts lines 63-75:
  ```ts
    const month = monthKey();
    const spend = await loadSpend(sb, month);
    let calls = spend.google_calls;
    const hasBudget = () => calls < CAP;
    if (!hasBudget()) {
      capHit = true;
    } else {
      googleFetched = true;
      const onCall = () => { calls++; };
      const google = await fetchGooglePhotoCandidates(venue.place_id as string, onCall, hasBudget, 10);
      await saveSpend(sb, month, calls, spend.over_cap);
      googleCount = google.length;
      if (calls >= CAP) capHit = true; // stopped mid-loop, budget exhausted this call
  ```
- Tables: reads: venues(id, display_name, place_id, lat, lng); image_spend(google_calls, over_cap) keyed by month (YYYY-MM UTC via `monthKey()`). writes: venue_photos(venue_id, source, stable_ref, serving_url, attribution, approved) upsert with `onConflict: "venue_id,stable_ref", ignoreDuplicates: true`; image_spend(month, google_calls, over_cap, updated_at) upsert on month. External calls: Wikimedia Commons geosearch API (free); Google Place Details + Place Photo media (billable, cap-counted).
- Errors: handles missing venue_id (400), missing venue (404). Wikimedia and Google helpers swallow all network/API errors to empty results (a total upstream failure looks like `count: 0`, not an error). [INFERRED] Malformed JSON is an unhandled 500. [INFERRED] The venue_photos upsert error is unchecked, and no audit_log row is written by this route (unlike the other five venue mutations). [INFERRED] Load-increment-save on image_spend is not atomic: two concurrent fetches can under-count spend.

### API-52 - POST /api/admin/venues/photos/remove
- File: app/api/admin/venues/photos/remove/route.ts (89 lines)
- Auth: `getAdminUser()` Supabase session check; line 25: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ photo_id?: string }`; required.
- Response: 200 `{ ok: true, reassigned: number }` (count of things whose photo was re-picked). Errors: 400 `{error:"photo_id required"}`, 401, 404 `{error:"photo not found"}`, 500 `{error:"not configured"}`, 500 `{error:<db message>}` on the delete.
- Logic: Deletes the venue_photos row (reject-a-candidate and remove-an-approved-photo are the same action; the additive-only Phase 2 DDL has no rejected state, and an unapproved row is publicly invisible, so delete equals hide). Audit-logs `photo_removed`. Then the Phase 7 (V-9) cleanup: if the removed photo was APPROVED and had a serving_url, every thing at that venue currently serving that exact photo_url is re-picked from the remaining approved pool with the same deterministic rotation (`pickFromPool(thing_id, today, remaining.length)`); if the pool is now empty, each falls back to a deterministic motif/big-type via `matchMarqueeVenue` + `assignVisual` (photo_url null, photo_source "motif", visual_kind/visual_key/visual_seed set). A batch audit_log insert records each reassignment, and `revalidatePublic()` fires only when something was reassigned. Removing an unapproved candidate never touches any thing.
- Complexity bar: yes (writes venue_photos, things, audit_log; branching on approved/serving_url/pool-remaining; deterministic pick calculation feeds published cards).

  app/api/admin/venues/photos/remove/route.ts lines 60-74:
  ```ts
      for (const t of affected) {
        if (remaining.length) {
          const idx = pickFromPool(t.id as string, today, remaining.length);
          const picked = remaining[idx];
          await sb.from("things").update({
            photo_url: picked.serving_url, photo_source: picked.source, photo_attribution: picked.attribution ?? null,
          }).eq("id", t.id);
        } else {
          const marquee = matchMarqueeVenue({ title: t.title as string, lat: (t.lat as number) ?? undefined, lng: (t.lng as number) ?? undefined });
          const visual = assignVisual({ id: t.id as string, happening_category: t.happening_category as HappeningCategory | null }, marquee?.key);
          await sb.from("things").update({
            photo_url: null, photo_source: "motif", photo_attribution: null,
            visual_kind: visual.visual_kind, visual_key: visual.visual_key, visual_seed: visual.visual_seed,
          }).eq("id", t.id);
        }
      }
  ```
- Tables: reads: venue_photos(id, venue_id, serving_url, approved) (the target row); things(id, title, happening_category, lat, lng) where venue_id + photo_url match; venue_photos(source, serving_url, attribution) (remaining approved pool). writes: venue_photos (row delete); things(photo_url, photo_source, photo_attribution, visual_kind, visual_key, visual_seed); audit_log (one `photo_removed` row plus one `venue_photo_cleanup_reassigned` row per affected thing).
- Errors: handles missing photo_id (400), missing row (404), delete failure (500). [INFERRED] Malformed JSON is an unhandled 500. [INFERRED] The initial row read destructures without checking the error, so a db read failure is indistinguishable from "photo not found" (both 404). [INFERRED] Per-thing update errors inside the loop are unchecked; a partial failure still reports the full `reassigned` count. Delete-then-reassign is not transactional.

### API-53 - POST /api/admin/venues/photos/reorder
- File: app/api/admin/venues/photos/reorder/route.ts (47 lines)
- Auth: `getAdminUser()` Supabase session check; line 12: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ photo_id?: string, direction?: "up" | "down" }`; both required, direction strictly one of the two literals.
- Response: 200 `{ ok: true }` (including the deliberate no-op when the photo is already at the top/bottom edge of the pool). Errors: 400 `{error:"photo_id + direction ('up'|'down') required"}`, 401, 404 `{error:<message or "not found">}` (photo missing or not approved), 500 `{error:"not configured"}`, 500 on pool read failure or either swap update failing.
- Logic: Swaps sort_order with the adjacent APPROVED photo in the same venue's pool. Reads the target photo (must be approved), loads the venue's full approved pool ordered by sort_order, finds the target's index, computes the neighbor index from direction, no-ops at either end, then swaps the two rows' sort_order values with two parallel updates. Audit-logs `photo_reordered` (V-15 consistency across the venue mutations). No revalidation (pool order affects the NEXT rotation pick, not currently-served photos).
- Complexity bar: yes (3+ conditional branches: direction validation, approved-row check, edge no-op, dual-error check; the sort_order swap feeds the pool's rotation/publishing order).

  app/api/admin/venues/photos/reorder/route.ts lines 30-39:
  ```ts
  const idx = pool.findIndex((p) => p.id === photo_id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= pool.length) return NextResponse.json({ ok: true }); // no-op at either end

  const a = pool[idx], b = pool[swapIdx];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    sb.from("venue_photos").update({ sort_order: b.sort_order }).eq("id", a.id),
    sb.from("venue_photos").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });
  ```
- Tables: reads: venue_photos(venue_id, sort_order) (target, approved only); venue_photos(id, sort_order) (approved pool). writes: venue_photos(sort_order) on two rows; audit_log(entity_type, entity_id, action, actor, payload).
- Errors: handles bad input (400), missing/unapproved photo (404), pool read failure (500), either swap update failing (500). [INFERRED] Malformed JSON is an unhandled 500. [INFERRED] The two swap updates are parallel and non-transactional: if exactly one fails, the pool is left with two rows sharing a sort_order (the 500 is reported but the partial write is not rolled back). Audit insert unchecked.

### API-54 - GET /api/admin/venues
- File: app/api/admin/venues/route.ts (15 lines)
- Auth: `getAdminUser()` Supabase session check; line 13: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` Unauthenticated requests receive 401 with body `{"error":"unauthorized"}`.
- Request: none (no params, no body).
- Response: 200 with the raw `VenuesData` object (no `ok` wrapper): `{ venues: VenueRow[], matches: MatchProposal[], archivedVenues: ArchivedVenue[], noMatchCatcher: NoMatchThing[] }`. `VenueRow = { id, key, display_name, place_id, lat, lng, radius_m, name_patterns, attachedCount, approvedPhotos: {id, source, serving_url, attribution, sort_order}[], candidatePhotos: {id, source, serving_url, attribution}[], dog_friendly, dogFriendlySuggested }`. `MatchProposal = { thing_id, title, address, happening_tier, venue_id, venue_key, venue_display_name, score }`. `NoMatchThing = { id, title, address, happening_tier, starts_at, place_id, lat, lng, weakGuess?: { venue_id, venue_display_name, score } }`. Errors: only 401; unlike the sibling routes, a missing service client is NOT a 500 here: `loadVenuesData()` returns `{ venues: [], matches: [], archivedVenues: [], noMatchCatcher: [] }` with a 200.
- Logic: The Venues tab's full data set via `loadVenuesData()` (lib/venuesServer.ts lines 115-260). Five parallel reads: active venues, all venue_photos, attached things (for counts and category signals), up to 1,000 unattached un-acked things (`MAX_UNATTACHED_SCAN`, a documented bound, not a silent truncation), and archived venues. Builds per-venue photo buckets (approved vs candidate) and attached counts, plus the `dogFriendlySuggested` UI hint (majority outdoor_activity/scenic_chill attached things, or a name-keyword regex hit; pure pre-fill, never auto-saved). Then one scan classifies every unattached thing into exactly one of two panes: `bestVenueMatch()` scores it against every active venue (`scoreVenueMatch`, lib/venuePool.ts: exact place_id match +100, +10 per name_pattern substring hit against title or address, up to +5 distance-graded proximity bonus inside radius_m via haversine); addressed things with a positive score become MatchProposals (single best venue per thing, sorted by score descending, display-capped at 200), everything else lands in the noMatchCatcher (carrying a weakGuess when a no-address thing still scored above zero), sorted dated-T1-soonest first, then undated T1, then T2/T3 alphabetical. Matches are computed live on every load; there is no persisted proposal queue and "reject" is a client-side dismiss.
- Complexity bar: yes (scoring calculation directly feeds the ranking of match proposals; multiple classification branches).

  lib/venuePool.ts lines 154-168 (scoreVenueMatch, the ranking calculation):
  ```ts
  let score = 0;
  if (thing.place_id && venue.place_id && thing.place_id === venue.place_id) score += 100;

  const titleNorm = normalizeText(thing.title);
  const addrNorm = thing.address ? normalizeText(thing.address) : '';
  for (const pattern of venue.name_patterns) {
    const p = normalizeText(pattern);
    if (!p) continue;
    if (titleNorm.includes(p) || (addrNorm && addrNorm.includes(p))) score += 10;
  }

  if (thing.lat != null && thing.lng != null && venue.lat != null && venue.lng != null) {
    const d = haversineMeters(thing.lat, thing.lng, venue.lat, venue.lng);
    if (d <= venue.radius_m) score += Math.max(0, 5 - (d / venue.radius_m) * 5);
  }
  ```
- Tables: reads: venues(id, key, display_name, place_id, lat, lng, radius_m, name_patterns, dog_friendly) status='active'; venues(id, key, display_name) status='archived'; venue_photos(id, venue_id, source, serving_url, attribution, approved, sort_order); things(venue_id, happening_category) attached and status in (published, needs_review); things(id, title, address, lat, lng, place_id, happening_tier, starts_at) unattached, status in (published, needs_review), no_venue_ack=false, limit 1000. writes: none.
- Errors: handles only unauthenticated (401). [INFERRED] The five parallel Supabase reads' errors are never checked inside loadVenuesData (each `res.data ?? []` silently becomes empty), so a db outage renders as an empty-but-200 Venues tab rather than an error; same for the not-configured case.
# API Endpoints, Batch E: Admin Images Desk + Review Cockpit

All twelve routes share the same auth mechanism: `getAdminUser()` (lib/reviewServer.ts lines 29-33) builds a cookie-bound Supabase client (`lib/supabaseServer.ts`, anon key + request cookies) and returns `(await sb.auth.getUser()).data.user`. There is no role or email allowlist check in any of these routes; any signed-in Supabase auth user of this project passes the gate [INFERRED: acceptable in practice because this is a single-founder app with one auth account, but the check is "signed in", not "is admin"]. All data operations then use the service-role client `getAdminSupabase()` (lib/supabaseAdmin.ts, `SUPABASE_SECRET_KEY`, bypasses RLS); if that env var is missing every route returns 500 `{"error":"not configured"}`.

Shared error posture [INFERRED]: none of the POST routes wrap `req.json()`, so a malformed/absent JSON body throws and surfaces as a framework 500, not a clean 400. `audit_log` inserts are never error-checked anywhere in this batch; an audit write failure is silently swallowed.

---

### API-34 - POST /api/admin/images/ack
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/images/ack/route.ts (33 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 16: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_id?: string }` or `{ thing_ids?: string[] }`. `thing_ids` is filtered to strings and capped at `MAX_IDS = 500`; single `thing_id` is wrapped into a one-element array.
- Response: 200 `{ ok: true, acked: string[] }`. Errors: 400 `{ error: "thing_id(s) required" }` when no ids; 401 `{ error: "unauthorized" }`; 500 `{ error: "not configured" }` or 500 `{ error: <supabase message> }` on the things update failure.
- Logic: The Images desk "Looks right as-is" dismissal. Sets `photo_ack = true` on the given things so they stop reappearing in the imageless queue (the bulk form backs the desk's "Keep motif (view)" tail-dismiss), then writes one `photo_ack` audit row per id. Cockpit-side flag only, nothing public renders it, so deliberately no `revalidatePublic()`.
- Complexity bar: yes (writes to two tables: things + audit_log). Verbatim, app/api/admin/images/ack/route.ts lines 26-32:
```ts
  const { error } = await sb.from("things").update({ photo_ack: true }).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert(
    ids.map((id) => ({ entity_type: "thing", entity_id: id, action: "photo_ack", actor: "founder" })),
  );
  return NextResponse.json({ ok: true, acked: ids });
}
```
- Tables: reads: none beyond auth; writes: things(photo_ack), audit_log(entity_type, entity_id, action, actor).
- Errors: handles missing auth, missing service key, empty id list, and the things update error. Not handled: malformed JSON body (framework 500) [INFERRED]; audit insert failure ignored [INFERRED]; ids that do not exist are silently reported as acked (the `.in()` update matches zero rows without error) [INFERRED].

### API-35 - POST /api/admin/images/auto-assign
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/images/auto-assign/route.ts (167 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 42: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_ids?: string[] }`, filtered to strings, capped at `MAX_IDS = 60`.
- Response: 200 `{ ok: true, results: AssignResult[], applied: number }` where each `AssignResult` is `{ id, action: "venue_pool" | "wikimedia" | "skipped", reason?, url?, source?, attribution?, venue_id?, venue_name?, attached_now?, prev? }` and `prev` is `{ url, source, attribution }` for one-click revert. Errors: 400 `{ error: "thing_ids required" }`; 401; 500 `{ error: "not configured" }`; 500 `{ error: <message> }` on the things batch read failure.
- Logic: Deterministic, $0 bulk assign (no AI, no Google) in the image waterfall's own priority order. Per thing: skip if it already has a real photo (raced with a manual apply); else (1) venue pool: use an attached venue, or newly attach the best fuzzy match when `bestVenueMatch` (lib/venuePool.ts, place_id +100, +10 per name-pattern hit against title/address, distance-graded proximity bonus up to +5) clears `STRONG_MATCH_SCORE = 20` (lib/review.ts line 58) AND that venue has approved serving photos, then apply today's deterministic rotation pick `pickFromPool(thingId, sbDay, poolLen)` (FNV-style hash mod pool length); (2) else apply the top pre-fetched free `photo_options` entry with source wikimedia/owned; (3) else skip and leave it for the founder. Calls `revalidatePublic()` once if anything was applied.
- Complexity bar: yes (many branches, a match-score calculation feeding an auto-attach, writes to things + audit_log). Verbatim, app/api/admin/images/auto-assign/route.ts lines 106-117:
```ts
      const best = bestVenueMatch(thing, matchableVenues);
      if (best && best.score >= STRONG_MATCH_SCORE && (pools.get(best.venue.id)?.some((p) => p.serving_url) ?? false)) {
        const { error } = await sb.from("things").update({ venue_id: best.venue.id }).eq("id", id);
        if (!error) {
          venueId = best.venue.id;
          attachedNow = true;
          await sb.from("audit_log").insert({
            entity_type: "thing", entity_id: id, action: "venue_match_approved", actor: "founder",
            payload: { venue_id: venueId, via: "images_auto_assign", score: best.score },
          });
        }
      }
```
- Tables: reads: things(id, title, address, lat, lng, place_id, venue_id, photo_url, photo_source, photo_attribution, photo_options), venues(id, display_name, place_id, lat, lng, radius_m, name_patterns; status='active'), venue_photos(venue_id, source, serving_url, attribution; approved=true, ordered by sort_order); writes: things(venue_id), things(photo_url, photo_source, photo_attribution), audit_log(entity_type, entity_id, action='venue_match_approved'|'photo_set', actor, payload).
- Errors: handles auth, config, empty ids, and the things read error; per-thing update errors degrade that item to the next tier or a skip rather than failing the batch. Not handled: `venuesRes.error` / `poolsRes.error` are never checked, a failed venues or pool read silently behaves as "no venues/no pools" [INFERRED]; malformed JSON body [INFERRED]; audit failures ignored [INFERRED].

### API-36 - POST /api/admin/images/auto-google
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/images/auto-google/route.ts (282 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 43: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_ids?: string[] }`, filtered to strings, capped at `MAX_IDS = 60`.
- Response: 200 `{ ok: true, results: GoogleResult[], applied: number, capHit: boolean, used: number, cap: number }`; each `GoogleResult` is `{ id, action: "google" | "venue_pool" | "skipped", reason?, url?, source?, attribution?, venue_id?, venue_name?, attached_now?, prev? }`. Errors: 400 `{ error: "thing_ids required" }`; 401; 500 `{ error: "not configured" }`; 500 `{ error: <message> }` on the things read failure.
- Logic: The paid, opt-in second pass for items the free auto-assign skipped, cheapest path first per thing: (1) resolve a venue: already attached; else exact place_id match against an active venue (attach); else auto-create a venue from the thing's own place_id via `createVenue` (lib/venuesServer.ts, slugged key with collision suffix); else, with no place_id anywhere, one free-tier Google Text Search (`searchPlaceByText`, ingest/images.ts, not counted against the photo cap) that must be a strong hit (`isWeakPlaceMatch` rejects bare geocoded addresses whose name starts with a digit), attaching or creating a venue from it. (2) If the venue already has approved pool photos, apply today's free rotation pick, no Google call. (3) Otherwise, one name lookup to backfill a missing venue place_id, then a top-1 paid fetch via `fetchGooglePhotoCandidates(place_id, onCall, hasBudget, 1)` (2 counted calls, 1 billable), auto-approved (`approved: true`) into venue_photos at the next sort_order so it joins the nightly serving-URL refresh, then applied to the thing. The shared monthly counter (`image_spend`, `CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1200)`) is loaded up front, enforced per fetch, and saved at the end. `applyPhoto` also folds the pick into the thing's `photo_options`. `revalidatePublic()` when anything applied.
- Complexity bar: yes (multi-branch venue resolution, budget calculation gating a paid publish-visible write, writes to five tables). Verbatim, app/api/admin/images/auto-google/route.ts lines 236-248:
```ts
    if (!hasBudget()) {
      capHit = true;
      results.push({ id, action: "skipped", reason: "monthly photo budget reached", attached_now: attachedNow, venue_id: venue.id });
      continue;
    }
    const onCall = () => { calls++; };
    const photos = await fetchGooglePhotoCandidates(venue.place_id, onCall, hasBudget, 1);
    if (calls >= CAP) capHit = true;
    const g = photos[0];
    if (!g) {
      results.push({ id, action: "skipped", reason: "no Google photo found", attached_now: attachedNow, venue_id: venue.id });
      continue;
    }
```
- Tables: reads: things(id, title, address, place_id, lat, lng, venue_id, photo_url, photo_source, photo_attribution, photo_options), venues(id, display_name, place_id; status='active'), venues(id) (createVenue key-collision probe), venue_photos(source, serving_url, attribution; approved per venue), venue_photos(sort_order max probe), image_spend(google_calls, over_cap); writes: things(venue_id), things(photo_url, photo_source, photo_attribution, photo_options), venues(insert: key, display_name, place_id, lat, lng, radius_m), venues(update: place_id, lat, lng), venue_photos(upsert: venue_id, source='google', stable_ref, serving_url, attribution, approved=true, sort_order; onConflict venue_id,stable_ref), image_spend(upsert: month, google_calls, over_cap, updated_at), audit_log(actions: venue_auto_attached, venue_auto_created, venue_auto_lookup, photo_approved, photo_set).
- Errors: handles auth, config, empty ids, things read error, venue-creation failure (per-item skip via try/catch), missing place_id, weak place matches, cap exhaustion, no-photo-found, and per-item write failures (skip with reason). Google/network failures inside `searchPlaceByText` / `fetchGooglePhotoCandidates` return null/[] rather than throwing. Not handled: `venuesRes.error` unchecked (a failed venues read looks like an empty registry and can trigger duplicate venue auto-creation) [INFERRED]; malformed JSON body [INFERRED]; `saveSpend` failure ignored, so counted calls could be lost and the cap under-enforced next call [INFERRED].

### API-37 - POST /api/admin/images/locate
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/images/locate/route.ts (56 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 21: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_ids?: string[] }`, filtered to strings, capped at `MAX_IDS = 25`.
- Response: 200 `{ ok: true, results: { id, located: boolean, place_id?, lat?, lng? }[], located: number }`. Errors: 400 `{ error: "thing_ids required" }`; 401; 500 `{ error: "not configured" }`; 500 `{ error: <message> }` on the things read failure.
- Logic: The desk's "locate" stage: for each thing without a `place_id`, run one Google Text Search (`searchPlaceByText`, free tier, not counted against the photo cap) using `"title, address"` or `"title, Santa Barbara, CA"`. Only strong hits (a real named business; `isWeakPlaceMatch` rejects names starting with a digit) write anything: place_id is stamped, and lat/lng are filled only where currently null (existing adapter coordinates stay authoritative). This is the root-cause unlock for the free image path (coords enable Wikimedia geosearch, place_ids enable venue matching + Google photos).
- Complexity bar: yes (per-item branch ladder, writes to two tables). Verbatim, app/api/admin/images/locate/route.ts lines 40-52:
```ts
    const q = address ? `${t.title as string}, ${address}` : `${t.title as string}, Santa Barbara, CA`;
    const found = await searchPlaceByText(q);
    if (!found || isWeakPlaceMatch(found.name)) { results.push({ id, located: false }); continue; }

    const lat = (t.lat as number) ?? found.lat;
    const lng = (t.lng as number) ?? found.lng;
    const { error: upErr } = await sb.from("things").update({ place_id: found.placeId, lat, lng }).eq("id", id);
    if (upErr) { results.push({ id, located: false }); continue; }
    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: id, action: "place_lookup", actor: "founder",
      payload: { place_id: found.placeId, matched_name: found.name, via: "images_locate" },
    });
```
- Tables: reads: things(id, title, address, place_id, lat, lng); writes: things(place_id, lat, lng), audit_log(action='place_lookup').
- Errors: handles auth, config, empty ids, read failure, weak/no match (per-item `located: false`), and per-item update failure. `searchPlaceByText` swallows all network errors to null. Not handled: malformed JSON body [INFERRED]; no revalidation, correct since place_id/coords are not directly rendered publicly [INFERRED]; missing `GOOGLE_PLACES_KEY` silently makes every lookup return null with no signal to the operator [INFERRED].

### API-38 - POST /api/admin/images/pool-build
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/images/pool-build/route.ts (153 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 24: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ venue_id?: string, include_google?: boolean }`.
- Response: 200 `{ ok: true, approved: true, applied: [...], capHit }` on success, where each applied entry is `{ id, url, source, attribution, prev: { url, source, attribution } }`; or 200 `{ ok: true, approved: false, applied: [], capHit, reason }` when no candidate could be approved (reasons: "monthly photo budget reached", "no candidates found, try again with Google", "venue has no place_id or coordinates (no confident lookup match)"). Errors: 400 `{ error: "venue_id required" }`; 400 `{ error: "venue is archived" }`; 404 `{ error: <message or "venue not found"> }`; 401; 500 `{ error: "not configured" }`.
- Logic: One-photo-covers-the-cluster accelerator for a single venue. Steps: (1) backfill a missing place_id (and null coords) via one free-tier name lookup, strong match only; (2) fetch candidates: top-5 gated/ranked Wikimedia geosearch results when the venue has coords (`rankWikimediaCandidates` applies the size/aspect/blocklist/MIME gate plus a keyword+license score with `WIKIMEDIA_MIN_SCORE = 2`), plus up to 3 paid Google candidates when `include_google` and a place_id exist and the shared monthly cap has room; upsert all as unapproved venue_photos rows; (3) if the venue has no approved photo yet, approve the best candidate (Wikimedia preferred via a descending source sort) at sort_order 0; (4) apply the approved pool's daily rotation pick to every attached published/needs_review thing still on a motif/placeholder, folding the pick into each thing's photo_options. `revalidatePublic()` when anything applied.
- Complexity bar: yes (candidate ranking calculation feeding an auto-approval, cap arithmetic, writes to five tables). Verbatim, app/api/admin/images/pool-build/route.ts lines 91-99:
```ts
  if (!approvedExisting?.length) {
    const { data: cands } = await sb
      .from("venue_photos").select("id, source, serving_url").eq("venue_id", venue.id).eq("approved", false)
      .not("serving_url", "is", null)
      .order("source", { ascending: false }) // 'wikimedia' sorts after 'google' -> descending puts wikimedia first
      .order("id", { ascending: true });
    const top = cands?.[0];
    if (!top) {
      return NextResponse.json({
```
- Tables: reads: venues(id, display_name, place_id, lat, lng, status), image_spend(google_calls, over_cap), venue_photos(id; approved probe), venue_photos(id, source, serving_url; unapproved candidates), venue_photos(source, serving_url, attribution; approved pool), things(id, photo_url, photo_source, photo_attribution, photo_options; by venue_id, status in published/needs_review); writes: venues(place_id, lat, lng), venue_photos(upsert candidates: venue_id, source, stable_ref, serving_url, attribution, approved=false; onConflict venue_id,stable_ref, ignoreDuplicates), venue_photos(update: approved=true, sort_order=0), things(photo_url, photo_source, photo_attribution, photo_options), image_spend(upsert), audit_log(actions: venue_auto_lookup, photo_approved, photo_set).
- Errors: handles auth, config, missing venue_id, venue not found (404), archived venue (400), cap exhaustion, and the three no-candidate reasons; per-thing apply errors just skip that thing. Wikimedia/Google fetchers swallow network errors to empty lists. Not handled: malformed JSON body [INFERRED]; the candidate upsert, approval update, and pool re-read errors are unchecked, a failed approval write would still return `approved: true` [INFERRED]; the "owned" source would outsort "wikimedia" in the descending source ordering, harmless today since this route only inserts wikimedia/google candidates [INFERRED].

### API-39 - POST /api/admin/images/prefetch
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/images/prefetch/route.ts (54 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 20: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ thing_ids?: string[] }`, filtered to strings, capped at `MAX_IDS = 8` (small so a batch stays inside a function timeout; the client pages ids across successive calls).
- Response: 200 `{ ok: true, options: Record<string, ImageOption[]> }` keyed by thing id (`ImageOption` = `{ url, source, width?, height?, attribution? }`). Errors: 400 `{ error: "thing_ids required" }`; 401; 500 `{ error: "not configured" }`; 500 `{ error: <message> }` on the things read failure.
- Logic: Background prefetch of the desk's candidate strips. Per thing, runs the free `findFreeCandidates` (ingest/images.ts): Wikimedia geosearch top-5 when the thing has coordinates plus the best category-aware title-search hit, gated and scored, never Google, never the paid cap; merges with existing options deduped by URL via `rankOptions` (which also strips retired pexels entries and appends the placeholder sentinel). Persists the merged list to `photo_options` only when the search actually added a new URL, so a no-hit search does not churn the row.
- Complexity bar: yes (the helper's gate/score/rank calculation feeds which candidates get persisted for the picker). Verbatim, app/api/admin/images/prefetch/route.ts lines 44-50:
```ts
    options[t.id as string] = merged;
    // Persist only when the search actually widened the set, a no-hit search
    // shouldn't churn the row (or the audit-free photo_options write) at all.
    const before = new Set(existing.filter((o) => o.url).map((o) => o.url));
    if (merged.some((o) => o.url && !before.has(o.url))) {
      await sb.from("things").update({ photo_options: merged }).eq("id", t.id as string);
    }
```
- Tables: reads: things(id, title, neighborhood, happening_category, lat, lng, photo_options); writes: things(photo_options). No audit_log write (deliberate: "audit-free photo_options write", line 46 comment).
- Errors: handles auth, config, empty ids, read failure. Wikimedia fetch failures degrade to empty candidate lists. Not handled: malformed JSON body [INFERRED]; the per-thing update error is unchecked (a failed persist still returns the options as if saved) [INFERRED].

### API-40 - GET /api/admin/images
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/admin/images/route.ts (14 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 12: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: no parameters (GET, no query string parsed).
- Response: 200 with the `ImagesDeskData` object from `loadImagesDesk()` (lib/imagesServer.ts): `{ rows: ImagesDeskRow[], venues: { id, display_name, approved_count }[], scanCapped: boolean, publishedTotal: number, noImageTotal: number }`; each row carries id, title, address, neighborhood, happening_tier, starts_at, place_id, lat, lng, venue_id, venue_name, venue_approved_count, photo_url, photo_source, photo_attribution, photo_options (pexels entries stripped), and a live-computed `suggestion` (best fuzzy venue match with score, for unattached rows). Error: 401 only; with the service key missing it returns 200 with the empty-shape object, not a 500.
- Logic: The whole Images desk dataset in one call: every published thing without a real photo (photo_url null, or photo_source placeholder/motif), filtered by `photo_ack = false` when that column exists (falls back to the unfiltered scan pre-migration), capped at `MAX_SCAN = 1000` with `scanCapped` signaling truncation; plus the active-venue directory with approved-pool counts, per-row fuzzy venue suggestions via `bestVenueMatch`, honest coverage stats (noImageTotal counts photo_ack-dismissed rows too), and a soonest-first sort with Tier-1 dated items on top. The client filters/pages.
- Complexity bar: yes (fuzzy match scoring feeds the desk's attach suggestions; multi-branch fallback scan). Verbatim, lib/imagesServer.ts lines 138-149:
```ts
    let suggestion: VenueSuggestion | null = null;
    if (!venue_id) {
      const thing: MatchableThing = {
        title: t.title as string, address: (t.address as string) ?? null,
        lat: (t.lat as number) ?? null, lng: (t.lng as number) ?? null,
        place_id: (t.place_id as string) ?? null,
      };
      const best = bestVenueMatch(thing, matchableVenues);
      const v = best ? venueById.get(best.venue.id) : undefined;
      if (best && v) {
        suggestion = { venue_id: v.id, display_name: v.display_name, score: best.score, approved_count: v.approved_count };
      }
    }
```
- Tables: reads: things(id, title, address, neighborhood, happening_tier, starts_at, place_id, lat, lng, venue_id, photo_url, photo_source, photo_attribution, photo_options, photo_ack; status='published'), things(head counts: published total and no-image total), venues(id, display_name, place_id, lat, lng, radius_m, name_patterns; status='active'), venue_photos(venue_id; approved=true). writes: none.
- Errors: handles the missing photo_ack column (falls back to the unfiltered scan with a console warning) and a failed scan (console error, empty rows) so the desk renders partial rather than 500. Not handled: `venuesRes` / `photosRes` / count errors unchecked (silently empty) [INFERRED]; a missing service key returns a convincing empty desk with 200 instead of an error [INFERRED].

### API-56 - POST /api/review/approve
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/review/approve/route.ts (161 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 15: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ ids?: string[], photo?: { url: string, source: string }, edits?: EditPayload, hero_eligible?: boolean, overlay_id?: string }` where `EditPayload` (lib/review.ts lines 146-152) is `{ title?, blurb?, blurb_long?, neighborhood?, tags? }` with only changed fields present. Three modes: `overlay_id` set = apply a pending thing_edits overlay to its live row; `edits` with exactly one id = apply-and-publish in one press; otherwise bulk publish of `ids`.
- Response: overlay mode 200 `{ ok: true, applied: overlay_id }`; single-card-with-edits 200 `{ ok: true, published: 1 }`; bulk 200 `{ ok: true, published: ids.length }`. Errors: 400 `{ error: "overlay not pending" }`; 400 `{ error: "no ids" }`; 400 `{ error: "Tag not allowed for this item: ..." }` (explicit illegal tag, e.g. family_day on a 21+ item or free_sb on a non-free item); 401; 500 `{ error: "not configured" }`; 500 `{ error: <message> }` on the things update failure.
- Logic: This is THE single write path to `status='published'`. Full write set:
  - things publish fields: every mode builds a patch of `status: "published"` + `last_confirmed: today` (SB note: overlay mode also re-stamps these on an already-live row), optionally overlaid with title/blurb/blurb_long/neighborhood from the edits (trimmed; empty string coerced to null; neighborhood validated against the NEIGHBORHOODS vocabulary or nulled), photo_url/photo_source when a `photo` was picked, and hero_eligible when a boolean was sent. Core patch, verbatim, app/api/review/approve/route.ts lines 80-83:
```ts
  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = { status: "published", last_confirmed: today };
  if (photo?.url) { patch.photo_url = photo.url; patch.photo_source = photo.source; }
  if (typeof hero_eligible === "boolean") patch.hero_eligible = hero_eligible;
```
  - thing_edits overlay application (mode 1): loads the pending overlay, prefers the request's `edits` over the stored payload (`edits ?? overlay.payload`), refuses non-pending overlays, applies the patch to the LIVE thing row (which stays published), then marks the overlay `status: "applied"` with `resolved_at`, and audits `edit_applied` with the changed fields.
  - tags: when edits carry tags, `filterTags` (lib/review.ts lines 21-29) enforces the negative rules against the row's own facts (is_21_plus strips family_day; non-free price_band strips free_sb); an explicitly illegal occasion tag 400s rather than being silently dropped; on success thing_tags for the row are deleted and reinserted with `confidence: 1.0, tag_source: "founder"`.
  - audit_log: `edit_applied` (overlay), or `approve` per id (single and bulk), payload carrying the changed fields and/or hero_eligible.
  - slug: publish modes (not overlay mode) call `ensureSlugsForThings(sb, ids)` (lib/slug/ensureSlug.ts) which, for each id that is published-and-slugless, generates a collision-safe slug (`disambiguate(makeSlug(title), id, taken)`), writes things.slug, and upserts a `/thing/<uuid>` to `/thing/<slug>` row into url_redirects (onConflict from_path); it never throws (a missed slug self-heals on the nightly sweep).
  - revalidation: every mode ends with `revalidatePublic()` (lib/reviewServer.ts lines 20-26), which revalidates `/`, `/discover`, `/saved`, `/discover/[id]`, and `/thing/[id]` so approved content appears without waiting out the ISR window.
- Complexity bar: yes (three modes, tag-rule calculation gating publish, writes to five tables). Verbatim core publish logic, app/api/review/approve/route.ts lines 147-160:
```ts
  // ---- bulk / no-edits publish ----
  const { error } = await sb.from("things").update(patch).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert(
    ids.map((id) => ({
      entity_type: "thing", entity_id: id, action: "approve", actor: "founder",
      ...(typeof hero_eligible === "boolean" ? { payload: { hero_eligible } } : {}),
    })),
  );
  // G2.1, assign slugs + redirects at publish time (not just the nightly).
  await ensureSlugsForThings(sb, ids);
  revalidatePublic();
  return NextResponse.json({ ok: true, published: ids.length });
```
  And the overlay application core, lines 61-69:
```ts
    const { error } = await sb.from("things").update(patch).eq("id", thingId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (tags !== undefined) {
      await sb.from("thing_tags").delete().eq("thing_id", thingId);
      if (tags.length) {
        await sb.from("thing_tags").insert(tags.map((tag) => ({ thing_id: thingId, tag, confidence: 1.0, tag_source: "founder" })));
      }
    }
    await sb.from("thing_edits").update({ status: "applied", resolved_at: new Date().toISOString() }).eq("id", overlay_id);
```
- Tables: reads: thing_edits(thing_id, payload, status; by overlay_id), things(is_21_plus, price_band; per edited row), things(id, title, slug, status) and things(slug not null) via ensureSlugsForThings; writes: things(status, last_confirmed, title, blurb, blurb_long, neighborhood, photo_url, photo_source, hero_eligible, slug), thing_tags(delete by thing_id; insert thing_id, tag, confidence, tag_source), thing_edits(status, resolved_at), url_redirects(upsert from_path, to_path), audit_log(actions: edit_applied, approve).
- Errors: handles auth, config, non-pending overlay, empty ids, illegal tags (400 with the offending tag names), and the primary things update error (500). ensureSlugsForThings deliberately never throws. Not handled: malformed JSON body [INFERRED]; when `edits` is sent alongside more than one id the edits are silently ignored and it becomes a bulk publish [INFERRED]; thing_tags delete/insert and thing_edits status-update errors are unchecked, a tags write failure after a successful publish leaves the row published with stale tags and no signal [INFERRED]; overlay mode does not verify the overlay's live row still exists or is published before stamping `status: "published"` onto it [INFERRED]; no validation that photo.source is one of the known enum values [INFERRED].

### API-57 - POST /api/review/image-fetch
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/review/image-fetch/route.ts (53 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 16: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ id?: string }` (a single thing id).
- Response: 200 `{ ok: true, options: ImageOption[], count: number, message: string }` where message is either "Found N free photo option(s), arrow through and approve." or the no-hit motif fallback message. Errors: 400 `{ error: "id required" }`; 404 `{ error: <message or "not found"> }` when the row is missing or the read fails; 401; 500 `{ error: "not configured" }`.
- Logic: Single-card free image fetch for a queue card with no options (a former Phase-13 stub, wired 2026-07-11). Runs the same `findFreeCandidates` as the desk prefetch (Wikimedia geosearch top-5 with coords + best title-search hit, gated and scored, never Google, never the paid cap), merges with existing photo_options deduped by URL, persists to `photo_options` only when a new URL appeared, and returns the merged list so the queue card can show the picker immediately.
- Complexity bar: yes (the gate/score/rank candidate calculation feeds what the founder can approve onto a publishable row). Verbatim, app/api/review/image-fetch/route.ts lines 30-43:
```ts
  const existing = (data.photo_options as ImageOption[]) ?? [];
  const options = await findFreeCandidates({
    title: data.title as string,
    neighborhood: (data.neighborhood as string) ?? null,
    happening_category: (data.happening_category as string) ?? null,
    lat: (data.lat as number) ?? null,
    lng: (data.lng as number) ?? null,
  }, existing);

  const before = new Set(existing.filter((o) => o.url).map((o) => o.url));
  const found = options.filter((o) => o.url).length;
  if (options.some((o) => o.url && !before.has(o.url))) {
    await sb.from("things").update({ photo_options: options }).eq("id", id);
  }
```
- Tables: reads: things(id, title, neighborhood, happening_category, lat, lng, photo_options); writes: things(photo_options).
- Errors: handles auth, config, missing id, missing/unreadable row (404). Wikimedia failures degrade to zero fresh candidates. Not handled: malformed JSON body [INFERRED]; the photo_options update error is unchecked (options are returned as if persisted) [INFERRED]; `count` includes the pre-existing options, not just newly found ones, so the "Found N" message can overstate what this fetch discovered [INFERRED].

### API-58 - GET /api/review/queue
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/review/queue/route.ts (11 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 9: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: no parameters.
- Response: 200 with `CockpitData` from `loadCockpitData()` (lib/reviewServer.ts): `{ queue: QueueRow[], drops: DropRow[], sources: SourceRow[], metrics: ConfidenceMetrics, merges: MergedRow[] }`. QueueRows carry the full card shape (see lib/review.ts lines 60-97) including formatted `when`, trust `chip`, `data_confidence` + recomputed `confidence_reasons`, per-row `registrySnippet` for registry-proposal rhythms, and overlay rows carrying `overlay_id`/`edit_of`. Metrics are the Phase-3-scoped gate counters `{ autoPublished, autoHeld, manuallyApproved, autoPublishRatePct, queueDepth }`. Error: 401 only; with the service key missing it returns the empty shape with 200.
- Logic: One call builds the whole cockpit: the needs_review queue (mapped via `mapThingRow`, confidence reasons recomputed from source authority/reliability metadata), pending thing_edits overlays merged over their live rows and pinned to the top, the last 40 ingest drops, per-source health rollups from the last 40 runs, gate metrics counted from audit_log since 2026-07-16 (deliberately not all-time so the auto-publish rate means something), and up to 40 reversible dedupe merges with survivor titles. Queue ordering is `[...overlays, ...prioritize(queueRaw)]`: highest data_confidence first, soonest start as the tiebreak.
- Complexity bar: yes (the prioritize calculation ranks the review queue; the metrics computation feeds the publish-gate dashboard). Verbatim, lib/review.ts lines 257-267:
```ts
export function prioritize<T extends { starts_at: string | null; data_confidence?: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ca = a.data_confidence ?? -1;
    const cb = b.data_confidence ?? -1;
    if (ca !== cb) return cb - ca;
    if (a.starts_at && b.starts_at) return a.starts_at.localeCompare(b.starts_at);
    if (a.starts_at) return -1;
    if (b.starts_at) return 1;
    return 0; // both start-less, keep DB order (fetched newest-first)
  });
}
```
- Tables: reads: sources(key, authority, reliability, lane), things(the THINGS_SELECT column list incl. embedded thing_tags(tag) and recurring_schedules(day_of_week, start_time, end_time, frequency, label); status='needs_review'), thing_edits(id, thing_id, payload, created_at + embedded things row; status='pending'), ingest_drops(id, source, title, reason, detail, source_url), source_runs(source, landed, fetched, ok, started_at), audit_log(head counts by action: auto_publish, auto_hold, approve, since 2026-07-16), things(head count status='needs_review'; and merged rows: id, title, merged_into, event_key, updated_at plus survivor id, title). writes: none.
- Errors: resilient by design: a failed queue read logs and renders empty, a missing thing_edits table returns no overlays, a failed sources read degrades confidence reasons to generic, merged-rows failures log and return []. Not handled: drops/runs read errors are unchecked (silently empty) [INFERRED]; a missing service key yields a convincing empty cockpit at 200 [INFERRED].

### API-59 - POST /api/review/reject
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/review/reject/route.ts (42 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 10: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ id?: string, reason?: string, overlay_id?: string }`. `overlay_id` set = discard a pending edit overlay; otherwise `id` = archive a thing.
- Response: overlay mode 200 `{ ok: true, discarded: overlay_id }`; thing mode 200 `{ ok: true }`. Errors: 400 `{ error: "overlay not pending" }`; 400 `{ error: "no id" }`; 401; 500 `{ error: "not configured" }`; 500 `{ error: <message> }` on the things update failure.
- Logic: Two distinct rejections. Overlay mode: loads the thing_edits row, refuses unless `status === "pending"`, marks it `status: "discarded"` with `resolved_at`, audits `edit_discarded` with the reason; the live row is untouched and nothing is revalidated. Thing mode: sets `things.status = "archived"` (the deterministic uuid5 id keeps the item dq'd on any future re-ingest of the same source row), audits `reject` with the reason, and calls `revalidatePublic()` so an archived-from-published row disappears from the public surfaces promptly.
- Complexity bar: yes (two modes, writes to two tables per mode across things/thing_edits + audit_log). Verbatim, app/api/review/reject/route.ts lines 17-26:
```ts
  // ---- overlay rejection: discard the pending edit; the live row is untouched ----
  if (overlay_id) {
    const { data: overlay } = await sb.from("thing_edits").select("thing_id, status").eq("id", overlay_id).single();
    if (!overlay || overlay.status !== "pending") return NextResponse.json({ error: "overlay not pending" }, { status: 400 });
    await sb.from("thing_edits").update({ status: "discarded", resolved_at: new Date().toISOString() }).eq("id", overlay_id);
    await sb.from("audit_log").insert({
      entity_type: "thing", entity_id: overlay.thing_id, action: "edit_discarded", actor: "founder",
      payload: { overlay_id, reason: reason ?? null },
    });
    return NextResponse.json({ ok: true, discarded: overlay_id });
  }
```
- Tables: reads: thing_edits(thing_id, status; by overlay_id); writes: thing_edits(status='discarded', resolved_at) or things(status='archived'), audit_log(actions: edit_discarded, reject).
- Errors: handles auth, config, non-pending overlay, missing id, and the things update error. Not handled: malformed JSON body [INFERRED]; the thing_edits status update error is unchecked (a failed discard still returns ok, and the overlay would reappear in the queue) [INFERRED]; archiving a nonexistent id succeeds silently (zero-row update) [INFERRED]; `reason` is free text with no length cap into the audit payload [INFERRED].

### API-60 - POST /api/review/update
- File: /Users/jameslightbody/Documents/sb-daymaker/app/api/review/update/route.ts (74 lines)
- Auth: `getAdminUser()` Supabase session cookie check; line 13: `if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`. Unauthenticated request receives 401 with body `{"error":"unauthorized"}`.
- Request: JSON body `{ id?: string, blurb?: string, blurb_long?: string, neighborhood?: string | null, tags?: string[], photo?: { url: string, source: string } | null }`.
- Response: 200 `{ ok: true, tags: string[], neighborhood: string | null }` (the server-filtered final values, so the client can reflect any silently dropped tags). Errors: 400 `{ error: "no id" }`; 401; 500 `{ error: "not configured" }`; 500 `{ error: <message> }` on the things update failure.
- Logic: Founder inline edit of voice + classification ONLY, status is not touched and the start time is intentionally not editable here (to change a time, reject and re-ingest so the gate re-runs). Reads the row's is_21_plus/price_band facts, validates neighborhood against the NEIGHBORHOODS vocabulary (invalid becomes null), runs `filterTags` (drops non-vocabulary tags; strips family_day for 21+ rows and free_sb for non-free rows, silently here, unlike approve's 400), patches blurb/blurb_long/neighborhood (empty strings coerced to null) plus photo_url/photo_source when an alternate image was picked, then REPLACES the row's thing_tags with the filtered set (`confidence: 1.0, tag_source: "founder"`), audits `edit`, and calls `revalidatePublic()`.
- Complexity bar: yes (tag-rule calculation, writes to three tables). Verbatim, app/api/review/update/route.ts lines 49-62:
```ts
  if (body.photo?.url) {
    patch.photo_url = body.photo.url;
    patch.photo_source = body.photo.source;
  }
  const { error: upErr } = await sb.from("things").update(patch).eq("id", body.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Replace the row's tags with the founder-approved set (tag_source='founder').
  await sb.from("thing_tags").delete().eq("thing_id", body.id);
  if (tags.length) {
    await sb.from("thing_tags").insert(
      tags.map((tag) => ({ thing_id: body.id, tag, confidence: 1.0, tag_source: "founder" })),
    );
  }
```
- Tables: reads: things(is_21_plus, price_band); writes: things(blurb, blurb_long, neighborhood, and conditionally photo_url, photo_source), thing_tags(delete by thing_id; insert thing_id, tag, confidence, tag_source), audit_log(action='edit', payload: { neighborhood, tags }).
- Errors: handles auth, config, missing id, and the things update error. Not handled: malformed JSON body [INFERRED]; illegal tags are silently dropped rather than 400ing (inconsistent with approve's explicit rejection, though the response does return the surviving set) [INFERRED]; thing_tags delete/insert errors unchecked, a failed reinsert after a successful delete would strip the row's tags entirely with a 200 [INFERRED]; omitting blurb/blurb_long in the body nulls them (patch always includes them via `?.trim() || null`), so a partial-body caller can unintentionally erase copy [INFERRED]; updating a nonexistent id returns ok [INFERRED].
