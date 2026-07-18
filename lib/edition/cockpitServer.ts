// lib/edition/cockpitServer.ts
//
// Server-only data access for the cockpit "Edition Draft" module (spec §5).
// Mirrors lib/reviewServer.ts's shape (service-role reads, kept separate from
// client-safe pure code). All writes happen in the API routes, not here, this
// file is read-only.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { titleCaseNeighborhood } from "./format";
import { whenString, dropRetiredPhotoOptions } from "../review";
import type { EditionSlot } from "./types";
import type { PhotoOption } from "../review";
import type {
  CockpitThing, CockpitPick, CockpitCandidate, EditionSummary, EditionDraftDetail, ArchiveRow,
} from "./cockpitTypes";

export type { CockpitThing, CockpitPick, CockpitCandidate, EditionSummary, EditionDraftDetail, ArchiveRow };

const THING_SELECT = `id, title, blurb, blurb_long, neighborhood, photo_url, photo_options, happening_tier, starts_at,
  recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`;

interface ThingJoinRow {
  id: string;
  title: string;
  blurb: string | null;
  blurb_long: string | null;
  neighborhood: string | null;
  photo_url: string | null;
  photo_options: PhotoOption[] | null;
  happening_tier: number;
  starts_at: string | null;
  recurring_schedules: { day_of_week: number | null; start_time: string | null; end_time: string | null; frequency: string | null; label: string | null }[] | null;
}

function toCockpitThing(t: ThingJoinRow): CockpitThing {
  return {
    id: t.id,
    title: t.title,
    blurb: t.blurb,
    blurb_long: t.blurb_long,
    neighborhood: t.neighborhood ? titleCaseNeighborhood(t.neighborhood) : null,
    photo_url: t.photo_url,
    photo_options: dropRetiredPhotoOptions(t.photo_options ?? []),
    when: whenString(t.happening_tier, t.starts_at, t.recurring_schedules ?? []),
    happening_tier: t.happening_tier,
  };
}

/** Editions still reachable/editable in the reviewer (the worklist). 'skipped'
 *  (the cockpit's "Hold" status) belongs here, not in the archive: it isn't a
 *  terminal state, it stays fully editable and reversible. Its one real
 *  effect is that send.ts will NOT send it (an explicit operator opt-out),
 *  unlike 'draft'/'approved' which both send at the normal time. */
export async function loadPendingEditions(sb: SupabaseClient): Promise<EditionSummary[]> {
  const { data, error } = await sb
    .from("editions")
    .select("id, edition_date, edition_type, status, subject")
    .in("status", ["draft", "approved", "skipped"])
    .order("edition_date", { ascending: true });
  if (error) throw new Error(`cockpit: pending editions select failed: ${error.message}`);
  return (data ?? []) as EditionSummary[];
}

export async function loadEditionDraftDetail(sb: SupabaseClient, editionId: string): Promise<EditionDraftDetail | null> {
  const { data: ed, error } = await sb.from("editions").select("*").eq("id", editionId).maybeSingle();
  if (error) throw new Error(`cockpit: edition select failed: ${error.message}`);
  if (!ed) return null;

  const [picksRes, candsRes] = await Promise.all([
    sb
      .from("edition_picks")
      .select(`id, slot, position, thing_id, override_title, override_blurb, override_when,
        override_neighborhood, override_local_note, override_image_url, cached_image_url, is_manual,
        things ( ${THING_SELECT} )`)
      .eq("edition_id", editionId)
      .order("slot")
      .order("position"),
    sb
      .from("edition_candidates")
      .select(`slot, rank, selected, thing_id, things ( ${THING_SELECT} )`)
      .eq("edition_id", editionId)
      .order("slot")
      .order("rank"),
  ]);
  if (picksRes.error) throw new Error(`cockpit: picks select failed: ${picksRes.error.message}`);
  if (candsRes.error) throw new Error(`cockpit: candidates select failed: ${candsRes.error.message}`);

  const picks: CockpitPick[] = (picksRes.data ?? []).map((r) => ({
    id: r.id as string,
    slot: r.slot as EditionSlot,
    position: r.position as number,
    thingId: r.thing_id as string,
    thing: toCockpitThing(r.things as unknown as ThingJoinRow),
    override_title: r.override_title as string | null,
    override_blurb: r.override_blurb as string | null,
    override_when: r.override_when as string | null,
    override_neighborhood: r.override_neighborhood as string | null,
    override_local_note: r.override_local_note as string | null,
    override_image_url: r.override_image_url as string | null,
    cached_image_url: r.cached_image_url as string | null,
    is_manual: r.is_manual as boolean,
  }));

  const candidates: CockpitCandidate[] = (candsRes.data ?? []).map((r) => ({
    slot: r.slot as EditionSlot,
    rank: r.rank as number,
    selected: r.selected as boolean,
    thing: toCockpitThing(r.things as unknown as ThingJoinRow),
  }));

  return {
    id: ed.id,
    edition_date: ed.edition_date,
    edition_type: ed.edition_type,
    status: ed.status,
    subject: ed.subject,
    preheader: ed.preheader,
    greeting: ed.greeting,
    skip_reason: ed.skip_reason,
    approved_at: ed.approved_at,
    sent_at: ed.sent_at,
    sent_count: ed.sent_count ?? 0,
    open_count: ed.open_count ?? 0,
    click_count: ed.click_count ?? 0,
    picks,
    candidates,
  };
}

export async function loadEditionArchive(sb: SupabaseClient): Promise<ArchiveRow[]> {
  const { data, error } = await sb
    .from("editions")
    .select("edition_date, edition_type, status, subject, sent_count, open_count, click_count")
    .in("status", ["sent", "failed"])
    .order("edition_date", { ascending: false })
    .limit(100);
  if (error) throw new Error(`cockpit: archive select failed: ${error.message}`);
  return (data ?? []) as ArchiveRow[];
}
