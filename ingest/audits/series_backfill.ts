// ingest/audits/series_backfill.ts
//
// R1 Wave 5 (W5.2). Compute `series_key` for every dated row.

import type { SupabaseClient } from '@supabase/supabase-js';
import { seriesKey, groupBySeries } from '../series';

export interface SeriesReport {
  scanned: number;
  toWrite: { id: string; key: string }[];
  groups: { key: string; count: number; title: string }[];
  written: number;
  dryRun: boolean;
}

const PAGE = 1000;

export async function backfillSeries(
  sb: SupabaseClient,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<SeriesReport> {
  const rows: { id: string; title: string; venue_name: string | null; starts_at: string | null; series_key: string | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('things')
      .select('id, title, venue_name, starts_at, series_key')
      .in('status', ['published', 'archived'])
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`series backfill read: ${error.message}`);
    const page = (data ?? []) as unknown as typeof rows;
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const toWrite: { id: string; key: string }[] = [];
  for (const r of rows) {
    const k = seriesKey(r);
    if (k && k !== r.series_key) toWrite.push({ id: r.id, key: k });
  }

  const grouped = groupBySeries(rows);
  const groups = [...grouped.entries()].map(([key, list]) => ({
    key, count: list.length, title: list[0].title,
  }));

  const report: SeriesReport = { scanned: rows.length, toWrite, groups, written: 0, dryRun };
  if (dryRun || toWrite.length === 0) return report;

  let written = 0;
  for (const w of toWrite) {
    const { error } = await sb.from('things').update({ series_key: w.key }).eq('id', w.id);
    if (error) throw new Error(`series backfill write ${w.id}: ${error.message}`);
    written++;
  }
  report.written = written;
  await sb.from('audit_log').insert({
    entity_type: 'thing', entity_id: null, action: 'backfill_series', actor: 'pipeline',
    payload: { written, series: groups.length },
  });
  return report;
}

export function formatSeriesReport(r: SeriesReport, sampleSize = 30): string {
  const L: string[] = [];
  L.push(`${r.dryRun ? 'DRY RUN' : 'APPLIED'}  backfill_series`);
  L.push(`  scanned (published + archived) : ${r.scanned}`);
  L.push(`  rows needing a key             : ${r.toWrite.length}`);
  L.push(`  distinct series                : ${r.groups.length}`);
  L.push(`  series with more than one date : ${r.groups.filter((g) => g.count > 1).length}`);
  L.push('');
  L.push(`  top ${sampleSize} series by occurrence count:`);
  for (const g of r.groups.slice(0, sampleSize)) {
    L.push(`     ${String(g.count).padStart(4)}  ${g.title.slice(0, 54).padEnd(56)} ${g.key.slice(0, 50)}`);
  }
  return L.join('\n');
}
