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
  };
}

export async function getPublishedGuides(): Promise<Guide[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("guides")
    .select("id, title, kicker, intro, kind, zone, tag, cover_url")
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
      "id, title, kicker, intro, kind, zone, tag, cover_url, guide_stops ( position, label, note, thing_id )",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  const stops = ((row.guide_stops as GuideStop[]) ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);
  return { guide: mapGuide(row), stops };
}

/** Live happenings scoped to a guide. */
export function matchGuideThings(guide: Guide, things: Thing[]): Thing[] {
  if (guide.kind === "neighborhood") {
    return guide.zone ? things.filter((t) => t.nearby_zone === guide.zone) : [];
  }
  return guide.tag ? things.filter((t) => t.tags.includes(guide.tag!)) : [];
}
