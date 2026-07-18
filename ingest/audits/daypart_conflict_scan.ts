// ingest/audits/daypart_conflict_scan.ts  (Gate 0 · G0.2, data sweep)
//
// For every PUBLISHED event with a start time, flags blurb / blurb_long copy
// whose daypart words contradict the true local daypart (the "free evening talk"
// at 10am class of bug). Emits a review table; does NOT auto-edit. Jim approves
// regenerations; enrich re-runs on approved rows only.
//
// The generator-side fix (prompt input + post-gen enforcement) lives in
// ingest/enrich.ts; this scan cleans the rows drafted before that guard existed.
//
// Run: node --env-file=.env.local --import tsx ingest/audits/daypart_conflict_scan.ts

import { getDb } from '../db';
import { daypartConflicts, trueDaypart } from '../../lib/format/daypart';
import { type Flag, isMain, printTable, snippet, writeReport } from './_util';

interface EventRow {
  id: string; title: string; starts_at: string;
  blurb: string | null; blurb_long: string | null;
}

export async function runDaypartConflictScan(): Promise<Flag[]> {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select('id, title, starts_at, blurb, blurb_long')
    .eq('status', 'published')
    .eq('type', 'event')
    .not('starts_at', 'is', null);
  if (error) throw new Error(`daypart scan: ${error.message}`);

  const flags: Flag[] = [];
  for (const e of (data ?? []) as EventRow[]) {
    const td = trueDaypart(e.starts_at);
    for (const col of ['blurb', 'blurb_long'] as const) {
      const conflicts = daypartConflicts(e[col], e.starts_at);
      if (conflicts.length) {
        const words = [...new Set(conflicts.map((c) => c.word))].join(', ');
        flags.push({
          id: e.id,
          title: e.title,
          table: 'things',
          column: col,
          snippet: snippet(e[col]!),
          note: `true daypart: ${td} · says: ${words}`,
        });
      }
    }
  }
  return flags;
}

async function main() {
  console.log('[daypart_conflict_scan] scanning published events for daypart contradictions…\n');
  const flags = await runDaypartConflictScan();
  printTable(flags);
  const path = writeReport('daypart_conflict_scan', 'G0.2, Daypart hallucinations (published events)', flags);
  console.log(`\n[daypart_conflict_scan] ${flags.length} flagged. Report: ${path}`);
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
