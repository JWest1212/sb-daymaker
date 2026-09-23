# R1 Wave 1: Stop the Loss

Purpose: stop the site from deleting saves, restore the 533 published listings hidden by the 1,000-row ceiling, make the share link visible, and keep every surface in step after an ingest. All S1 except W1.5 and W1.6. No checkpoint in this wave.

Findings closed: SAV-001, SAV-002 (reframed), SHR-001, OPP-004, OPP-005, TP-A1-01 to TP-A1-12, TP-A3-01 to TP-A3-05, TP-A4-05, TP-A9-06 (pool part), TP-A2-11 (counts over a truncated pool).

Decisions in force: D1, D2 (query half only; retirement is Wave 2).

## W1.1 Saved resolves saves by id and never deletes (SavedClient.tsx, lib/things.ts)

- Add `getThingsByIds(ids: string[])` to lib/things.ts: `.in("id", ids)` in chunks of 200, `status in ('published','archived')`, no tier filter, no quality filter, no row ceiling. Return a map keyed by id.
- /saved renders from that map, not from the published pool. Keep ISR on the page shell; fetch the saved items client-side after hydration (saves live in localStorage, so this fetch must be client-side; use the anon client, which RLS already limits to published rows; archived rows are readable by the anon role through the `things_read_archived` policy in the index's DDL paste; confirm it exists at kickoff).
- Delete the ghost-save cleanup effect entirely (SavedClient.tsx:76-81). Replace with: an id the lookup does not return renders as a compact "No longer listed" card with the saved title if known, a Remove control, and no auto-removal.
- Archived items render normally with an "Already happened, [date]" line and keep want/been state, because "Did you make it?" depends on past items surviving.
- Guides and detail pages already write `thing_id` to the same store. Make lib/guides.ts `getStopThingMap()` and the Saved lookup share the same select shape so a guide can never offer a heart on something Saved cannot render.
- Unit test: a saves map with three ids where the lookup returns two renders two cards plus one "No longer listed" card and calls `remove` zero times.

## W1.2 The public pool excludes finished events and never truncates (lib/things.ts getPublishedThings)

- Add a server-side date predicate: keep rows where `starts_at is null` (evergreen and recurring) or `coalesce(ends_at, starts_at + interval '4 hours') >= now() - interval '1 day'`. Express it as a PostgREST `or` filter; if that proves awkward, a SQL view `things_public` (Jim pastes; read-only) is acceptable. Do not filter in JavaScript after the fetch.
- Add explicit `.limit(2000)` and read the `content-range` total. If the total exceeds the returned count, log a server warning with both numbers and page a second request so the pool is never silently short.
- Keep `order("happening_tier", asc)` and the `quality_tier === 3` drop.
- Do not change the cascade sort keys.
- Unit test for the predicate builder: a row that ended yesterday passes, a row that ended two days ago does not, evergreen passes.

## W1.3 Pool consumers agree (lib/guides.ts, lib/things.ts)

- `getStopThingMap()` and `getThingsByIds()` use one shared select constant with `getPublishedThings()` so every surface renders the same fields.
- Search indexes the same pool as Explore (whatever search reads today; find it, do not rewrite it).

## W1.4 Backup from the first save (SavedClient.tsx:388, RestorePanel.tsx)

- Show the restore panel at `counts.total >= 1`. At 1 to 4 saves render the compact form: one line, "Back up this list to your email", the field, and Send. At 5 or more keep the current panel.
- Copy stays as built; it already handles `sent: false` honestly.

## W1.5 The share link is always visible (components/saved/share.ts, the share UI on Saved and Plan)

- `shareUrl()` keeps trying `navigator.share` first. On any outcome other than a resolved share (unsupported, rejected, dismissed, or thrown), render the link in a small sheet with the URL, a Copy link button, and a confirmation "Copied" state. Never return to the list silently.
- Apply to single-item share, multi-select share, and Plan's "Share day".
- Analytics: `share_create` still fires once per link.

## W1.6 Caches refresh after an ingest (ingest/run.ts, app/api/revalidate/route.ts)

- Add `POST /api/revalidate` gated by `Authorization: Bearer ${CRON_SECRET}` (same secret the reaper uses). It calls the existing `revalidatePublic()` helper.
- At the end of a successful `ingest/run.ts` run, POST to it with the site URL from env. Log the response. Failure to revalidate is logged, never fatal.
- Lower `revalidate` on /saved, /plan, /discover, /discover/[id] from 600 to 300 as a safety net.
- Investigate TP-A3-03 (the detail route declares ISR but serves no-store). Report the cause; fix only if it is a one-line opt-out such as an unguarded `cookies()` or `headers()` call.

## Do not touch in this wave

- Past-event archiving (Wave 2). The retention filter above is read-time only.
- Card layout, area logic, Plan.

## Acceptance (Claude Code runs at 390px; report failures only)

1. TP-A1 repro: in a fresh browser, save the Santa Barbara Wine Festival from its detail page and Helena Avenue Bakery from the Funk Zone guide, open /saved. Both remain. `sbd.saves.v1` still holds both ids.
2. All 16 thing-backed guide stops across both guides survive a save and appear on /saved.
3. `getPublishedThings()` returns every published, unfinished row; a server log shows the content-range total equals the returned count. The Month view count on / rises to reflect evergreen places; 72 happening_tier 2 and 3 rows are present in the pool.
4. Search for "Helena Avenue Bakery" returns it.
5. A saved id that is not in the database renders "No longer listed" with Remove, and is not auto-deleted across three reloads.
6. With 1 save, the backup form is visible on /saved. Sending to jim@sourcewyse.com returns the inbox message and the link restores in a fresh profile.
7. On desktop Chrome, "Share 2 selected" shows a sheet with the URL and Copy link. Copy works. Same on Plan.
8. `curl -sI /saved` shows the new revalidate window; `POST /api/revalidate` without the secret returns 401, with it returns 200.
9. Test suite green with the new tests added.

Commit: `fix(r1-w1): saves resolve by id, pool excludes finished events, share link visible, revalidate after ingest`
