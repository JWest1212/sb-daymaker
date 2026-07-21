// Elevation v1 · Gate 4/5, nightly venue-data refresh: keeps open-hours + setting
// current so the Concierge Day planner can validate "open when it says" for new
// and changed venues without a manual backfill.
//
// HOURS: for published places that have a Google place_id but no stored hours,
// fetch regularOpeningHours from Google Place Details (New) and map to the app's
// HourSpec[] (SB-local; overnight + 24h safe). Only venues MISSING hours are
// queried, so steady-state volume is a handful per night, inside the Place
// Details Enterprise free tier (1,000 calls/month). A per-run cap is the runaway
// guard.
//
// SETTING: deterministic indoor/outdoor/both from happening_category, venues only
// (an event's indoor/outdoor nature is venue-specific and is never guessed).
//
// Pure of side effects except the DB writes it is asked to make. No em dash.

import type { SupabaseClient } from '@supabase/supabase-js';

/** {dow 0=Sun..6=Sat, open "HH:MM", close "HH:MM"} in SB-local time (mirrors
 *  lib/format/openNow.ts HourSpec; kept local so the ingest worker needs no
 *  cross-boundary import). */
interface HourSpec {
  dow: number;
  open: string;
  close: string;
}

const HOURS_CALL_CAP = 300; // runaway guard; real nightly volume is a few venues

const SETTING_BY_CATEGORY: Record<string, 'indoor' | 'outdoor' | 'both'> = {
  recurring_outdoors: 'outdoor', scenic_chill: 'outdoor', sports_outdoors_event: 'outdoor',
  outdoor_activity: 'outdoor', recurring_market: 'outdoor', festival_fair: 'outdoor',
  arts_theater: 'indoor', culture_spot: 'indoor', live_music: 'indoor',
  recurring_nightlife: 'indoor', shopping_browse: 'indoor', recurring_arts: 'indoor',
  food_drink_spot: 'both', food_drink_event: 'both',
  // community_gathering + anything unlisted: too ambiguous, leave null.
};

const pad = (n: number) => String(n).padStart(2, '0');

interface GooglePeriodPoint { day?: number; hour?: number; minute?: number }
interface GooglePeriod { open?: GooglePeriodPoint; close?: GooglePeriodPoint }

/** Google regularOpeningHours.periods -> HourSpec[]. Handles overnight windows
 *  (close on the next day, stored as close <= open) and all-week 24h. */
export function mapGoogleHours(roh: { periods?: GooglePeriod[] } | null | undefined): HourSpec[] | null {
  const periods = roh?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;
  if (periods.length === 1 && periods[0].open && !periods[0].close && (periods[0].open.hour ?? 0) === 0) {
    return Array.from({ length: 7 }, (_, dow) => ({ dow, open: '00:00', close: '23:59' }));
  }
  const out: HourSpec[] = [];
  for (const p of periods) {
    if (!p.open) continue;
    const dow = p.open.day ?? 0;
    const open = `${pad(p.open.hour ?? 0)}:${pad(p.open.minute ?? 0)}`;
    const close = p.close ? `${pad(p.close.hour ?? 0)}:${pad(p.close.minute ?? 0)}` : '23:59';
    out.push({ dow, open, close });
  }
  return out.length ? out : null;
}

async function fetchGoogleHours(placeId: string, key: string): Promise<HourSpec[] | null | 'error'> {
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'regularOpeningHours' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return 'error';
    const j = await r.json();
    return mapGoogleHours(j?.regularOpeningHours);
  } catch {
    return 'error';
  }
}

export interface VenueDataResult {
  settingWritten: number;
  calls: number;
  hoursWritten: number;
  noHours: number;
  failed: number;
}

/** Fill missing setting (deterministic) and missing hours (Google) for published
 *  venues. Idempotent: only touches rows where the field is null. */
export async function refreshVenueHoursAndSetting(sb: SupabaseClient): Promise<VenueDataResult> {
  const res: VenueDataResult = { settingWritten: 0, calls: 0, hoursWritten: 0, noHours: 0, failed: 0 };

  // ---- setting (no API) ----
  const { data: places } = await sb
    .from('things')
    .select('id, happening_category, setting')
    .eq('status', 'published')
    .eq('type', 'place')
    .is('setting', null);
  for (const t of places ?? []) {
    const want = SETTING_BY_CATEGORY[(t.happening_category as string) ?? ''];
    if (!want) continue;
    const u = await sb.from('things').update({ setting: want }).eq('id', t.id);
    if (!u.error) res.settingWritten++;
  }

  // ---- hours (Google, venues missing them) ----
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) return res; // no key configured; setting still done

  const { data: venues } = await sb
    .from('things')
    .select('id, place_id')
    .eq('status', 'published')
    .eq('type', 'place')
    .not('place_id', 'is', null)
    .is('hours', null);

  for (const v of venues ?? []) {
    if (res.calls >= HOURS_CALL_CAP) break;
    res.calls++;
    const hours = await fetchGoogleHours(v.place_id as string, key);
    if (hours === 'error') { res.failed++; continue; }
    if (!hours) { res.noHours++; continue; } // Google has no hours (park/trail)
    const u = await sb.from('things').update({ hours }).eq('id', v.id);
    if (u.error) res.failed++;
    else res.hoursWritten++;
  }

  return res;
}
