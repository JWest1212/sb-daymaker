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
import { makeSlug, disambiguate, shortHash } from "../../lib/slug/makeSlug";
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
  // R1 W6.7. Archived rows too, for two reasons. They stay READABLE (W1.1/W2.2:
  // a saved or shared link to something that already happened must still
  // resolve), so they need a slug of their own. And their slugs must be in the
  // taken-set, or a new row could be handed a slug an archived page is already
  // serving, and one of the two URLs would resolve to the wrong thing.
  const rows = await allRows(sb, table);

  // R1 W6.7. Seed the taken-set from EVERY row in the table, whatever its
  // status, not just the ones being slugged. `things_slug_uidx` is a table-wide
  // unique index: a draft, a rejected row or a merged duplicate can be holding
  // "sunset-sail", and assigning it again fails the insert. Selecting only the
  // public statuses is what made this backfill die partway through.
  const taken = await allTakenSlugs(sb, table);

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
      // R1 W6.7. One row losing a race for a slug must not abandon the other
      // four hundred. It keeps its UUID URL, which still resolves, and the next
      // sweep tries again.
      if (upErr) {
        console.warn(`  [slug] ${table} ${r.id} kept its uuid: ${upErr.message}`);
        idToSlug.delete(r.id);
        assigned--;
      }
    }
  }
  return { idToSlug, assigned };
}

/**
 * R1 W6.7 (DET-007). Drop a disambiguating hash that is no longer earning its
 * place.
 *
 * "baby-and-me-808c" is what a collision looks like: two rows wanted
 * "baby-and-me", so the second got its id's first four hex characters. When the
 * other row is later archived, merged away or retitled, the bare slug comes free
 * and the hash is just noise in a URL a person is meant to read and trust.
 *
 * Only ever shortens, never renames on any other grounds, and only when the bare
 * base is claimed by nobody. The old slug gets a redirect row, so a link someone
 * already has (or a browser's cached 301 from the UUID era) still arrives.
 * Deterministic by id, so two rows that both want the same freed base resolve
 * the same way on every run.
 */
export function planShortenings(
  rows: { id: string; title: string; slug: string | null }[],
  /** Every slug in the table, whatever the row's status: the unique index is
   *  table-wide, so a base held by a draft row is not free. Defaults to the
   *  given rows' own slugs, which is what the tests exercise. */
  allTaken?: Iterable<string>,
): { id: string; from: string; to: string }[] {
  const taken = new Set<string>(allTaken ?? []);
  for (const r of rows) if (r.slug) taken.add(r.slug);

  const out: { id: string; from: string; to: string }[] = [];
  for (const r of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!r.slug) continue;
    const base = makeSlug(r.title);
    // Only the exact shape this generator produces. A slug that merely happens
    // to end in four hex-ish characters is left alone.
    if (r.slug !== `${base}-${shortHash(r.id)}`) continue;
    if (taken.has(base)) continue;
    taken.delete(r.slug);
    taken.add(base);
    out.push({ id: r.id, from: r.slug, to: base });
  }
  return out;
}

/**
 * R1 W6.7. Every row this sweep may slug, paged.
 *
 * Same 1,000-row ceiling as the taken-set below. Unpaged, this select simply
 * stopped at a thousand rows and the sweep reported success while leaving the
 * rest of the catalog without slugs, which is why UUID URLs kept turning up in
 * the feed long after the backfill had "run".
 */
async function allRows(sb: SupabaseClient, table: "things" | "guides"): Promise<SlugRow[]> {
  const PAGE = 1000;
  const statuses = table === "things" ? ["published", "archived"] : ["published"];
  const out: SlugRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select("id, title, slug")
      .in("status", statuses)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} slug select: ${error.message}`);
    const rows = (data ?? []) as unknown as SlugRow[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/**
 * R1 W6.7. Every slug in one table, paged.
 *
 * A single select would stop at PostgREST's 1,000-row ceiling (CLAUDE.md), and
 * this table is past that. A short taken-set is worse than useless here: it
 * reports slugs as free that are not, and the assignment then fails against the
 * table-wide unique index, one row at a time, for the rest of the run.
 */
async function allTakenSlugs(sb: SupabaseClient, table: "things" | "guides"): Promise<Set<string>> {
  const PAGE = 1000;
  const taken = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select("slug")
      .not("slug", "is", null)
      .order("slug", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} taken-slug select: ${error.message}`);
    const rows = (data ?? []) as { slug: string }[];
    for (const r of rows) taken.add(r.slug);
    if (rows.length < PAGE) return taken;
  }
}

/** Upsert a batch of redirect rows (idempotent on from_path). */
async function upsertRedirects(
  sb: SupabaseClient,
  rows: { from_path: string; to_path: string }[],
  dry: boolean,
): Promise<number> {
  // R1 W6.7. One row per from_path, last write winning. Postgres refuses an
  // ON CONFLICT batch that touches the same key twice ("cannot affect row a
  // second time"), and a shortened slug legitimately rewrites a from_path the
  // canonical pass already queued.
  const byFrom = new Map<string, { from_path: string; to_path: string }>();
  for (const r of rows) if (r.from_path !== r.to_path) byFrom.set(r.from_path, r);
  const clean = [...byFrom.values()];
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
  /** R1 W6.7 (DET-007). Slugs whose no-longer-needed hash was dropped. */
  shortened: number;
}

/** Apply planShortenings to one table. Returns what it changed (or would). */
async function shortenSlugs(
  sb: SupabaseClient,
  table: "things" | "guides",
  dry: boolean,
): Promise<{ id: string; from: string; to: string }[]> {
  const plan = planShortenings(await allRows(sb, table), await allTakenSlugs(sb, table));
  if (dry) return plan;
  const done: { id: string; from: string; to: string }[] = [];
  for (const p of plan) {
    const { error: upErr } = await sb.from(table).update({ slug: p.to }).eq("id", p.id);
    if (upErr) continue; // self-heals next run; the hashed slug still works
    done.push(p);
  }
  return done;
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

  // R1 W6.7 (DET-007). Shorten any slug whose hash is no longer needed, and
  // leave a redirect behind so the old URL never breaks.
  const shortenedThings = await shortenSlugs(sb, "things", dry);
  const shortenedGuides = await shortenSlugs(sb, "guides", dry);
  for (const [prefix, list] of [["/thing", shortenedThings], ["/discover", shortenedGuides]] as const) {
    for (const sh of list) {
      redirectRows.push({ from_path: `${prefix}/${sh.from}`, to_path: `${prefix}/${sh.to}` });
      // The UUID path now points at the shortened slug, not the hashed one.
      const idx = redirectRows.findIndex((r) => r.from_path === `${prefix}/${sh.id}`);
      if (idx >= 0) redirectRows[idx] = { from_path: `${prefix}/${sh.id}`, to_path: `${prefix}/${sh.to}` };
    }
  }

  const redirects = await upsertRedirects(sb, [...redirectRows, ...dupeRows], dry);
  return {
    things: things.assigned,
    guides: guides.assigned,
    redirects,
    dupeRedirects,
    shortened: shortenedThings.length + shortenedGuides.length,
  };
}

async function main() {
  const dry = process.env.DRY_RUN === "1";
  const sb = getDb();
  const r = await ensureSlugs(sb, { dry });
  console.log(`\n[slug-backfill] ${dry ? "DRY RUN (no writes) · " : ""}slugs assigned:`);
  console.log(`  things:  ${r.things} newly slugged`);
  console.log(`  guides:  ${r.guides} newly slugged`);
  console.log(`  redirects upserted: ${r.redirects} (incl. ${r.dupeRedirects} merged-dupe -> survivor)`);
  console.log(`  hashes dropped:     ${r.shortened} (R1 W6.7, DET-007)`);
  console.log("");
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
