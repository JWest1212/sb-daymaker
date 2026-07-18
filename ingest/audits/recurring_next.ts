// ingest/audits/recurring_next.ts  (Elevation v1 · Gate 3 · G3.4)
//
// Compute recurring_schedules.next_occurrence for every recurring row, from
// cadence + day_of_week + nth_dow. DATA operation (not DDL): the column was added
// in Gate 1; this fills it. `recomputeNextOccurrences()` is the shared engine,
// called BOTH here (one-off/on-demand) and by the nightly worker so the stored
// next-date stays current (the public card also computes it read-time, so a card
// is never stale even between runs; this keeps the column right for the digest).
//
// Run:  node --env-file=.env.local --import tsx ingest/audits/recurring_next.ts
//       DRY_RUN=1 ...  (preview, writes nothing)

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "../db";
import { sbDay } from "../../lib/explore";
import { nextOccurrence } from "../../lib/recurring/nextOccurrence";
import { isMain } from "./_util";

interface Row {
  id: string;
  day_of_week: number | null;
  frequency: string | null;
  cadence: string | null;
  nth_dow: number | null;
  start_time: string | null;
  last_confirmed: string | null;
  next_occurrence: string | null;
}

export interface NextResult {
  scanned: number;
  computed: number;
  irregular: number;
  changed: number;
}

export async function recomputeNextOccurrences(
  sb: SupabaseClient,
  opts: { dry?: boolean } = {},
): Promise<NextResult> {
  const { data, error } = await sb
    .from("recurring_schedules")
    .select("id, day_of_week, frequency, cadence, nth_dow, start_time, last_confirmed, next_occurrence");
  if (error) throw new Error(`recurring-next select: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];
  const fromKey = sbDay(Date.now());

  let computed = 0;
  let irregular = 0;
  let changed = 0;
  for (const r of rows) {
    const next = nextOccurrence(r, fromKey); // "YYYY-MM-DD" | null
    if (next) computed++;
    else irregular++;
    if (next !== r.next_occurrence) {
      changed++;
      if (!opts.dry) {
        const { error: upErr } = await sb
          .from("recurring_schedules")
          .update({ next_occurrence: next })
          .eq("id", r.id);
        if (upErr) throw new Error(`recurring-next update ${r.id}: ${upErr.message}`);
      }
    }
  }
  return { scanned: rows.length, computed, irregular, changed };
}

async function main() {
  const dry = process.env.DRY_RUN === "1";
  const r = await recomputeNextOccurrences(getDb(), { dry });
  console.log(`\n[recurring-next] ${dry ? "DRY RUN (no writes) · " : ""}scanned ${r.scanned} schedule(s)`);
  console.log(`  computed a next date: ${r.computed}`);
  console.log(`  no honest date (irregular/seasonal/no weekday): ${r.irregular}`);
  console.log(`  changed this run: ${r.changed}\n`);
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
