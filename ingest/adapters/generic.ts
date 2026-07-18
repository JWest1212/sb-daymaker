// ingest/adapters/generic.ts
//
// Data Arch Redesign 25, the generic AI extraction lane's SourceAdapter.
// ONE code path serves every `sources` row with lane='generic': fetch its
// page, reduce to clean text, hand it to Haiku (ingest/extract.ts), and emit
// RawCandidates the same shape any hand-coded adapter emits. From here on,
// onboarding a new long-tail source is a `sources` row only (spec 25 §5), // this file does not change per source.
//
// TRUST FIREWALL (Doc 16 §2.3 / spec 25 §4): an event only gets a deterministic
// start (startStrategy 'ai_extracted') when Haiku returned BOTH a real date and
// a clock time, same "never guess" rule every adapter follows (adapters/types.ts).
// Anything else emits startStrategy:'none' and the shared gate (ingest/gate.ts)
// drops it, logged like any other adapter's drop. The actual auto-publish block
// is NOT this label, it's ingest/publishGate.ts's requireStructuredLane, which
// reads the resolved source's `lane` (set on its `sources` row, not on the
// candidate), so a generic-lane event can never skip review regardless of how
// confident the extraction looked.
//
// Phase 3, cost/runtime discipline (spec 25 §3):
//   • Change-detection: a page's reduced text is hashed; an unchanged hash
//     skips the Haiku call entirely (the AI call is the metered cost, the
//     self-hosted fetch itself is free, so there's no reason to skip that).
//   • Source-specific scheduling: 'nightly' sources run every night, 'weekly'
//     sources run once every 7 days (tracked via sources.last_ok_at), and
//     'reserve' sources never run automatically (a future manual trigger only).
//   • Per-run page cap protects the 20-minute nightly wall as more sources
//     are onboarded (Phase 4).
//   • AI spend (from real token usage) + runtime are logged per run via
//     getLastGenericRunStats(), which ingest/run.ts folds into this run's
//     source_runs row (ai_cost_usd), runtime is already free from that row's
//     existing started_at/finished_at.

import { createHash } from 'crypto';
import type { DateWindow, SourceAdapter } from './types';
import type { HappeningCategory, RawCandidate } from '../../packages/shared/types';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { reduceToText, extractEvents, type ExtractedEvent } from '../extract';
import { sbISO, sbDateKey } from '../tz';

export interface GenericSourceRow {
  key: string;
  url: string | null;
  category_hints: string[] | null;
  /** Founder-confirmed street address for this source's OWN fixed venue, *  set only when the source has one physical home (a winery, a hall). Never
   *  set for a multi-location or touring source (e.g. a comedy club whose
   *  shows rotate rooms, a nonprofit with two campuses), because defaulting
   *  to one address would then be actively wrong on some nights, which is
   *  worse than the honest no_address drop it would otherwise get. Used only
   *  as the last resort in toRawCandidate, when the page named neither an
   *  address nor any venue at all. */
  venue_address?: string | null;
}

/** The full sources-row shape fetch() reads, extends GenericSourceRow (the
 *  candidate-mapping shape toRawCandidate needs) with the scheduling/change-
 *  detection fields, kept separate so mapping tests don't need to fill them in. */
interface SourceScheduleRow extends GenericSourceRow {
  crawl_frequency: string;
  last_ok_at: string | null;
  content_hash: string | null;
}

/** Founder-curation fallback when a source's category_hints is empty, matches
 *  submissions.ts's use of the same catch-all for non-specific items. */
const DEFAULT_CATEGORY: HappeningCategory = 'community_gathering';

/** "$15" -> 15; "$20-$35" -> 20 (the lower end, same convention every adapter's
 *  priceLow uses); "Free"/unpriced -> null. Never invents a number that isn't
 *  in the text. */
export function parsePriceLow(price: string | undefined): number | null {
  if (!price) return null;
  const m = price.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export function isExplicitlyFree(price: string | undefined): boolean {
  return !!price && /free/i.test(price);
}

/** Combine extracted "YYYY-MM-DD" + "HH:MM" into an SB-local ISO instant.
 *  Returns undefined, never guesses, if either piece is missing or malformed,
 *  which is exactly what makes the gate drop the candidate as startStrategy:'none'. */
export function combineStartISO(startDate: string | undefined, startTime: string | undefined): string | undefined {
  const dm = startDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = startTime?.match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm) return undefined;
  const [, y, mo, d] = dm;
  const [, hh, mm] = tm;
  return sbISO(Number(y), Number(mo), Number(d), Number(hh), Number(mm));
}

/** Live testing (Phase 4) surfaced a real failure mode: a stale cached page
 *  can echo a date years in the past (seen live, a 2024 date on a 2026 page,
 *  a 2021 date on another) and the model reports it "high" confidence because
 *  the text itself IS unambiguous, it's just old. A wrong-year date is exactly
 *  the silent error the trust firewall exists to catch, so a start whose SB
 *  calendar day is before today is treated the same as no start at all, *  never landed, never guessed forward to "fix" it. */
export function isPastDate(startISO: string, now: Date): boolean {
  return sbDateKey(startISO) < sbDateKey(now.toISOString());
}

export function toRawCandidate(
  e: ExtractedEvent,
  sourceRow: GenericSourceRow,
  pageUrl: string,
  now: Date = new Date(),
): RawCandidate {
  let startISO = combineStartISO(e.start_date, e.start_time);
  if (startISO && isPastDate(startISO, now)) startISO = undefined;
  return {
    source: sourceRow.key,
    title: e.title,
    // Preference order: the page's own stated address, then its stated venue
    // name (existing behavior), then, only when the page named NEITHER, // this source's own known home address. That last fallback never fires
    // when a (possibly different) venue was named, so it can't paper over an
    // event that's actually happening somewhere else.
    address: e.address || e.venue || sourceRow.venue_address || undefined,
    venueName: e.venue,
    tier: 1,
    category: (sourceRow.category_hints?.[0] as HappeningCategory | undefined) ?? DEFAULT_CATEGORY,
    type: 'event',
    startISO,
    endISO: e.end,
    startStrategy: startISO ? 'ai_extracted' : 'none',
    priceLow: parsePriceLow(e.price),
    explicitlyFree: isExplicitlyFree(e.price),
    sourceUrl: e.url || pageUrl,
    raw: { extraction: e },
  };
}

/** sha256 of the page's reduced text, cheap, deterministic change signal.
 *  A boilerplate-only change (nav/footer) never reaches here since reduceToText
 *  already strips that chrome before this is computed. */
export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;

/** Spec 25 §3, source-specific scheduling from sources.crawl_frequency.
 *  'nightly' is always due. 'weekly' is due when never checked or ≥7 days
 *  since its last successful check (sources.last_ok_at). 'reserve' is never
 *  auto-scheduled, mirrors Lane C's "reserve" naming (held back by default;
 *  a future manual/on-demand trigger is the only way it runs). */
export function isSourceDue(row: Pick<SourceScheduleRow, 'crawl_frequency' | 'last_ok_at'>, now: Date): boolean {
  if (row.crawl_frequency === 'reserve') return false;
  if (row.crawl_frequency !== 'weekly') return true; // 'nightly' (and any unrecognized value) defaults to due
  if (!row.last_ok_at) return true;
  return now.getTime() - new Date(row.last_ok_at).getTime() >= WEEKLY_INTERVAL_MS;
}

/** Spec 25 §3, per-run page cap, protecting the 20-minute nightly wall as
 *  more generic-lane sources are onboarded (Phase 4 targets 10-20). Sources
 *  due longest ago (or never checked) go first, so nothing due starves behind
 *  sources that merely sort earlier. */
export const GENERIC_LANE_PAGE_CAP = 20;

export function selectSourcesForRun<T extends Pick<SourceScheduleRow, 'last_ok_at'>>(
  dueSources: T[],
  cap: number = GENERIC_LANE_PAGE_CAP,
): T[] {
  return [...dueSources]
    .sort((a, b) => (a.last_ok_at ?? '').localeCompare(b.last_ok_at ?? ''))
    .slice(0, cap);
}

// Haiku 4.5 published rate (spec 25 §3, "log AI spend ... per run").
const HAIKU_INPUT_PER_M_USD = 1.0;
const HAIKU_OUTPUT_PER_M_USD = 5.0;

export interface GenericLaneRunStats {
  sourcesDue: number;
  sourcesExtracted: number;
  sourcesSkippedUnchanged: number;
  sourcesDeferred: number; // due this run but cut by the page cap
  aiCostUsd: number;
  inputTokens: number;
  outputTokens: number;
}

function emptyStats(): GenericLaneRunStats {
  return {
    sourcesDue: 0, sourcesExtracted: 0, sourcesSkippedUnchanged: 0, sourcesDeferred: 0,
    aiCostUsd: 0, inputTokens: 0, outputTokens: 0,
  };
}

let lastRunStats: GenericLaneRunStats = emptyStats();

/** ingest/run.ts reads this right after adapter.fetch() to fold ai_cost_usd
 *  into this run's source_runs row, the SourceAdapter interface returns only
 *  RawCandidate[], so spend/skip bookkeeping rides this side-channel instead
 *  of widening that shared interface for one adapter. */
export function getLastGenericRunStats(): GenericLaneRunStats {
  return lastRunStats;
}

export const generic: SourceAdapter = {
  key: 'generic',
  label: 'Generic AI extraction lane',
  async fetch(_window: DateWindow): Promise<RawCandidate[]> {
    const stats = emptyStats();
    const sb = getDb();
    const { data, error } = await sb
      .from('sources')
      .select('key, url, category_hints, venue_address, crawl_frequency, last_ok_at, content_hash')
      .eq('lane', 'generic')
      .eq('status', 'active');
    if (error) throw new Error(`generic lane sources read: ${error.message}`);
    const rows = (data ?? []) as SourceScheduleRow[];

    const now = new Date();
    const due = rows.filter((r) => isSourceDue(r, now));
    stats.sourcesDue = due.length;
    const selected = selectSourcesForRun(due);
    stats.sourcesDeferred = due.length - selected.length;
    if (stats.sourcesDeferred > 0) {
      console.log(`[generic] page cap (${GENERIC_LANE_PAGE_CAP}) reached, ${stats.sourcesDeferred} due source(s) deferred to a later run`);
    }
    if (!selected.length) {
      lastRunStats = stats;
      return [];
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log('[generic] ANTHROPIC_API_KEY not set, skipping generic-lane extraction this run');
      lastRunStats = stats;
      return [];
    }
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });

    const out: RawCandidate[] = [];
    for (const row of selected) {
      if (!row.url) continue;
      const nowIso = new Date().toISOString();
      try {
        const html = await fetchHtmlPolite(row.url, row.key);
        const text = reduceToText(html);
        const hash = hashText(text);

        if (row.content_hash && row.content_hash === hash) {
          stats.sourcesSkippedUnchanged++;
          console.log(`[generic] ${row.key}: unchanged since last check, skipping extraction`);
          await sb.from('sources').update({ last_ok_at: nowIso }).eq('key', row.key);
          continue;
        }

        const { events, usage } = await extractEvents(row.url, text, client);
        stats.sourcesExtracted++;
        stats.inputTokens += usage.inputTokens;
        stats.outputTokens += usage.outputTokens;
        const cost = (usage.inputTokens / 1_000_000) * HAIKU_INPUT_PER_M_USD
          + (usage.outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_M_USD;
        stats.aiCostUsd += cost;

        const mapped = events.map((e) => toRawCandidate(e, row, row.url!, now));
        const withStart = mapped.filter((c) => c.startStrategy === 'ai_extracted').length;
        console.log(`[generic] ${row.key}: ${events.length} extracted, ${withStart} with a deterministic date+time ($${cost.toFixed(4)})`);
        out.push(...mapped);

        await sb.from('sources').update({ content_hash: hash, last_ok_at: nowIso }).eq('key', row.key);
      } catch (err) {
        console.log(`[generic] ${row.key} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    lastRunStats = stats;
    console.log(
      `[generic] run summary: ${stats.sourcesExtracted} extracted, ${stats.sourcesSkippedUnchanged} unchanged-skipped, `
      + `${stats.sourcesDeferred} deferred (cap), $${stats.aiCostUsd.toFixed(4)} AI spend, `
      + `${stats.inputTokens}+${stats.outputTokens} tokens`,
    );
    return out;
  },
};
