/* ============================================================================
 * CROWN JEWEL — verbatim copy of lib/reviewServer.ts
 * (SB Daymaker platform snapshot @ caa7302, 2026-07-03. Read-only copy.)
 *
 * ROLE: The cockpit server core -- getAdminUser (auth guard), loadCockpitData 
 * (queue + overlay assembly), revalidatePublic. Backs /admin/review and every 
 * /api/review/* and /api/admin/* route. This is the sponsor-blind admin data 
 * path.
 * ==========================================================================*/

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

// The shared `things` column list — reused by the needs_review queue AND the
// thing_edits overlay embed so both build identical QueueRows.
export const THINGS_SELECT =
  `id, type, title, blurb, blurb_long, happening_category, happening_tier, neighborhood,
   nearby_zone, address, price_band, free, is_21_plus, hero_eligible, starts_at, source,
   photo_url, photo_source, photo_options, last_confirmed,
   thing_tags ( tag ),
   recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`;

type ThingRaw = Record<string, unknown>;

/** Map a raw `things` row to the base QueueRow (no overlay fields). */
function mapThingRow(t: ThingRaw): QueueRow {
  const tier = Number(t.happening_tier);
  const scheds = (t.recurring_schedules as []) ?? [];
  const source = (t.source as string) ?? null;
  const tags = ((t.thing_tags as { tag: string }[]) ?? []).map((x) => x.tag);

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
    blurb: (t.blurb as string) ?? null,
    blurb_long: (t.blurb_long as string) ?? null,
    happening_category: (t.happening_category as string) ?? null,
    happening_tier: tier,
    neighborhood: (t.neighborhood as string) ?? null,
    nearby_zone: (t.nearby_zone as string) ?? null,
    address: (t.address as string) ?? null,
    price_band: (t.price_band as string) ?? null,
    free: (t.free as boolean) ?? null,
    is_21_plus: (t.is_21_plus as boolean) ?? null,
    hero_eligible: (t.hero_eligible as boolean) ?? false,
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
}

/** Pending thing_edits overlays, mapped to QueueRows (live row + payload preview). */
async function loadPendingOverlays(sb: NonNullable<ReturnType<typeof getAdminSupabase>>): Promise<QueueRow[]> {
  const { data, error } = await sb
    .from("thing_edits")
    .select(`id, thing_id, payload, created_at, things ( ${THINGS_SELECT} )`)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return []; // table missing / read failure — no overlays rather than 500

  return (data ?? []).flatMap((e) => {
    // A FK embed returns the single related row; some type paths widen it to an array.
    const liveRaw = e.things as unknown;
    const live = (Array.isArray(liveRaw) ? liveRaw[0] : liveRaw) as ThingRaw | undefined;
    if (!live) return [];
    const base = mapThingRow(live);
    const p = (e.payload as import("./review").EditPayload) ?? {};
    // Merge the pending changes over the live row for the preview.
    const merged: QueueRow = {
      ...base,
      title: p.title ?? base.title,
      blurb: p.blurb !== undefined ? p.blurb : base.blurb,
      blurb_long: p.blurb_long !== undefined ? p.blurb_long : base.blurb_long,
      neighborhood: p.neighborhood !== undefined ? p.neighborhood : base.neighborhood,
      tags: p.tags ?? base.tags,
      overlay_id: e.id as string,
      edit_of: e.thing_id as string,
    };
    return [merged];
  });
}

/** Build { queue, drops, sources } from Supabase (service role). */
export async function loadCockpitData(): Promise<CockpitData> {
  const sb = getAdminSupabase();
  if (!sb) return { queue: [], drops: [], sources: [] };

  const [thingsRes, dropsRes, runsRes, overlays] = await Promise.all([
    sb
      .from("things")
      .select(THINGS_SELECT)
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
    loadPendingOverlays(sb),
  ]);

  // Resilient if a read fails: render an empty/partial cockpit rather than 500.
  if (thingsRes.error) console.error("[cockpit] queue read failed:", thingsRes.error.message);

  const queueRaw = (thingsRes.data ?? []).map((t) => mapThingRow(t as ThingRaw));

  // Founder edits of live things sit at the top of the queue for a second look.
  return {
    queue: [...overlays, ...prioritize(queueRaw)],
    drops: (dropsRes.data ?? []) as DropRow[],
    sources: rollupSources((runsRes.data ?? []) as never),
  };
}

export interface CockpitCounts {
  queue: number;   // things awaiting review
  dropped: number; // rows dropped in the latest run window
  down: number;    // sources whose latest run failed
}

/** Cheap head-count queries for the shell topbar + tab strip (no full-row fetch). */
export async function loadCockpitCounts(): Promise<CockpitCounts> {
  const sb = getAdminSupabase();
  if (!sb) return { queue: 0, dropped: 0, down: 0 };

  const [queueRes, dropRes, runsRes] = await Promise.all([
    sb.from("things").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
    sb.from("ingest_drops").select("id", { count: "exact", head: true }),
    sb.from("source_runs").select("source, landed, fetched, ok, started_at")
      .order("started_at", { ascending: false }).limit(60),
  ]);

  const down = rollupSources((runsRes.data ?? []) as never).filter((s) => s.status === "fail").length;
  return {
    queue: queueRes.count ?? 0,
    dropped: dropRes.count ?? 0,
    down,
  };
}
