// ingest/tz.ts
//
// Build an ISO-8601 string with the correct America/Los_Angeles offset for a
// given SB WALL-CLOCK time. Scrapers read a local clock time ("Jul 12 at 7:00 PM");
// we must stamp it with -07:00 (PDT) or -08:00 (PST) depending on the date.
// A wrong offset is a wrong start instant, exactly what the gate guards against, // so this is isolated and unit-tested.

const TZ = 'America/Los_Angeles';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** What `utcMillis` reads as, on the SB wall clock, expressed as a UTC-epoch of
 *  those wall-clock fields. (asTz - utc) is the zone offset in ms (negative for LA). */
function offsetMs(utcMillis: number): number {
  const map: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(new Date(utcMillis))) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  // 'en-US' renders midnight as hour '24'; normalize to 0.
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  const asTz = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    hour, Number(map.minute), Number(map.second),
  );
  return asTz - utcMillis;
}

const dateKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** The SB-local calendar day ('YYYY-MM-DD') for an instant. Used by dedupe to
 *  compare a UTC Ticketmaster time and a local SOhO time on the same footing. */
export function sbDateKey(iso: string): string {
  return dateKeyFmt.format(new Date(iso)); // en-CA => YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, '0');

/** SB local wall-clock (y, m=1..12, d, hh=0..23, mm) -> ISO with the right offset. */
export function sbISO(y: number, m: number, d: number, hh: number, mm: number): string {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  // One correction pass resolves the DST-edge chicken-and-egg.
  let off = offsetMs(guess);
  off = offsetMs(guess - off);
  const sign = off <= 0 ? '-' : '+';
  const abs = Math.abs(off);
  const oh = pad(Math.floor(abs / 3_600_000));
  const om = pad(Math.floor((abs % 3_600_000) / 60_000));
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${sign}${oh}:${om}`;
}
