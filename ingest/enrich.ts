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

// Exported only so enrich.test.ts can assert the prompt practices what it preaches
// (no em dash inside an instruction that bans em dashes).
export const SYSTEM = `You write SB Daymaker's editorial copy for Santa Barbara listings.

Voice: a knowing local friend, telling you where they'd go. Warm, dry, specific, a
little understated. Never corporate, never breathless, never salesy. No hype, no
"don't miss," no "amazing," no exclamation marks. Active voice, sentence case, plain
verbs. Concrete, sensory detail beats a list of themes or keywords. Never use an em dash,
anywhere, under any circumstances: use a period, comma, colon, semicolon, or parentheses
instead.

Example of the difference (this is the failure mode to avoid):
- Flat and listy (wrong): "Gardens, families, evening exploration, roots and growth."
- Knowing-local-friend voice (right): "Gardens, families, and evening light. Bring the
  kids and let them run before the sun drops."
- Flat and listy (wrong): "Game day at the library, strategy, stakes, community."
- Knowing-local-friend voice (right): "Board games and low stakes over lunch at the
  library. Come for the company."

Use ONLY the facts provided. You must NEVER invent or alter a name, address, date, time, or
price: those facts are fixed and most are not even given to you. Your job is voice + tags only.
For each item return:
- blurb: 1–2 sentences, ≤ ~24 words, the hook a local would text a friend. Concrete and
  specific, never a list of themes.
- blurb_long: 2–4 sentences for the detail screen, same voice.
- tags: 1–3 occasion tags chosen ONLY from the allowed list, each with a confidence 0–1.

Tagging rubric (a tag is a promise about the occasion, not a "maybe": be selective):
- Alcohol-primary venues (breweries, taprooms, wine tasting rooms, bars, cocktail
  lounges) default to wine_food and/or nightlife. Do NOT tag them family_day, even
  if kids could technically tag along.
- Civic services and government meetings (city councils, commissions, committees,
  public hearings, advisory boards) are not leisure occasions: give them FEW or NO
  tags rather than forcing a fit.
- family_day means genuinely family-oriented programming (kids' activities, all-ages
  by design), not merely "a family could attend." When in doubt, leave it off.

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

/** W2.2 — alcohol-primary venue titles, for the AI-only family_day guard below. */
const ALCOHOL_VENUE_RE = /\b(brewer|brewing|taproom|winery|wine bar|tasting room|distiller|cocktail|pub)\b/i;

/** Code-side negative rules (Doc 11 §7 / schema B4), applied AFTER the model — so they
 *  scrub the AI's PROPOSED tags only. These are NOT publish-time hard rules (that's
 *  review.filterTags, which the founder's own edits pass through). */
export function applyNegativeRules(
  cand: Pick<Candidate, 'is_21_plus' | 'price_band'> & { title?: string },
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
  // W2.2 — strip family_day the AI proposed for alcohol-primary venues (brewery/
  // taproom/winery/…). Deliberately AI-ONLY: the founder can still add family_day in
  // the cockpit for the genuinely family-friendly cases (M Special, with its cornhole
  // and food trucks, is the canonical example) — so this must NOT become a hard
  // publish-time rule like the 21+/free rules in review.filterTags.
  if (cand.title && ALCOHOL_VENUE_RE.test(cand.title)) {
    out = out.filter((t) => t.tag !== 'family_day');
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

// Haiku 4.5 max output tokens is 8 192. At ~250 tokens per item, a single call
// handles at most ~32 items before hitting the model ceiling. We chunk to 20 so
// each call comfortably fits (5 000 tokens) and finishes well within the timeout.
const CHUNK_SIZE = 20;

/** One Claude call over a single chunk (≤ CHUNK_SIZE items). */
async function enrichChunk(
  chunk: Candidate[],
  client: Anthropic,
): Promise<Candidate[]> {
  const maxTokens = Math.min(8_000, Math.max(1_024, chunk.length * 250));
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM,
    tools: [enrichTool],
    tool_choice: { type: 'tool', name: 'enrich_batch' },
    messages: [{ role: 'user', content: `Items (JSON):\n${JSON.stringify(buildItems(chunk))}` }],
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return chunk; // no tool_use → return unchanged
  const items = (block.input as { items?: ModelItem[] }).items ?? [];
  return mergeEnrichment(chunk, items);
}

/**
 * Batched Claude enrichment, chunked so each API call stays within Haiku's
 * 8 192-token output ceiling. Processes chunks sequentially; any chunk that
 * fails (timeout, API error) is returned unchanged (fail-soft per chunk).
 * Returns enriched copies, or the originals unchanged on missing key / empty input.
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

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });

  const chunks: Candidate[][] = [];
  for (let i = 0; i < cands.length; i += CHUNK_SIZE) {
    chunks.push(cands.slice(i, i + CHUNK_SIZE));
  }

  const results: Candidate[] = [];
  let totalDrafted = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const enriched = await enrichChunk(chunk, client);
      results.push(...enriched);
      const drafted = enriched.filter((c) => c.blurb).length;
      totalDrafted += drafted;
      console.log(`[enrich] chunk ${i + 1}/${chunks.length}: ${drafted}/${chunk.length} drafted`);
    } catch (err) {
      // Fail-soft: one bad chunk doesn't lose the rest of the batch.
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[enrich] chunk ${i + 1}/${chunks.length} failed (${msg}) — landing ${chunk.length} plain titles`);
      results.push(...chunk);
    }
  }

  if (opts.sb) await logDrafts(opts.sb, results);
  console.log(`[enrich] drafted ${totalDrafted}/${cands.length} across ${chunks.length} ${MODEL} call(s)`);
  return results;
}
