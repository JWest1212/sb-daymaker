// scripts/reconcile_activity_slugs.mts
//
// Doc 22 Option A, the locked Activity vocabulary renames `festivals-community`
// to `community-festivals` and drops `clubs-groups` entirely. This reconciles
// existing things.activities[] data to match: renames the first slug in place,
// removes the second, dedupes defensively. Idempotent, a row with neither slug
// is left untouched; re-running after a successful apply is a no-op.
//
//   node --env-file=.env.local --import tsx scripts/reconcile_activity_slugs.mts          # dry run
//   node --env-file=.env.local --import tsx scripts/reconcile_activity_slugs.mts --write   # apply

import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const write = process.argv.includes("--write");

const { data, error } = await sb.from("things").select("id, activities");
if (error) throw new Error(error.message);
const rows = data ?? [];

let renamed = 0;
let removed = 0;
const toUpdate: { id: string; activities: string[] }[] = [];

for (const r of rows) {
  const acts = (r.activities as string[] | null) ?? [];
  if (!acts.includes("festivals-community") && !acts.includes("clubs-groups")) continue;

  const next = [...new Set(
    acts
      .map((a) => (a === "festivals-community" ? "community-festivals" : a))
      .filter((a) => a !== "clubs-groups"),
  )];

  if (acts.includes("festivals-community")) renamed++;
  if (acts.includes("clubs-groups")) removed++;
  toUpdate.push({ id: r.id as string, activities: next });
}

console.log(`${rows.length} things scanned`);
console.log(`  ${renamed} contain 'festivals-community' -> will rename to 'community-festivals'`);
console.log(`  ${removed} contain 'clubs-groups' -> will drop that element`);
console.log(`  ${toUpdate.length} rows total need an update`);

if (!write) {
  console.log("\nDRY RUN, writes nothing. Pass --write to apply.");
  process.exit(0);
}

let updated = 0;
for (const row of toUpdate) {
  const { error: upErr } = await sb.from("things").update({ activities: row.activities }).eq("id", row.id);
  if (upErr) throw new Error(`update ${row.id}: ${upErr.message}`);
  updated++;
}
console.log(`\nDone: ${updated} rows updated.`);
