// ingest/adapters/_shared/localist.ts
//
// Localist event API fetcher. Used by UCSB (events.ucsb.edu) and any other
// Localist-powered civic calendar. Localist returns structured ISO instance
// times → startStrategy:'structured'. Paginated via page number. (§2.7)
//
// GET {base}/api/2/events?start={from}&end={to}&pp=100&page=N
// Each event → event.event_instances[].start/.end (ISO string or object)

import type { RawCandidate, HappeningCategory, Neighborhood, OccasionTag } from '../../../packages/shared/types';
import type { DateWindow } from '../types';
import { seedOccasionTags } from './occasionTags';

const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';

function classifyLocalist(ev: any): HappeningCategory {
  const types: string[] = (ev?.event_types ?? []).map((t: any) => String(t?.name ?? '').toLowerCase());
  const title = String(ev?.title ?? '').toLowerCase();
  const hay = [...types, title].join(' ');
  if (/music|concert|band|jazz|recital/.test(hay)) return 'live_music';
  if (/theat|dance|film|art|gallery|perform|comedy|lecture|exhibit/.test(hay)) return 'arts_theater';
  if (/food|wine|taste|culinary/.test(hay)) return 'food_drink_event';
  if (/sport|race|hike|fitness|athlet/.test(hay)) return 'sports_outdoors_event';
  if (/festival|fair|market/.test(hay)) return 'festival_fair';
  return 'community_gathering';
}

function parseLocalistDate(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    // "2026-07-09T20:00:00-07:00" or "2026-07-09T20:00:00Z"
    const d = Date.parse(raw);
    return Number.isNaN(d) ? null : raw;
  }
  if (typeof raw === 'object' && raw !== null) {
    // Some Localist instances return { datetime, timezone }
    const obj = raw as any;
    const dt = obj?.datetime ?? obj?.start_date;
    return dt ? parseLocalistDate(dt) : null;
  }
  return null;
}

export interface LocalistOpts {
  sourceKey: string;
  venueName: string;
  address: string;
  neighborhood?: Neighborhood;
  tier?: 1 | 2;
  /** Only include events from these group names (case-insensitive substring match). */
  allowGroups?: string[];
  /** Drop events whose title matches any of these patterns. */
  denyKeywords?: RegExp[];
}

/** Fetch events from a Localist API, returning one RawCandidate per instance. */
export async function fetchLocalist(
  base: string,
  w: DateWindow,
  opts: LocalistOpts,
): Promise<RawCandidate[]> {
  const root = base.replace(/\/$/, '');
  const from = w.fromISO.slice(0, 10);
  const to = w.toISO.slice(0, 10);
  const out: RawCandidate[] = [];

  for (let page = 1; page <= 20; page++) {
    const url = `${root}/api/2/events?start=${from}&end=${to}&pp=100&page=${page}`;
    let body: any;
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`Localist ${res.status}`);
      body = await res.json();
    } catch (err) {
      if (page === 1) throw err; // first page failure is fatal for the adapter
      break;
    }

    const events: any[] = body?.events ?? [];
    if (!events.length) break;

    for (const wrapper of events) {
      const ev = wrapper?.event ?? wrapper;
      const title: string = ev?.title ?? '';
      if (!title.trim()) continue;

      // Group filter
      if (opts.allowGroups?.length) {
        const groups: string[] = (ev?.filters?.departments ?? ev?.groups ?? [])
          .map((g: any) => String(g?.name ?? g ?? '').toLowerCase());
        const allowed = opts.allowGroups.some((ag) =>
          groups.some((g) => g.includes(ag.toLowerCase())),
        );
        if (!allowed) continue;
      }

      // Deny-keyword filter
      if (opts.denyKeywords?.some((rx) => rx.test(title))) continue;

      // Expand all instances within the window
      const instances: any[] = ev?.event_instances ?? [{ start: ev?.starts_at, end: ev?.ends_at }];
      for (const inst of instances) {
        const startISO = parseLocalistDate(inst?.start ?? inst?.event_instance?.start);
        if (!startISO) continue;
        const ts = Date.parse(startISO);
        if (Number.isNaN(ts) || ts < Date.parse(w.fromISO) || ts > Date.parse(w.toISO)) continue;

        const endISO = parseLocalistDate(inst?.end ?? inst?.event_instance?.end);
        const category = classifyLocalist(ev);
        const sourceUrl: string = ev?.url ?? `${root}/event/${ev?.id ?? ''}`;
        const price = parseFloat(ev?.ticket_cost ?? '');

        out.push({
          source: opts.sourceKey,
          title: title.trim(),
          venueName: ev?.location_name ?? opts.venueName,
          address: ev?.location ?? opts.address,
          lat: ev?.geo?.latitude ? Number(ev.geo.latitude) : undefined,
          lng: ev?.geo?.longitude ? Number(ev.geo.longitude) : undefined,
          neighborhood: opts.neighborhood,
          tier: opts.tier ?? 1,
          category,
          type: 'event',
          startISO,
          endISO: endISO ?? undefined,
          startStrategy: 'structured',
          priceLow: Number.isFinite(price) ? price : null,
          explicitlyFree: ev?.free ?? (Number.isFinite(price) && price === 0),
          sourceUrl,
          buyUrl: ev?.ticket_url ?? sourceUrl,
          occasionTags: seedOccasionTags({ category, text: title }) as OccasionTag[],
          raw: { id: ev?.id, instance_id: inst?.id },
        });
      }
    }

    // Check pagination
    const meta = body?.meta ?? body;
    const total = meta?.total ?? meta?.count ?? 0;
    if (out.length >= total || events.length < 100) break;
  }

  return out;
}
