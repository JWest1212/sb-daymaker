// lib/reviewServer.ts
//
// Server-only cockpit data access (service-role reads + the auth guard). Kept
// separate from lib/review.ts so the pure formatters stay client-safe.

import "server-only";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "./supabaseServer";
import { getAdminSupabase } from "./supabaseAdmin";
import {
  chipFor, whenString, prioritize, rollupSources,
  isRegistryProposalSource, buildRegistrySnippet,
  type QueueRow, type DropRow, type SourceRow, type PhotoOption,
} from "./review";

/** Refresh the ISR-cached public surfaces after a publish/edit/reject so approved
 *  content appears promptly instead of waiting up to 10 minutes. */
export function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/discover");
  revalidatePath("/saved");
  revalidatePath("/discover/[id]", "page");
  revalidatePath("/thing/[id]", "page");
}

/** The signed-in admin user, or null. Used to gate the page + API routes. */
export async function getAdminUser() {
  const sb = await getServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export interface CockpitData {
  queue: QueueRow[];
  drops: DropRow[];
  sources: SourceRow[];
}

/** Build { queue, drops, sources } from Supabase (service role). */
export async function loadCockpitData(): Promise<CockpitData> {
  const sb = getAdminSupabase();
  if (!sb) return { queue: [], drops: [], sources: [] };

  const [thingsRes, dropsRes, runsRes] = await Promise.all([
    sb
      .from("things")
      .select(
        `id, type, title, blurb, blurb_long, happening_category, happening_tier, neighborhood,
         address, price_band, free, is_21_plus, starts_at, source, photo_url, photo_source,
         photo_options, last_confirmed,
         thing_tags ( tag ),
         recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`,
      )
      .eq("status", "needs_review")
      .order("last_confirmed", { ascending: false }),
    sb
      .from("ingest_drops")
      .select("id, source, title, reason, detail, source_url")
      .order("created_at", { ascending: false })
      .limit(40),
    sb
      .from("source_runs")
      .select("source, landed, fetched, ok, started_at")
      .order("started_at", { ascending: false })
      .limit(40),
  ]);

  // Resilient if the photo_options migration hasn't run yet (or any read fails):
  // render an empty/partial cockpit rather than 500.
  if (thingsRes.error) console.error("[cockpit] queue read failed:", thingsRes.error.message);

  const queueRaw = (thingsRes.data ?? []).map((t) => {
    const tier = Number(t.happening_tier);
    const scheds = (t.recurring_schedules as []) ?? [];
    const source = (t.source as string) ?? null;
    const tags = ((t.thing_tags as { tag: string }[]) ?? []).map((x) => x.tag);

    // §3.5 — detect registry proposals and generate paste-ready snippets
    const isRegistry = isRegistryProposalSource(source) && tier === 2 && scheds.length > 0;
    const registrySnippet = isRegistry
      ? buildRegistrySnippet(
          {
            title: t.title as string,
            address: (t.address as string) ?? null,
            neighborhood: (t.neighborhood as string) ?? null,
            happening_category: (t.happening_category as string) ?? null,
            source,
            tags,
          },
          scheds,
        )
      : undefined;

    return {
      id: t.id as string,
      type: t.type as string,
      title: t.title as string,
      blurb: t.blurb ?? null,
      blurb_long: t.blurb_long ?? null,
      happening_category: t.happening_category ?? null,
      happening_tier: tier,
      neighborhood: t.neighborhood ?? null,
      address: t.address ?? null,
      price_band: t.price_band ?? null,
      free: t.free ?? null,
      is_21_plus: t.is_21_plus ?? null,
      starts_at: (t.starts_at as string) ?? null,
      source,
      photo_url: (t.photo_url as string) ?? null,
      photo_source: (t.photo_source as string) ?? "placeholder",
      photo_options: ((t.photo_options as PhotoOption[]) ?? []),
      tags,
      when: whenString(tier, (t.starts_at as string) ?? null, scheds),
      chip: chipFor(tier, (t.starts_at as string) ?? null),
      ...(registrySnippet ? { registrySnippet } : {}),
    } satisfies QueueRow;
  });

  return {
    queue: prioritize(queueRaw),
    drops: (dropsRes.data ?? []) as DropRow[],
    sources: rollupSources((runsRes.data ?? []) as never),
  };
}
