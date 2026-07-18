// ingest/audits/daypart_fix.ts  (Gate 0 apply: G0.2 bulk daypart re-enrich)
//
// Founder-approved bulk fix. Re-runs enrich() over every published event the
// daypart scan flagged, so the NEW generator guard (daypart input + post-gen
// enforcement) redrafts them without a time-of-day contradiction. Writes back
// ONLY blurb + blurb_long, leaving founder-approved tags/other fields untouched.
// APPLY-gated: prints the count by default; only writes with APPLY=1.
//
// Run (plan):  node --env-file=.env.local --import tsx ingest/audits/daypart_fix.ts
// Run (apply): APPLY=1 node --env-file=.env.local --import tsx ingest/audits/daypart_fix.ts

import { getDb } from '../db';
import { enrich } from '../enrich';
import { daypartConflicts } from '../../lib/format/daypart';
import type { Candidate, PriceBand, Tod } from '../../packages/shared/types';
import { runDaypartConflictScan } from './daypart_conflict_scan';
import { isMain } from './_util';

interface Row {
  id: string; type: string; title: string;
  happening_tier: number; happening_category: string | null;
  neighborhood: string | null; address: string | null;
  price_band: string | null; time_of_day_fit: string[] | null;
  starts_at: string | null; ends_at: string | null; is_21_plus: boolean | null;
  blurb: string | null; blurb_long: string | null; source: string | null;
  last_confirmed: string | null;
}

function toCandidate(r: Row): Candidate {
  return {
    id: r.id,
    type: r.type as Candidate['type'],
    status: 'published' as Candidate['status'],
    title: r.title,
    tier: r.happening_tier,
    happening_category: (r.happening_category ?? 'arts_theater') as Candidate['happening_category'],
    neighborhood: (r.neighborhood ?? undefined) as Candidate['neighborhood'],
    address: r.address ?? '',
    price_band: (r.price_band ?? null) as PriceBand | null,
    time_of_day_fit: (r.time_of_day_fit ?? []) as Tod[],
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    is_21_plus: r.is_21_plus ?? false,
    blurb: r.blurb ?? undefined,
    blurb_long: r.blurb_long ?? undefined,
    source_url: r.source ?? 'https://sbdaymaker.local/reenrich',
    last_confirmed: r.last_confirmed ?? null,
    start_strategy: 'structured',
  } as Candidate;
}

async function main() {
  const apply = process.env.APPLY === '1';
  const sb = getDb();

  const flags = await runDaypartConflictScan();
  const ids = [...new Set(flags.map((f) => f.id))];
  console.log(`[daypart_fix] ${ids.length} flagged event(s) to re-enrich. ${apply ? 'APPLYING' : 'PLAN (dry run)'}\n`);
  if (!ids.length) { console.log('  nothing to do.'); process.exit(0); }

  const { data, error } = await sb
    .from('things')
    .select('id, type, title, happening_tier, happening_category, neighborhood, address, price_band, time_of_day_fit, starts_at, ends_at, is_21_plus, blurb, blurb_long, source, last_confirmed')
    .in('id', ids);
  if (error) throw new Error(`load rows: ${error.message}`);

  const cands = (data ?? []).map((r) => toCandidate(r as Row));
  if (!apply) {
    console.log('  Re-run with APPLY=1 to redraft these via the guarded enrich pipeline.');
    process.exit(0);
  }

  const enriched = await enrich(cands, { sb });
  let updated = 0, stillConflicting = 0;
  for (const c of enriched) {
    // Safety net: enforce again post-write (enrich already did). Never write a
    // blurb that still conflicts.
    const conflicts = c.starts_at
      ? daypartConflicts(c.blurb, c.starts_at).length + daypartConflicts(c.blurb_long, c.starts_at).length
      : 0;
    if (conflicts) stillConflicting++;
    const { error: uErr } = await sb.from('things')
      .update({ blurb: c.blurb ?? null, blurb_long: c.blurb_long ?? null })
      .eq('id', c.id);
    if (uErr) throw new Error(`update ${c.id}: ${uErr.message}`);
    updated++;
  }
  console.log(`\n[daypart_fix] updated ${updated} row(s); ${stillConflicting} still conflicting (should be 0).`);
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
