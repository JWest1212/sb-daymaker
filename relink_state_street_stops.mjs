// relink_state_street_stops.mjs — re-resolve the 6 label-only State Street stops
// now that seed_state_street_things.mjs added their venues to the catalog.
// Sets thing_id and clears the authored sub/maps_query fallback so the stop's
// sub-line and directions link auto-derive from thing data (spec §3/§4).
// Idempotent. Apply: `node relink_state_street_stops.mjs`

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const GUIDE_ID = "483ec84a-c031-56e0-b9fd-5a2a98f90182";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const TITLES = [
  "Caje",
  "The Arlington Theatre",
  "La Arcada Courtyard",
  "El Presidio de Santa Barbara",
  "Palihouse",
  "Paloma",
];

const { data: things, error: lookupErr } = await sb
  .from("things")
  .select("id, title")
  .in("title", TITLES);
if (lookupErr || !things) {
  console.error("❌ lookup failed:", lookupErr?.message);
  process.exit(1);
}
const byTitle = Object.fromEntries(things.map((t) => [t.title, t.id]));
for (const title of TITLES) {
  if (!byTitle[title]) {
    console.error(`❌ still missing from catalog: "${title}"`);
    process.exit(1);
  }
}

let ok = true;
for (const title of TITLES) {
  const { error } = await sb
    .from("guide_stops")
    .update({ thing_id: byTitle[title], sub: null, maps_query: null })
    .eq("guide_id", GUIDE_ID)
    .eq("label", title);
  if (error) {
    console.error(`❌ ${title}: ${error.message}`);
    ok = false;
  } else {
    console.log(`✅ ${title} → thing ${byTitle[title].slice(0, 8)}…`);
  }
}

console.log("\n=== verification ===");
const { data: stops } = await sb
  .from("guide_stops")
  .select("position, label, thing_id, sub, maps_query")
  .eq("guide_id", GUIDE_ID)
  .order("position");
for (const s of stops ?? []) {
  console.log(`  ${s.position}. ${s.label} — ${s.thing_id ? "thing-backed" : "label-only"}`);
}

console.log(ok ? "\nAll 9 stops now thing-backed." : "\nSome stops failed — see above.");
process.exit(ok ? 0 : 1);
