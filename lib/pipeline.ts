import { getAdminSupabase } from "./supabaseAdmin";
import { enrichThing, type EnrichFacts } from "./enrich";
import type { OccasionKey } from "./occasions";

export interface PipelineSummary {
  gathered: number; // submissions turned into draft things
  enriched: number; // drafts enriched and staged for review
  flagged: number; // enriched but kept as draft (low confidence / missing gate)
  failed: number; // enrichment call failed (skipped)
}

/** Tier is derived from STRUCTURE, never AI-judged (CLAUDE.md / architecture). */
function deriveTier(startsAt: string | null, recurringCount: number): number {
  if (startsAt) return 1;
  if (recurringCount > 0) return 2;
  return 3;
}

/**
 * One nightly run: gather new submissions into draft things, then batch-enrich
 * every draft with Haiku and stage it for review. Deterministic where it counts:
 * tier derivation, negative rules, and the publish gate are all code, not AI.
 */
export async function runNightly(): Promise<PipelineSummary> {
  const sb = getAdminSupabase();
  if (!sb) throw new Error("SUPABASE_SECRET_KEY not configured");

  const summary: PipelineSummary = { gathered: 0, enriched: 0, flagged: 0, failed: 0 };

  // (a) GATHER — new submissions → draft place things (no invented facts/dates).
  const { data: subs } = await sb
    .from("submissions")
    .select("id, raw_payload")
    .eq("status", "new");
  for (const s of subs ?? []) {
    const p = (s.raw_payload ?? {}) as Record<string, unknown>;
    const title = String(p.name ?? "Untitled submission").slice(0, 200);
    const { data: inserted } = await sb
      .from("things")
      .insert({
        type: "place",
        status: "draft",
        title,
        address: (p.where as string) || null,
        source: "submission",
      })
      .select("id")
      .single();
    await sb
      .from("submissions")
      .update({ status: "parsed", parsed_thing_id: inserted?.id ?? null })
      .eq("id", s.id);
    summary.gathered++;
  }

  // (b) ENRICH — every draft thing.
  const { data: drafts } = await sb
    .from("things")
    .select(
      `id, type, title, neighborhood, address, price_band, free, starts_at,
       is_21_plus, indoor, recurring_schedules ( category )`,
    )
    .eq("status", "draft");

  for (const t of drafts ?? []) {
    const facts: EnrichFacts = {
      title: t.title,
      type: t.type,
      neighborhood: t.neighborhood ?? null,
      address: t.address ?? null,
      price_band: t.price_band ?? null,
      free: t.free ?? null,
      starts_at: t.starts_at ?? null,
      is_21_plus: t.is_21_plus ?? false,
      indoor: t.indoor ?? false,
    };

    const e = await enrichThing(facts);
    if (!e) {
      summary.failed++;
      continue;
    }

    const recurringCount = (t.recurring_schedules as unknown[] | null)?.length ?? 0;
    const tier = deriveTier(t.starts_at ?? null, recurringCount);

    // Negative-rule layer (code, after the model).
    let tags = Array.from(new Set(e.tags ?? [])) as OccasionKey[];
    if (t.is_21_plus) tags = tags.filter((x) => x !== "family_day");
    if (!t.free) tags = tags.filter((x) => x !== "free_sb");

    const reason = e.reason_to_go?.trim() || null;
    const flagged =
      e.confidence < 0.6 ||
      (tier === 3 && !reason) ||
      (tier === 1 && !t.starts_at);
    const status = flagged ? "draft" : "needs_review";

    await sb
      .from("things")
      .update({
        blurb: e.blurb,
        blurb_long: e.blurb_long,
        reason_to_go: reason,
        local_note: e.local_note || null,
        happening_category: e.happening_category,
        happening_tier: tier,
        status,
      })
      .eq("id", t.id);

    await sb.from("thing_tags").delete().eq("thing_id", t.id);
    if (tags.length) {
      await sb.from("thing_tags").insert(
        tags.map((tag) => ({
          thing_id: t.id,
          tag,
          confidence: e.confidence,
          tag_source: "ai",
        })),
      );
    }

    await sb.from("audit_log").insert({
      entity_type: "thing",
      entity_id: t.id,
      action: "ai_draft",
      actor: "ai",
      ai_confidence: e.confidence,
      payload: { category: e.happening_category, tags, tier, flagged },
    });

    if (flagged) summary.flagged++;
    else summary.enriched++;
  }

  return summary;
}
