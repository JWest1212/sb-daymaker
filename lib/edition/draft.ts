// lib/edition/draft.ts
//
// The drafter orchestrator (edition_build_spec.md §3). Deterministic,
// sponsor-blind, idempotent while status='draft' (§3.1/§3.8). Takes an
// already-constructed service-role SupabaseClient so it runs identically from
// the ingest/ GitHub Action (getDb(), SUPABASE_SERVICE_ROLE) and, later, a
// cockpit "regenerate draft" action (getAdminSupabase(), SUPABASE_SECRET_KEY).
//
// Each selected pick's photo_url is re-hosted into edition-media (spec §3.5) —
// see lib/edition/imageHost.ts. Re-hosting is best-effort: on any failure it
// falls back to the original photo_url rather than blocking the draft.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { whenString } from "../review";
import type { DraftResult, DraftThing, EditionSelection, EditionSlot, EditionType } from "./types";
import { EDITION_CONFIG, windowDaysFor } from "./window";
import { selectEdition } from "./select";
import { resolveEditionCopy } from "./copyPools";
import { titleCaseNeighborhood } from "./format";
import { rehostImage } from "./imageHost";
import { discoverMoreImages } from "./imageDiscovery";
import { enrich } from "../../ingest/enrich";
import type { Candidate } from "../../packages/shared/types";

const THING_SELECT = `id, type, title, blurb, blurb_long, local_note, reason_to_go,
  happening_tier, happening_category, editorial_weight, neighborhood, starts_at, ends_at,
  hero_eligible, photo_url, photo_source, photo_attribution, photo_options, created_at, last_confirmed,
  recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`;
// Deliberately NOT selected: is_featured, sponsor_id (spec §0.2 — sponsor-blindness
// enforced by never reading these columns, not just by convention).

const COOLDOWN_EDITIONS = 12;

async function fetchPublishedThings(sb: SupabaseClient): Promise<DraftThing[]> {
  const { data, error } = await sb.from("things").select(THING_SELECT).eq("status", "published");
  if (error) throw new Error(`draft: things select failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    ...(r as unknown as DraftThing),
    recurring: ((r as { recurring_schedules?: unknown[] }).recurring_schedules ?? []) as DraftThing["recurring"],
  }));
}

async function resolveWindowHeroPin(sb: SupabaseClient, windowDays: string[]): Promise<string | null> {
  const { data, error } = await sb.from("hero_pins").select("pin_date, thing_id").in("pin_date", windowDays);
  if (error) throw new Error(`draft: hero_pins select failed: ${error.message}`);
  const byDate = new Map((data ?? []).map((p) => [p.pin_date as string, p.thing_id as string]));
  for (const d of windowDays) if (byDate.has(d)) return byDate.get(d)!;
  return null;
}

async function fetchCooldownIds(sb: SupabaseClient, beforeDate: string): Promise<Set<string>> {
  const { data: eds, error } = await sb
    .from("editions")
    .select("id")
    .lt("edition_date", beforeDate)
    .order("edition_date", { ascending: false })
    .limit(COOLDOWN_EDITIONS);
  if (error) throw new Error(`draft: cooldown editions select failed: ${error.message}`);
  const ids = (eds ?? []).map((e) => e.id as string);
  if (!ids.length) return new Set();
  const { data: picks, error: pErr } = await sb.from("edition_picks").select("thing_id").in("edition_id", ids);
  if (pErr) throw new Error(`draft: cooldown picks select failed: ${pErr.message}`);
  return new Set((picks ?? []).map((p) => p.thing_id as string));
}

function allSelectedThings(selection: EditionSelection): DraftThing[] {
  return [
    ...selection.hero.picks,
    ...selection.secondary.picks,
    ...selection.nonevent.picks,
    ...selection.anchor.picks,
  ];
}

/** Every selected pick gets a real blurb, not a blank line or (per the cockpit's
 *  own bug this fixes) a title standing in for one. A published thing can reach
 *  the drafter blurb-less if the nightly enrich() call missed it — this is a
 *  batch, draft-time (not send-time) Claude Haiku call, same tiering/cost
 *  category as the nightly enrich pass, just scoped to this issue's picks.
 *  Fills genuinely MISSING blurbs only (never overwrites one that already
 *  exists) and persists to the CANONICAL thing, benefiting the main site and
 *  every future edition, not just this one. */
async function ensureBlurbs(sb: SupabaseClient, things: DraftThing[]): Promise<void> {
  const missing = things.filter((t) => !t.blurb);
  if (!missing.length) return;
  const cands: Candidate[] = missing.map((t) => ({
    id: t.id, type: t.type as Candidate["type"], status: "needs_review", title: t.title,
    tier: t.happening_tier as Candidate["tier"], happening_category: t.happening_category as Candidate["happening_category"],
    neighborhood: (t.neighborhood as Candidate["neighborhood"]) ?? undefined, address: "", price_band: null,
    time_of_day_fit: [], starts_at: null, ends_at: null, source_url: "",
    last_confirmed: "", start_strategy: "none",
  }));
  const enriched = await enrich(cands, { sb });
  for (const c of enriched) {
    if (!c.blurb) continue;
    const { error } = await sb
      .from("things").update({ blurb: c.blurb, blurb_long: c.blurb_long ?? null }).eq("id", c.id);
    if (error) throw new Error(`draft: ensureBlurbs update ${c.id}: ${error.message}`);
  }
}

const MIN_IMAGE_OPTIONS = 6;

/** Every selected pick gets at least 6 real image options waiting in the cockpit
 *  swap picker, not whatever the nightly resolver happened to find (often fewer,
 *  since Pexels doesn't always return a full page for a specific query). Reuses
 *  the same widen-and-persist logic as the cockpit's own "find more options"
 *  button (imageDiscovery.ts), just run proactively at draft time instead of
 *  waiting for an operator to click. Sequential, not parallel, to stay gentle on
 *  Pexels's rate limit — this runs twice a week for ~5 picks, not on a hot path. */
async function ensureImageOptions(sb: SupabaseClient, things: DraftThing[]): Promise<void> {
  for (const t of things) {
    const current = (t.photo_options ?? []).filter((o) => o.url);
    if (current.length >= MIN_IMAGE_OPTIONS) continue;
    const options = await discoverMoreImages({
      neighborhood: t.neighborhood,
      happening_category: t.happening_category,
      photo_options: t.photo_options ?? [],
    });
    const { error } = await sb.from("things").update({ photo_options: options }).eq("id", t.id);
    if (error) throw new Error(`draft: ensureImageOptions update ${t.id}: ${error.message}`);
  }
}

/** thing -> its edition_picks row shape (spec §2.2). `position` renders each
 *  slot's chosen order; overrides are always null at draft time (cockpit-only). */
async function pickRow(
  sb: SupabaseClient,
  editionId: string,
  slot: EditionSlot,
  position: number,
  t: DraftThing,
) {
  return {
    edition_id: editionId,
    thing_id: t.id,
    slot,
    position,
    cached_image_url: await rehostImage(sb, t.photo_url),
    is_manual: false,
  };
}

function candidateRows(editionId: string, slot: EditionSlot, bench: DraftThing[], selectedIds: Set<string>) {
  return bench.map((t, i) => ({
    edition_id: editionId,
    slot,
    thing_id: t.id,
    rank: i,
    selected: selectedIds.has(t.id),
  }));
}

export async function draftEdition(
  sb: SupabaseClient,
  editionDate: string,
  editionType: EditionType,
): Promise<DraftResult> {
  const { data: existing, error: exErr } = await sb
    .from("editions")
    .select("id, status")
    .eq("edition_date", editionDate)
    .maybeSingle();
  if (exErr) throw new Error(`draft: existing edition lookup failed: ${exErr.message}`);
  if (existing && existing.status !== "draft") {
    return {
      ok: false,
      editionId: existing.id,
      editionDate,
      editionType,
      status: existing.status as DraftResult["status"],
      skipReason: `edition already ${existing.status} — idempotent no-op`,
    };
  }
  const editionId = existing?.id ?? randomUUID();

  const windowDays = windowDaysFor(editionType, editionDate);
  const [things, heroPinThingId, cooldownIds] = await Promise.all([
    fetchPublishedThings(sb),
    resolveWindowHeroPin(sb, windowDays),
    fetchCooldownIds(sb, editionDate),
  ]);

  const selection = selectEdition({
    things,
    heroPinThingId,
    cooldownIds,
    editionType,
    windowDays,
    editionDateKey: editionDate,
  });

  const heroPick = selection.hero.picks[0] ?? null;
  const realPickCount =
    selection.secondary.picks.length + selection.nonevent.picks.length + selection.anchor.picks.length;

  // Failure vs thin (spec §3.9 / anatomy §5): thin never skips; failure does.
  if (!heroPick || realPickCount === 0) {
    const skipReason = !heroPick
      ? "no hero candidate (ranked pool and evergreen fallback both empty)"
      : "no real picks beyond hero — cannot assemble a minimum viable issue";
    await sb.from("editions").upsert(
      { id: editionId, edition_date: editionDate, edition_type: editionType, status: "failed", skip_reason: skipReason },
      { onConflict: "id" },
    );
    return { ok: false, editionId, editionDate, editionType, status: "failed", skipReason };
  }

  // Every selected pick gets a real blurb and a full bench of image options
  // before the cockpit ever opens (see ensureBlurbs/ensureImageOptions above).
  const selectedThings = allSelectedThings(selection);
  await ensureBlurbs(sb, selectedThings);
  await ensureImageOptions(sb, selectedThings);

  const cfg = EDITION_CONFIG[editionType];
  const copy = resolveEditionCopy(editionId, editionType, {
    hero_title: heroPick.title,
    hero_neighborhood: heroPick.neighborhood ? titleCaseNeighborhood(heroPick.neighborhood) : null,
    hero_when: whenString(heroPick.happening_tier, heroPick.starts_at, heroPick.recurring),
    edition_weekday: cfg.weekdayLabel,
    window_label: cfg.windowLabel,
    pick_count: selection.secondary.picks.length,
    heroIsEvergreen: selection.hero.source === "evergreen",
  });

  const { error: upErr } = await sb.from("editions").upsert(
    {
      id: editionId,
      edition_date: editionDate,
      edition_type: editionType,
      status: "draft",
      subject: copy.subject,
      preheader: copy.preheader,
      greeting: copy.greeting,
    },
    { onConflict: "id" },
  );
  if (upErr) throw new Error(`draft: editions upsert failed: ${upErr.message}`);

  // Idempotent refresh (§3.1): only reached when status was 'draft' or the row
  // is new, so clearing + rewriting picks/candidates is always safe here.
  const [{ error: delPicksErr }, { error: delCandErr }] = await Promise.all([
    sb.from("edition_picks").delete().eq("edition_id", editionId),
    sb.from("edition_candidates").delete().eq("edition_id", editionId),
  ]);
  if (delPicksErr) throw new Error(`draft: edition_picks clear failed: ${delPicksErr.message}`);
  if (delCandErr) throw new Error(`draft: edition_candidates clear failed: ${delCandErr.message}`);

  const pickRows = await Promise.all([
    pickRow(sb, editionId, "hero", 0, heroPick),
    ...selection.secondary.picks.map((t, i) => pickRow(sb, editionId, "secondary", i, t)),
    ...selection.nonevent.picks.map((t, i) => pickRow(sb, editionId, "nonevent", i, t)),
    ...selection.anchor.picks.map((t, i) => pickRow(sb, editionId, "anchor", i, t)),
  ]);
  const { error: picksErr } = await sb.from("edition_picks").insert(pickRows);
  if (picksErr) throw new Error(`draft: edition_picks insert failed: ${picksErr.message}`);

  const selectedIds = new Set(pickRows.map((r) => r.thing_id));
  const candRows = [
    ...candidateRows(editionId, "hero", selection.hero.rankedBench, selectedIds),
    ...candidateRows(editionId, "secondary", selection.secondary.rankedBench, selectedIds),
    ...candidateRows(editionId, "nonevent", selection.nonevent.rankedBench, selectedIds),
    ...candidateRows(editionId, "anchor", selection.anchor.rankedBench, selectedIds),
  ];
  if (candRows.length) {
    const { error: candErr } = await sb.from("edition_candidates").insert(candRows);
    if (candErr) throw new Error(`draft: edition_candidates insert failed: ${candErr.message}`);
  }

  return {
    ok: true,
    editionId,
    editionDate,
    editionType,
    status: "draft",
    heroSource: selection.hero.source,
    counts: {
      secondaries: selection.secondary.picks.length,
      nonevent: selection.nonevent.picks.length,
      anchor: selection.anchor.picks.length,
    },
  };
}
