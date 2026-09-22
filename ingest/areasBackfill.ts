// ingest/areasBackfill.ts
//
// R1 Wave 4 (W4.4). Give the area-less rows an area.
//
// 585 of 1,529 published rows had no `nearby_zone` and 610 had no door zone
// (TP-A2-08), which is why the Place door could not become a real filter
// without emptying the feed: most of the catalog was unplaceable. This is the
// pass that makes W4.2 affordable.
//
// Resolution order, most trustworthy first:
//
//   1. The venue dictionary (`venue_neighborhoods`), via the existing pure
//      resolver that ingest and the cockpit sweep already share. Names, aliases
//      and place_ids, maintained by hand through the sweep console.
//   2. The nearest area centroid, when the row has coordinates.
//   3. Left unresolved, and listed for Jim's sweep console.
//
// Rule 3 is where this deliberately stops. The spec allows a paid Google Places
// geocode from the address as a third step; measured against the real data it
// would buy very little, because rows with a usable address almost always have
// coordinates already, and the ones that do not carry the city-wide placeholder
// "Santa Barbara, Santa Barbara, CA", which geocodes to the middle of town and
// would invent an area rather than find one. Nothing is guessed: an unresolved
// row stays unresolved and goes to the sweep.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Neighborhood } from '../packages/shared/types';
import {
  resolveNeighborhood,
  type ResolvableThing,
  type VenueDictEntry,
} from './adapters/_shared/resolveNeighborhood';
import { nearestArea, areaForNeighborhood, AREA_CANONICAL_NEIGHBORHOOD, AREA_BY_KEY, type AreaKey } from '../lib/areas';
import venueData from './data/venues.json';
import { zoneForNeighborhood } from '../lib/zones';

/** How far from an area's centre a coordinate may sit and still be called that
 *  area. Santa Barbara's areas are small; beyond this the nearest centroid is a
 *  guess rather than a resolution. Roughly 2.5 miles. */
export const MAX_CENTROID_DEGREES = 0.036;

export type ResolveVia = 'venue' | 'seeded_venue' | 'source_venue' | 'postcode' | 'coordinates' | 'unresolved';

interface SeededVenue { match: string; area: AreaKey; note?: string; review?: boolean }
interface SeededSource { key: string; area: AreaKey; note?: string }
const SEEDED_VENUES = (venueData.venues as SeededVenue[]).map((v) => ({ ...v, needle: v.match.toLowerCase() }));
const SEEDED_SOURCES = venueData.sources as SeededSource[];

/** The hand-assigned area for a title, matched on its venue segment first (the
 *  part after a pipe) and then on the whole title. Longest match wins, so
 *  "Oak Park Wading Pool" beats "Oak Park". */
export function seededAreaForTitle(title: string): AreaKey | null {
  const segment = title.includes('|') ? title.split('|').pop()!.trim() : title;
  const hay = `${segment} \u0000 ${title}`.toLowerCase();
  let best: SeededVenue | null = null;
  for (const v of SEEDED_VENUES) {
    if (!hay.includes(v.needle)) continue;
    if (!best || v.needle.length > best.match.toLowerCase().length) best = v;
  }
  return best ? best.area : null;
}

/**
 * Postcodes that mean exactly one area. Deliberately partial: 93101 covers
 * Downtown, the Funk Zone AND the Waterfront, so it is absent rather than
 * guessed at, and the Santa Maria / Lompoc / Santa Ynez postcodes are absent
 * because they are outside Santa Barbara altogether and belong in the sweep.
 */
const ZIP_AREA: Record<string, AreaKey> = {
  '93103': 'downtown_state',        // the Eastside
  '93105': 'mission_riviera',       // Mission, Riviera, upper canyons
  '93108': 'montecito_carpinteria', // Montecito
  '93013': 'montecito_carpinteria', // Carpinteria
  '93117': 'goleta_isla_vista',     // Goleta and Isla Vista
  '93110': 'upper_state',           // San Roque and Hope Ranch Annex
  '93111': 'upper_state',           // Hope Ranch Annex and north
};

/** The area a postcode names, when it names exactly one. */
export function areaForPostcode(address: string | null): AreaKey | null {
  if (!address) return null;
  const m = address.match(/\b9\d{4}\b/);
  return m ? (ZIP_AREA[m[0]] ?? null) : null;
}

/** The hand-assigned area for a single-venue source. A brewery's own events
 *  calendar publishes events at that brewery; that is a resolution, not a guess.
 *  Listing sites (independent.com, the city calendar) are deliberately absent. */
export function seededAreaForSource(source: string | null): AreaKey | null {
  if (!source) return null;
  const s = source.toLowerCase();
  return SEEDED_SOURCES.find((x) => s.includes(x.key.toLowerCase()))?.area ?? null;
}

export interface BackfillRow {
  id: string;
  title: string;
  status: string;
  is_civic?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  source: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  via: ResolveVia;
  neighborhood: Neighborhood | null;
  areaLabel: string | null;
}

export interface BackfillReport {
  scanned: number;
  /** Rows with no area at all before this pass. */
  candidates: number;
  resolved: BackfillRow[];
  unresolved: BackfillRow[];
  /** Counts of resolved rows by method, per source host. */
  bySource: Record<string, Record<ResolveVia, number>>;
  byArea: Record<string, number>;
  written: number;
  remainingAfter: number;
  dryRun: boolean;
}

const PAGE = 1000;

function host(source: string | null): string {
  if (!source) return '(none)';
  try {
    return new URL(source).hostname.replace(/^www\./, '');
  } catch {
    return source;
  }
}

/** Rows the public can see that nobody can place. */
async function fetchCandidates(sb: SupabaseClient) {
  const rows: Omit<BackfillRow, 'via' | 'neighborhood' | 'areaLabel'>[] = [];
  let scanned = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('things')
      .select('id, title, status, source, address, lat, lng, neighborhood, nearby_zone, place_id, is_civic, starts_at, ends_at')
      .in('status', ['published', 'archived'])
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`areas backfill read: ${error.message}`);
    const page = (data ?? []) as unknown as (Omit<BackfillRow, 'via' | 'neighborhood' | 'areaLabel'> & {
      neighborhood: string | null;
      nearby_zone: string | null;
      place_id: string | null;
    })[];
    scanned += page.length;
    for (const r of page) {
      // Already placeable through either column: nothing to do.
      if (areaForNeighborhood(r.neighborhood)) continue;
      if (r.nearby_zone) continue;
      rows.push(r);
    }
    if (page.length < PAGE) break;
  }
  return { rows, scanned };
}

export async function backfillAreas(
  sb: SupabaseClient,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<BackfillReport> {
  const { rows, scanned } = await fetchCandidates(sb);

  const { data: dictRows, error: dictErr } = await sb
    .from('venue_neighborhoods')
    .select('name, name_norm, neighborhood, place_id, aliases');
  if (dictErr) throw new Error(`areas backfill dictionary: ${dictErr.message}`);
  const dictionary = (dictRows ?? []) as unknown as VenueDictEntry[];

  const resolved: BackfillRow[] = [];
  const unresolved: BackfillRow[] = [];
  const bySource: BackfillReport['bySource'] = {};
  const byArea: Record<string, number> = {};

  for (const r0 of rows) {
    const r = r0 as typeof r0 & { place_id: string | null };
    let via: ResolveVia = 'unresolved';
    let neighborhood: Neighborhood | null = null;

    // 1. The hand-seeded venue table (ingest/data/venues.json), W4.4's first
    //    rule. Deliberate local knowledge, so it outranks the automatic
    //    resolver: the bounding boxes below are an acknowledged weak spot and
    //    were, for instance, putting the Arts and Crafts Show on Cabrillo
    //    Boulevard in the Funk Zone rather than on the Waterfront it runs along.
    {
      const key = seededAreaForTitle(r.title);
      if (key) {
        neighborhood = AREA_CANONICAL_NEIGHBORHOOD[key];
        via = 'seeded_venue';
      }
    }

    // 2. The venue dictionary, through the resolver ingest and the cockpit
    //    sweep already share (names, aliases, place_ids, then boxes and streets).
    const viaDict = resolveNeighborhood(
      {
        title: r.title,
        address: r.address,
        place_id: r.place_id ?? null,
        source_url: r.source ?? '',
        lat: r.lat,
        lng: r.lng,
        neighborhood: null,
      } as ResolvableThing,
      dictionary,
    );
    if (!neighborhood && viaDict.neighborhood && viaDict.confidence >= 0.75) {
      neighborhood = viaDict.neighborhood;
      via = 'venue';
    }

    // 3. The source's own home venue, for single-venue sources only.
    if (!neighborhood) {
      const key = seededAreaForSource(r.source);
      if (key) {
        neighborhood = AREA_CANONICAL_NEIGHBORHOOD[key];
        via = 'source_venue';
      }
    }

    // 4. An unambiguous postcode. 122 of the unplaced rows sit in 93103, the
    //    Eastside, which is unmistakably one area.
    if (!neighborhood) {
      const key = areaForPostcode(r.address);
      if (key) {
        neighborhood = AREA_CANONICAL_NEIGHBORHOOD[key];
        via = 'postcode';
      }
    }

    // 5. Nearest area centroid, but only when the coordinate is genuinely close
    //    to one. A point out by the airport is not "Downtown" just because
    //    Downtown is the least-far centroid.
    if (!neighborhood && r.lat != null && r.lng != null) {
      const key = nearestArea(r.lat, r.lng);
      const a = AREA_BY_KEY[key];
      const near =
        Math.abs(a.lat - r.lat) <= MAX_CENTROID_DEGREES &&
        Math.abs(a.lng - r.lng) <= MAX_CENTROID_DEGREES;
      if (near) {
        neighborhood = AREA_CANONICAL_NEIGHBORHOOD[key];
        via = 'coordinates';
      }
    }

    const areaKey = areaForNeighborhood(neighborhood);
    const row: BackfillRow = {
      ...r,
      via,
      neighborhood,
      areaLabel: areaKey ? AREA_BY_KEY[areaKey].label : null,
    };
    const h = host(r.source);
    bySource[h] ??= { venue: 0, seeded_venue: 0, source_venue: 0, postcode: 0, coordinates: 0, unresolved: 0 };
    bySource[h][via]++;
    if (neighborhood) {
      resolved.push(row);
      if (row.areaLabel) byArea[row.areaLabel] = (byArea[row.areaLabel] ?? 0) + 1;
    } else {
      unresolved.push(row);
    }
  }

  const report: BackfillReport = {
    scanned,
    candidates: rows.length,
    resolved,
    unresolved,
    bySource,
    byArea,
    written: 0,
    remainingAfter: unresolved.length,
    dryRun,
  };
  if (dryRun || resolved.length === 0) return report;

  let written = 0;
  for (const r of resolved) {
    // `nearby_zone` is derived from the module mapping, never invented, so the
    // two columns cannot disagree after this pass.
    const nearby_zone = zoneForNeighborhood(r.neighborhood);
    const { error } = await sb
      .from('things')
      .update({ neighborhood: r.neighborhood, nearby_zone })
      .eq('id', r.id);
    if (error) throw new Error(`areas backfill write ${r.id}: ${error.message}`);
    written++;
  }
  report.written = written;

  await sb.from('audit_log').insert({
    entity_type: 'thing',
    entity_id: null,
    action: 'backfill_areas',
    actor: 'pipeline',
    payload: { written, by_area: byArea, unresolved: unresolved.length },
  });

  return report;
}

export function formatBackfillReport(r: BackfillReport, sampleSize = 30): string {
  const L: string[] = [];
  L.push(`${r.dryRun ? 'DRY RUN' : 'APPLIED'}  backfill_areas`);
  L.push(`  rows scanned (published + archived) : ${r.scanned}`);
  L.push(`  rows with NO area at all            : ${r.candidates}`);
  L.push(`  would resolve                       : ${r.resolved.length}`);
  for (const via of ['venue', 'seeded_venue', 'source_venue', 'postcode', 'coordinates'] as ResolveVia[]) {
    L.push(`    via ${via.padEnd(30)} : ${r.resolved.filter((x) => x.via === via).length}`);
  }
  L.push(`  would remain unresolved             : ${r.unresolved.length}`);
  L.push('');
  L.push('  by source host (dict / seeded / source / zip / coords / unresolved):');
  const total = (c: Record<ResolveVia, number>) => c.venue + c.seeded_venue + c.source_venue + c.postcode + c.coordinates + c.unresolved;
  const sources = Object.entries(r.bySource).sort(([, a], [, b]) => total(b) - total(a));
  for (const [h, c] of sources.slice(0, 14)) {
    L.push(`     ${h.padEnd(34)} ${String(c.venue).padStart(4)} /${String(c.seeded_venue).padStart(5)} /${String(c.source_venue).padStart(5)} /${String(c.postcode).padStart(4)} /${String(c.coordinates).padStart(5)} /${String(c.unresolved).padStart(6)}`);
  }
  L.push('');
  L.push('  resolved rows by area:');
  for (const [a, n] of Object.entries(r.byArea).sort(([, x], [, y]) => y - x)) {
    L.push(`     ${a.padEnd(40)} ${n}`);
  }
  L.push('');
  L.push(`  ${Math.min(sampleSize, r.resolved.length)} examples of what would be written:`);
  for (const x of r.resolved.slice(0, sampleSize)) {
    L.push(`     [${x.via.padEnd(11)}] ${x.areaLabel?.padEnd(38)} ${x.title.slice(0, 58)}`);
  }
  if (r.unresolved.length) {
    // What the residue actually is. An unresolved civic meeting or an archived
    // row cannot be met by a visitor browsing by area, so the number that
    // matters is the last line here, not the headline.
    const now = Date.now();
    const live = r.unresolved.filter((x) => {
      if (x.status !== 'published' || x.is_civic) return false;
      if (!x.starts_at) return true;
      const end = x.ends_at ? new Date(x.ends_at).getTime() : new Date(x.starts_at).getTime() + 4 * 3600e3;
      return end >= now - 24 * 3600e3;
    });
    L.push('');
    L.push('  what the unresolved rows are:');
    L.push(`     archived                              : ${r.unresolved.filter((x) => x.status === 'archived').length}`);
    L.push(`     published but civic (never in the feed): ${r.unresolved.filter((x) => x.status === 'published' && x.is_civic).length}`);
    L.push(`     published, not civic, already finished : ${r.unresolved.filter((x) => x.status === 'published' && !x.is_civic).length - live.length}`);
    L.push(`     PUBLIC AND LIVE (what a visitor meets) : ${live.length}`);
    L.push('');
    L.push(`  ${Math.min(10, live.length)} examples of the public, live ones:`);
    for (const x of live.slice(0, 10)) {
      L.push(`     ${(x.address ?? '(no address)').slice(0, 44).padEnd(46)} ${x.title.slice(0, 50)}`);
    }
    L.push('');
    L.push(`  ${Math.min(6, r.unresolved.length)} examples across the whole residue:`);
    for (const x of r.unresolved.slice(0, 10)) {
      L.push(`     ${(x.address ?? '(no address)').slice(0, 44).padEnd(46)} ${x.title.slice(0, 50)}`);
    }
  }
  return L.join('\n');
}
