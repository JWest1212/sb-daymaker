// scripts/backfill_nearby_zone.mts
//
// One-time (repeatable) backfill: derive `things.nearby_zone` from lat/lng for
// rows that have coordinates but no zone yet. Going forward the ingest landing
// step (toThingRow) sets this; this catches everything that landed before that.
//
//   node --env-file=.env.local --import tsx scripts/backfill_nearby_zone.mts          # dry run
//   node --env-file=.env.local --import tsx scripts/backfill_nearby_zone.mts --write   # apply

import { createClient } from "@supabase/supabase-js";
import { nearestZone, zoneForNeighborhood } from "../lib/zones";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const write = process.argv.includes("--write");

const { data, error } = await sb
  .from("things")
  .select("id, lat, lng, neighborhood")
  .is("nearby_zone", null);
if (error) throw new Error(error.message);
const rows = data ?? [];

// Prefer coordinates; fall back to the neighborhood mapping. Skip rows we can't zone.
const byZone: Record<string, string[]> = {};
let unzonable = 0;
for (const r of rows) {
  const z = r.lat != null && r.lng != null
    ? nearestZone(Number(r.lat), Number(r.lng))
    : zoneForNeighborhood(r.neighborhood as string | null);
  if (!z) { unzonable++; continue; }
  (byZone[z] ??= []).push(r.id as string);
}

console.log(`${rows.length} rows with no nearby_zone (${unzonable} unzonable, no coords, no mappable neighborhood):`);
for (const [z, ids] of Object.entries(byZone)) console.log(`  ${z.padEnd(12)} ${ids.length}`);

if (!write) {
  console.log("\nDRY RUN, pass --write to apply.");
  process.exit(0);
}

let updated = 0;
for (const [z, ids] of Object.entries(byZone)) {
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { error: upErr } = await sb.from("things").update({ nearby_zone: z }).in("id", chunk);
    if (upErr) throw new Error(`update ${z}: ${upErr.message}`);
    updated += chunk.length;
  }
  console.log(`  updated ${ids.length} -> ${z}`);
}
console.log(`\nDone: ${updated} rows zoned.`);
