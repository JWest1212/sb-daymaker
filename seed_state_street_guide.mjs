// seed_state_street_guide.mjs — Living Postcard Phase 5, guide 2 of 8 (State Street)
//
// Seeds the State Street guide row + 9 guide_stops. Idempotent: upserts on
// conflict so re-running changes nothing. Looks up thing_ids for the 3
// catalog-backed stops by exact title; the other 6 ship label-only
// (thing_id = NULL) with the authored sub/maps_query fallback (spec §3/§4) —
// Caje, The Arlington Theatre, La Arcada Courtyard, El Presidio de Santa
// Barbara, Palihouse, and Paloma are all MISSes against the current catalog.
//
// guide.status = 'draft' — Jim publishes at stop-and-show approval.
// guide.now_note = null — Jim supplies the July line at stop-and-show.
// Stop 5 (Courthouse) note is seeded verbatim from the mockup; the planted ✵
// wrong detail is Jim's edit to make, not Claude Code's (spec §8.1).
//
// Apply: `node seed_state_street_guide.mjs`

import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import { readFileSync } from "node:fs";

const NS = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const GUIDE_ID = uuidv5("guide|State Street (First-timer)", NS);

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

// ─── Look up thing_ids for the 3 catalog-backed stops (spec §4) ───────────
const CATALOG_TITLES = [
  "Santa Barbara Public Market",
  "The Book Den",
  "Santa Barbara County Courthouse",
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
    console.error(`❌ Missing from catalog: "${title}" — expected a resolved match, re-check §4`);
    process.exit(1);
  }
  console.log(`  ✅ ${title} → ${byTitle[title]}`);
}

// ─── Guide content jsonb (spec §2, house-swept: commas not em dashes) ─────
const CONTENT = {
  meta: { distance_mi: 1.0, plan_hrs: [5, 7] },
  chapters: [
    {
      k: "Stops 1–3 · Upper State",
      name: "The top of the street",
      sum: "Coffee across from the Arlington, a graze at the market, then point downhill.",
      tod: "morning",
    },
    {
      k: "Stops 4–6 · The core",
      name: "A block off State",
      sum: "Lose an hour in the stacks, climb the tower, then cut through the arcade.",
      tod: "afternoon",
    },
    {
      k: "Stops 7–9 · The evening",
      name: "The old fort, a pour, then dinner",
      sum: "The 1782 fort before it closes, a courtyard cocktail at golden hour, then supper under the neon dove.",
      tod: "evening",
    },
  ],
  asides: [
    {
      after_chapter: 1,
      text: "The Courthouse tower is free and rarely has a line before noon. Go up while it's early, the view is the best in town and costs you nothing.",
    },
    {
      after_chapter: 2,
      text: "State Street's real trick is the paseos, the tiled passages cutting between the main drag and the side streets. When the street feels busy, duck into one; you come out somewhere quieter and prettier.",
    },
  ],
  take: {
    h: "Best hour on State Street, ranked.",
    items: [
      { b: "The tower climb", rest: " at the Courthouse: the best free view in town, and you paid nothing for it." },
      { b: "The old Presidio", rest: ": the 1782 adobes and a hushed courtyard, the city at the spot where it began." },
      { b: "A slow browse at the Book Den", rest: ": go in for a minute, lose twenty." },
    ],
    landing: "Three very different hours, all a short walk apart. String them together and you have done State Street right.",
  },
  know_before: [
    {
      k: "Parking",
      v: "Use the city structures off State, not the street meters; the first 75 minutes are free and you are a block from every stop.",
    },
    {
      k: "Budget",
      v: "The headline sights (the tower, the gardens, the Presidio, the arcade) cost little or nothing. Budget for one meal, one round, and whatever the Book Den talks you into.",
    },
    {
      k: "Restrooms",
      v: "Reliable restrooms at the Public Market, the Courthouse, and Paseo Nuevo; plan around those three.",
    },
    {
      k: "Timing",
      v: "This is a Wednesday to Sunday walk (Paloma is closed Mondays and Tuesdays). Start late morning: the Courthouse tower and El Presidio both close by 4:30, so see them while it is light, then the Palihouse courtyard and Paloma's dinner (from 5) carry the evening.",
    },
  ],
  postcard_captions: {
    b1_3: "The top of the street, done.",
    b4_6: "Off State and into the good part.",
    b7_8: "One pour from the finish.",
    b9: "Nine stops. One of them keeps its own time.",
  },
  secret_tease: "Somewhere on this walk, one detail is wrong on purpose.",
  sketch: { kind: "sketch", asset: "state-street", no: 2 },
};

// ─── Guide row ────────────────────────────────────────────────────────────
console.log(`\nUpserting guide row (id: ${GUIDE_ID})…`);
const GUIDE_ROW = {
  id: GUIDE_ID,
  title: "State Street (First-timer)",
  kicker: "State Street and the blocks that reward wandering off it",
  intro:
    "State Street gets the postcards, but its best hours happen a block off it, in the courthouse gardens, the old bookstores, and the tiled arcades. Walk it downhill from the upper theaters to the old Presidio, and let the side streets do the work.",
  kind: "neighborhood",
  zone: "downtown",
  tag: null,
  stamp_code: "DT",
  refreshed_on: "2026-07-01",
  now_note: null,         // Jim supplies the July line at stop-and-show
  now_note_on: null,
  cover_url: null,
  status: "draft",        // published on Jim's approval at stop-and-show
  content: CONTENT,
};

const { error: guideErr } = await sb.from("guides").upsert(GUIDE_ROW, { onConflict: "id" });
if (guideErr) {
  console.error("❌ guide upsert failed:", guideErr.message);
  process.exit(1);
}
console.log("  ✅ guide row upserted");

// ─── guide_stops (9 rows, spec §3) ─────────────────────────────────────────
const STOPS = [
  {
    position: 1, chapter: 1,
    label: "Caje",
    thing_id: null,
    sub: "1316 State St · Coffee · $",
    maps_query: "Caje Coffee 1316 State St Santa Barbara",
    note: "Start with a coffee from Caje, in the fountain courtyard across from the Arlington. Order it to go; the walk runs downhill from here.",
  },
  {
    position: 2, chapter: 1,
    label: "The Arlington Theatre",
    thing_id: null,
    sub: "1317 State St · Historic theater",
    maps_query: "Arlington Theatre 1317 State St Santa Barbara",
    note: "The Moorish movie palace with a tiled courtyard and a ceiling painted like a night sky. Peek in even if nothing is showing.",
  },
  {
    position: 3, chapter: 1,
    label: "Santa Barbara Public Market",
    thing_id: byTitle["Santa Barbara Public Market"],
    sub: null, maps_query: null,
    note: "One roof, many kitchens: Thai, tacos, a wine bar, a bakery. A good place to graze or regroup before you drop into the core.",
  },
  {
    position: 4, chapter: 2,
    label: "The Book Den",
    thing_id: byTitle["The Book Den"],
    sub: null, maps_query: null,
    note: "California's oldest used bookstore, founded in 1902 and tucked just off the plaza on Anapamu across from the library. The stacks reward a slow browse; leave more time than you think.",
  },
  {
    position: 5, chapter: 2,
    label: "Santa Barbara County Courthouse",
    thing_id: byTitle["Santa Barbara County Courthouse"],
    sub: null, maps_query: null,
    note: "Climb the clock tower for the best free view in town, with hand-painted ceilings on the way up and the sunken gardens waiting below.",
  },
  {
    position: 6, chapter: 2,
    label: "La Arcada Courtyard",
    thing_id: null,
    sub: "1114 State St · Courtyard · Free",
    maps_query: "La Arcada 1114 State St Santa Barbara",
    note: "The Spanish courtyard hiding off State: fountains, bronze figures tucked in corners, and a handful of small shops. The prettiest shortcut on the street.",
  },
  {
    position: 7, chapter: 3,
    label: "El Presidio de Santa Barbara",
    thing_id: null,
    sub: "123 E Canon Perdido · Historic park · $",
    maps_query: "El Presidio de Santa Barbara 123 E Canon Perdido St",
    note: "The 1782 Spanish fort where the city began, restored adobe by adobe. Wander the chapel and the shady courtyard, plan on under an hour. It closes at 4:30, so make this the last stop in daylight, then it is a short walk to the evening's first drink.",
  },
  {
    position: 8, chapter: 3,
    label: "Palihouse",
    thing_id: null,
    sub: "915 Garden St · Cocktail bar · $$",
    maps_query: "Palihouse Santa Barbara 915 Garden St",
    note: "A craft cocktail in the Palihouse courtyard, a fountain, pale pink umbrellas, and market lights strung overhead. The prettiest place to catch golden hour, tucked a few steps off the beaten path in the Presidio blocks, and an easy walk on to dinner.",
  },
  {
    position: 9, chapter: 3,
    label: "Paloma",
    thing_id: null,
    sub: "702 Anacapa St · Californio · $$$",
    maps_query: "Paloma 702 Anacapa St Santa Barbara",
    note: "Dinner on the corner of Ortega under the old neon dove, wood-fired Californio cooking in a room that has fed this block for a century. Closed Mondays and Tuesdays; the patio is the seat to want.",
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
