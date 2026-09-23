// ingest/civicBackfill.ts
//
// R1 Wave 2 (W2.3). One-time pass to set `is_civic` on rows that already landed
// before the adapters started flagging it. Same rules as ingest/civic.ts, which
// is the only place the rules live.
//
// Idempotent: it only writes rows whose current flag disagrees with the rule, so
// re-running it is a no-op, and a row Jim has deliberately flipped back to
// non-civic in the cockpit will be flipped again only if the rule still matches
// it. That last point is why the cockpit chip matters, see W2.7.

import type { SupabaseClient } from '@supabase/supabase-js';
import { civicReason, type CivicInput } from './civic';

export interface CivicBackfillRow {
  id: string;
  title: string;
  source: string | null;
  status: string;
  reason: 'source' | 'title' | 'closure';
}

export interface CivicBackfillReport {
  scanned: number;
  /** Rows the rule matches that are not already flagged. */
  toFlag: CivicBackfillRow[];
  byReason: Record<string, number>;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  /** Already flagged and still matching: nothing to do. */
  alreadyFlagged: number;
  /** Flagged today but no longer matching the rule. Reported, never unflagged
   *  automatically, because a human may have set it on purpose. */
  flaggedButNotMatching: CivicBackfillRow[];
  written: number;
  dryRun: boolean;
}

/** A source URL reduced to its host, so a report groups instead of listing one
 *  line per row. */
function shortSource(s: string | null): string {
  if (!s) return '(none)';
  try {
    return new URL(s).hostname.replace(/^www\./, '');
  } catch {
    return s;
  }
}

const PAGE = 1000;

/** Every row worth scanning: anything the public could see, plus the queue. */
async function fetchRows(sb: SupabaseClient) {
  const rows: { id: string; title: string; source: string | null; status: string; is_civic: boolean }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('things')
      .select('id, title, source, status, is_civic')
      .in('status', ['published', 'archived', 'needs_review', 'draft'])
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`civic backfill read: ${error.message}`);
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function backfillCivic(
  sb: SupabaseClient,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<CivicBackfillReport> {
  const rows = await fetchRows(sb);

  const toFlag: CivicBackfillRow[] = [];
  const flaggedButNotMatching: CivicBackfillRow[] = [];
  let alreadyFlagged = 0;

  for (const r of rows) {
    const input: CivicInput = { title: r.title, source: r.source, sourceUrl: r.source };
    const reason = civicReason(input);
    if (reason && !r.is_civic) {
      toFlag.push({ id: r.id, title: r.title, source: r.source, status: r.status, reason });
    } else if (reason && r.is_civic) {
      alreadyFlagged++;
    } else if (!reason && r.is_civic) {
      flaggedButNotMatching.push({ id: r.id, title: r.title, source: r.source, status: r.status, reason: 'title' });
    }
  }

  const tally = (key: (r: CivicBackfillRow) => string) =>
    Object.fromEntries(
      Object.entries(
        toFlag.reduce<Record<string, number>>((acc, r) => {
          const k = key(r);
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
      ).sort(([, a], [, b]) => b - a),
    );

  const report: CivicBackfillReport = {
    scanned: rows.length,
    toFlag,
    byReason: tally((r) => r.reason),
    bySource: tally((r) => shortSource(r.source)),
    byStatus: tally((r) => r.status),
    alreadyFlagged,
    flaggedButNotMatching,
    written: 0,
    dryRun,
  };
  if (dryRun || toFlag.length === 0) return report;

  let written = 0;
  for (let i = 0; i < toFlag.length; i += 200) {
    const chunk = toFlag.slice(i, i + 200).map((r) => r.id);
    const { data, error } = await sb
      .from('things')
      .update({ is_civic: true })
      .in('id', chunk)
      .select('id');
    if (error) throw new Error(`civic backfill write: ${error.message}`);
    written += data?.length ?? 0;
  }
  report.written = written;

  await sb.from('audit_log').insert({
    entity_type: 'thing',
    entity_id: null,
    action: 'flag_civic',
    actor: 'pipeline',
    payload: { flagged: written, by_reason: report.byReason, by_source: report.bySource },
  });

  return report;
}

export function formatCivicReport(r: CivicBackfillReport, sampleSize = 30): string {
  const lines: string[] = [];
  lines.push(`${r.dryRun ? 'DRY RUN' : 'APPLIED'}  flag_civic`);
  lines.push(`  scanned: ${r.scanned}`);
  lines.push(`  already flagged and still matching: ${r.alreadyFlagged}`);
  lines.push(`  WOULD FLAG: ${r.toFlag.length}`);
  lines.push('  by rule:');
  for (const [k, n] of Object.entries(r.byReason)) lines.push(`     ${k.padEnd(9)} ${n}`);
  lines.push('  by status:');
  for (const [k, n] of Object.entries(r.byStatus)) lines.push(`     ${k.padEnd(14)} ${n}`);
  lines.push('  by source host (top 12):');
  for (const [k, n] of Object.entries(r.bySource).slice(0, 12)) lines.push(`     ${k.padEnd(36)} ${n}`);
  if (r.flaggedButNotMatching.length) {
    lines.push(`  flagged but no longer matching (left alone): ${r.flaggedButNotMatching.length}`);
  }
  lines.push(`  sample of ${Math.min(sampleSize, r.toFlag.length)} titles that would be hidden from the feed:`);
  for (const t of r.toFlag.slice(0, sampleSize)) {
    lines.push(`     [${t.reason}] ${t.status.padEnd(12)} ${t.title}`);
  }
  return lines.join('\n');
}
