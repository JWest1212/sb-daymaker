// ingest/enrich.ts
//
// Step ④ of the nightly pipeline (Doc 11 §7): ONE batched Claude call over the
// whole night's gated candidates, returning per-id blurb + blurb_long + proposed
// occasion tags in the house voice. Tiered to Haiku (CLAUDE.md §4).
//
// HARD RULES (trust core):
//   • AI runs AFTER the gate and NEVER reads or alters a start time/date. We don't
//     even send starts_at as an editable field — buildItems omits it entirely.
//   • Negative tag rules are enforced in CODE after the call (21+ -> no family_day;
//     non-free -> no free_sb); any tag outside the enum is dropped.
//   • Every draft is logged to audit_log. If the call fails, candidates are returned
//     UNCHANGED so the run still lands them with plain titles (never blocks).

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Candidate, OccasionTag, PriceBand, Tod } from '../packages/shared/types';

const MODEL = 'claude-haiku-4-5';

const OCCASION_TAGS: OccasionTag[] = [
  'date_night', 'family_day', 'nightlife', 'catch_a_show', 'arts_culture',
  'outdoors_active', 'wine_food', 'free_sb', 'hosting_visitors', 'solo',
];

const SYSTEM = `You write SB Daymaker's editorial copy for Santa Barbara listings.
Voice: a knowing local friend — warm, concrete, editorial; Spanish-Colonial-meets-broadsheet.
Never corporate, never breathless, never salesy.
Use ONLY the facts provided. You must NEVER invent or alter a name, address, date, time, or
price — those facts are fixed and most are not even given to you. Your job is voice + tags only.
For each item return:
- blurb: ONE line, ≤ ~24 words, the hook a local would text a friend.
- blurb_long: 2–4 sentences for the detail screen, same voice.
- tags: 1–3 occasion tags chosen ONLY from the allowed list, each with a confidence 0–1.
Respond by calling the enrich_batch tool with one entry per item id. Nothing else.`;

/** What we send the model: facts only — NO starts_at/ends_at (the trust guarantee). */
export interface EnrichItem {
  id: string;
  title: string;
  type: string;
  tier: number;
  happening_category: string;
  neighborhood?: string;
  address: string;
  price_band: PriceBand | null;
  time_of_day_fit: Tod[];
}

export function buildItems(cands: Candidate[]): EnrichItem[] {
  return cands.map((c) => ({
    id: c.id,
    title: c.title,
    type: c.type,
    tier: c.tier,
    happening_category: c.happening_category,
    neighborhood: c.neighborhood,
    address: c.address,
    price_band: c.price_band,
    time_of_day_fit: c.time_of_day_fit,
  }));
}

/** Code-side negative rules (Doc 11 §7 / schema B4), applied AFTER the model. */
export function applyNegativeRules(
  cand: Pick<Candidate, 'is_21_plus' | 'price_band'>,
  tags: { tag: OccasionTag; confidence: number }[],
): { tag: OccasionTag; confidence: number }[] {
  let out = tags.filter((t) => OCCASION_TAGS.includes(t.tag)); // drop anything off-enum
  // de-dupe, keep the highest confidence per tag
  const best = new Map<OccasionTag, number>();
  for (const t of out) best.set(t.tag, Math.max(best.get(t.tag) ?? 0, t.confidence));
  out = [...best].map(([tag, confidence]) => ({ tag, confidence }));
  if (cand.is_21_plus) out = out.filter((t) => t.tag !== 'family_day');
  if (cand.price_band != null && cand.price_band !== 'free') {
    out = out.filter((t) => t.tag !== 'free_sb');
  }
  return out;
}

interface ModelItem {
  id: string;
  blurb?: string;
  blurb_long?: string;
  tags?: { tag: OccasionTag; confidence: number }[];
}

/** Merge model output back onto candidates — PURE. starts_at is left byte-identical. */
export function mergeEnrichment(cands: Candidate[], modelItems: ModelItem[]): Candidate[] {
  const byId = new Map(modelItems.map((m) => [m.id, m]));
  return cands.map((c) => {
    const m = byId.get(c.id);
    if (!m) return c;
    const tags = applyNegativeRules(c, m.tags ?? []);
    return {
      ...c, // starts_at, ends_at, address, price_band, etc. untouched
      blurb: m.blurb?.trim() || c.blurb,
      blurb_long: m.blurb_long?.trim() || c.blurb_long,
      proposed_tags: tags,
    };
  });
}

const enrichTool: Anthropic.Tool = {
  name: 'enrich_batch',
  description: 'Return blurb, blurb_long, and occasion tags for every listing id provided.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            blurb: { type: 'string' },
            blurb_long: { type: 'string' },
            tags: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  tag: { type: 'string', enum: OCCASION_TAGS },
                  confidence: { type: 'number' },
                },
                required: ['tag', 'confidence'],
              },
            },
          },
          required: ['id', 'blurb', 'blurb_long', 'tags'],
        },
      },
    },
    required: ['items'],
  },
};

async function logDrafts(sb: SupabaseClient, cands: Candidate[]): Promise<void> {
  const rows = cands
    .filter((c) => c.blurb || (c.proposed_tags && c.proposed_tags.length))
    .map((c) => ({
      entity_type: 'thing',
      entity_id: c.id,
      action: 'ai_draft',
      actor: 'ai',
      ai_confidence: c.proposed_tags?.length
        ? Number((c.proposed_tags.reduce((s, t) => s + t.confidence, 0) / c.proposed_tags.length).toFixed(2))
        : null,
      payload: { tags: c.proposed_tags ?? [], model: MODEL } as object,
    }));
  if (rows.length) await sb.from('audit_log').insert(rows);
}

/**
 * ONE batched Claude call over all gated candidates. Returns enriched copies, or
 * the originals unchanged on any failure / missing key / empty input.
 */
export async function enrich(
  cands: Candidate[],
  opts: { sb?: SupabaseClient } = {},
): Promise<Candidate[]> {
  if (!cands.length) return cands;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('[enrich] ANTHROPIC_API_KEY not set — landing rows with plain titles');
    return cands;
  }

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 });
  // ~250 output tokens per item, bounded to a safe non-streaming ceiling.
  const maxTokens = Math.min(16_000, Math.max(2_048, cands.length * 250));

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      tools: [enrichTool],
      tool_choice: { type: 'tool', name: 'enrich_batch' },
      messages: [{ role: 'user', content: `Items (JSON):\n${JSON.stringify(buildItems(cands))}` }],
    });
    const block = res.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      console.log('[enrich] no tool_use in response — landing plain titles');
      return cands;
    }
    const items = (block.input as { items?: ModelItem[] }).items ?? [];
    const enriched = mergeEnrichment(cands, items);
    if (opts.sb) await logDrafts(opts.sb, enriched);
    const drafted = enriched.filter((c) => c.blurb).length;
    console.log(`[enrich] drafted ${drafted}/${cands.length} (1 batched ${MODEL} call)`);
    return enriched;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[enrich] enrichment skipped (${msg}) — landing rows with plain titles`);
    return cands;
  }
}
