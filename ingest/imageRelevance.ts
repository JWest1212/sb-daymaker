// ingest/imageRelevance.ts
//
// Mobile/image addendum Part B (amends edition_build_spec §3.5 / images.ts's resolver):
// a batched Claude Haiku VISION pass over the resolver's auto-picked image for each
// freshly-resolved candidate, screening for obviously WRONG matches (e.g. a costumed
// festival photo attached to a library exhibit) before they ever land. Mirrors
// enrich.ts's conventions — tiered to Haiku, batch-only, fail-soft (CLAUDE.md §4).
//
// Runs ONLY on the resolver's single auto-picked image per candidate — never on the
// alternates shown in the cockpit's swap picker, where a human already looks before
// choosing (addendum: "cockpit swap-and-upload control is the human override").
//
// A false REJECT only costs a branded-gradient fallback (cheap, reversible via the
// cockpit). A false ACCEPT is the same risk the pipeline already carried before this
// guard existed. So any failure (missing key, timeout, malformed response) defaults
// every affected item to relevant — never to reject.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';
// Images are token-heavier than enrich.ts's text-only batches — smaller chunks.
const CHUNK_SIZE = 12;

const SYSTEM = `You are screening auto-matched stock photos for Santa Barbara local
listings, to catch clearly WRONG matches before publish — for example a costumed
festival photo attached to a library exhibit, or a generic beach photo attached to an
indoor gallery talk. For each image, judge only: does this image plausibly depict or
relate to the listing's title and category? Do not judge photo quality, composition,
lighting, or whether it's the "best" available image — only whether it is a believable
match. Default to relevant=true unless the mismatch is clear and obvious — a generic
but plausible photo (e.g. a generic bar interior for a bar listing, a generic trail
photo for a hike) IS relevant. Respond by calling judge_relevance with one entry per
image id. Nothing else.`;

const relevanceTool: Anthropic.Tool = {
  name: 'judge_relevance',
  description: 'Judge whether each image plausibly depicts or relates to its listing.',
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
            relevant: { type: 'boolean' },
          },
          required: ['id', 'relevant'],
        },
      },
    },
    required: ['items'],
  },
};

export interface RelevanceCandidate {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
}

interface ModelItem { id: string; relevant: boolean }

async function checkChunk(chunk: RelevanceCandidate[], client: Anthropic): Promise<Map<string, boolean>> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const c of chunk) {
    content.push({ type: 'text', text: `id: ${c.id} — "${c.title}" (${c.category})` });
    content.push({ type: 'image', source: { type: 'url', url: c.imageUrl } });
  }
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: Math.min(4_000, Math.max(512, chunk.length * 60)),
    system: SYSTEM,
    tools: [relevanceTool],
    tool_choice: { type: 'tool', name: 'judge_relevance' },
    messages: [{ role: 'user', content }],
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  const result = new Map<string, boolean>();
  if (!block || block.type !== 'tool_use') return result; // empty -> caller defaults every id to relevant
  const items = ((block.input as { items?: ModelItem[] }).items ?? []);
  for (const it of items) result.set(it.id, it.relevant !== false);
  return result;
}

/**
 * Batched relevance check over the resolver's auto-picked images. Returns a Map of
 * id -> relevant. Any id ABSENT from the result (missing key, chunk failure, or a
 * response that omitted it) must be treated as relevant by the caller — this function
 * never returns an explicit false for a candidate it couldn't actually check.
 */
export async function checkImageRelevance(cands: RelevanceCandidate[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (!cands.length) return result;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('[imageRelevance] ANTHROPIC_API_KEY not set — skipping relevance guard, all picks pass through');
    return result;
  }

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });
  const chunks: RelevanceCandidate[][] = [];
  for (let i = 0; i < cands.length; i += CHUNK_SIZE) chunks.push(cands.slice(i, i + CHUNK_SIZE));

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const chunkResult = await checkChunk(chunk, client);
      for (const [id, relevant] of chunkResult) result.set(id, relevant);
      const rejected = [...chunkResult.values()].filter((v) => !v).length;
      console.log(`[imageRelevance] chunk ${i + 1}/${chunks.length}: ${rejected}/${chunk.length} flagged irrelevant`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[imageRelevance] chunk ${i + 1}/${chunks.length} failed (${msg}) — leaving ${chunk.length} unchecked (defaults to relevant)`);
    }
  }
  return result;
}
