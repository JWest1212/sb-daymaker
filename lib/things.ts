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
  reason_to_go: string | null;
  happening_tier: number;
  happening_category: string | null;
  neighborhood: string | null;
  nearby_zone: Zone | null;
  price_band: string | null;
  free: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  time_of_day_fit: string[] | null;
  is_21_plus: boolean;
  indoor: boolean;
  tags: OccasionKey[];
  happyHours: HappyHourWindow[];
  recurring: RecurringSchedule[];
}

/** All published things with their tags, happy-hour windows, and schedules.
 *  RLS exposes only published rows to the publishable key. */
export async function getPublishedThings(): Promise<Thing[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("things")
    .select(
      `id, type, title, blurb, reason_to_go, happening_tier, happening_category,
       neighborhood, nearby_zone, price_band, free, starts_at, ends_at,
       time_of_day_fit, is_21_plus, indoor,
       thing_tags ( tag ),
       happy_hour_windows ( day_of_week, starts_local, ends_local, deal_text ),
       recurring_schedules ( category, day_of_week, start_time, end_time, label )`,
    )
    .order("happening_tier", { ascending: true });

  if (error || !data) return [];

  return data.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      type: row.type as ThingType,
      title: row.title as string,
      blurb: (row.blurb as string) ?? null,
      reason_to_go: (row.reason_to_go as string) ?? null,
      happening_tier: (row.happening_tier as number) ?? 3,
      happening_category: (row.happening_category as string) ?? null,
      neighborhood: (row.neighborhood as string) ?? null,
      nearby_zone: (row.nearby_zone as Zone) ?? null,
      price_band: (row.price_band as string) ?? null,
      free: (row.free as boolean) ?? null,
      starts_at: (row.starts_at as string) ?? null,
      ends_at: (row.ends_at as string) ?? null,
      time_of_day_fit: (row.time_of_day_fit as string[]) ?? null,
      is_21_plus: (row.is_21_plus as boolean) ?? false,
      indoor: (row.indoor as boolean) ?? false,
      tags: ((row.thing_tags as { tag: OccasionKey }[]) ?? []).map((t) => t.tag),
      happyHours: (row.happy_hour_windows as HappyHourWindow[]) ?? [],
      recurring: (row.recurring_schedules as RecurringSchedule[]) ?? [],
    };
  });
}
