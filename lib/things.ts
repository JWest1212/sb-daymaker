import { getSupabase } from "./supabase";
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

export interface Thing {
  id: string;
  type: ThingType;
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
const BASE_COLS = `id, type, title, blurb, blurb_long, reason_to_go,
  happening_tier, editorial_weight, happening_category, neighborhood, nearby_zone, price_band, free,
  starts_at, ends_at, buy_url, time_of_day_fit, is_21_plus, indoor, photo_url, photo_source, venue_id,
  visual_kind, visual_key, visual_seed`;
// Elevation v1 · Gate 1 additive columns. Kept OUT of BASE_COLS (the safe
// fallback select) so a DB that somehow lacks them still renders a degraded feed
// rather than 400ing both the primary and the fallback. Same "prefer the richer
// select, fall back if it 400s" posture the activities/local_note columns use.
const G1_COLS = `quality_tier, hours, verified_at, verified_by, last_confirmed, setting, address, lat, lng, practical_note, slug, updated_at`;
// G1.9, `confidence` now comes back with each tag so the read path can order the
// card/detail chips by it (the card shows the single highest-confidence tag).
const RELATIONS = `thing_tags ( tag, confidence ),
  happy_hour_windows ( day_of_week, starts_local, ends_local, deal_text ),
  recurring_schedules ( category, day_of_week, start_time, end_time, label, frequency, cadence, nth_dow, last_confirmed )`;
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

/** All published things with their tags, happy-hour windows, and schedules.
 *  RLS exposes only published rows to the publishable key. */
export async function getPublishedThings(): Promise<Thing[]> {
  const sb = getSupabase();
  if (!sb) return [];
  // Prefer the select with `activities`; fall back if the migration hasn't been
  // applied yet (same pattern getThing() uses for local_note/photo_attribution).
  const [primary, dogFriendlyVenueIds] = await Promise.all([
    sb.from("things").select(SELECT_WITH_ACTIVITIES).order("happening_tier", { ascending: true }),
    getDogFriendlyVenueIds(),
  ]);
  const result = primary.error
    ? await sb.from("things").select(SELECT).order("happening_tier", { ascending: true })
    : primary;
  if (result.error || !result.data) return [];
  // Gate 1 · G1.1, quality_tier=3 is quarantined: never rendered in the public
  // feed (it "sits in the cockpit as needs work"). This is the single public
  // chokepoint, every public surface (Explore, Saved, Discover, Plan, share,
  // search) reads through here; the admin cockpit uses its own service-role query.
  return result.data
    .map((r) => mapThing(r as Record<string, unknown>, dogFriendlyVenueIds))
    .filter((t) => t.quality_tier !== 3);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A single published thing matched on `column = value` (or null). Shared by the
 *  id and slug lookups; keeps the "prefer the rich select, fall back on 400"
 *  posture getThing has always used. */
async function fetchThing(column: "id" | "slug", value: string): Promise<Thing | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const [detail, dogFriendlyVenueIds] = await Promise.all([
    sb.from("things").select(SELECT_DETAIL).eq(column, value).maybeSingle(),
    getDogFriendlyVenueIds(),
  ]);
  let { data, error } = detail;
  if (error) {
    ({ data, error } = await sb.from("things").select(SELECT).eq(column, value).maybeSingle());
  }
  if (error || !data) return null;
  return mapThing(data as Record<string, unknown>, dogFriendlyVenueIds);
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

/** Elevation v1 · Gate 3 · G3.5, up to `limit` published things in the same
 *  nearby_zone (excluding the thing itself), Tier-1 (dated) first, for the detail
 *  page's "Nearby" pairing. Deterministic (no AI). Excludes quality_tier=3. */
export async function getNearbyThings(
  zone: Zone,
  excludeId: string,
  limit = 3,
): Promise<Thing[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const [primary, dogFriendlyVenueIds] = await Promise.all([
    sb
      .from("things")
      .select(SELECT_WITH_ACTIVITIES)
      .eq("nearby_zone", zone)
      .neq("id", excludeId)
      .order("happening_tier", { ascending: true }),
    getDogFriendlyVenueIds(),
  ]);
  const result = primary.error
    ? await sb.from("things").select(SELECT).eq("nearby_zone", zone).neq("id", excludeId).order("happening_tier", { ascending: true })
    : primary;
  if (result.error || !result.data) return [];
  return result.data
    .map((r) => mapThing(r as Record<string, unknown>, dogFriendlyVenueIds))
    .filter((t) => t.quality_tier !== 3)
    .slice(0, limit);
}
