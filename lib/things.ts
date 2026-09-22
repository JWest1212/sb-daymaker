import { getSupabase } from "./supabase";
import { freshnessOrFilter } from "./poolFilter";
import type { OccasionKey } from "./occasions";
import type { Zone } from "./zones";
import type { ActivityKey } from "./activities";
import { getDogFriendlyVenueIds } from "./venues";
import { cleanText } from "./text/stripEmDash";
import type { HourSpec } from "./format/openNow";

export type ThingType = "place" | "event" | "firstlook" | "happyhour";

export interface HappyHourWindow {
  day_of_week: number;
  starts_local: string;
  ends_local: string;
  deal_text: string | null;
}

export interface RecurringSchedule {
  category: string;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  label: string | null;
  /** Elevation v1 · Gate 3 · G3.4, cadence fields for computing the next date. */
  frequency: string | null;
  cadence: string | null;
  nth_dow: number | null;
  last_confirmed: string | null;
}

/** The lifecycle states a row the public can read may be in. R1 Wave 1 (W1.1)
 *  and Wave 2 (W2.2): `archived` rows are deliberately readable by the anon role
 *  so a saved, shared or restored link never 404s on something that already
 *  happened. They are never part of the browse pool. */
export type ThingStatus = "published" | "archived";

export interface Thing {
  id: string;
  type: ThingType;
  /** R1 W1.1. Surfaced so Saved and the detail page can mark an archived row
   *  "already happened" instead of treating it as missing. */
  status: ThingStatus;
  title: string;
  blurb: string | null;
  blurb_long: string | null;
  local_note: string | null;
  reason_to_go: string | null;
  happening_tier: number;
  /** Founder curation nudge (−5..+5, default 0). Consumed by cascade()/pickAutoHero.
   *  This is explicitly-permitted editorial curation, NOT sponsor status. The ranker
   *  must never read is_featured/sponsor_id (schema §A7). */
  editorial_weight: number;
  happening_category: string | null;
  neighborhood: string | null;
  nearby_zone: Zone | null;
  /** Elevation v1 · Gate 1 · G1.3, the street address (schema field, now surfaced). */
  address: string | null;
  /** R1 W2.4. Fit to be the day's pick. Distinct from "fit to list": a row can be
   *  perfectly good in the feed and still a poor front-page recommendation.
   *  Defaults to true when absent so the degraded fallback select cannot make
   *  every row ineligible and blank the pick. */
  hero_eligible: boolean;
  /** R1 W2.3. A municipal meeting. Never in the public pool; see D3/D14. */
  is_civic: boolean;
  /** The source URL this row came from. R1 W3.1 reads it to tell a library's
   *  cooking class (programming) from a restaurant. */
  source: string | null;
  /** R1 W5.1. The venue lifted out of a "Title | Venue" pattern. Rendered in the
   *  card meta line, never in the title. */
  venue_name: string | null;
  /** R1 W5.5. Human price text, e.g. "$15 to $25" or "Free, RSVP". Preferred
   *  over the coarse band when present. */
  price_note: string | null;
  /** R1 W5.2. Identity of a recurring series (normalized title + venue +
   *  weekday), so occurrences can collapse to one card per series. */
  series_key: string | null;
  lat: number | null;
  lng: number | null;
  price_band: string | null;
  free: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  buy_url: string | null;
  /** Elevation v1 · Gate 1 · G1.1, editorial completeness tier (1 full / 2 compact /
   *  3 hidden). Distinct from happening_tier (structure). getPublishedThings filters
   *  out tier 3, so nothing public is ever tier 3; defaults to 1 when unscored. */
  quality_tier: number;
  /** Gate 1 · G1.5, stored open-hours [{dow,open,close}] in SB-local time. */
  hours: HourSpec[] | null;
  /** Gate 1 · G1.6, verification stamp source of truth. */
  verified_at: string | null;
  verified_by: string | null;
  /** Gate 1 · G1.6 fallback for the stamp date; also the freshness signal. */
  last_confirmed: string | null;
  /** Gate 1 · G1.3, indoor/outdoor nuance (the `indoor` bit can't say "both"). */
  setting: "indoor" | "outdoor" | "both" | null;
  /** Gate 1 · G1.7, the outdoor "Before you go" practical note. */
  practical_note: string | null;
  /** Elevation v1 · Gate 2 · G2.1, the semantic URL slug (canonical path). */
  slug: string | null;
  /** Gate 2 · G2.7, drives sitemap lastModified. */
  updated_at: string | null;
  time_of_day_fit: string[] | null;
  is_21_plus: boolean;
  indoor: boolean;
  photo_url: string | null;
  photo_source: string | null;
  /** Card Imagery Build Spec Phase 1 §4.3, non-owned photo credit, rendered on the
   *  detail page only (never the card rail). Detail-select-only field, like local_note. */
  photo_attribution: string | null;
  /** Card Imagery Build Spec Phase 3 §6.1/§6.2, the motif tier. Set only when
   *  `photo_source === 'motif'`; `visual_key` is null for a `'bigtype'` kind (the
   *  D8 fallback computes its own text from other fields, not a registry lookup). */
  visual_kind: "motif" | "bigtype" | null;
  visual_key: string | null;
  visual_seed: number | null;
  /** Card Imagery Build Spec Phase 2 §5.1, the venue this thing is attached to (if
   *  any), the join key for the venue photo pool + per-feed dedupe (lib/venuePool.ts). */
  venue_id: string | null;
  tags: OccasionKey[];
  /** Home Rework spec §6, the Activity taxonomy (supabase/migrations/
   *  20260711_activities.sql, additive, not yet applied as of Phase 4). Defaults to
   *  `[]`, both when a thing genuinely has none, and (via getPublishedThings'
   *  fallback select) when the migration hasn't landed on this DB yet. */
  activities: ActivityKey[];
  happyHours: HappyHourWindow[];
  recurring: RecurringSchedule[];
}

// Base columns used by the feeds. local_note is added only for the detail
// query (getThing), so the feeds keep working before phase7.sql runs.
const BASE_COLS = `id, type, title, blurb, blurb_long, reason_to_go, status, venue_name, price_note, series_key,
  happening_tier, editorial_weight, happening_category, neighborhood, nearby_zone, price_band, free,
  starts_at, ends_at, buy_url, time_of_day_fit, is_21_plus, indoor, photo_url, photo_source, venue_id,
  visual_kind, visual_key, visual_seed`;
// Elevation v1 · Gate 1 additive columns. Kept OUT of BASE_COLS (the safe
// fallback select) so a DB that somehow lacks them still renders a degraded feed
// rather than 400ing both the primary and the fallback. Same "prefer the richer
// select, fall back if it 400s" posture the activities/local_note columns use.
const G1_COLS = `quality_tier, hours, verified_at, verified_by, last_confirmed, setting, address, lat, lng, practical_note, slug, updated_at, hero_eligible, is_civic, source`;
// G1.9, `confidence` now comes back with each tag so the read path can order the
// card/detail chips by it (the card shows the single highest-confidence tag).
const RELATIONS = `thing_tags ( tag, confidence ),
  happy_hour_windows ( day_of_week, starts_local, ends_local, deal_text ),
  recurring_schedules ( category, day_of_week, start_time, end_time, label, frequency, cadence, nth_dow, last_confirmed )`;
/** R1 W1.1/W1.3. The statuses the public may read at all. The browse pool is
 *  narrower still (published only); this is the set an id lookup resolves over,
 *  so a save, a share or a restore can render something that already happened. */
export const PUBLIC_STATUSES = ["published", "archived"] as const;

const SELECT = `${BASE_COLS}, ${RELATIONS}`;
const SELECT_DETAIL = `${BASE_COLS}, ${G1_COLS}, local_note, photo_attribution, ${RELATIONS}`;
// Home Rework spec §6, same "select the new column, fall back if it 400s"
// pattern getThing() already uses for local_note/photo_attribution below.
const SELECT_WITH_ACTIVITIES = `${BASE_COLS}, ${G1_COLS}, activities, ${RELATIONS}`;

function mapThing(row: Record<string, unknown>, dogFriendlyVenueIds: Set<string> = new Set()): Thing {
  const indoor = (row.indoor as boolean) ?? false;
  // Doc 22 §2.2, Rainy Day is a read-time derivation from `indoor`, not a
  // stored tag: no DDL, no batch write, always in sync with `indoor`.
  // G1.9, order the stored tags by confidence (desc) so tags[0] is the single
  // highest-confidence occasion, the card chip and the detail's top chip derive
  // from the same ordered set (no arbitrary divergence). Stable for equal/absent
  // confidence (older rows may have null); derived tags append after.
  const tags = ((row.thing_tags as { tag: OccasionKey; confidence: number | null }[]) ?? [])
    .map((t, i) => ({ tag: t.tag, confidence: t.confidence ?? 0, i }))
    .sort((a, b) => b.confidence - a.confidence || a.i - b.i)
    .map((t) => t.tag);
  if (indoor && !tags.includes("rainy_day")) tags.push("rainy_day");
  // Occasion Tags spec §3, same read-time-derivation pattern, from the
  // resolved venue's founder-marked flag instead of a thing column.
  const venueId = row.venue_id as string | null;
  if (venueId && dogFriendlyVenueIds.has(venueId) && !tags.includes("dog_friendly")) tags.push("dog_friendly");
  return {
    id: row.id as string,
    type: row.type as ThingType,
    // Defaults to "published": the fallback select (BASE_COLS without status, on
    // a DB that somehow lacks it) must not make every row look archived.
    status: ((row.status as ThingStatus) ?? "published"),
    // G0.9 render guard: the shared normalizer is the last line of defense, so a
    // user never sees an em dash even if a stray one is in the DB.
    title: cleanText(row.title as string),
    blurb: cleanText((row.blurb as string) ?? null),
    blurb_long: cleanText((row.blurb_long as string) ?? null),
    local_note: cleanText((row.local_note as string) ?? null),
    reason_to_go: cleanText((row.reason_to_go as string) ?? null),
    happening_tier: (row.happening_tier as number) ?? 3,
    editorial_weight: (row.editorial_weight as number) ?? 0,
    happening_category: (row.happening_category as string) ?? null,
    neighborhood: (row.neighborhood as string) ?? null,
    nearby_zone: (row.nearby_zone as Zone) ?? null,
    address: (row.address as string) ?? null,
    hero_eligible: (row.hero_eligible as boolean) ?? true,
    is_civic: (row.is_civic as boolean) ?? false,
    source: (row.source as string) ?? null,
    venue_name: cleanText((row.venue_name as string) ?? null),
    price_note: cleanText((row.price_note as string) ?? null),
    series_key: (row.series_key as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
    price_band: (row.price_band as string) ?? null,
    free: (row.free as boolean) ?? null,
    starts_at: (row.starts_at as string) ?? null,
    ends_at: (row.ends_at as string) ?? null,
    buy_url: (row.buy_url as string) ?? null,
    // Gate 1. quality_tier defaults to 1 (full) when unscored/absent, so the
    // degraded fallback-select path never silently demotes or hides everything;
    // real rows carry their scored value (see ingest/audits/tier_backfill.ts).
    quality_tier: (row.quality_tier as number) ?? 1,
    hours: (row.hours as HourSpec[]) ?? null,
    verified_at: (row.verified_at as string) ?? null,
    verified_by: (row.verified_by as string) ?? null,
    last_confirmed: (row.last_confirmed as string) ?? null,
    setting: (row.setting as Thing["setting"]) ?? null,
    practical_note: cleanText((row.practical_note as string) ?? null),
    slug: (row.slug as string) ?? null,
    updated_at: (row.updated_at as string) ?? null,
    time_of_day_fit: (row.time_of_day_fit as string[]) ?? null,
    is_21_plus: (row.is_21_plus as boolean) ?? false,
    indoor,
    photo_url: (row.photo_url as string) ?? null,
    photo_source: (row.photo_source as string) ?? null,
    photo_attribution: (row.photo_attribution as string) ?? null,
    visual_kind: (row.visual_kind as Thing["visual_kind"]) ?? null,
    visual_key: (row.visual_key as string) ?? null,
    visual_seed: (row.visual_seed as number) ?? null,
    venue_id: (row.venue_id as string) ?? null,
    tags,
    activities: (row.activities as ActivityKey[]) ?? [],
    happyHours: (row.happy_hour_windows as HappyHourWindow[]) ?? [],
    recurring: (row.recurring_schedules as RecurringSchedule[]) ?? [],
  };
}

/** Page size for the pool read. PostgREST enforces its own `db-max-rows` ceiling
 *  (1,000 on this project) and silently truncates to it, so this is an upper
 *  bound on each request, not a promise about the total. `fetchAllPages` below
 *  keeps requesting until the server's reported total is satisfied. */
const POOL_PAGE_SIZE = 1000;
/** Hard stop, so a runaway count can never loop forever. */
const POOL_MAX_PAGES = 10;

/**
 * All published, not-yet-finished things with their tags, happy-hour windows and
 * schedules. The single chokepoint every public surface reads through.
 *
 * R1 Wave 1 (W1.2). Three things were wrong here and all three deleted saves:
 *
 * 1. **No `status` filter.** This query trusted RLS to decide what "published"
 *    meant. Once the R1 DDL let the anon role read archived rows (so a saved or
 *    shared link can still render something that already happened), archived
 *    rows started flowing straight into the browse pool. Measured: 436 of the
 *    998 rows the homepage rendered. The status predicate now lives here, where
 *    it is visible, rather than being an emergent property of a policy in
 *    another system.
 * 2. **No date filter.** 1,108 of 1,529 published rows were events that had
 *    already happened, which is what pushed the catalog past the row ceiling.
 * 3. **No paging.** PostgREST caps a response at `db-max-rows` and says so only
 *    in `content-range`. The old query never read it, so the pool was silently
 *    truncated to the first 1,000 rows sorted by `happening_tier`. Because 1,457
 *    tier-1 rows already exceeded the cap, every one of the 72 evergreen places
 *    (tier 2 and 3) fell out of the catalog, and /saved then deleted anything it
 *    could not see. See docs/audits/2026-09-21-technical-pass.md TP-A1.
 *
 * The cascade sort keys (`happening_tier`, then `starts_at` downstream) are
 * unchanged, per the R1 invariants. Filtering is added around them, never inside.
 */
export async function getPublishedThings(now: Date = new Date()): Promise<Thing[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const freshness = freshnessOrFilter(now);

  // Prefer the select with `activities`; fall back if the migration hasn't been
  // applied yet (same pattern getThing() uses for local_note/photo_attribution).
  const page = (select: string, from: number) =>
    sb
      .from("things")
      .select(select, { count: "exact" })
      .eq("status", "published")
      // R1 W2.3 (D3/D14). Civic meetings keep ingesting for a possible future
      // civic surface, but they never reach a leisure feed. Excluded here, at
      // the single chokepoint, so Explore, Saved, Discover, Plan, share and
      // search all inherit it rather than each remembering to filter.
      .eq("is_civic", false)
      .or(freshness)
      .order("happening_tier", { ascending: true })
      .range(from, from + POOL_PAGE_SIZE - 1);

  const [probe, dogFriendlyVenueIds] = await Promise.all([
    page(SELECT_WITH_ACTIVITIES, 0),
    getDogFriendlyVenueIds(),
  ]);
  const select = probe.error ? SELECT : SELECT_WITH_ACTIVITIES;
  const first = probe.error ? await page(SELECT, 0) : probe;
  if (first.error || !first.data) return [];

  const rows = [...first.data];
  const total = first.count ?? rows.length;
  for (let p = 1; rows.length < total && p < POOL_MAX_PAGES; p++) {
    const next = await page(select, p * POOL_PAGE_SIZE);
    if (next.error || !next.data || next.data.length === 0) break;
    rows.push(...next.data);
  }
  if (rows.length < total) {
    // Never silent. If this ever fires the pool is short and something upstream
    // (a raised db-max-rows, a catalog past POOL_MAX_PAGES) needs attention.
    console.warn(
      `[getPublishedThings] pool is short: fetched ${rows.length} of ${total} rows`,
    );
  }

  // Gate 1 · G1.1, quality_tier=3 is quarantined: never rendered in the public
  // feed (it "sits in the cockpit as needs work"). The admin cockpit uses its own
  // service-role query.
  return rows
    .map((r) => mapThing(r as unknown as Record<string, unknown>, dogFriendlyVenueIds))
    .filter((t) => t.quality_tier !== 3);
}

/** Chunk size for the `in("id", ...)` lookup. Keeps the URL well inside any
 *  proxy's length limit while staying far below the row ceiling. */
const BY_ID_CHUNK = 200;

/**
 * R1 Wave 1 (W1.1). Resolve specific things by id, for surfaces that already
 * know exactly what they are looking for: the saved list, a shared list, a
 * restore link.
 *
 * Deliberately unlike the browse pool. There is no tier filter, no
 * `quality_tier` drop, no freshness predicate and no row ceiling, and archived
 * rows are included. A visitor saved this thing on purpose; the fact that it has
 * since finished, been demoted, or been archived is something to TELL them, not
 * a reason to pretend it never existed. /saved used to diff its saves against the
 * browse pool and delete anything missing, which is how a truncated pool erased
 * real saves off people's phones (TP-A1-01, TP-A1-10).
 *
 * Ids that do not resolve are simply absent from the returned map. The caller
 * renders those as "no longer listed"; it must never delete them.
 */
/**
 * R1 W7.4. The database could not be asked, as opposed to "asked, and these ids
 * are not there". The two must never be confused: Saved treats an id the
 * database answered for and did not return as "No longer listed", so reporting
 * a dropped connection as an empty answer would label every save as gone.
 */
export class ThingsUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThingsUnreachableError";
  }
}

export async function getThingsByIds(
  ids: string[],
  opts: { timeoutMs?: number } = {},
): Promise<Map<string, Thing>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Thing>();
  if (unique.length === 0) return map;
  const sb = getSupabase();
  if (!sb) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BY_ID_CHUNK) chunks.push(unique.slice(i, i + BY_ID_CHUNK));

  // R1 W7.4. An optional deadline. Supabase's client retries a failed request
  // with backoff and never throws, so without one an offline visitor waits out
  // every retry on a "Loading" line before learning anything.
  const signal = opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined;
  const lookup = (select: string, chunk: string[]) => {
    const q = sb.from("things").select(select).in("id", chunk).in("status", [...PUBLIC_STATUSES]);
    return signal ? q.abortSignal(signal) : q;
  };

  const [dogFriendlyVenueIds, ...results] = await Promise.all([
    getDogFriendlyVenueIds(signal),
    ...chunks.map((chunk) => lookup(SELECT_WITH_ACTIVITIES, chunk)),
  ]);

  for (let i = 0; i < results.length; i++) {
    const result = results[i].error ? await lookup(SELECT, chunks[i]) : results[i];
    // R1 W7.4. Both selects failed: the database was not reached (or refused
    // the query outright). Say so; never report it as "these ids are gone".
    if (result.error) throw new ThingsUnreachableError(result.error.message);
    if (!result.data) continue;
    for (const row of result.data) {
      const thing = mapThing(row as unknown as Record<string, unknown>, dogFriendlyVenueIds);
      map.set(thing.id, thing);
    }
  }
  return map;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A single published thing matched on `column = value` (or null). Shared by the
 *  id and slug lookups; keeps the "prefer the rich select, fall back on 400"
 *  posture getThing has always used. */
async function fetchThing(column: "id" | "slug", value: string): Promise<Thing | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // R1 W1.1. Published or archived, stated here rather than left to RLS. An
  // archived detail page must still resolve so a saved or shared link never
  // 404s on something that already happened; W2.2 adds the banner that says so.
  const lookup = (select: string) =>
    sb.from("things").select(select).eq(column, value).in("status", [...PUBLIC_STATUSES]).maybeSingle();
  const [detail, dogFriendlyVenueIds] = await Promise.all([
    lookup(SELECT_DETAIL),
    getDogFriendlyVenueIds(),
  ]);
  let { data, error } = detail;
  if (error) {
    ({ data, error } = await lookup(SELECT));
  }
  if (error || !data) return null;
  return mapThing(data as unknown as Record<string, unknown>, dogFriendlyVenueIds);
}

/** A single published thing by id (or null). */
export async function getThing(id: string): Promise<Thing | null> {
  return fetchThing("id", id);
}

/** Elevation v1 · Gate 2 · G2.2, resolve a /thing/[param] path by SLUG first,
 *  falling back to a UUID (the old opaque path) for safety. The route param is
 *  the same segment either way, so a bare UUID and a slug both land here. */
export async function getThingBySlugOrId(param: string): Promise<Thing | null> {
  if (UUID_RE.test(param)) return fetchThing("id", param);
  return fetchThing("slug", param);
}

/**
 * R1 W6.9 (TP-B-05). Drop the fields no browse surface reads, before the pool
 * crosses to the client.
 *
 * The homepage was shipping 935 KB of HTML: 408 rows, every column, so a client
 * component could render fourteen cards. Most of that weight is text only the
 * detail page shows. Nothing here changes what the SERVER fetched (the detail
 * page, the plan engine and the sitemap still read the full row from their own
 * queries); it changes what gets serialized into the page.
 *
 * Each field below was checked against every reader on the browse path. The
 * three that look droppable and are not (`buy_url`, `setting`, `last_confirmed`,
 * all read by components/explore/derive.ts) are deliberately kept.
 */
const NOT_ON_BROWSE = [
  "blurb_long",      // detail page only
  "local_note",      // detail page only
  "practical_note",  // detail page only
  "hours",           // the plan engine's open-hours check, from its own query
  "updated_at",      // the sitemap's lastModified, from its own query
  "photo_source",    // attribution, shown on the detail page
  "verified_at",     // the detail page's "Verified" stamp
  "verified_by",
] as const satisfies readonly (keyof Thing)[];

export function stripForBrowse(things: Thing[]): Thing[] {
  return things.map((t) => {
    const out = { ...t };
    for (const k of NOT_ON_BROWSE) (out as Record<string, unknown>)[k] = null;
    return out;
  });
}

/** How many rows to scan before deduping. The list shows at most 5, but a zone
 *  full of one weekly series needs headroom to find 5 DISTINCT titles. */
const NEARBY_SCAN_LIMIT = 200;

/** Collapse a title to its comparable form: case, punctuation and whitespace
 *  removed, so "Recreation Swim | Oak Park Wading Pool" and "Recreation Swim |
 *  Oak Park Wading Pool " are one thing. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * R1 W2.6. One row per normalized title, keeping the first (the caller has
 * already ordered soonest-first), so a recurring series contributes one entry
 * instead of filling the list.
 *
 * The audit's case: /thing/recreation-swim-oak-park-wading-pool listed
 * "Recreation Swim | Oak Park Wading Pool" three times, the same title as the
 * page the visitor was standing on (TP-A7-06).
 */
export function dedupeByTitle(things: Thing[]): Thing[] {
  const seen = new Set<string>();
  const out: Thing[] = [];
  for (const t of things) {
    const key = normalizeTitle(t.title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Elevation v1 · Gate 3 · G3.5, up to `limit` published things in the same
 *  nearby_zone (excluding the thing itself), Tier-1 (dated) first, for the detail
 *  page's "Nearby" pairing. Deterministic (no AI). Excludes quality_tier=3. */
export async function getNearbyThings(
  zone: Zone,
  excludeId: string,
  limit = 5,
  now: Date = new Date(),
): Promise<Thing[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const query = (select: string) =>
    sb
      .from("things")
      .select(select)
      .eq("status", "published")
      // R1 W2.3, a municipal meeting is not a suggestion for what else to do.
      .eq("is_civic", false)
      .eq("nearby_zone", zone)
      .neq("id", excludeId)
      // R1 W2.6, the nearby list is a "what else is near here" list, so a
      // finished event has no business in it. Same freshness rule as the pool.
      .or(freshnessOrFilter(now))
      .order("happening_tier", { ascending: true })
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(NEARBY_SCAN_LIMIT);
  const [primary, dogFriendlyVenueIds] = await Promise.all([
    query(SELECT_WITH_ACTIVITIES),
    getDogFriendlyVenueIds(),
  ]);
  const result = primary.error ? await query(SELECT) : primary;
  if (result.error || !result.data) return [];
  return dedupeByTitle(
    result.data
      .map((r) => mapThing(r as unknown as Record<string, unknown>, dogFriendlyVenueIds))
      .filter((t) => t.quality_tier !== 3),
  ).slice(0, limit);
}
