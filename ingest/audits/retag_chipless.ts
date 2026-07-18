// ingest/audits/retag_chipless.ts  (Elevation v1 · Gate 1 · G1.9, "re-run tagging on offenders")
//
// Finds published things carrying ZERO stored occasion tags (their cards render
// chipless, or lean only on a read-time-derived rainy_day/dog_friendly chip) and
// runs the SAME batched enrich the nightly uses to propose occasion tags, then
// lands them. Tags only: existing blurbs are never touched (we call enrich for
// its tag proposals and only landTags the result).
//
// The negative rules (21+ -> no family_day, non-free -> no free_sb, alcohol/adult
// -> no family_day) + the top-3 cap run inside enrich, so what lands here obeys
// the same publish-safety rules as everything else.
//
// Run:  node --env-file=.env.local --import tsx ingest/audits/retag_chipless.ts
//       DRY_RUN=1 ... (report the offenders + proposed tags, write nothing)

import { getDb } from '../db';
import { enrich } from '../enrich';
import { landTags } from '../land';
import { isMain } from './_util';
import type { Candidate, Tod } from '../../packages/shared/types';

const OCCASION_TAGS = new Set([
  'date_night', 'family_day', 'nightlife', 'catch_a_show', 'arts_culture',
  'outdoors_active', 'wine_food', 'free_sb', 'hosting_visitors', 'solo',
]);

interface ChiplessRow {
  id: string;
  type: string;
  title: string;
  happening_tier: number;
  happening_category: string | null;
  neighborhood: string | null;
  address: string | null;
  price_band: string | null;
  time_of_day_fit: string[] | null;
  is_21_plus: boolean | null;
  reason_to_go: string | null;
  source: string | null;
  last_confirmed: string | null;
  thing_tags: { tag: string }[] | null;
}

export async function retagChipless(dry: boolean): Promise<{ offenders: number; tagsWritten: number }> {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select(
      'id, type, title, happening_tier, happening_category, neighborhood, address, ' +
        'price_band, time_of_day_fit, is_21_plus, reason_to_go, source, last_confirmed, ' +
        'thing_tags ( tag )',
    )
    .eq('status', 'published');
  if (error) throw new Error(`retag select: ${error.message}`);
  const rows = (data ?? []) as unknown as ChiplessRow[];

  // Offenders = zero STORED occasion tags (rainy_day/dog_friendly are read-time
  // derivations, not stored, so a row with only those still counts as untagged).
  const offenders = rows.filter((r) => {
    const tags = (r.thing_tags ?? []).map((t) => t.tag);
    return tags.filter((t) => OCCASION_TAGS.has(t)).length === 0;
  });

  console.log(`\n[retag-chipless] ${offenders.length} published row(s) with no occasion tag`);
  for (const r of offenders) console.log(`  ${r.id}  [${r.type}/${r.happening_category}]  "${r.title}"`);
  if (!offenders.length) return { offenders: 0, tagsWritten: 0 };

  const cands: Candidate[] = offenders.map((r) => ({
    id: r.id,
    type: r.type as Candidate['type'],
    status: 'needs_review',
    title: r.title as string,
    tier: Number(r.happening_tier) as Candidate['tier'],
    happening_category: r.happening_category as Candidate['happening_category'],
    neighborhood: (r.neighborhood ?? undefined) as Candidate['neighborhood'],
    address: r.address ?? '',
    price_band: (r.price_band ?? null) as Candidate['price_band'],
    time_of_day_fit: (r.time_of_day_fit as Tod[]) ?? [],
    starts_at: null, // enrich must never see a start time
    ends_at: null,
    source_url: (r.source as string) ?? '',
    reason_to_go: r.reason_to_go ?? undefined,
    is_21_plus: (r.is_21_plus as boolean) ?? undefined,
    last_confirmed: (r.last_confirmed as string)?.slice(0, 10) ?? '',
    start_strategy: 'none',
  }));

  const enriched = await enrich(cands, { sb });
  for (const c of enriched) {
    const tags = (c.proposed_tags ?? []).map((t) => t.tag).join(', ') || '(none proposed)';
    console.log(`  -> ${c.id}: ${tags}`);
  }
  if (dry) {
    console.log('\n[retag-chipless] DRY RUN, no tags written.\n');
    return { offenders: offenders.length, tagsWritten: 0 };
  }
  const tagsWritten = await landTags(sb, enriched);
  console.log(`\n[retag-chipless] wrote ${tagsWritten} occasion tag(s) across ${offenders.length} row(s).\n`);
  return { offenders: offenders.length, tagsWritten };
}

if (isMain(import.meta.url)) {
  retagChipless(process.env.DRY_RUN === '1').catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
