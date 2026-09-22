// ingest/series.ts
//
// R1 Wave 5 (W5.2). Give every occurrence of a recurring thing the same identity.
//
// The audit found 154 title-and-venue groups covering 619 extra rows: "Recreation
// Swim" 38 times across two pools, the Arts and Crafts Show once per Sunday for
// 17 weeks, Chess Club 16 times (TP-A7-02, TP-A7-03). They are not duplicates,
// they are occurrences of one series, and the feed should say "Every Sunday,
// next Sep 27" rather than listing the same thing seventeen times.
//
// The key is normalized title + venue. W5.2's prose says to add the weekday too,
// but its own acceptance line says Recreation Swim should have TWO keys, one per
// pool. Measured against the real data those cannot both be true: Recreation Swim
// runs most days at three pools, so adding the weekday produced 18 keys, and the
// Arts and Crafts Show (which runs Saturday AND Sunday) split into two.
//
// Title + venue is the grain the product actually wants. D6 asks for one card per
// series per horizon, and a swim that runs daily at one pool is one series, not
// six. The cadence sentence ("Every Sunday", "Tuesdays and Thursdays") is then
// DERIVED from the occurrence dates by seriesCadence() below, which is both more
// accurate than a key component and able to say "most days" when that is the
// truth.
//
// Pure. The `series_key` column is additive and computed here; nothing about the
// row's own dates changes, because Explore still needs exact occurrence dates.

/** Collapse a string for comparison: case, accents, punctuation, whitespace. */
export function normalizeForKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The SB-local weekday (0 = Sunday) for an instant. */
export function sbWeekday(iso: string): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
  }).format(new Date(iso));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(s);
}

export interface SeriesInput {
  title: string;
  venue_name?: string | null;
  starts_at?: string | null;
}

/**
 * The series a row belongs to, or null when it has no start (an evergreen place
 * is not a series) or its date is unreadable.
 *
 * Shape: `<title> :: <venue>`. Readable on purpose, so a key in a
 * log or a cockpit column says what it is without a lookup.
 */
export function seriesKey(row: SeriesInput): string | null {
  if (!row.starts_at) return null;
  if (sbWeekday(row.starts_at) < 0) return null;
  const title = normalizeForKey(row.title);
  if (!title) return null;
  const venue = normalizeForKey(row.venue_name ?? '');
  return `${title} :: ${venue}`;
}

const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * R1 W5.2. How a series reads on a card, derived from its actual occurrence
 * dates rather than asserted: "Every Sunday", "Tuesdays and Thursdays",
 * "Most days", or null when there is only one date (not a series at all).
 */
export function seriesCadence(startsAt: string[]): string | null {
  const days = [...new Set(startsAt.map(sbWeekday).filter((d) => d >= 0))].sort();
  if (startsAt.length < 2 || days.length === 0) return null;
  if (days.length === 1) return `Every ${DAY_NAME[days[0]]}`;
  if (days.length >= 6) return 'Most days';
  if (days.length >= 4) return 'Several days a week';
  const names = days.map((d) => `${DAY_NAME[d]}s`);
  return names.length === 2
    ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Rows sharing a key, largest series first. Used by the backfill report. */
export function groupBySeries<T extends SeriesInput>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = seriesKey(r);
    if (!k) continue;
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return new Map([...out.entries()].sort(([, a], [, b]) => b.length - a.length));
}
