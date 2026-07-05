import { getSupabase } from "./supabase";
import type { Thing } from "./things";
import type { OccasionKey } from "./occasions";
import type { Zone } from "./zones";

export type GuideKind = "neighborhood" | "theme";

export interface GuideStop {
  position: number;
  label: string;
  note: string | null;
  thing_id: string | null;
  /** Chapter number (1-based). Defaults to 1 for plain guides. */
  chapter: number;
  /** Label-only-stop authored sub-line. Null for thing-backed stops (derived at render). */
  sub: string | null;
  /** Directions deep-link override text query. Thing lat/lng used when null. */
  maps_query: string | null;
}

export interface Guide {
  id: string;
  title: string;
  kicker: string | null;
  intro: string | null;
  kind: GuideKind;
  zone: Zone | null;
  tag: OccasionKey | null;
  cover_url: string | null;
  /** Two-letter passport stamp code (e.g. "FZ"). Null for plain guides. */
  stamp_code: string | null;
  /** Editorial freshness date (ISO "YYYY-MM-DD"). Drives "REFRESHED JUL 2026". */
  refreshed_on: string | null;
  /** "Right now" block body text. Null = block is hidden. Edited in cockpit. */
  now_note: string | null;
  /** ISO date when now_note was last updated. Drives "updated Jun 28". */
  now_note_on: string | null;
  /** Raw jsonb from guides.content. Parse with parseGuideContent(). */
  content: unknown;
}

function mapGuide(row: Record<string, unknown>): Guide {
  return {
    id: row.id as string,
    title: row.title as string,
    kicker: (row.kicker as string) ?? null,
    intro: (row.intro as string) ?? null,
    kind: row.kind as GuideKind,
    zone: (row.zone as Zone) ?? null,
    tag: (row.tag as OccasionKey) ?? null,
    cover_url: (row.cover_url as string) ?? null,
    stamp_code: (row.stamp_code as string) ?? null,
    refreshed_on: (row.refreshed_on as string) ?? null,
    now_note: (row.now_note as string) ?? null,
    now_note_on: (row.now_note_on as string) ?? null,
    content: row.content ?? {},
  };
}

function mapStop(row: Record<string, unknown>): GuideStop {
  return {
    position: row.position as number,
    label: row.label as string,
    note: (row.note as string) ?? null,
    thing_id: (row.thing_id as string) ?? null,
    chapter: typeof row.chapter === "number" ? row.chapter : 1,
    sub: (row.sub as string) ?? null,
    maps_query: (row.maps_query as string) ?? null,
  };
}

export async function getPublishedGuides(): Promise<Guide[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("guides")
    .select("id, title, kicker, intro, kind, zone, tag, cover_url, stamp_code, refreshed_on, now_note, now_note_on, content")
    .eq("status", "published")
    .order("kind", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => mapGuide(r as Record<string, unknown>));
}

export async function getGuide(
  id: string,
): Promise<{ guide: Guide; stops: GuideStop[] } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("guides")
    .select(
      "id, title, kicker, intro, kind, zone, tag, cover_url, stamp_code, refreshed_on, now_note, now_note_on, content, guide_stops ( position, label, note, thing_id, chapter, sub, maps_query )",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  const stops = ((row.guide_stops as Record<string, unknown>[]) ?? [])
    .map(mapStop)
    .sort((a, b) => a.position - b.position);
  return { guide: mapGuide(row), stops };
}

/** Fetch the minimal thing fields needed to derive stop sub-lines and directions
 *  URLs. Only thing_ids present in the guide_stops are fetched. */
export async function getStopThingMap(
  thingIds: string[],
): Promise<Map<string, StopThingFields & { id: string }>> {
  const ids = [...new Set(thingIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const sb = getSupabase();
  if (!sb) return new Map();
  const { data, error } = await sb
    .from("things")
    .select("id, category, address, lat, lng, price_band, free")
    .in("id", ids);
  if (error || !data) return new Map();
  const map = new Map<string, StopThingFields & { id: string }>();
  for (const row of data as Record<string, unknown>[]) {
    map.set(row.id as string, {
      id: row.id as string,
      category: (row.category as string) ?? null,
      address: (row.address as string) ?? null,
      lat: (row.lat as number) ?? null,
      lng: (row.lng as number) ?? null,
      price_band: (row.price_band as string) ?? null,
      free: (row.free as boolean) ?? null,
    });
  }
  return map;
}

/** Live happenings scoped to a guide. */
export function matchGuideThings(guide: Guide, things: Thing[]): Thing[] {
  if (guide.kind === "neighborhood") {
    return guide.zone ? things.filter((t) => t.nearby_zone === guide.zone) : [];
  }
  return guide.tag ? things.filter((t) => t.tags.includes(guide.tag!)) : [];
}

// ───────────────────────────────────────────────────────────────────────────
// Living Postcard — content model (Phase 1)
//
// Pure types + helpers only. No query or UI wiring this phase: the selects in
// getPublishedGuides/getGuide stay byte-identical so the render is provably
// additive (spec §5), and no page reads these yet (that's Phase 2).
//
// The `GuideContent` shape encodes the approved jsonb model verbatim — see
// docs/discover-sb/Phase1_Content_Model_FunkZone_Paper.md §A3. An empty `{}`
// parses to all-empty defaults, which render a plain v1 guide (the additivity
// guarantee). The parser is tolerant: missing keys → defaults, wrong types →
// coerced, unknown keys ignored, never throws.
// ───────────────────────────────────────────────────────────────────────────

/** Meta row (+ Phase-6 FAQ source). */
export interface GuideContentMeta {
  /** Walking distance in miles (display-only). */
  distance_mi: number | null;
  /** Suggested plan length as an [min, max] hours range. */
  plan_hrs: number[];
}

/** Time-of-day band for a chapter; drives the deterministic "Now" tag from the
 *  clock. Content vocabulary — note "golden" is content-only, distinct from the
 *  DB `tod` enum (morning|afternoon|evening|late). */
export type ChapterTod = "morning" | "afternoon" | "golden" | "evening";

/** Copy for one chapter band; the array index aligns with `guide_stops.chapter`. */
export interface GuideChapter {
  /** Band label, e.g. "Stops 1–3 · Morning". */
  k: string | null;
  /** Chapter name. */
  name: string | null;
  /** One-line summary. */
  sum: string | null;
  /** Time-of-day band (null if unrecognized). */
  tod: ChapterTod | null;
}

/** A "From a local" aside, placed after a given chapter (0 = before ch.1). */
export interface GuideAside {
  after_chapter: number | null;
  text: string | null;
}

/** One ranked item in the editorial "take" (bold lead + trailing sentence). */
export interface GuideTakeItem {
  b: string | null;
  rest: string | null;
}

/** The editorial "take" block. */
export interface GuideTake {
  h: string | null;
  items: GuideTakeItem[];
  landing: string | null;
}

/** A know-before row (also the Phase-6 FAQ / structured-data source). */
export interface GuideKnowBefore {
  k: string | null;
  v: string | null;
}

/** Static postcard caption buckets (e.g. `b1_3`, `b4_6`, …). No AI at tap time. */
export type GuidePostcardCaptions = Record<string, string>;

/** Repo sketch/emblem asset reference — the art itself lives in lib/guide-art.ts. */
export interface GuideSketch {
  kind: "sketch" | "emblem";
  /** Asset id in the lib/guide-art.ts registry (null → renderer falls back). */
  asset: string | null;
  /** Colophon plate number. */
  no: number | null;
}

/** Parsed shape of `guides.content` (jsonb). Empty `{}` → all-empty defaults. */
export interface GuideContent {
  meta: GuideContentMeta;
  chapters: GuideChapter[];
  asides: GuideAside[];
  take: GuideTake;
  know_before: GuideKnowBefore[];
  postcard_captions: GuidePostcardCaptions;
  secret_tease: string | null;
  sketch: GuideSketch;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asNumberArray(v: unknown): number[] {
  return Array.isArray(v)
    ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    : [];
}

const CHAPTER_TODS: ReadonlySet<string> = new Set([
  "morning",
  "afternoon",
  "golden",
  "evening",
]);

function asTod(v: unknown): ChapterTod | null {
  return typeof v === "string" && CHAPTER_TODS.has(v) ? (v as ChapterTod) : null;
}

/** Tolerant parser for `guides.content`. Missing keys → empty defaults, unknown
 *  keys ignored, wrong-typed values coerced. Never throws — bad data degrades to
 *  a plain guide rather than a broken page. */
export function parseGuideContent(raw: unknown): GuideContent {
  const empty: GuideContent = {
    meta: { distance_mi: null, plan_hrs: [] },
    chapters: [],
    asides: [],
    take: { h: null, items: [], landing: null },
    know_before: [],
    postcard_captions: {},
    secret_tease: null,
    sketch: { kind: "sketch", asset: null, no: null },
  };
  if (!isRecord(raw)) return empty;

  const metaRaw = isRecord(raw.meta) ? raw.meta : {};
  const takeRaw = isRecord(raw.take) ? raw.take : {};
  const sketchRaw = isRecord(raw.sketch) ? raw.sketch : {};

  const chapters: GuideChapter[] = Array.isArray(raw.chapters)
    ? raw.chapters.filter(isRecord).map((c) => ({
        k: asString(c.k),
        name: asString(c.name),
        sum: asString(c.sum),
        tod: asTod(c.tod),
      }))
    : [];

  const asides: GuideAside[] = Array.isArray(raw.asides)
    ? raw.asides.filter(isRecord).map((a) => ({
        after_chapter: asNumber(a.after_chapter),
        text: asString(a.text),
      }))
    : [];

  const take: GuideTake = {
    h: asString(takeRaw.h),
    items: Array.isArray(takeRaw.items)
      ? takeRaw.items.filter(isRecord).map((i) => ({
          b: asString(i.b),
          rest: asString(i.rest),
        }))
      : [],
    landing: asString(takeRaw.landing),
  };

  const know_before: GuideKnowBefore[] = Array.isArray(raw.know_before)
    ? raw.know_before.filter(isRecord).map((r) => ({
        k: asString(r.k),
        v: asString(r.v),
      }))
    : [];

  const postcard_captions: GuidePostcardCaptions = {};
  if (isRecord(raw.postcard_captions)) {
    for (const [k, v] of Object.entries(raw.postcard_captions)) {
      if (typeof v === "string") postcard_captions[k] = v;
    }
  }

  return {
    meta: {
      distance_mi: asNumber(metaRaw.distance_mi),
      plan_hrs: asNumberArray(metaRaw.plan_hrs),
    },
    chapters,
    asides,
    take,
    know_before,
    postcard_captions,
    secret_tease: asString(raw.secret_tease),
    sketch: {
      kind: sketchRaw.kind === "emblem" ? "emblem" : "sketch",
      asset: asString(sketchRaw.asset),
      no: asNumber(sketchRaw.no),
    },
  };
}

// ─── Stop derivations (Call-1 rules, spec §3.2–3.3) ─────────────────────────
// Minimal structural inputs so these stay pure and unit-testable without
// pulling the full Guide/Thing DB-mapped types (which this phase doesn't widen).

/** The `guide_stops` fields the derivations read. */
export interface StopDeriveFields {
  thing_id: string | null;
  sub: string | null;
  maps_query: string | null;
}

/** The `things` fields the derivations read (subset of the schema `things`). */
export interface StopThingFields {
  address: string | null;
  category: string | null;
  price_band: string | null;
  free: boolean | null;
  lat: number | null;
  lng: number | null;
}

/** First comma-segment of an address with a leading house number stripped:
 *  "1112 State St, Santa Barbara, CA" → "State St". Null/blank → null. */
function shortStreet(address: string | null): string | null {
  if (!address) return null;
  const seg = address.split(",")[0].trim();
  if (!seg) return null;
  const stripped = seg.replace(/^\d+[A-Za-z]?\s+/, "").trim();
  return stripped || null;
}

/** Price glyph: `free` → "Free"; else the `price_band` value ($/$$/$$$) as-is;
 *  null band (and not free) → null (omit the segment). */
function priceGlyph(price_band: string | null, free: boolean | null): string | null {
  if (free) return "Free";
  return price_band && price_band !== "free" ? price_band : null;
}

/** Derive a stop's sub-line (spec §3.2).
 *  - thing-backed stop → built from thing data (street · category · price);
 *    segments whose source field is null are omitted — never a placeholder.
 *  - label-only stop (thing_id null) → the stored `sub` verbatim (or null).
 *  Pure. */
export function deriveStopSub(
  stop: Pick<StopDeriveFields, "thing_id" | "sub">,
  thing: StopThingFields | null,
): string | null {
  if (stop.thing_id === null || thing == null) return stop.sub ?? null;
  const segments = [
    shortStreet(thing.address),
    thing.category ?? null,
    priceGlyph(thing.price_band, thing.free),
  ].filter((s): s is string => !!s);
  return segments.length > 0 ? segments.join(" · ") : null;
}

/** Directions URL for a stop (spec §3.3).
 *  - `maps_query` set → a text-query maps link;
 *  - else thing lat/lng → a coordinate maps link;
 *  - else null (card renders no ⌖ link).
 *  Pure. */
export function directionsUrl(
  stop: Pick<StopDeriveFields, "maps_query">,
  thing: Pick<StopThingFields, "lat" | "lng"> | null,
): string | null {
  if (stop.maps_query) {
    return `https://maps.google.com/?q=${encodeURIComponent(stop.maps_query)}`;
  }
  if (thing && thing.lat != null && thing.lng != null) {
    return `https://maps.google.com/?q=${thing.lat},${thing.lng}`;
  }
  return null;
}
