// lib/recurringRhythmsServer.ts
//
// Server-only DB access for the Recurring Rhythms cockpit surface (Data Arch
// Redesign, recurring-registry spec, Phase 3). Reads/writes `recurring_rhythms`,
// the table ingest/adapters/recurringRegistry.ts's nightly fetch() now reads.

import { getAdminSupabase } from "./supabaseAdmin";
import { slugifyVenueKey } from "./venuePool";
import type { RecurringRhythmRow, RecurringRhythmInput } from "./recurringRhythms";

export async function loadRecurringRhythms(): Promise<RecurringRhythmRow[]> {
  const sb = getAdminSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("recurring_rhythms")
    .select("*")
    .order("active", { ascending: false })
    .order("title");
  if (error) { console.error("[recurringRhythms] read failed:", error.message); return []; }

  return (data ?? []) as RecurringRhythmRow[];
}

export interface MutateResult { ok: boolean; error?: string }

export async function addRecurringRhythm(input: RecurringRhythmInput): Promise<MutateResult> {
  const sb = getAdminSupabase();
  if (!sb) return { ok: false, error: "no admin client" };

  const title = input.title.trim();
  const venue = input.venue.trim();
  const address = input.address.trim();
  const sourceUrl = input.sourceUrl.trim();
  if (!title || !venue || !address || !sourceUrl) {
    return { ok: false, error: "title, venue, address, and source URL are required" };
  }

  const slug = slugifyVenueKey(title);
  const { error } = await sb.from("recurring_rhythms").insert({
    slug,
    title,
    venue,
    address,
    neighborhood: input.neighborhood,
    category: input.category,
    reason_to_go: input.reasonToGo.trim(),
    frequency: input.frequency,
    source_url: sourceUrl,
    days: [input.day],
    occasion_tags: input.occasionTags && input.occasionTags.length > 0 ? input.occasionTags : null,
    active: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface RecurringRhythmEdit {
  title?: string;
  venue?: string;
  address?: string;
  neighborhood?: string;
  category?: string;
  reasonToGo?: string;
  frequency?: string;
  sourceUrl?: string;
  day?: RecurringRhythmInput["day"];
  occasionTags?: string[] | null;
  active?: boolean;
}

export async function updateRecurringRhythm(id: string, edit: RecurringRhythmEdit): Promise<MutateResult> {
  const sb = getAdminSupabase();
  if (!sb) return { ok: false, error: "no admin client" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (edit.title !== undefined) patch.title = edit.title.trim();
  if (edit.venue !== undefined) patch.venue = edit.venue.trim();
  if (edit.address !== undefined) patch.address = edit.address.trim();
  if (edit.neighborhood !== undefined) patch.neighborhood = edit.neighborhood;
  if (edit.category !== undefined) patch.category = edit.category;
  if (edit.reasonToGo !== undefined) patch.reason_to_go = edit.reasonToGo.trim();
  if (edit.frequency !== undefined) patch.frequency = edit.frequency;
  if (edit.sourceUrl !== undefined) patch.source_url = edit.sourceUrl.trim();
  if (edit.day !== undefined) patch.days = [edit.day];
  if (edit.occasionTags !== undefined) {
    patch.occasion_tags = edit.occasionTags && edit.occasionTags.length > 0 ? edit.occasionTags : null;
  }
  if (edit.active !== undefined) patch.active = edit.active;

  const { error } = await sb.from("recurring_rhythms").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
