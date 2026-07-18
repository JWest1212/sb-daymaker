// ingest/audits/gate0_apply.ts  (Gate 0 apply: G0.6 Art Walks + G0.4 merges)
//
// Founder-approved, deterministic DB writes. Idempotent + APPLY-gated: prints the
// plan by default; only writes with APPLY=1.
//
//   G0.6  Reclassify the two Art Walks from recurring places (Tier 2, wrongly in
//         "Every week") to dated Tier-1 events with the confirmed next dates, and
//         drop their recurring_schedules rows so no "recurring" signal remains.
//   G0.4  Merge each confirmed duplicate: archive the loser and point merged_into
//         at the survivor (no guide_stops/edition_picks reference the losers, so
//         nothing to re-point; the Gate 2 redirect layer will 301 the old URLs).
//
// Run (plan):  node --env-file=.env.local --import tsx ingest/audits/gate0_apply.ts
// Run (apply): APPLY=1 node --env-file=.env.local --import tsx ingest/audits/gate0_apply.ts

import { getDb } from '../db';
import { sbISO } from '../tz';
import { isMain } from './_util';

// G0.6, confirmed by Jim. Funk Zone = last Thursday monthly (its stored "Friday"
// was wrong); 1st Thursday = first Thursday monthly.
const ART_WALKS = [
  { id: '5fc68c7d-91ad-5014-893d-d7d2aab22116', title: 'Funk Zone Art Walk', start: sbISO(2026, 7, 30, 17, 0), end: sbISO(2026, 7, 30, 19, 0) },
  { id: '29d8129b-a514-56aa-8028-5ddac4d620da', title: '1st Thursday Art Walk', start: sbISO(2026, 8, 6, 17, 0), end: sbISO(2026, 8, 6, 20, 0) },
];

// G0.4, survivor <- loser (survivor keeps place_id / photo / fuller title).
const MERGES = [
  { survivor: '921caa91-f437-5e64-b814-9d38305a120c', loser: 'ee877878-b525-57f1-86ea-39647a1b453d', what: 'SBMA' },
  { survivor: 'caf4c75e-9f13-5ec6-981c-907c7206b8ab', loser: '3a3eca51-251e-5cfd-85bd-1a583f6267d4', what: 'James McMurtry' },
  { survivor: '366cad81-fbc1-5885-8294-a411d27425ec', loser: '539723ab-1d7c-5073-9b94-7f6d9d28c8e1', what: 'folkYEAH! Automatic' },
  { survivor: '2fe78b23-c2aa-52ab-8255-0188af5fbc78', loser: '5e8cfaf9-4176-5d5e-b652-8e818faa89cb', what: 'Figueroa Mountain (event into venue)' },
];

async function main() {
  const apply = process.env.APPLY === '1';
  const sb = getDb();
  console.log(`[gate0_apply] ${apply ? 'APPLYING' : 'PLAN (dry run)'} \n`);

  console.log('G0.6, reclassify Art Walks to dated Tier-1 events:');
  for (const w of ART_WALKS) {
    console.log(`  ${w.title}: type=event, tier=1, ${w.start} to ${w.end}, drop recurring_schedules`);
    if (apply) {
      const { error: uErr } = await sb.from('things')
        .update({ type: 'event', happening_tier: 1, starts_at: w.start, ends_at: w.end })
        .eq('id', w.id);
      if (uErr) throw new Error(`${w.title} update: ${uErr.message}`);
      const { error: dErr } = await sb.from('recurring_schedules').delete().eq('thing_id', w.id);
      if (dErr) throw new Error(`${w.title} schedule delete: ${dErr.message}`);
    }
  }

  console.log('\nG0.4, merge duplicates (archive loser, set merged_into):');
  for (const m of MERGES) {
    console.log(`  ${m.what}: archive ${m.loser} -> survivor ${m.survivor}`);
    if (apply) {
      const { error } = await sb.from('things')
        .update({ status: 'archived', merged_into: m.survivor })
        .eq('id', m.loser);
      if (error) throw new Error(`${m.what} merge: ${error.message}`);
    }
  }

  console.log(`\n[gate0_apply] ${apply ? 'done.' : 'plan only, re-run with APPLY=1 to write.'}`);
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
