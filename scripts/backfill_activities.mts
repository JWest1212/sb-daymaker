// scripts/backfill_activities.mts
//
// Doc 21 — one-time (repeatable) backfill: derive `things.activities` from
// `happening_category` via the deterministic map in ingest/activityBackfill.ts.
// Unions into activities[] where empty; NEVER overwrites a row that already
// carries at least one tag (Doc 21 §4 — union, don't clobber).
//
//   node --env-file=.env.local --import tsx scripts/backfill_activities.mts          # dry run
//   node --env-file=.env.local --import tsx scripts/backfill_activities.mts --write   # apply

import { createClient } from "@supabase/supabase-js";
import { categoryToActivities } from "../ingest/activityBackfill";
import { ACTIVITY_KEYS } from "../lib/activities";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const write = process.argv.includes("--write");

// All statuses, not just published: Doc 21's 725/716/9 audit numbers span the
// whole catalog (needs_review rows should already carry activities[] by the
// time they publish; archived rows cost nothing to tag). The live door itself
// still only reads published things.
const { data, error } = await sb
  .from("things")
  .select("id, status, happening_category, activities");
if (error) throw new Error(error.message);
const rows = data ?? [];

const bySlug: Record<string, number> = Object.fromEntries(ACTIVITY_KEYS.map((k) => [k, 0]));
const byStatus: Record<string, number> = {};
let alreadyTagged = 0;
let unmapped = 0;
const toUpdate: { id: string; activities: string[] }[] = [];

for (const r of rows) {
  const status = r.status as string;
  byStatus[status] = (byStatus[status] ?? 0) + 1;
  const existing = (r.activities as string[] | null) ?? [];
  if (existing.length > 0) {
    alreadyTagged++;
    for (const slug of existing) if (slug in bySlug) bySlug[slug]++;
    continue; // never clobber a pre-tagged row
  }
  const mapped = categoryToActivities(r.happening_category as string | null);
  if (mapped.length === 0) {
    unmapped++;
    continue;
  }
  for (const slug of mapped) bySlug[slug]++;
  toUpdate.push({ id: r.id as string, activities: mapped });
}

console.log(`${rows.length} things total (all statuses)`);
for (const [s, c] of Object.entries(byStatus)) console.log(`  ${s.padEnd(15)} ${c}`);
console.log(`  ${alreadyTagged} already tagged (untouched, union-not-clobber)`);
console.log(`  ${toUpdate.length} would be newly tagged from happening_category`);
console.log(`  ${unmapped} remain empty (no mapped category — see Doc 21 §5 known-sparse slugs)`);
console.log(`\nProjected activities[] per-slug counts (after this pass, existing + newly mapped):`);
for (const key of ACTIVITY_KEYS) console.log(`  ${key.padEnd(20)} ${bySlug[key]}`);

if (!write) {
  console.log("\nDRY RUN — writes nothing. Pass --write to apply.");
  process.exit(0);
}

// Group by identical mapped-activities tuple so each distinct combination is
// one chunked bulk update, not one request per row (same convention as
// scripts/backfill_nearby_zone.mts).
const byMapping = new Map<string, string[]>();
for (const row of toUpdate) {
  const key = JSON.stringify(row.activities);
  (byMapping.get(key) ?? byMapping.set(key, []).get(key)!).push(row.id);
}

let updated = 0;
for (const [key, ids] of byMapping) {
  const activities = JSON.parse(key) as string[];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { error: upErr } = await sb.from("things").update({ activities }).in("id", chunk);
    if (upErr) throw new Error(`update [${activities.join(",")}]: ${upErr.message}`);
    updated += chunk.length;
  }
}
console.log(`\nDone: ${updated} rows tagged.`);
