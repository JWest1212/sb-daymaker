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
  isRegistryProposalSource, buildRegistrySnippet, dropRetiredPhotoOptions,
  type QueueRow, type DropRow, type SourceRow, type PhotoOption, type MergedRow,
} from "./review";
import { sourceKeyOf } from "../ingest/dedupe";
import { confidenceReasons, type SourceMeta, type ThingForConfidence } from "../ingest/confidence";

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
  metrics: ConfidenceMetrics;
  merges: MergedRow[];
}

// The shared `things` column list — reused by the needs_review queue AND the
// thing_edits overlay embed so both build identical QueueRows.
export const THINGS_SELECT =
  `id, type, title, blurb, blurb_long, happening_category, happening_tier, neighborhood,
   nearby_zone, address, price_band, free, is_21_plus, hero_eligible, editorial_weight, starts_at, source,
   photo_url, photo_source, photo_options, last_confirmed, data_confidence, source_count, activities,
   thing_tags ( tag ),
   recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`;

type ThingRaw = Record<string, unknown>;

/** Map a raw `things` row to the base QueueRow (no overlay fields). `sourceByKey`
 *  is optional so this stays usable anywhere a full source lookup isn't handy
 *  (data_confidence/confidence_reasons just come back empty in that case). */
function mapThingRow(t: ThingRaw, sourceByKey: Map<string, SourceMeta> = new Map()): QueueRow {
  const tier = Number(t.happening_tier);
  const scheds = (t.recurring_schedules as {
    day_of_week: number | null; start_time: string | null; end_time: string | null;
    frequency: string | null; label: string | null;
  }[]) ?? [];
  const source = (t.source as string) ?? null;
  const tags = ((t.thing_tags as { tag: string }[]) ?? []).map((x) => x.tag);

  // Data Arch Redesign 24 Phase 4 — the same confidence facts the nightly
  // pipeline scores with, recomputed here for the "why it's here" reasons
  // (only the aggregate data_confidence is persisted, not the breakdown).
  const dataConfidence = t.data_confidence == null ? null : Number(t.data_confidence);
  const confidenceFor: ThingForConfidence = {
    happening_tier: tier,
    starts_at: (t.starts_at as string) ?? null,
    address: (t.address as string) ?? null,
    blurb: (t.blurb as string) ?? null,
    photo_url: (t.photo_url as string) ?? null,
    photo_source: (t.photo_source as string) ?? null,
    nearby_zone: (t.nearby_zone as string) ?? null,
    activities: (t.activities as string[]) ?? null,
    last_confirmed: (t.last_confirmed as string) ?? null,
    source_count: (t.source_count as number) ?? 1,
    scheduleConfirmed: scheds.some((s) => s.day_of_week != null && !!s.start_time),
  };
  const reasons = confidenceReasons(confidenceFor, sourceByKey.get(sourceKeyOf(source ?? undefined)));

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
    editorial_weight: (t.editorial_weight as number) ?? 0,
    starts_at: (t.starts_at as string) ?? null,
    source,
    photo_url: (t.photo_url as string) ?? null,
    photo_source: (t.photo_source as string) ?? "placeholder",
    photo_options: dropRetiredPhotoOptions((t.photo_options as PhotoOption[]) ?? []),
    tags,
    when: whenString(tier, (t.starts_at as string) ?? null, scheds),
    chip: chipFor(tier, (t.starts_at as string) ?? null),
    data_confidence: dataConfidence,
    confidence_reasons: reasons,
    ...(registrySnippet ? { registrySnippet } : {}),
  } satisfies QueueRow;
}

/** Data Arch Redesign 24 Phase 4 — sources.authority/reliability/lane keyed by
 *  sources.key, for the Queue's confidence reasons. Same shape as ingest/run.ts's
 *  loadSourceMetaByKey(), duplicated (not imported) to keep this file's only
 *  ingest/ dependency the pure confidence.ts module. */
async function loadSourceMetaByKey(sb: NonNullable<ReturnType<typeof getAdminSupabase>>): Promise<Map<string, SourceMeta>> {
  const { data, error } = await sb.from("sources").select("key, authority, reliability, lane");
  if (error) return new Map(); // resilient — reasons just come back generic, not a 500
  const byKey = new Map<string, SourceMeta>();
  for (const r of data ?? []) {
    byKey.set(r.key as string, {
      authority: Number(r.authority), reliability: Number(r.reliability), lane: r.lane as string,
    });
  }
  return byKey;
}

/** Pending thing_edits overlays, mapped to QueueRows (live row + payload preview). */
async function loadPendingOverlays(
  sb: NonNullable<ReturnType<typeof getAdminSupabase>>,
  sourceByKey: Map<string, SourceMeta>,
): Promise<QueueRow[]> {
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
    const base = mapThingRow(live, sourceByKey);
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

// Data Arch Redesign 24 Phase 3 shipped 2026-07-16 — audit_log's 'approve'
// action goes back to the cockpit's very first day (627+ rows and counting),
// so an all-time count would permanently swamp autoPublishRatePct toward 0%
// and never reflect what the gate is actually doing. Scope every metric here
// to activity SINCE the gate went live, so "before/after" means something.
const PHASE3_LAUNCH_DATE = "2026-07-16";

export interface ConfidenceMetrics {
  autoPublished: number;      // audit_log action='auto_publish', since Phase 3 launch
  autoHeld: number;           // audit_log action='auto_hold', since Phase 3 launch
  manuallyApproved: number;   // audit_log action='approve', since Phase 3 launch (not all-time)
  autoPublishRatePct: number | null; // autoPublished / (autoPublished + manuallyApproved) * 100; null with no data yet
  queueDepth: number;         // current needs_review count — "time being reclaimed" (Doc 24 §4)
}

/** Data Arch Redesign 24 Phase 4 — "measure the win": how much of your review
 *  time the gate is actually reclaiming, from the audit trail Phase 3 already
 *  writes. No new table — audit_log is the ledger. */
async function loadConfidenceMetrics(sb: NonNullable<ReturnType<typeof getAdminSupabase>>): Promise<ConfidenceMetrics> {
  const since = (q: ReturnType<typeof sb.from>) => q.select("id", { count: "exact", head: true }).gte("created_at", PHASE3_LAUNCH_DATE);
  const [autoPubRes, autoHoldRes, approvedRes, queueRes] = await Promise.all([
    since(sb.from("audit_log")).eq("action", "auto_publish"),
    since(sb.from("audit_log")).eq("action", "auto_hold"),
    since(sb.from("audit_log")).eq("action", "approve"),
    sb.from("things").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
  ]);
  const autoPublished = autoPubRes.count ?? 0;
  const manuallyApproved = approvedRes.count ?? 0;
  const total = autoPublished + manuallyApproved;
  return {
    autoPublished,
    autoHeld: autoHoldRes.count ?? 0,
    manuallyApproved,
    autoPublishRatePct: total > 0 ? Math.round((autoPublished / total) * 100) : null,
    queueDepth: queueRes.count ?? 0,
  };
}

/** Data Arch Redesign 26 Phase 5 — merged/archived rows the founder can
 *  reverse. Two queries (not an embedded resource) so this doesn't depend on
 *  guessing the merged_into foreign-key constraint name: fetch the archived
 *  merged rows, then batch-fetch their survivors' titles by id. */
async function loadMergedRows(sb: NonNullable<ReturnType<typeof getAdminSupabase>>): Promise<MergedRow[]> {
  const { data: merged, error } = await sb
    .from("things")
    .select("id, title, merged_into, event_key, updated_at")
    .not("merged_into", "is", null)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) { console.error("[cockpit] merged-rows read failed:", error.message); return []; }
  if (!merged?.length) return [];

  const survivorIds = [...new Set(merged.map((m) => m.merged_into as string))];
  const { data: survivors } = await sb.from("things").select("id, title").in("id", survivorIds);
  const titleById = new Map((survivors ?? []).map((s) => [s.id as string, s.title as string]));

  return merged.map((m) => ({
    id: m.id as string,
    title: m.title as string,
    survivorId: m.merged_into as string,
    survivorTitle: titleById.get(m.merged_into as string) ?? "(unknown)",
    eventKey: (m.event_key as string) ?? null,
    mergedAt: m.updated_at as string,
  }));
}

/** Build { queue, drops, sources, metrics, merges } from Supabase (service role). */
export async function loadCockpitData(): Promise<CockpitData> {
  const sb = getAdminSupabase();
  const emptyMetrics: ConfidenceMetrics = { autoPublished: 0, autoHeld: 0, manuallyApproved: 0, autoPublishRatePct: null, queueDepth: 0 };
  if (!sb) return { queue: [], drops: [], sources: [], metrics: emptyMetrics, merges: [] };

  // Loaded first (not in the Promise.all below) because both the main queue
  // query and loadPendingOverlays need it to compute confidence reasons.
  const sourceByKey = await loadSourceMetaByKey(sb);

  const [thingsRes, dropsRes, runsRes, overlays, metrics, merges] = await Promise.all([
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
    loadPendingOverlays(sb, sourceByKey),
    loadConfidenceMetrics(sb),
    loadMergedRows(sb),
  ]);

  // Resilient if a read fails: render an empty/partial cockpit rather than 500.
  if (thingsRes.error) console.error("[cockpit] queue read failed:", thingsRes.error.message);

  const queueRaw = (thingsRes.data ?? []).map((t) => mapThingRow(t as ThingRaw, sourceByKey));

  // Founder edits of live things sit at the top of the queue for a second look.
  return {
    queue: [...overlays, ...prioritize(queueRaw)],
    drops: (dropsRes.data ?? []) as DropRow[],
    sources: rollupSources((runsRes.data ?? []) as never),
    metrics,
    merges,
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
