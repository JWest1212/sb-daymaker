// lib/slug/ensureSlug.ts  (Elevation v1 · Gate 2 · G2.1)
//
// Assign slugs to specific just-published things at publish time, so a row
// published by hand in the cockpit gets its canonical URL + redirect immediately,
// not only on the next nightly run. Client-agnostic (takes the Supabase client),
// so both the cockpit approve route (service-role) and any server path can use it.
// The nightly ingest/slugs/backfill.ts still sweeps the whole catalog as a
// belt-and-suspenders; this closes the between-runs gap.

import type { SupabaseClient } from "@supabase/supabase-js";
import { makeSlug, disambiguate } from "./makeSlug";

interface Row {
  id: string;
  title: string;
  slug: string | null;
  status: string;
}

/** Ensure each given thing id that is published-and-slugless gets a unique slug +
 *  a /thing/<uuid> -> /thing/<slug> redirect row. Idempotent; returns how many
 *  were newly slugged. Never throws on a slug write failure (publishing already
 *  succeeded; a missing slug self-heals on the nightly sweep). */
export async function ensureSlugsForThings(sb: SupabaseClient, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { data } = await sb.from("things").select("id, title, slug, status").in("id", ids);
  const needing = ((data ?? []) as unknown as Row[]).filter((r) => r.status === "published" && !r.slug);
  if (!needing.length) return 0;

  // Load existing slugs once for collision safety.
  const { data: existing } = await sb.from("things").select("slug").not("slug", "is", null);
  const taken = new Set(((existing ?? []) as { slug: string }[]).map((r) => r.slug));

  const redirects: { from_path: string; to_path: string }[] = [];
  let n = 0;
  for (const r of [...needing].sort((a, b) => a.id.localeCompare(b.id))) {
    const slug = disambiguate(makeSlug(r.title), r.id, taken);
    taken.add(slug);
    const { error } = await sb.from("things").update({ slug }).eq("id", r.id);
    if (error) continue; // self-heals on the nightly sweep
    redirects.push({ from_path: `/thing/${r.id}`, to_path: `/thing/${slug}` });
    n++;
  }
  if (redirects.length) {
    await sb.from("url_redirects").upsert(redirects, { onConflict: "from_path" });
  }
  return n;
}
