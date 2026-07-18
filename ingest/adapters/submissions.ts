// ingest/adapters/submissions.ts
//
// Public /submit entries as a first-class source, so they ride the SAME pipeline
// as every adapter: gate -> dedupe -> enrich -> images -> land. This replaces the
// old lib/pipeline.runNightly path. Submissions are reviewed like anything else;
// incomplete ones are dropped-with-reason into the cockpit's "Dropped tonight".
//
// Strict-gate honesty: an event's free-text `when` becomes a start ONLY if the
// submitter gave a real date + clock time. Vague prose ("Saturday 8-ish") is never
// guessed into a start, it emits startStrategy:'none' and the gate drops it.

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { getDb } from '../db';
import { sbISO } from '../tz';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse a submitter's `when` into an ISO start, only when it carries an explicit
 *  month/day/year AND a clock time. Otherwise null (the gate then drops the event). */
export function parseSubmissionWhen(when: string | undefined): string | null {
  if (!when) return null;
  const m = when.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4}).{0,12}?(\d{1,2}):(\d{2})\s*([ap])\.?m/i);
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  let hour = Number(m[4]) % 12;
  if (m[6].toLowerCase() === 'p') hour += 12;
  return sbISO(Number(m[3]), month, Number(m[2]), hour, Number(m[5]));
}

interface SubRow { id: string; kind: string; raw_payload: Record<string, string> | null }

export const submissions: SourceAdapter = {
  key: 'submission',
  label: 'Public submissions',
  async fetch(): Promise<RawCandidate[]> {
    const sb = getDb();
    const { data } = await sb
      .from('submissions')
      .select('id, kind, raw_payload')
      .eq('status', 'new');
    const rows = (data ?? []) as SubRow[];
    if (!rows.length) return [];

    const out: RawCandidate[] = [];
    for (const r of rows) {
      const p = r.raw_payload ?? {};
      const isEvent = r.kind === 'event';
      const startISO = isEvent ? parseSubmissionWhen(p.when) ?? undefined : undefined;
      const free = /free/i.test(p.price ?? '');
      out.push({
        source: 'submission',
        title: p.name ?? '',
        address: p.where ?? undefined,
        tier: isEvent ? 1 : 3,
        category: isEvent ? 'community_gathering' : 'food_drink_spot',
        type: isEvent ? 'event' : 'place',
        startISO,
        startStrategy: startISO ? 'server_detail' : 'none',
        priceLow: null,
        explicitlyFree: free,
        // Synthetic, stable source so the row is keyable + idempotent; not an http
        // link, so the cockpit shows no "view source" (correct, there's no page).
        sourceUrl: `submission:${r.id}`,
        reasonToGo: isEvent ? undefined : (p.caption || undefined), // T3 needs a reason
        localNote: p.caption || undefined,
        raw: { submissionId: r.id },
      });
    }

    // Mark every submission we processed as parsed (dropped ones are visible in
    // ingest_drops; landed ones become needs_review things) so they don't re-run.
    // Never mutate during a dry run.
    if (process.env.DRY_RUN !== '1') {
      await sb.from('submissions').update({ status: 'parsed' }).in('id', rows.map((r) => r.id));
    }
    return out;
  },
};
