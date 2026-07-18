// lib/neighborhoodSweepServer.ts
//
// Doc 19 §6 Phase 2, server-only dry-run sweep. One query over published
// things, one for the venue_neighborhoods dictionary, resolved in-process via
// the pure resolveNeighborhood waterfall (ingest/adapters/_shared). No AI, no
// per-request calls, no paid geocoding. Same convention as lib/coverageServer.ts.
//
// `dry` names the eventual apply/dry-run switch (Doc 19 Phase 4 adds the write
// path); this phase only ever reads and computes, it writes nothing regardless
// of the flag, mirroring the existing DRY_RUN posture (ingest/run.ts).

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import {
  resolveNeighborhood, autoWrites,
  type VenueDictEntry, type ResolveMethod, type ResolvableThing,
} from "../ingest/adapters/_shared/resolveNeighborhood";
import { DOOR_ZONES, DOOR_ZONE_BY_KEY, doorZoneForNeighborhood, canonicalNeighborhoodForZone, type DoorZoneKey } from "./doorZones";
import { deriveNearbyZone } from "./geo";
import { extractVenueNameFromAddress } from "./venuePool";
import type { SweepSummary, SweepMethodCount, SweepZoneCount, SweepTriageItem, DictionaryEntry } from "./neighborhoodSweep";

// extractVenueNameFromAddress's "first comma segment that isn't digit-led" rule
// (built for venue-prefixed addresses like "SOhO, 1221 State St...") false-
// positives on a bare street address with no venue prefix at all, e.g. "East
// Beach" (address "E Cabrillo Blvd, Santa Barbara, CA") extracts "E Cabrillo
// Blvd" as if it were the venue. Filter those out before offering the guess as
// a dictionary-add candidate: a short, street-suffixed segment is a street, not
// a venue name.
const STREET_SUFFIX = /\b(st|street|ave|avenue|blvd|rd|road|dr|drive|way|ln|lane|ct|court|pl|place|hwy|highway)\.?$/i;
function plausibleVenueName(guess: string | null): string | null {
  if (!guess) return null;
  if (guess.split(/\s+/).length <= 4 && STREET_SUFFIX.test(guess)) return null;
  return guess;
}

interface ThingRow {
  id: string;
  title: string;
  address: string | null;
  place_id: string | null;
  source: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
}

const METHOD_ORDER: ResolveMethod[] =
  ['place_id', 'venue_name', 'source', 'point_in_polygon', 'street', 'existing', 'unresolved'];

function emptySummary(generatedAt: string): SweepSummary {
  return { total: 0, resolved: 0, unresolved: 0, autoResolveRate: 0, byMethod: [], byZone: [], triage: [], generatedAt };
}

export async function runNeighborhoodSweep(opts: { dry: boolean } = { dry: true }): Promise<SweepSummary> {
  void opts; // Phase 2 is read-only regardless; Phase 4 wires the write path through this flag.
  const generatedAt = new Date().toISOString();
  const sb = getAdminSupabase();
  if (!sb) return emptySummary(generatedAt);

  const [{ data: thingRows, error: tErr }, { data: dictRows, error: dErr }] = await Promise.all([
    sb.from("things").select("id, title, address, place_id, source, lat, lng, neighborhood").eq("status", "published"),
    sb.from("venue_neighborhoods").select("name, name_norm, neighborhood, place_id, aliases"),
  ]);
  if (tErr) { console.error("[neighborhoodSweep] things read failed:", tErr.message); return emptySummary(generatedAt); }
  if (dErr) { console.error("[neighborhoodSweep] dictionary read failed:", dErr.message); return emptySummary(generatedAt); }

  const things = (thingRows ?? []) as unknown as ThingRow[];
  const dictionary = (dictRows ?? []) as unknown as VenueDictEntry[];

  const methodCounts: Record<ResolveMethod, number> =
    { place_id: 0, venue_name: 0, source: 0, point_in_polygon: 0, street: 0, existing: 0, unresolved: 0 };
  const zoneCounts = new Map<string, number>();
  const triage: SweepTriageItem[] = [];
  let resolved = 0;

  for (const t of things) {
    const input: ResolvableThing = {
      title: t.title, address: t.address, place_id: t.place_id, source_url: t.source,
      lat: t.lat, lng: t.lng, neighborhood: t.neighborhood as ResolvableThing["neighborhood"],
    };
    const result = resolveNeighborhood(input, dictionary);
    methodCounts[result.method]++;

    if (autoWrites(result)) {
      resolved++;
      const zoneKey = doorZoneForNeighborhood(result.neighborhood);
      if (zoneKey) zoneCounts.set(zoneKey, (zoneCounts.get(zoneKey) ?? 0) + 1);
    } else {
      triage.push({
        id: t.id, title: t.title, address: t.address, source: t.source,
        suggestedZone: doorZoneForNeighborhood(result.neighborhood),
        suggestedNeighborhood: result.neighborhood,
        confidence: result.confidence, method: result.method,
        venueNameGuess: t.address ? plausibleVenueName(extractVenueNameFromAddress(t.address)) : null,
      });
    }
  }

  const byMethod: SweepMethodCount[] = METHOD_ORDER.map((method) => ({ method, count: methodCounts[method] }));
  const byZone: SweepZoneCount[] = DOOR_ZONES.map((z) => ({ key: z.key, label: z.label, count: zoneCounts.get(z.key) ?? 0 }));

  return {
    total: things.length,
    resolved,
    unresolved: things.length - resolved,
    autoResolveRate: things.length ? resolved / things.length : 0,
    byMethod,
    byZone,
    triage,
    generatedAt,
  };
}

interface VenueDictRow {
  name: string;
  neighborhood: string;
  aliases: string[] | null;
  created_by: string;
}

/** Doc 19 §6 Phase 3, the dictionary table's data, sorted by zone then name. */
export async function loadVenueDictionary(): Promise<DictionaryEntry[]> {
  const sb = getAdminSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("venue_neighborhoods")
    .select("name, neighborhood, aliases, created_by")
    .order("neighborhood")
    .order("name");
  if (error) { console.error("[neighborhoodSweep] dictionary read failed:", error.message); return []; }

  return (data ?? []).map((r: VenueDictRow) => {
    const zoneKey = doorZoneForNeighborhood(r.neighborhood);
    return {
      name: r.name,
      neighborhood: r.neighborhood,
      zoneKey,
      zoneLabel: zoneKey ? DOOR_ZONE_BY_KEY[zoneKey].label : "·",
      aliases: r.aliases ?? [],
      createdBy: r.created_by,
    };
  });
}

export interface ApplyResult {
  updated: number;
  remaining: number; // still needs triage after this run (unaffected by apply)
}

/** Doc 19 §6 Phase 4, writes every autoWrites()-eligible, actually-new match
 *  (methods place_id/venue_name/source/point_in_polygon; 'existing' is already
 *  correct and needs no write) to things.neighborhood. Also keeps `nearby_zone`
 *  in sync via deriveNearbyZone, the same LC-6 pattern the catalog edit route
 *  uses (app/api/admin/catalog/edit/route.ts), because the live Place/Near-Me
 *  door reads `nearby_zone`, not `neighborhood` directly. */
export async function applyResolvedNeighborhoods(): Promise<ApplyResult> {
  const sb = getAdminSupabase();
  if (!sb) return { updated: 0, remaining: 0 };

  const [{ data: thingRows, error: tErr }, { data: dictRows, error: dErr }] = await Promise.all([
    sb.from("things").select("id, title, address, place_id, source, lat, lng, neighborhood").eq("status", "published"),
    sb.from("venue_neighborhoods").select("name, name_norm, neighborhood, place_id, aliases"),
  ]);
  if (tErr || dErr) {
    console.error("[neighborhoodSweep] apply read failed:", tErr?.message ?? dErr?.message);
    return { updated: 0, remaining: 0 };
  }

  const things = (thingRows ?? []) as unknown as ThingRow[];
  const dictionary = (dictRows ?? []) as unknown as VenueDictEntry[];

  // Group by identical (neighborhood, nearby_zone) write target for chunked
  // bulk updates, same convention as scripts/backfill_nearby_zone.mts.
  const byTarget = new Map<string, string[]>();
  let remaining = 0;

  for (const t of things) {
    const input: ResolvableThing = {
      title: t.title, address: t.address, place_id: t.place_id, source_url: t.source,
      lat: t.lat, lng: t.lng, neighborhood: t.neighborhood as ResolvableThing["neighborhood"],
    };
    const result = resolveNeighborhood(input, dictionary);
    if (!autoWrites(result)) { remaining++; continue; }
    if (result.method === "existing" || !result.neighborhood) continue; // already correct, nothing to write

    const nearbyZone = deriveNearbyZone(result.neighborhood, t.lat, t.lng);
    const key = JSON.stringify([result.neighborhood, nearbyZone]);
    (byTarget.get(key) ?? byTarget.set(key, []).get(key)!).push(t.id);
  }

  let updated = 0;
  for (const [key, ids] of byTarget) {
    const [neighborhood, nearby_zone] = JSON.parse(key) as [string, string | null];
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error } = await sb.from("things").update({ neighborhood, nearby_zone }).in("id", chunk);
      if (error) { console.error("[neighborhoodSweep] apply write failed:", error.message); continue; }
      updated += chunk.length;
    }
  }

  return { updated, remaining };
}

export interface TriageAssignInput {
  id: string;
  zoneKey: DoorZoneKey | "other";
  /** When set and not already in the dictionary (matched by name_norm), upserts
   *  it so the same venue self-resolves for every future thing (Doc 19 §5.2). */
  venueName?: string | null;
}

export interface TriageAssignResult {
  ok: boolean;
  neighborhood: string | null;
  addedToDictionary: boolean;
  error?: string;
}

/** Doc 19 §6 Phase 4, one-tap triage assignment. Writes `neighborhood` +
 *  `nearby_zone` for a single thing (§4.3's canonical neighborhood for the two
 *  collapsed zones; 'other' + no zone for "Regional / Online"), and optionally
 *  upserts a venue into the dictionary. */
export async function assignTriageZone(input: TriageAssignInput): Promise<TriageAssignResult> {
  const sb = getAdminSupabase();
  if (!sb) return { ok: false, neighborhood: null, addedToDictionary: false, error: "no admin client" };

  const { data: row, error: readErr } = await sb.from("things").select("id, lat, lng").eq("id", input.id).single();
  if (readErr || !row) {
    return { ok: false, neighborhood: null, addedToDictionary: false, error: readErr?.message ?? "thing not found" };
  }

  const neighborhood = input.zoneKey === "other" ? "other" : canonicalNeighborhoodForZone(input.zoneKey);
  const nearby_zone = input.zoneKey === "other"
    ? null
    : deriveNearbyZone(neighborhood, row.lat as number | null, row.lng as number | null);

  const { error: updErr } = await sb.from("things").update({ neighborhood, nearby_zone }).eq("id", input.id);
  if (updErr) return { ok: false, neighborhood: null, addedToDictionary: false, error: updErr.message };

  let addedToDictionary = false;
  if (input.zoneKey !== "other" && input.venueName?.trim()) {
    const name = input.venueName.trim();
    const name_norm = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const { data: existing } = await sb.from("venue_neighborhoods").select("id").eq("name_norm", name_norm).maybeSingle();
    if (!existing) {
      const { error: insErr } = await sb
        .from("venue_neighborhoods")
        .insert({ name, name_norm, neighborhood, aliases: [], created_by: "triage" });
      if (!insErr) addedToDictionary = true;
      else console.error("[neighborhoodSweep] triage dictionary insert failed:", insErr.message);
    }
  }

  return { ok: true, neighborhood, addedToDictionary };
}

export interface AddVenueResult {
  ok: boolean;
  error?: string;
}

/** Doc 19 §5.3, the dictionary's direct "Add a venue" row, independent of
 *  triage. Same name_norm-keyed upsert as the seed script (§5.1) and the
 *  triage auto-add, so a manual add and a triage add of the same venue never
 *  duplicate. */
export async function addDictionaryVenue(name: string, zoneKey: DoorZoneKey): Promise<AddVenueResult> {
  const sb = getAdminSupabase();
  if (!sb) return { ok: false, error: "no admin client" };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "name is required" };

  const name_norm = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const neighborhood = canonicalNeighborhoodForZone(zoneKey);

  const { error } = await sb
    .from("venue_neighborhoods")
    .upsert({ name: trimmed, name_norm, neighborhood, created_by: "founder" }, { onConflict: "name_norm" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Doc 19 §6 Phase 5, the Coverage tab's watch count. If this drifts up over
 *  time (Phase 5's self-heal wired into ingest/land.ts should keep it near the
 *  residue that only manual triage/other legitimately explains), the sweep
 *  needs another pass. */
export async function countPublishedWithNoZone(): Promise<number> {
  const sb = getAdminSupabase();
  if (!sb) return 0;

  const { count, error } = await sb
    .from("things")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .or("neighborhood.is.null,neighborhood.eq.other");
  if (error) { console.error("[neighborhoodSweep] no-zone count failed:", error.message); return 0; }
  return count ?? 0;
}
