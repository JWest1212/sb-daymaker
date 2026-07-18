// ingest/extract.ts
//
// Data Arch Redesign 25, Phase 1 — the generic AI extraction lane's core
// function: reduce a fetched page to clean text, then ask Haiku (batch,
// forced tool-call, strict schema) what events are literally stated on it.
//
// TRUST RULE (Doc 16 §2.3 / spec 25 §4): everything this returns is a
// CANDIDATE, never a fact. Nothing in this file writes to the database or
// decides publish status — ingest/publishGate.ts's requireStructuredLane
// already refuses to auto-publish anything from lane='generic', so the
// firewall is enforced by code that exists independent of this file. This
// module's only job is: page in, candidate events out.

import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

// Keeps the AI payload small and cheap (spec 25 §2 step 3 / §3).
const MAX_TEXT_CHARS = 6_000;

export interface ExtractedEvent {
  title: string;
  start_date?: string;
  start_time?: string;
  end?: string;
  venue?: string;
  address?: string;
  price?: string;
  url?: string;
  /** Model's own read on how plainly the date/time/venue were stated. */
  confidence: 'high' | 'low';
}

/**
 * Strip nav/boilerplate tags and collapse whitespace, so the page's visible
 * text goes to the model instead of the raw HTML. Deliberately simple (no
 * main-content heuristics beyond removing structural chrome) — good enough
 * for a Phase 1 accuracy check; revisit if sample results show it's pulling
 * in menu/footer noise the model can't filter itself.
 */
export function reduceToText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe, form, nav, header, footer').remove();
  $('[aria-hidden="true"]').remove();
  const raw = $('body').text() || $.root().text();
  const collapsed = raw
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  return collapsed.slice(0, MAX_TEXT_CHARS);
}

export const EXTRACT_SYSTEM = `You extract events from the text of a Santa Barbara venue or organization's web page.

Return ONLY events that are literally stated on the page. Never invent, infer, or guess a
date, time, venue, address, or price that isn't written on the page. If a field isn't stated,
omit it rather than guessing at it. A page describing a single recurring or ongoing offering
with no specific date (e.g. "open mic every Thursday") may still be returned with start_date
omitted.

Mark confidence "high" only when the date, time, and venue are stated plainly and
unambiguously. Mark confidence "low" whenever any of those was ambiguous, partial, relative
("next Friday" without a stated date), or you are not fully sure you read it correctly.

If the page has no events at all (e.g. it's a homepage, an about page, or a menu), call the
tool with an empty events array.

Respond by calling the extract_events tool. Nothing else.`;

export const extractTool: Anthropic.Tool = {
  name: 'extract_events',
  description: 'Return every distinct event literally stated on this page, or an empty array if none.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      events: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            start_date: { type: 'string', description: 'ISO 8601 date (YYYY-MM-DD) if a specific date is stated' },
            start_time: { type: 'string', description: '24h HH:MM local time if stated' },
            end: { type: 'string', description: 'ISO date or date+time if an explicit end is stated' },
            venue: { type: 'string' },
            address: { type: 'string' },
            price: { type: 'string', description: 'as stated on the page, e.g. "$15", "Free", "$20-$35"' },
            url: { type: 'string', description: 'event-specific URL if the page links to one' },
            confidence: { type: 'string', enum: ['high', 'low'] },
          },
          required: ['title', 'confidence'],
        },
      },
    },
    required: ['events'],
  },
};

export function buildExtractUserMessage(url: string, text: string): string {
  return `Source page: ${url}\n\nPage text:\n${text}`;
}

export interface ExtractUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ExtractResult {
  events: ExtractedEvent[];
  usage: ExtractUsage;
}

/** One Claude call over one page's reduced text. Pure I/O wrapper: caller owns the client.
 *  Returns token usage alongside the events so callers can track AI spend (spec 25 §3). */
export async function extractEvents(
  url: string,
  text: string,
  client: Anthropic,
): Promise<ExtractResult> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2_048,
    system: EXTRACT_SYSTEM,
    tools: [extractTool],
    tool_choice: { type: 'tool', name: 'extract_events' },
    messages: [{ role: 'user', content: buildExtractUserMessage(url, text) }],
  });
  const usage: ExtractUsage = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return { events: [], usage };
  const events = (block.input as { events?: ExtractedEvent[] }).events ?? [];
  return { events: events.map((e) => ({ ...e, url: e.url || url })), usage };
}
