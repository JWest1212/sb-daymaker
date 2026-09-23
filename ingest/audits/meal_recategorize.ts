// ingest/audits/meal_recategorize.ts
//
// R1 Wave 3 (W3.1) data pass. Move community food services out of the
// food-and-drink category, so nothing downstream can read them as a meal.
//
// lib/plan/meals.ts already refuses them at read time, which is the load-bearing
// fix. This pass corrects the stored data as well, so every other surface (the
// Activity door, the occasion tags, a future feature that reads the category)
// starts from the truth rather than from a classification that was never right.
//
// A food bank is a community gathering: it is a real, useful listing, it is just
// not a restaurant. Nothing is unpublished or deleted here.
//
// Run: RECAT_MEALS_DRYRUN=1 / RECAT_MEALS_APPLY=1 npx tsx ingest/run.ts

import type { SupabaseClient } from '@supabase/supabase-js';

/** Titles that are a food service rather than a place to eat. Kept in step with
 *  NOT_A_MEAL in lib/plan/meals.ts. */
const NOT_A_MEAL = [
  /\bfood\s+distribution\b/i,
  /\bfood\s+bank\b/i,
  /\bfood\s+pantry\b/i,
  /\bpantry\b/i,
  /\bmeal\s+service\b/i,
  /\bmeal\s+delivery\b/i,
  /\bsoup\s+kitchen\b/i,
  /\bfree\s+(?:meals?|lunch|groceries|grocery)\b/i,
  /\bcommunity\s+fridge\b/i,
];

/** The bookmobile. Named in the spec because it passed isFood() on its tags
 *  alone despite being a library van (TP-A9-07). */
const BOOKMOBILE = /^LOTG\b|\bbookmobile\b/i;

const TARGET_CATEGORY = 'community_gathering';

export interface RecatRow {
  id: string;
  title: string;
  status: string;
  happening_category: string | null;
  activities: string[] | null;
  reason: 'food_service' | 'bookmobile';
}

export interface RecatReport {
  scanned: number;
  toChange: RecatRow[];
  byTitle: Record<string, number>;
  written: number;
  dryRun: boolean;
}

const PAGE = 1000;

export async function recategorizeMeals(
  sb: SupabaseClient,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<RecatReport> {
  const rows: RecatRow[] = [];
  let scanned = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('things')
      .select('id, title, status, happening_category, activities')
      .in('status', ['published', 'archived', 'needs_review', 'draft'])
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`meal recat read: ${error.message}`);
    const page = (data ?? []) as unknown as Omit<RecatRow, 'reason'>[];
    scanned += page.length;
    for (const r of page) {
      const foodish =
        r.happening_category === 'food_drink_event' ||
        r.happening_category === 'food_drink_spot' ||
        (r.activities ?? []).includes('food-drink');
      if (!foodish) continue;
      if (NOT_A_MEAL.some((re) => re.test(r.title))) rows.push({ ...r, reason: 'food_service' });
      else if (BOOKMOBILE.test(r.title)) rows.push({ ...r, reason: 'bookmobile' });
    }
    if (page.length < PAGE) break;
  }

  const byTitle: Record<string, number> = {};
  for (const r of rows) byTitle[r.title] = (byTitle[r.title] ?? 0) + 1;

  const report: RecatReport = { scanned, toChange: rows, byTitle, written: 0, dryRun };
  if (dryRun || rows.length === 0) return report;

  let written = 0;
  for (const r of rows) {
    // activities is a per-row array, so this cannot be batched by id.
    const activities = (r.activities ?? []).filter((a) => a !== 'food-drink');
    const { error } = await sb
      .from('things')
      .update({ happening_category: TARGET_CATEGORY, activities })
      .eq('id', r.id);
    if (error) throw new Error(`meal recat write ${r.id}: ${error.message}`);
    written++;
  }
  report.written = written;

  await sb.from('audit_log').insert({
    entity_type: 'thing',
    entity_id: null,
    action: 'recategorize_food_service',
    actor: 'pipeline',
    payload: { changed: written, to: TARGET_CATEGORY, by_title: byTitle },
  });

  return report;
}

export function formatRecatReport(r: RecatReport): string {
  const L: string[] = [];
  L.push(`${r.dryRun ? 'DRY RUN' : 'APPLIED'}  recategorize_food_service -> ${TARGET_CATEGORY}`);
  L.push(`  scanned: ${r.scanned}`);
  L.push(`  rows to change: ${r.toChange.length}`);
  L.push('  by title:');
  for (const [t, n] of Object.entries(r.byTitle).sort(([, a], [, b]) => b - a)) {
    L.push(`     ${String(n).padStart(3)}  ${t}`);
  }
  return L.join('\n');
}
