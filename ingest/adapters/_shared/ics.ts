// ingest/adapters/_shared/ics.ts
//
// iCal feed parser. Fetches an .ics URL, parses VEVENT blocks:
//   • DTSTART/DTEND with TZID or Z → ISO instant (structured time)
//   • RRULE weekly/biweekly/monthly → registry candidate (recurring, §3)
//   • One-off events → dated candidates
// Used by LibCal libraries, MOXI iCal fallback, any CivicPlus iCal. (§2.6)

import type { RawCandidate, RecurringSpec, HappeningCategory, Neighborhood } from '../../../packages/shared/types';
import type { DateWindow } from '../types';
import { seedOccasionTags } from './occasionTags';

const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';

// ---- iCal text parsing ---------------------------------------------------

function unfold(text: string): string {
  // RFC 5545: lines ending with CRLF + space/tab continue the previous line
  return text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n');
}

interface IcsEvent {
  summary?: string;
  dtstart?: string;
  dtend?: string;
  url?: string;
  location?: string;
  description?: string;
  rrule?: string;
  uid?: string;
}

function parseEvents(icsText: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const lines = unfold(icsText).split('\n');
  let cur: IcsEvent | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const keyPart = line.slice(0, colon).toUpperCase();
    const val = line.slice(colon + 1).trim();
    // Strip parameters: DTSTART;TZID=America/Los_Angeles:20260705T190000
    const key = keyPart.split(';')[0];
    if (key === 'SUMMARY') cur.summary = val.replace(/\\,/g, ',').replace(/\\n/g, ' ');
    else if (key === 'DTSTART') cur.dtstart = val;
    else if (key === 'DTEND') cur.dtend = val;
    else if (key === 'URL') cur.url = val;
    else if (key === 'LOCATION') cur.location = val.replace(/\\,/g, ',').replace(/\\n/g, ' ');
    else if (key === 'DESCRIPTION') cur.description = val.replace(/\\,/g, ',').replace(/\\n/g, ' ');
    else if (key === 'RRULE') cur.rrule = val;
    else if (key === 'UID') cur.uid = val;
  }
  return events;
}

// ---- Date parsing --------------------------------------------------------

function parseIcsDate(raw: string | undefined): string | null {
  if (!raw) return null;
  // DATE-TIME: 20260705T190000Z  or  20260705T190000 (local, no offset → ambiguous, drop)
  // DATE only: 20260705 (all-day → no clock time → gate will drop)
  const zMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (zMatch) {
    const [, y, mo, d, h, mi, s] = zMatch;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  }
  // Floating (no Z, no TZ): treat as ambiguous → null (no clock time we can trust)
  // (LibCal actually ships UTC+0 for their public iCal feeds, handle as UTC)
  const floatMatch = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (floatMatch) {
    const [, y, mo, d, h, mi, s] = floatMatch;
    // Treat as UTC (most LibCal feeds are UTC even when not marked)
    return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  }
  return null; // date-only or unrecognized → gate drops
}

// ---- RRULE → RecurringSpec -----------------------------------------------

function parseRRule(rrule: string, dtstart: string | undefined): RecurringSpec | null {
  const parts: Record<string, string> = {};
  for (const seg of rrule.split(';')) {
    const [k, v] = seg.split('=');
    if (k && v) parts[k.toUpperCase()] = v;
  }
  const freq = parts['FREQ'];
  if (!freq) return null;

  const frequency =
    freq === 'WEEKLY' ? 'weekly' :
    freq === 'BIWEEKLY' ? 'biweekly' :
    freq === 'MONTHLY' ? 'monthly' : null;
  if (!frequency) return null;

  // day_of_week from BYDAY or from DTSTART
  let day_of_week: number | null = null;
  const byday = parts['BYDAY'];
  if (byday) {
    const DAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const m = byday.match(/([A-Z]{2})$/);
    if (m) day_of_week = DAY_MAP[m[1]] ?? null;
  }
  if (day_of_week == null && dtstart) {
    const iso = parseIcsDate(dtstart);
    if (iso) day_of_week = new Date(iso).getDay();
  }
  if (day_of_week == null) return null;

  // Extract start time from dtstart
  const startIso = dtstart ? parseIcsDate(dtstart) : null;
  let start_time: string | null = null;
  if (startIso) {
    const d = new Date(startIso);
    // Convert UTC to wall-clock for SB (rough: just use UTC hours for now;
    // the registry stores start_time as wall-clock HH:MM which the founder verifies)
    start_time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }

  // Extract end time from DTEND/DURATION (best-effort)
  return {
    day_of_week,
    start_time,
    end_time: null,
    frequency,
    time_unknown: start_time == null,
  };
}

// ---- Public API ---------------------------------------------------------

export interface IcsOpts {
  sourceKey: string;
  venueName: string;
  address: string;
  neighborhood?: Neighborhood;
  category?: HappeningCategory;
  tier?: 1 | 2;
  /** When true, RRULE events become registry candidates; one-offs stay dated. */
  emitRegistryCandidates?: boolean;
}

/** Fetch an iCal URL and return RawCandidates. */
export async function parseIcsFeed(icsUrl: string, w: DateWindow, opts: IcsOpts): Promise<RawCandidate[]> {
  const res = await fetch(icsUrl, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`iCal fetch ${res.status}: ${icsUrl}`);
  const text = await res.text();
  return parseIcsText(text, icsUrl, w, opts);
}

/** Parse an already-fetched iCal string (useful in tests). */
export function parseIcsText(
  icsText: string,
  sourceUrl: string,
  w: DateWindow,
  opts: IcsOpts,
): RawCandidate[] {
  const events = parseEvents(icsText);
  const out: RawCandidate[] = [];
  const category = opts.category ?? 'community_gathering';
  const tier = opts.tier ?? 1;

  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);

  for (const ev of events) {
    if (!ev.summary?.trim()) continue;
    const title = ev.summary.trim();
    const url = ev.url || sourceUrl;

    // RRULE → registry candidate (if opted-in)
    if (ev.rrule && opts.emitRegistryCandidates) {
      const spec = parseRRule(ev.rrule, ev.dtstart);
      if (!spec) continue;
      out.push({
        source: opts.sourceKey,
        title,
        venueName: ev.location || opts.venueName,
        address: opts.address,
        neighborhood: opts.neighborhood,
        tier: 2,
        category: tier === 2 ? category : 'community_gathering',
        type: 'place',
        startStrategy: 'none',
        registryCandidate: true,
        recurring: [spec],
        priceLow: null,
        explicitlyFree: true,
        sourceUrl: url,
        occasionTags: seedOccasionTags({ category, text: title }),
        raw: { uid: ev.uid, rrule: ev.rrule },
      });
      continue;
    }

    // One-off event
    const startISO = parseIcsDate(ev.dtstart);
    if (!startISO) continue; // date-only or unrecognized
    const ts = Date.parse(startISO);
    if (ts < fromTs || ts > toTs) continue; // outside window

    out.push({
      source: opts.sourceKey,
      title,
      venueName: ev.location || opts.venueName,
      address: opts.address,
      neighborhood: opts.neighborhood,
      tier,
      category,
      type: 'event',
      startISO,
      endISO: ev.dtend ? parseIcsDate(ev.dtend) ?? undefined : undefined,
      startStrategy: 'structured',
      priceLow: null,
      explicitlyFree: /free/i.test(ev.description ?? ev.summary ?? ''),
      sourceUrl: url,
      buyUrl: url,
      occasionTags: seedOccasionTags({ category, text: title }),
      raw: { uid: ev.uid },
    });
  }
  return out;
}
