// lib/edition/renderData.ts
//
// The DB adapter for the renderer (edition_build_spec.md §4, §6.1). Loads an
// edition + its picks, applies `override_* ?? thing.field` (spec §4 — editing
// a draft never mutates the canonical thing), and hands the pure renderer
// (render.ts) a fully-resolved RenderableEdition. Shared by the public
// permalink route and, later, the cockpit draft preview (same renderer,
// never forked, per spec §5.1).

import type { SupabaseClient } from "@supabase/supabase-js";
import { sbDay } from "../explore";
import { whenString } from "../review";
import { titleCaseNeighborhood } from "./format";
import { EDITION_CONFIG, weekdayOf } from "./window";
import type { RenderPick, RenderableEdition } from "./render";
import type { EditionSlot, EditionType } from "./types";

const DOW_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DATE_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export interface ThingRow {
  title: string;
  blurb: string | null;
  blurb_long: string | null;
  local_note: string | null;
  reason_to_go: string | null;
  neighborhood: string | null;
  starts_at: string | null;
  happening_tier: number;
  photo_attribution: string | null;
  recurring_schedules: {
    day_of_week: number | null; label: string | null;
    start_time: string | null; end_time: string | null; frequency: string | null;
  }[] | null;
}

interface PickRow {
  slot: EditionSlot;
  position: number;
  thing_id: string;
  override_title: string | null;
  override_blurb: string | null;
  override_when: string | null;
  override_neighborhood: string | null;
  override_local_note: string | null;
  override_image_url: string | null;
  cached_image_url: string | null;
  things: ThingRow;
}

const PICK_SELECT = `slot, position, thing_id, override_title, override_blurb, override_when,
  override_neighborhood, override_local_note, override_image_url, cached_image_url,
  things ( title, blurb, blurb_long, local_note, reason_to_go, neighborhood, starts_at, happening_tier,
    photo_attribution, recurring_schedules ( day_of_week, label, start_time, end_time, frequency ) )`;

/** Noon-UTC anchor for a "YYYY-MM-DD" key (same convention as window.ts /
 *  heroServer.ts) — safely within the same SB calendar day regardless of DST,
 *  since noon UTC is always early-morning Pacific, same date either way. */
function dateLabelAnchor(sbDateKey: string): Date {
  const [y, m, d] = sbDateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function dayLabelFor(t: ThingRow): string | null {
  if (t.starts_at) return DOW_LABEL[weekdayOf(sbDay(new Date(t.starts_at).getTime()))];
  const scheds = t.recurring_schedules ?? [];
  const withLabel = scheds.find((s) => s.label);
  if (withLabel?.label) return withLabel.label;
  const withDow = scheds.find((s) => s.day_of_week != null);
  return withDow ? DOW_LABEL[withDow.day_of_week!] : null;
}

/** Anatomy v3 §2: hero reads `blurb_long` (a deliberately longer hook than the
 *  secondaries get, falling back to `blurb` for any older row missing it);
 *  secondary reads `blurb`; anchor reads `reason_to_go` (the Tier-3 "why go"
 *  field); non-event reads `blurb` falling back to `reason_to_go`. Never
 *  things.blurb for anchor — that's the settled map. */
export function blurbSourceFor(slot: EditionSlot, t: ThingRow): string | null {
  if (slot === "hero") return t.blurb_long ?? t.blurb;
  if (slot === "anchor") return t.reason_to_go;
  if (slot === "nonevent") return t.blurb ?? t.reason_to_go;
  return t.blurb;
}

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

export interface LoadEditionOptions {
  siteUrl: string;
  unsubscribeToken?: string | null; // present only when rendering for an actual send
}

/** Loads by edition_date. `allowAnyStatus` lets the cockpit preview a
 *  draft/approved edition (auth-gated there); the public permalink route
 *  leaves it false so only `status='sent'` editions resolve (matches the
 *  public_read_editions RLS policy — this is a belt-and-suspenders check
 *  when called with the anon client, and the real gate when called with the
 *  service-role client for the cockpit). */
export async function loadRenderableEdition(
  sb: SupabaseClient,
  editionDate: string,
  opts: LoadEditionOptions,
  allowAnyStatus = false,
): Promise<RenderableEdition | null> {
  let q = sb.from("editions").select("*").eq("edition_date", editionDate);
  if (!allowAnyStatus) q = q.eq("status", "sent");
  const { data: ed, error } = await q.maybeSingle();
  if (error || !ed) return null;

  const { data: picksRaw, error: pErr } = await sb
    .from("edition_picks")
    .select(PICK_SELECT)
    .eq("edition_id", ed.id)
    .order("slot")
    .order("position");
  if (pErr) throw new Error(`renderData: picks select failed: ${pErr.message}`);

  const picks = (picksRaw ?? []) as unknown as PickRow[];
  const bySlot = (slot: EditionSlot) => picks.filter((p) => p.slot === slot);

  const heroRow = bySlot("hero")[0];
  const cfg = EDITION_CONFIG[ed.edition_type as EditionType];

  const unsubscribeUrl = opts.unsubscribeToken
    ? `${opts.siteUrl}/unsubscribe?token=${opts.unsubscribeToken}`
    : null;

  return {
    editionType: ed.edition_type as EditionType,
    subject: ed.subject ?? "",
    preheader: ed.preheader ?? "",
    greeting: ed.greeting ?? "",
    windowLabel: cfg.windowLabel,
    dateLabel: DATE_LABEL_FMT.format(dateLabelAnchor(ed.edition_date)),
    secondariesLabel: cfg.secondariesLabel,
    nonEventLabel: cfg.nonEventLabel,
    hero: heroRow ? toRenderPick(heroRow, opts.siteUrl) : null,
    secondaries: bySlot("secondary").map((r) => toRenderPick(r, opts.siteUrl)),
    nonEvent: bySlot("nonevent")[0] ? toRenderPick(bySlot("nonevent")[0], opts.siteUrl) : null,
    anchor: bySlot("anchor")[0] ? toRenderPick(bySlot("anchor")[0], opts.siteUrl) : null,
    permalinkUrl: `${opts.siteUrl}/edition/${ed.edition_date}`,
    subscribeUrl: `${opts.siteUrl}/`,
    unsubscribeUrl,
  };
}
