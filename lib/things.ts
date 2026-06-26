import { getSupabase } from "./supabase";
import type { OccasionKey } from "./occasions";
import type { Zone } from "./zones";

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
  happening_category: string | null;
  neighborhood: string | null;
  nearby_zone: Zone | null;
  price_band: string | null;
  free: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  buy_url: string | null;
  time_of_day_fit: string[] | null;
  is_21_plus: boolean;
  indoor: boolean;
  photo_url: string | null;
  photo_source: string | null;
  tags: OccasionKey[];
  happyHours: HappyHourWindow[];
  recurring: RecurringSchedule[];
}

// Base columns used by the feeds. local_note is added only for the detail
// query (getThing), so the feeds keep working before phase7.sql runs.
const BASE_COLS = `id, type, title, blurb, blurb_long, reason_to_go,
  happening_tier, happening_category, neighborhood, nearby_zone, price_band, free,
  starts_at, ends_at, buy_url, time_of_day_fit, is_21_plus, indoor, photo_url, photo_source`;
const RELATIONS = `thing_tags ( tag ),
  happy_hour_windows ( day_of_week, starts_local, ends_local, deal_text ),
  recurring_schedules ( category, day_of_week, start_time, end_time, label )`;
const SELECT = `${BASE_COLS}, ${RELATIONS}`;
const SELECT_DETAIL = `${BASE_COLS}, local_note, ${RELATIONS}`;

function mapThing(row: Record<string, unknown>): Thing {
  return {
    id: row.id as string,
    type: row.type as ThingType,
    title: row.title as string,
    blurb: (row.blurb as string) ?? null,
    blurb_long: (row.blurb_long as string) ?? null,
    local_note: (row.local_note as string) ?? null,
    reason_to_go: (row.reason_to_go as string) ?? null,
    happening_tier: (row.happening_tier as number) ?? 3,
    happening_category: (row.happening_category as string) ?? null,
    neighborhood: (row.neighborhood as string) ?? null,
    nearby_zone: (row.nearby_zone as Zone) ?? null,
    price_band: (row.price_band as string) ?? null,
    free: (row.free as boolean) ?? null,
    starts_at: (row.starts_at as string) ?? null,
    ends_at: (row.ends_at as string) ?? null,
    buy_url: (row.buy_url as string) ?? null,
    time_of_day_fit: (row.time_of_day_fit as string[]) ?? null,
    is_21_plus: (row.is_21_plus as boolean) ?? false,
    indoor: (row.indoor as boolean) ?? false,
    photo_url: (row.photo_url as string) ?? null,
    photo_source: (row.photo_source as string) ?? null,
    tags: ((row.thing_tags as { tag: OccasionKey }[]) ?? []).map((t) => t.tag),
    happyHours: (row.happy_hour_windows as HappyHourWindow[]) ?? [],
    recurring: (row.recurring_schedules as RecurringSchedule[]) ?? [],
  };
}

/** All published things with their tags, happy-hour windows, and schedules.
 *  RLS exposes only published rows to the publishable key. */
export async function getPublishedThings(): Promise<Thing[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("things")
    .select(SELECT)
    .order("happening_tier", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => mapThing(r as Record<string, unknown>));
}

/** A single published thing by id (or null). */
export async function getThing(id: string): Promise<Thing | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // Prefer the detail select (with local_note); fall back to base columns if the
  // column isn't there yet (before phase7.sql runs).
  let { data, error } = await sb
    .from("things")
    .select(SELECT_DETAIL)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    ({ data, error } = await sb
      .from("things")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle());
  }
  if (error || !data) return null;
  return mapThing(data as Record<string, unknown>);
}
