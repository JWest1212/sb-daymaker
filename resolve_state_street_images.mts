// resolve_state_street_images.mts — one-off free-tier image backfill for the 6
// State Street things just added to the catalog. Reuses the real
// ingest/images.ts resolveImages() waterfall (Pexels -> Wikimedia -> Google
// Place Photo, paid step skipped here since these rows have no place_id) so the
// image is resolved the exact same way the nightly pipeline would, just run
// on demand instead of waiting for the next scheduled pass. Targets these 6
// ids directly (unlike ingest/run.ts's IMAGE_BACKFILL mode, which only scans
// status='needs_review' rows) — never touches the `status` column.
//
// Apply: `npx tsx resolve_state_street_images.mts`

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

const { createClient } = await import("@supabase/supabase-js");
const { resolveImages } = await import("./ingest/images");

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

const { data: rows, error } = await sb
  .from("things")
  .select("id, type, title, happening_tier, happening_category, neighborhood, address, price_band, place_id, photo_source")
  .in("title", TITLES);
if (error || !rows) {
  console.error("❌ select failed:", error?.message);
  process.exit(1);
}
console.log(`Resolving images for ${rows.length} things…\n`);

const cands = rows.map((r) => ({
  id: r.id as string,
  type: r.type,
  status: "needs_review" as const, // satisfies the Candidate type only; never written back
  title: r.title as string,
  tier: Number(r.happening_tier),
  happening_category: r.happening_category,
  neighborhood: r.neighborhood ?? undefined,
  address: (r.address as string) ?? "",
  price_band: r.price_band ?? null,
  time_of_day_fit: [],
  starts_at: null,
  ends_at: null,
  source_url: "",
  place_id: (r.place_id as string) ?? undefined,
  last_confirmed: "",
  start_strategy: "none" as const,
}));

const { cands: resolved, stats } = await resolveImages(cands as any, sb, {});
let updated = 0;
for (const c of resolved) {
  if (!c.photo_url && c.photo_source === "placeholder") {
    console.log(`  ⚪ ${c.title}: no free-tier match, left as placeholder`);
    continue;
  }
  const { error: upErr } = await sb
    .from("things")
    .update({ photo_url: c.photo_url ?? null, photo_source: c.photo_source, photo_options: c.photo_options ?? [] })
    .eq("id", c.id);
  if (upErr) {
    console.error(`  ❌ ${c.title}: ${upErr.message}`);
    continue;
  }
  console.log(`  ✅ ${c.title}: ${c.photo_source} (${c.photo_options?.length ?? 0} options)`);
  updated++;
}

console.log(`\nUpdated ${updated}/${rows.length} — free ${stats.free} · google ${stats.google} · placeholder ${stats.placeholder}`);
