// seed_funk_zone_things.mjs — Living Postcard Phase 2 prerequisite (Jim, 2026-07-04)
//
// Adds the three Funk Zone walk venues that were missing from the catalog so the
// guide stops can resolve thing-backed (Helena Avenue Bakery, Lucky Penny, The
// Lark). Facts are enriched from public sources (addresses, coordinates, hours),
// NEVER invented — see the per-venue provenance comments. Rows mirror the exact
// shape of the existing published Funk Zone things (MOXI / Pali / Topa Topa):
// Tier-3 evergreen `place`, happening_category 'food_drink_spot', neighborhood
// 'funk_zone', nearby_zone 'funk', with reason_to_go set (the Tier-3 publish gate).
//
// Idempotent: deterministic uuidv5 ids on the gate's 'seed:google_places|<title>'
// key (ingest/gate.ts idFor), upserted on id; tags are replaced (delete+insert).
// Re-running changes nothing. Apply: `node seed_funk_zone_things.mjs`
// (tsx can't execute in the sandbox — the repo's .mjs service-role pattern).

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

// House copy style (Jim, 2026-07-04): no em dashes; commas instead.
const THINGS = [
  {
    // Provenance: 131 Anacapa St Ste C (enter off Helena Ave), historic Fish
    // Market building; open daily 7am–2:30pm. Coords 34°24'51.89"N 119°41'26.62"W.
    title: "Helena Avenue Bakery",
    blurb: "A homestyle artisan bakery and kitchen in the historic Fish Market building.",
    reason_to_go:
      "Rustic breads, from-scratch pastries, and made-to-order breakfast and lunch, open daily from 7am.",
    local_note:
      "Enter off Helena Avenue (Suite C); the good pastries sell out well before the 2:30pm close.",
    address: "131 Anacapa St, Santa Barbara, CA 93101",
    lat: 34.4144132,
    lng: -119.6907278,
    price_band: "$$",
    time_of_day_fit: ["morning", "afternoon"],
    tags: ["wine_food"],
  },
  {
    // Provenance: 127 Anacapa St, Funk Zone; take-away café, wood-fired pizza,
    // salads, frosé; exterior tiled with 150,000+ copper pennies; est. 2013.
    // Same Fish Market parcel, immediately beside The Lark.
    title: "Lucky Penny",
    blurb: "A copper-penny-clad café for wood-fired pizza, salads, and frosé.",
    reason_to_go:
      "Grab a wood-fired pizza and a frosé beneath an exterior tiled with 150,000 pennies.",
    local_note:
      "On the grounds of the historic Santa Barbara Fish Market, right next to The Lark.",
    address: "127 Anacapa St, Santa Barbara, CA 93101",
    lat: 34.41454,
    lng: -119.69056,
    price_band: "$$",
    time_of_day_fit: ["afternoon", "evening"],
    tags: ["wine_food"],
  },
  {
    // Provenance: 131 Anacapa St Ste A, corner of Anacapa & Yanonali, historic
    // Fish Market building; New American, communal seating. Coords via Apple Maps
    // 34.4145882, -119.6904928. Named for the Southern Pacific "Lark" Pullman train.
    title: "The Lark",
    blurb: "A New American restaurant with communal tables in the historic Fish Market building.",
    reason_to_go:
      "Share seasonal Central Coast plates at communal tables, the neighborhood's marquee dinner.",
    local_note:
      "Suite A, on the Anacapa corner; named for the Southern Pacific's overnight Pullman train, book ahead for weekend tables.",
    address: "131 Anacapa St, Santa Barbara, CA 93101",
    lat: 34.4145882,
    lng: -119.6904928,
    price_band: "$$$",
    time_of_day_fit: ["evening"],
    tags: ["wine_food", "date_night"],
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
    category: "food",
    happening_tier: 3,
    happening_category: "food_drink_spot",
    reason_to_go: t.reason_to_go,
    local_note: t.local_note,
    neighborhood: "funk_zone",
    nearby_zone: "funk",
    address: t.address,
    lat: t.lat,
    lng: t.lng,
    price_band: t.price_band,
    indoor: true,
    is_21_plus: false,
    time_of_day_fit: t.time_of_day_fit,
    hero_eligible: true,
    editorial_weight: 0,
    is_featured: false,
    photo_source: "placeholder", // real image comes from the nightly resolver
    photo_query: `${t.title} Santa Barbara Funk Zone`,
    source: "seed:google_places",
    last_confirmed: "2026-07-04",
  };

  const { error: upErr } = await sb.from("things").upsert(row, { onConflict: "id" });
  if (upErr) {
    console.error(`❌ ${t.title}: ${upErr.message}`);
    ok = false;
    continue;
  }
  await sb.from("thing_tags").delete().eq("thing_id", id);
  const { error: tagErr } = await sb.from("thing_tags").insert(
    t.tags.map((tag) => ({ thing_id: id, tag, confidence: 1.0, tag_source: "founder" })),
  );
  if (tagErr) {
    console.error(`❌ ${t.title} tags: ${tagErr.message}`);
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
