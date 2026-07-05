// seed_funk_zone_guide.mjs — Living Postcard Phase 2 (Jim, 2026-07-04)
//
// Seeds the Funk Zone guide row + 9 guide_stops. Idempotent: upserts on
// conflict so re-running changes nothing. Looks up thing_ids for the 5
// catalog-backed stops by exact title; fails clearly if any are missing.
//
// guide.status = 'draft' — Jim publishes at stop-and-show approval.
// guide.now_note = null — Jim supplies the July line at stop-and-show.
//
// Apply: `node seed_funk_zone_guide.mjs`

import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import { readFileSync } from "node:fs";

const NS = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const GUIDE_ID = uuidv5("guide|The Funk Zone", NS);

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

// ─── Look up thing_ids for the 5 catalog-backed stops ─────────────────────
const idFor = (title) => uuidv5(`seed:google_places|${title}`, NS);

const SEEDED_IDS = {
  "Helena Avenue Bakery": idFor("Helena Avenue Bakery"),  // 8e309567…
  "Lucky Penny": idFor("Lucky Penny"),                    // d7b34405…
  "The Lark": idFor("The Lark"),                          // 581f1481…
};

const CATALOG_TITLES = [
  "MOXI, The Wolf Museum of Exploration + Innovation",
  "Pali Wine Co.",
  "Santa Barbara Wine Collective",
  "Topa Topa Brewing Co.",
];

console.log("Looking up catalog thing IDs…");
const { data: catalogThings, error: lookupErr } = await sb
  .from("things")
  .select("id, title")
  .in("title", CATALOG_TITLES);

if (lookupErr || !catalogThings) {
  console.error("❌ Catalog lookup failed:", lookupErr?.message);
  process.exit(1);
}

const byTitle = {};
for (const t of catalogThings) byTitle[t.title] = t.id;
for (const title of CATALOG_TITLES) {
  if (!byTitle[title]) {
    console.error(`❌ Missing from catalog: "${title}" — run seed for base things first`);
    process.exit(1);
  }
  console.log(`  ✅ ${title} → ${byTitle[title]}`);
}

const ALL_IDS = { ...SEEDED_IDS, ...byTitle };

// ─── Guide content jsonb (spec §3, house-swept: commas not em dashes) ──────
const CONTENT = {
  meta: { distance_mi: 1.3, plan_hrs: [3, 5] },
  chapters: [
    {
      k: "Stops 1–3 · Morning",
      name: "Pastry, science, murals",
      sum: "The zone before the crowds, start with the croissant.",
      tod: "morning",
    },
    {
      k: "Stops 4–6 · Afternoon",
      name: "The wine blocks",
      sum: "Two pours and a palate-cleansing pint.",
      tod: "afternoon",
    },
    {
      k: "Stops 7–9 · Golden hour",
      name: "Pizza, dinner, the sand",
      sum: "The zone’s best two hours.",
      tod: "golden",
    },
  ],
  asides: [
    {
      after_chapter: 2,
      text: "Tasting rooms hit capacity around 3 on Saturdays. Want the pourers chatty and the couches open? Come Sunday before noon.",
    },
    {
      after_chapter: 3,
      text: "The train horn isn’t an emergency, it’s the neighborhood’s grandfather clock. Locals set their pours by it.",
    },
  ],
  take: {
    h: "Best bite in the zone, ranked.",
    items: [
      { b: "The clam pie", rest: " at Lucky Penny, order it before you think about it." },
      { b: "The brussels sprouts", rest: " at The Lark, yes, really, the sprouts." },
      { b: "The breakfast sandwich", rest: " at Helena Avenue, gone by 11." },
    ],
    landing: "Disagree? Good. That’s what the walk is for, go build your case.",
  },
  know_before: [
    {
      k: "Parking",
      v: "Park once, on Anacapa above Yanonali, and forget the car exists. The Funk Zone lots are a trap, $3 every half hour adds up faster than the tasting fees.",
    },
    {
      k: "Budget",
      v: "Tastings run $15–25 and most waive it with a bottle. Two flights and a pizza is a ~$70 afternoon; the murals and the sand are free.",
    },
    {
      k: "Restrooms",
      v: "MOXI lobby if you’re a ticket-holder; the public lot on Helena otherwise. Tasting rooms expect you to be a customer.",
    },
    {
      k: "Timing",
      v: "Tasting rooms run roughly noon–6. The zone goes quiet by 9, this is a daytime neighborhood.",
    },
  ],
  postcard_captions: {
    b1_3: "Off and walking.",
    b4_6: "The wine blocks are next.",
    b7_8: "Two from the stamp.",
    b9: "Every stop. Even the wrong-way penny.",
  },
  secret_tease: "Somewhere on this walk, one detail is wrong on purpose.",
  sketch: { kind: "sketch", asset: "funk-zone", no: 1 },
};

// ─── Guide row ────────────────────────────────────────────────────────────
console.log(`\nUpserting guide row (id: ${GUIDE_ID})…`);
const GUIDE_ROW = {
  id: GUIDE_ID,
  title: "The Funk Zone",
  kicker: "Wine, art, and salt air in twelve walkable blocks",
  intro:
    "Six blocks of tasting rooms, murals, and repurposed fish warehouses between the tracks and the sand. The rare tourist district locals never surrendered.",
  kind: "neighborhood",
  zone: "funk",
  tag: null,
  stamp_code: "FZ",
  refreshed_on: "2026-07-01",
  now_note: null,         // Jim supplies the July line at stop-and-show
  now_note_on: null,
  status: "draft",        // published on Jim's approval at stop-and-show
  content: CONTENT,
};

const { error: guideErr } = await sb.from("guides").upsert(GUIDE_ROW, { onConflict: "id" });
if (guideErr) {
  console.error("❌ guide upsert failed:", guideErr.message);
  process.exit(1);
}
console.log("  ✅ guide row upserted");

// ─── guide_stops (9 rows) ─────────────────────────────────────────────────
const STOPS = [
  {
    position: 1, chapter: 1,
    label: "Helena Avenue Bakery",
    thing_id: ALL_IDS["Helena Avenue Bakery"],
    sub: null, maps_query: null,
    note: "Start where the zone starts its day. The breakfast sandwich is the order, it’s gone by 11, which tells you everything about it.",
  },
  {
    position: 2, chapter: 1,
    label: "MOXI",
    thing_id: ALL_IDS["MOXI, The Wolf Museum of Exploration + Innovation"],
    sub: null, maps_query: null,
    note: "Three floors of hands-on science that adults pretend is just for the kids. Go up to the Sky Garden, it’s the best free harbor view in the zone.",
  },
  {
    position: 3, chapter: 1,
    label: "The mural walls",
    thing_id: null,
    sub: "Off Helena & Gray Ave · Free",
    maps_query: "Funk Zone murals Helena Ave Santa Barbara",
    note: "The alleys off Helena are an open-air gallery that repaints itself a few times a year. Free, always open, and the best backdrop in town for a photo.",
  },
  {
    position: 4, chapter: 2,
    label: "Pali Wine Co.",
    thing_id: ALL_IDS["Pali Wine Co."],
    sub: null, maps_query: null,
    note: "Start easy: small-lot Pinot in a relaxed room, no ceremony.",
  },
  {
    position: 5, chapter: 2,
    label: "Santa Barbara Wine Collective",
    thing_id: ALL_IDS["Santa Barbara Wine Collective"],
    sub: null, maps_query: null,
    note: "One roof, many local producers, the efficient way to find your favorite.",
  },
  {
    position: 6, chapter: 2,
    label: "Topa Topa Brewing Co.",
    thing_id: ALL_IDS["Topa Topa Brewing Co."],
    sub: null, maps_query: null,
    note: "The palate-cleansing pint in the airy Waterline space; good for mixed wine/beer groups.",
  },
  {
    position: 7, chapter: 3,
    label: "Lucky Penny",
    thing_id: ALL_IDS["Lucky Penny"],
    sub: null, maps_query: null,
    note: "The penny-clad pizza spot next to The Lark. Order the clam pie before you think about it; the copper wall makes the wait a photo op.",
  },
  {
    position: 8, chapter: 3,
    label: "The Lark",
    thing_id: ALL_IDS["The Lark"],
    sub: null, maps_query: null,
    note: "The zone’s big-night table, communal seating, and yes, order the brussels sprouts. If you get one reservation in the neighborhood, this is it.",
  },
  {
    position: 9, chapter: 3,
    label: "The sand",
    thing_id: null,
    sub: "End of Anacapa · Free",
    maps_query: "East Beach Santa Barbara at Anacapa Street",
    note: "Walk Anacapa to its end and you run out of zone and into beach. No ticket, no pour list, just the payoff. This is where the walk was headed all along.",
  },
];

console.log("\nUpserting guide_stops…");
let ok = true;
for (const stop of STOPS) {
  const row = { guide_id: GUIDE_ID, ...stop };
  const { error: stopErr } = await sb
    .from("guide_stops")
    .upsert(row, { onConflict: "guide_id,position" });
  if (stopErr) {
    console.error(`  ❌ stop ${stop.position} "${stop.label}": ${stopErr.message}`);
    ok = false;
  } else {
    const thingRef = stop.thing_id ? `→ thing ${stop.thing_id.slice(0, 8)}…` : "(label-only)";
    console.log(`  ✅ stop ${stop.position} "${stop.label}" ${thingRef}`);
  }
}

// ─── Verify ────────────────────────────────────────────────────────────────
console.log("\n=== verification ===");
const { data: verified } = await sb
  .from("guides")
  .select("id, title, status, stamp_code, refreshed_on, now_note")
  .eq("id", GUIDE_ID)
  .single();
console.log(`guide: ${verified?.title} · status=${verified?.status} · stamp=${verified?.stamp_code} · refreshed=${verified?.refreshed_on}`);

const { count } = await sb
  .from("guide_stops")
  .select("id", { count: "exact", head: true })
  .eq("guide_id", GUIDE_ID);
console.log(`stops: ${count} rows`);

console.log(`\n🔗 Navigate to: /discover/${GUIDE_ID}`);
console.log(ok ? "\nAll seeded." : "\nSEED HAD ERRORS — see above.");
process.exit(ok ? 0 : 1);
