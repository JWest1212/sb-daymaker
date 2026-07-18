// ingest/slugs/backfill.ts  (Elevation v1 · Gate 2 · G2.1/G2.2)
//
// Assigns stable slugs to every published thing + guide and writes the
// url_redirects map so old /thing/<uuid> and /discover/<uuid> links 301 to the
// new slug URL, and Gate 0's archived duplicates redirect to their survivor's
// slug. DATA operation (not DDL): the slug columns + url_redirects table already
// exist; this fills them.
//
// `ensureSlugs()` is the shared engine, called BOTH here (one-off/on-demand) and
// by the nightly worker so a newly published row never stays slug-less. Idempotent:
// existing slugs are preserved, redirects are upserted, a re-run writes nothing new.
//
// Run:  node --env-file=.env.local --import tsx ingest/slugs/backfill.ts
//       DRY_RUN=1 ...  (report what it would assign, write nothing)

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "../db";
import { makeSlug, disambiguate } from "../../lib/slug/makeSlug";
import { isMain } from "../audits/_util";

interface SlugRow {
  id: string;
  title: string;
  slug: string | null;
}

/** Assign slugs to all rows of one table that lack one, preserving existing
 *  slugs. Returns the full id->slug map (existing + newly assigned) and the count
 *  written. Pure-ish: only writes the rows it newly slugs. */
async function slugTable(
  sb: SupabaseClient,
  table: "things" | "guides",
  dry: boolean,
): Promise<{ idToSlug: Map<string, string>; assigned: number }> {
  const { data, error } = await sb
    .from(table)
    .select("id, title, slug")
    .eq("status", "published");
  if (error) throw new Error(`${table} slug select: ${error.message}`);
  const rows = (data ?? []) as unknown as SlugRow[];

  // Seed the taken-set with existing slugs so we never collide with a live URL.
  const taken = new Set<string>();
  for (const r of rows) if (r.slug) taken.add(r.slug);

  const idToSlug = new Map<string, string>();
  let assigned = 0;
  // Stable order (by id) so disambiguation is deterministic across runs.
  for (const r of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    if (r.slug) {
      idToSlug.set(r.id, r.slug);
      continue;
    }
    const slug = disambiguate(makeSlug(r.title), r.id, taken);
    taken.add(slug);
    idToSlug.set(r.id, slug);
    assigned++;
    if (!dry) {
      const { error: upErr } = await sb.from(table).update({ slug }).eq("id", r.id);
      if (upErr) throw new Error(`${table} slug update ${r.id}: ${upErr.message}`);
    }
  }
  return { idToSlug, assigned };
}

/** Upsert a batch of redirect rows (idempotent on from_path). */
async function upsertRedirects(
  sb: SupabaseClient,
  rows: { from_path: string; to_path: string }[],
  dry: boolean,
): Promise<number> {
  const clean = rows.filter((r) => r.from_path !== r.to_path);
  if (dry || clean.length === 0) return clean.length;
  const { error } = await sb.from("url_redirects").upsert(clean, { onConflict: "from_path" });
  if (error) throw new Error(`url_redirects upsert: ${error.message}`);
  return clean.length;
}

export interface SlugResult {
  things: number;
  guides: number;
  redirects: number;
  dupeRedirects: number;
}

export async function ensureSlugs(sb: SupabaseClient, opts: { dry?: boolean } = {}): Promise<SlugResult> {
  const dry = !!opts.dry;
  const things = await slugTable(sb, "things", dry);
  const guides = await slugTable(sb, "guides", dry);

  // Canonical redirects: every old UUID path -> its slug path.
  const redirectRows: { from_path: string; to_path: string }[] = [];
  for (const [id, slug] of things.idToSlug) redirectRows.push({ from_path: `/thing/${id}`, to_path: `/thing/${slug}` });
  for (const [id, slug] of guides.idToSlug) redirectRows.push({ from_path: `/discover/${id}`, to_path: `/discover/${slug}` });

  // Gate 0 archived duplicates: their UUID path -> the survivor's slug path.
  let dupeRedirects = 0;
  const { data: dupes, error: dErr } = await sb
    .from("things")
    .select("id, merged_into")
    .eq("status", "archived")
    .not("merged_into", "is", null);
  if (dErr) throw new Error(`archived dupes select: ${dErr.message}`);
  const dupeRows: { from_path: string; to_path: string }[] = [];
  for (const d of (dupes ?? []) as { id: string; merged_into: string }[]) {
    const survivorSlug = things.idToSlug.get(d.merged_into);
    if (survivorSlug) {
      dupeRows.push({ from_path: `/thing/${d.id}`, to_path: `/thing/${survivorSlug}` });
      dupeRedirects++;
    }
  }

  const redirects = await upsertRedirects(sb, [...redirectRows, ...dupeRows], dry);
  return { things: things.assigned, guides: guides.assigned, redirects, dupeRedirects };
}

async function main() {
  const dry = process.env.DRY_RUN === "1";
  const sb = getDb();
  const r = await ensureSlugs(sb, { dry });
  console.log(`\n[slug-backfill] ${dry ? "DRY RUN (no writes) · " : ""}slugs assigned:`);
  console.log(`  things:  ${r.things} newly slugged`);
  console.log(`  guides:  ${r.guides} newly slugged`);
  console.log(`  redirects upserted: ${r.redirects} (incl. ${r.dupeRedirects} merged-dupe -> survivor)`);
  console.log("");
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
