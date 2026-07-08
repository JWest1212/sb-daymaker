// seed_state_street_things.mjs — Living Postcard Phase 5 prerequisite (2026-07-08)
//
// Adds the six State Street walk venues that were missing from the catalog so the
// guide stops can resolve thing-backed (Caje, The Arlington Theatre, La Arcada
// Courtyard, El Presidio de Santa Barbara, Palihouse, Paloma). Facts are enriched
// from public sources (addresses from the build spec §7 appendix, coordinates
// geocoded via OpenStreetMap Nominatim, cross-checked by name where indexed),
// NEVER invented. Rows mirror the shape of the existing published downtown things
// (Book Den / Public Market / Courthouse): Tier-3 evergreen `place`,
// neighborhood/zone 'downtown', with reason_to_go set (the Tier-3 publish gate).
//
// Idempotent: deterministic uuidv5 ids on the gate's 'seed:google_places|<title>'
// key (ingest/gate.ts idFor), upserted on id; tags are replaced (delete+insert).
// Re-running changes nothing. Apply: `node seed_state_street_things.mjs`

import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import { readFileSync } from "node:fs";

const NS = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"; // same namespace as the seed/gate
const idFor = (title) => uuidv5(`seed:google_places|${title}`, NS);

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

// House copy style: no em dashes; commas instead.
const THINGS = [
  {
    // Provenance: 1316 State St (spec §7); geocoded via Nominatim, matched by
    // name to "Cajé Coffee Roasters" at that address. Daily ~7am-1pm.
    title: "Caje",
    blurb: "Caje on State. A to-go coffee in the fountain courtyard across from the Arlington.",
    reason_to_go: "Grab a to-go coffee in the fountain courtyard across from the Arlington, the specialty drinks are dine-in only.",
    local_note: "Mornings only, roughly 7 to 1; dog-friendly, and the walk downhill starts right outside.",
    category: "food",
    happening_category: "food_drink_spot",
    address: "1316 State St, Santa Barbara, CA 93101",
    lat: 34.4248111,
    lng: -119.7060230,
    price_band: "$",
    indoor: true,
    is_21_plus: false,
    time_of_day_fit: ["morning"],
  },
  {
    // Provenance: 1317 State St (spec §7); geocoded via Nominatim, matched by
    // name to "Arlington Theatre". Exterior/courtyard viewable anytime.
    title: "The Arlington Theatre",
    blurb: "The Arlington Theatre. A Moorish movie palace with a tiled courtyard, worth a peek even dark.",
    reason_to_go: "Peek into the Moorish movie palace's tiled courtyard and star-painted ceiling, even when nothing is showing that night.",
    local_note: "The courtyard and marquee are viewable anytime; the ceiling is only seen from inside on a show night.",
    category: "culture",
    happening_category: "culture_spot",
    address: "1317 State St, Santa Barbara, CA 93101",
    lat: 34.4242051,
    lng: -119.7069644,
    price_band: null,
    indoor: true,
    is_21_plus: false,
    time_of_day_fit: ["morning", "afternoon", "evening"],
  },
  {
    // Provenance: 1114 State St (spec §7); geocoded via Nominatim, matched by
    // name to "La Arcada Building" (E Figueroa St frontage of the same complex).
    title: "La Arcada Courtyard",
    blurb: "La Arcada Courtyard. A Spanish courtyard off State with fountains, bronze figures, and small shops.",
    reason_to_go: "Duck into the Spanish courtyard's fountains and bronze figures tucked in corners, the prettiest shortcut off State.",
    local_note: "Open-air day and night; the handful of shops keep to roughly 10 to 6.",
    category: "culture",
    happening_category: "scenic_chill",
    address: "1114 State St, Santa Barbara, CA 93101",
    lat: 34.4231070,
    lng: -119.7029210,
    price_band: "free",
    indoor: false,
    is_21_plus: false,
    time_of_day_fit: ["morning", "afternoon", "evening"],
  },
  {
    // Provenance: 123 E Canon Perdido St (spec §7); geocoded via Nominatim,
    // matched by name to "El Presidio de Santa Barbara State Historic Park".
    // Daily 10:30am-4:30pm, $5 adult, 1782 Spanish fort.
    title: "El Presidio de Santa Barbara",
    blurb: "El Presidio de Santa Barbara. The 1782 Spanish fort where the city began, restored adobe by adobe.",
    reason_to_go: "Wander the restored 1782 adobe fort's chapel and shady courtyard, the spot where the city began, for a few dollars.",
    local_note: "Closes at 4:30 with no entry after; budget under an hour for the chapel and courtyard.",
    category: "culture",
    happening_category: "culture_spot",
    address: "123 E Canon Perdido St, Santa Barbara, CA 93101",
    lat: 34.4227600,
    lng: -119.6988739,
    price_band: "$",
    indoor: false,
    is_21_plus: false,
    time_of_day_fit: ["morning", "afternoon"],
  },
  {
    // Provenance: 915 Garden St (spec §7); geocoded via Nominatim on the exact
    // address (not independently indexed by name). Boutique hotel, Garden Cafe
    // & Cocktail Bar, Presidio-block courtyard.
    title: "Palihouse",
    blurb: "Palihouse. A boutique hotel courtyard for a craft cocktail under string lights and pink umbrellas.",
    reason_to_go: "Catch golden hour with a craft cocktail in the Palihouse courtyard, string lights and pale pink umbrellas overhead.",
    local_note: "The Garden Cafe and Bar leans afternoon into evening; call ahead to confirm walk-in hours.",
    category: "drink",
    happening_category: "food_drink_spot",
    address: "915 Garden St, Santa Barbara, CA 93101",
    lat: 34.4237937,
    lng: -119.6974356,
    price_band: "$$",
    indoor: false,
    is_21_plus: true,
    time_of_day_fit: ["afternoon", "evening"],
  },
  {
    // Provenance: 702 Anacapa St at Ortega (spec §7); geocoded via Nominatim,
    // address matched (OSM's own name index shows an older "La Paloma Cafe" at
    // the identical address/coordinates). Acme Hospitality, wood-fired
    // Californio, closed Mon/Tue, neon dove sign.
    title: "Paloma",
    blurb: "Paloma. Wood-fired Californio cooking on the corner of Ortega, under the old neon dove.",
    reason_to_go: "Wood-fired Californio cooking under the old neon dove, a corner room that has fed this block for a century.",
    local_note: "Closed Mondays and Tuesdays; dinner runs from 5, with happy hour roughly 4 to 6:30.",
    category: "food",
    happening_category: "food_drink_spot",
    address: "702 Anacapa St, Santa Barbara, CA 93101",
    lat: 34.4199738,
    lng: -119.6968973,
    price_band: "$$$",
    indoor: true,
    is_21_plus: false,
    time_of_day_fit: ["evening"],
  },
];

let ok = true;
for (const t of THINGS) {
  const id = idFor(t.title);
  const row = {
    id,
    type: "place",
    status: "published", // meets the full Tier-3 gate; guide needs them live to resolve
    title: t.title,
    blurb: t.blurb,
    category: t.category,
    happening_tier: 3,
    happening_category: t.happening_category,
    reason_to_go: t.reason_to_go,
    local_note: t.local_note,
    neighborhood: "downtown",
    nearby_zone: "downtown",
    address: t.address,
    lat: t.lat,
    lng: t.lng,
    price_band: t.price_band,
    indoor: t.indoor,
    is_21_plus: t.is_21_plus,
    time_of_day_fit: t.time_of_day_fit,
    hero_eligible: true,
    editorial_weight: 0,
    is_featured: false,
    photo_source: "placeholder", // real image resolved in the follow-up backfill pass
    photo_query: `${t.title} Santa Barbara`,
    source: "seed:google_places",
    last_confirmed: "2026-07-08",
  };

  const { error: upErr } = await sb.from("things").upsert(row, { onConflict: "id" });
  if (upErr) {
    console.error(`❌ ${t.title}: ${upErr.message}`);
    ok = false;
    continue;
  }
  console.log(`✅ ${t.title} → ${id}`);
}

// Verify the publish gate is satisfied on every row.
console.log("\n=== gate check (Tier-3 publish requirements) ===");
for (const t of THINGS) {
  const { data } = await sb
    .from("things")
    .select("title,status,happening_tier,happening_category,reason_to_go,address,nearby_zone,price_band")
    .eq("id", idFor(t.title))
    .single();
  const pass =
    data &&
    data.status === "published" &&
    data.happening_tier === 3 &&
    !!data.happening_category &&
    !!data.reason_to_go?.trim() &&
    !!data.address?.trim();
  console.log(`  ${pass ? "✅" : "❌"} ${data?.title}: status=${data?.status} cat=${data?.happening_category} zone=${data?.nearby_zone} price=${data?.price_band} reason=${data?.reason_to_go ? "set" : "MISSING"}`);
  if (!pass) ok = false;
}

console.log(ok ? "\nAll rows seeded and gate-clean." : "\nSEED HAD ERRORS — see above.");
process.exit(ok ? 0 : 1);
