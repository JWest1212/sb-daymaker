// scripts/seed_venue_neighborhoods.mts
//
// Doc 19 §5.1, one-time (repeatable) auto-seed of the `venue_neighborhoods`
// dictionary from the ~21 venue-direct adapter sources already known to the
// pipeline. Idempotent: upserts on name_norm, so re-running just refreshes
// aliases/neighborhood rather than duplicating rows.
//
//   node --env-file=.env.local --import tsx scripts/seed_venue_neighborhoods.mts

import { createClient } from "@supabase/supabase-js";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// name -> [neighborhood, aliases[]]. Names match the VENUE_NAME / venueName
// literals in their respective ingest/adapters/*.ts files where one exists;
// Stearns Wharf has no dedicated adapter (evergreen content) and uses Doc 19's
// literal starter-set name.
const STARTER_SET: { name: string; neighborhood: string; aliases?: string[] }[] = [
  { name: "SOhO Restaurant & Music Club", neighborhood: "downtown", aliases: ["SOhO"] },
  { name: "The Granada Theatre", neighborhood: "downtown", aliases: ["Granada Theatre", "Granada"] },
  { name: "Lobero Theatre", neighborhood: "downtown", aliases: ["Lobero"] },
  { name: "Arlington Theatre", neighborhood: "downtown" },
  { name: "Center Stage Theater", neighborhood: "downtown", aliases: ["Center Stage"] },
  { name: "New Vic Theatre", neighborhood: "downtown", aliases: ["Ensemble Theatre Company", "ETC", "New Vic"] },
  { name: "Santa Barbara Museum of Art", neighborhood: "downtown", aliases: ["SBMA", "SB Museum of Art"] },
  { name: "Dargan's Irish Pub", neighborhood: "downtown", aliases: ["Dargan's"] },
  { name: "Downtown Santa Barbara (State Street)", neighborhood: "downtown", aliases: ["Downtown SB"] },
  { name: "MOXI, The Wolf Museum of Exploration + Innovation", neighborhood: "funk_zone", aliases: ["MOXI"] },
  { name: "Figueroa Mountain Brewing Co. (Funk Zone)", neighborhood: "funk_zone", aliases: ["Figueroa Mountain Brewing", "Fig Mountain Brewing"] },
  { name: "Santa Barbara Museum of Natural History", neighborhood: "mission_canyon", aliases: ["SB Museum of Natural History", "Natural History Museum"] },
  { name: "Santa Barbara Botanic Garden", neighborhood: "mission_canyon", aliases: ["SB Botanic Garden"] },
  { name: "Santa Barbara Bowl", neighborhood: "riviera", aliases: ["SB Bowl"] },
  { name: "Music Academy of the West", neighborhood: "montecito", aliases: ["Music Academy"] },
  { name: "The Alcazar Theater", neighborhood: "carpinteria", aliases: ["Alcazar Theatre"] },
  { name: "Carpinteria Arts Center", neighborhood: "carpinteria" },
  { name: "Stearns Wharf", neighborhood: "waterfront" },
  { name: "Condor Express", neighborhood: "waterfront" },
  { name: "UCSB", neighborhood: "goleta", aliases: ["UCSB Campus Events", "University of California Santa Barbara"] },
  { name: "Ice in Paradise (Las Positas Sports Complex)", neighborhood: "goleta", aliases: ["Ice in Paradise"] },
];

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

const rows = STARTER_SET.map((v) => ({
  name: v.name,
  name_norm: normalize(v.name),
  neighborhood: v.neighborhood,
  aliases: v.aliases ?? [],
  created_by: "founder",
}));

const { data, error } = await sb
  .from("venue_neighborhoods")
  .upsert(rows, { onConflict: "name_norm" })
  .select("name, neighborhood");
if (error) throw new Error(error.message);

console.log(`Seeded ${data?.length ?? 0} venues:`);
for (const r of data ?? []) console.log(`  ${(r.name as string).padEnd(50)} -> ${r.neighborhood}`);
