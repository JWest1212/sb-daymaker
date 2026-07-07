// ingest/draftEdition.ts
//
// On-demand / nightly entrypoint for the reader-edition drafter (spec §3, §3.1).
// Mirrors ingest/run.ts's conventions (getDb(), console summary, non-zero exit
// on fatal error) so it drops into the same GitHub Action pattern once §3.1's
// schedule wiring lands (Wed/Sat-night gate — not built yet, tracked separately).
//
// Usage:
//   npx tsx ingest/draftEdition.ts                 auto: drafts the next Thu/Sun
//                                                   edition IF tonight (SB time)
//                                                   is Wed or Sat; else no-ops.
//   EDITION_DATE=2026-07-09 EDITION_TYPE=weekend \
//     npx tsx ingest/draftEdition.ts               explicit override (testing/backfill).

import { getDb } from './db';
import { draftEdition } from '../lib/edition/draft';
import { sbDay, sbDayOfWeek } from '../lib/explore';
import type { EditionType } from '../lib/edition/types';

function nextEditionTarget(now: number): { date: string; type: EditionType } | null {
  const dow = sbDayOfWeek(now);
  const [y, m, d] = sbDay(now).split('-').map(Number);
  const tomorrow = sbDay(Date.UTC(y, m - 1, d + 1, 12));
  if (dow === 3) return { date: tomorrow, type: 'weekend' };   // Wed night -> Thu edition
  if (dow === 6) return { date: tomorrow, type: 'week_ahead' }; // Sat night -> Sun edition
  return null;
}

async function main() {
  const overrideDate = process.env.EDITION_DATE;
  const overrideType = process.env.EDITION_TYPE as EditionType | undefined;

  let target: { date: string; type: EditionType } | null;
  if (overrideDate && overrideType) {
    target = { date: overrideDate, type: overrideType };
  } else if (overrideDate || overrideType) {
    throw new Error('draftEdition: set BOTH EDITION_DATE and EDITION_TYPE, or neither (auto mode)');
  } else {
    target = nextEditionTarget(Date.now());
  }

  if (!target) {
    console.log('[edition] not a drafting night (SB time) — no-op');
    return;
  }

  console.log(`\n[edition] drafting ${target.type} edition for ${target.date}...\n`);
  const sb = getDb();
  const result = await draftEdition(sb, target.date, target.type);

  if (!result.ok) {
    console.log(`[edition] ${result.status}: ${result.skipReason ?? '(no reason given)'}`);
    if (result.status === 'failed') process.exitCode = 1;
    return;
  }
  console.log(
    `[edition] drafted ${result.editionId} — hero via ${result.heroSource}, ` +
      `${result.counts?.secondaries} secondaries, ${result.counts?.nonevent ? 'non-event picked' : 'no non-event pick'}, ` +
      `anchor ${result.counts?.anchor ? 'fired' : 'not fired'}`,
  );
}

main().catch((err) => {
  console.error('[edition] fatal:', err);
  process.exit(1);
});
