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
import type { DraftResult, DraftThing, EditionSlot, EditionType } from "./types";
import { EDITION_CONFIG, windowDaysFor } from "./window";
import { selectEdition } from "./select";
import { resolveEditionCopy } from "./copyPools";
import { titleCaseNeighborhood } from "./format";
import { rehostImage } from "./imageHost";

const THING_SELECT = `id, type, title, blurb, local_note, reason_to_go,
  happening_tier, editorial_weight, neighborhood, starts_at, ends_at,
  hero_eligible, photo_url, photo_source, photo_attribution, created_at, last_confirmed,
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
