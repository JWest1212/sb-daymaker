// ingest/extractSample.ts
//
// Data Arch Redesign 25, Phase 1 — OFFLINE accuracy check only. Fetches a
// handful of real long-tail pages (a winery, a community hall, ...), runs
// them through reduceToText + extractEvents, and prints the result so Jim
// can eyeball accuracy before anything lands in the database.
//
// This script is NOT part of the nightly run and NEVER writes to Supabase —
// no `land.ts`, no `sources`/`things` writes, nothing. It exists purely to
// let a human judge extraction quality (spec 25 §6 Phase 1).
//
// Run:
//   node --env-file=.env.local --import tsx ingest/extractSample.ts

import Anthropic from '@anthropic-ai/sdk';
import { fetchHtmlPolite } from './adapters/_shared/fetchHtml';
import { reduceToText, extractEvents } from './extract';

const SAMPLE_URLS: string[] = [
  'https://carrwinery.com/events/',
  'https://www.margerumwines.com/upcoming-events/',
  'https://ussb.org/community/events-calendar/',
  'https://www.caminorealmarketplace.net/happeningsandevents',
];

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set — see .env.local');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });

  for (const url of SAMPLE_URLS) {
    console.log(`\n${'='.repeat(70)}\n${url}\n${'='.repeat(70)}`);
    try {
      const html = await fetchHtmlPolite(url, 'extract-sample');
      const text = reduceToText(html);
      console.log(`[fetched ${html.length} chars → reduced to ${text.length} chars]`);
      const { events, usage } = await extractEvents(url, text, client);
      if (!events.length) {
        console.log('(no events extracted)');
      } else {
        console.log(JSON.stringify(events, null, 2));
      }
      console.log(`[tokens: ${usage.inputTokens} in / ${usage.outputTokens} out]`);
    } catch (err) {
      console.error(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main();
