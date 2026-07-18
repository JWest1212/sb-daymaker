// ingest/dedupeAdjudicate.ts
//
// Data Arch Redesign 26 Phase 3 — AI adjudication for the ambiguous band (Doc 16
// §3.3). A Sonnet batch call on genuinely uncertain pairs only (~0.35-0.55 title
// similarity, same day/cadence, same-or-unknown venue — dedupe.ts's evaluateMatch
// classifies these 'ambiguous' rather than merging or splitting). The
// deterministic core in dedupe.ts never sends its clear cases here; this is the
// minority AI is actually needed for, kept batch-only per CLAUDE.md.
//
// Same fail-soft posture as enrich.ts: a failed/errored chunk contributes no
// verdicts (never guesses same_event=true on an API error), so the caller's
// default of "stays split, held for review" applies — the bias toward split
// spec 26 §4 asks for extends to AI failures too.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-5';
// $2/$10 per MTok is the introductory Sonnet 5 rate in effect through
// 2026-08-31 (see the claude-api skill's pricing table); reverts to the
// standard $3/$15 after.
const SONNET_INPUT_PER_M_USD = 2.0;
const SONNET_OUTPUT_PER_M_USD = 10.0;

export interface AdjudicationPair {
  pairId: string; // caller-assigned, stable — usually `${idA}|${idB}`
  titleA: string;
  titleB: string;
  venueA: string | null; // canonical venue if known (eventKey.ts's canonicalVenue), else null
  venueB: string | null;
  whenA: string; // human-readable date/cadence description — never an invented fact
  whenB: string;
  addressA: string | null;
  addressB: string | null;
}

export interface AdjudicationVerdict {
  pairId: string;
  sameEvent: boolean;
  confidence: number; // 0-1, model-reported
  reasoning: string; // short, for the merge-log evidence trail (spec 26 §4)
}

const adjudicateTool: Anthropic.Tool = {
  name: 'adjudicate_pairs',
  description: 'For each pair, decide whether the two listings describe the same real-world event or two different events.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pair_id: { type: 'string' },
            same_event: { type: 'boolean' },
            confidence: { type: 'number' },
            reasoning: { type: 'string' },
          },
          required: ['pair_id', 'same_event', 'confidence', 'reasoning'],
        },
      },
    },
    required: ['verdicts'],
  },
};

export const SYSTEM = `You adjudicate whether two event listings describe the SAME real-world
event or two DIFFERENT events, for a Santa Barbara events database deduplicating
across many sources.

Use ONLY the facts given for each pair. Never invent a name, venue, date, or detail
that isn't provided. These pairs were pre-filtered by a deterministic matcher: their
titles are only partially similar, and the venue is either the same or unknown for
both sides. This is the genuinely ambiguous band a simple text-similarity score
cannot resolve on its own.

Judge same_event=true only when you are confident it is the same occurrence
reported by two sources (allowing for reasonable differences in title wording,
e.g. "SB Jazz Society Presents: X" vs "X"). Judge same_event=false when the titles
or venues more likely describe two distinct events or occurrences (e.g. two
different stops in a recurring series, two different specific programs at one
venue or campus on the same day). When genuinely unsure, prefer same_event=false:
a missed merge just shows a duplicate; a wrong merge hides a real event.

Respond by calling the adjudicate_pairs tool with one verdict per pair_id
provided. Nothing else.`;

// Sonnet's larger output ceiling than Haiku's still benefits from chunking so
// a single call stays fast and any one failure only costs a small slice.
const CHUNK_SIZE = 20;

interface ChunkResult {
  verdicts: AdjudicationVerdict[];
  inputTokens: number;
  outputTokens: number;
}

async function adjudicateChunk(chunk: AdjudicationPair[], client: Anthropic): Promise<ChunkResult> {
  const items = chunk.map((p) => ({
    pair_id: p.pairId,
    a: { title: p.titleA, venue: p.venueA, when: p.whenA, address: p.addressA },
    b: { title: p.titleB, venue: p.venueB, when: p.whenB, address: p.addressB },
  }));
  const maxTokens = Math.min(8_000, Math.max(1_024, chunk.length * 200));
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM,
    tools: [adjudicateTool],
    tool_choice: { type: 'tool', name: 'adjudicate_pairs' },
    messages: [{ role: 'user', content: `Pairs (JSON):\n${JSON.stringify(items)}` }],
  });
  const inputTokens = res.usage.input_tokens;
  const outputTokens = res.usage.output_tokens;
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return { verdicts: [], inputTokens, outputTokens };
  const raw = (block.input as { verdicts?: { pair_id: string; same_event: boolean; confidence: number; reasoning: string }[] }).verdicts ?? [];
  const verdicts = raw.map((v) => ({ pairId: v.pair_id, sameEvent: v.same_event, confidence: v.confidence, reasoning: v.reasoning }));
  return { verdicts, inputTokens, outputTokens };
}

export interface AdjudicationResult {
  verdicts: AdjudicationVerdict[];
  costUsd: number;
}

/** Batched Claude adjudication, chunked and fail-soft (mirrors ingest/enrich.ts):
 *  a chunk that errors contributes no verdicts rather than guessing, so the
 *  caller's default (stays split) applies. Returns no verdicts and $0 cost with
 *  no API key set — never blocks the caller on missing credentials. */
export async function adjudicatePairs(pairs: AdjudicationPair[]): Promise<AdjudicationResult> {
  if (!pairs.length) return { verdicts: [], costUsd: 0 };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('[dedupe-adjudicate] ANTHROPIC_API_KEY not set — no verdicts (pairs stay split)');
    return { verdicts: [], costUsd: 0 };
  }
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });

  const chunks: AdjudicationPair[][] = [];
  for (let i = 0; i < pairs.length; i += CHUNK_SIZE) chunks.push(pairs.slice(i, i + CHUNK_SIZE));

  const verdicts: AdjudicationVerdict[] = [];
  let costUsd = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const { verdicts: v, inputTokens, outputTokens } = await adjudicateChunk(chunk, client);
      verdicts.push(...v);
      const cost = (inputTokens / 1_000_000) * SONNET_INPUT_PER_M_USD + (outputTokens / 1_000_000) * SONNET_OUTPUT_PER_M_USD;
      costUsd += cost;
      console.log(`[dedupe-adjudicate] chunk ${i + 1}/${chunks.length}: ${v.length}/${chunk.length} verdict(s) ($${cost.toFixed(4)})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[dedupe-adjudicate] chunk ${i + 1}/${chunks.length} failed (${msg}) — ${chunk.length} pair(s) stay split`);
    }
  }
  return { verdicts, costUsd };
}
