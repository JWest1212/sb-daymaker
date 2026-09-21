/**
 * R1 Wave 1 (W1.2), the read-time freshness rule for the public pool.
 *
 * The catalog keeps every event row after the event happens. Wave 2 archives
 * them a week later, but archiving is a nightly pipeline step, so between the
 * moment an event ends and the moment the pipeline runs there is a window where
 * a finished event is still `status = 'published'`. This rule closes that window
 * at query time, so the pool is correct on the day an event ends rather than a
 * week later.
 *
 * The rule, stated once:
 *
 *   keep a row when `starts_at is null`                     (evergreen, recurring)
 *   or when `coalesce(ends_at, starts_at + 4h) >= now - 1d`  (has not finished yet)
 *
 * `ends_at` is frequently null, so an event with no stated end is assumed to run
 * for four hours. The one-day grace keeps last night's show visible through the
 * following morning, which is when people actually look it up again.
 *
 * PostgREST cannot express `coalesce(a, b + interval)`, so the same rule is
 * rewritten into three disjoint branches it can express. `isFresh` below is the
 * reference implementation of the rule and the thing the tests pin; it is
 * deliberately NOT used to filter after the fetch, because filtering in
 * JavaScript after the fetch is what lets the row ceiling truncate the catalog.
 */

/** How long after an event finishes it stays in the pool. */
export const STALE_GRACE_HOURS = 24;
/** Assumed run time for an event that states no `ends_at`. */
export const ASSUMED_EVENT_HOURS = 4;

const HOUR_MS = 60 * 60 * 1000;

/** The instant an event must have ended after, to still count as fresh. */
export function freshnessCutoff(now: Date): Date {
  return new Date(now.getTime() - STALE_GRACE_HOURS * HOUR_MS);
}

/** The instant an end-less event must have STARTED after, which is the cutoff
 *  pulled back by the assumed run time. Equivalent to `starts_at + 4h >= cutoff`. */
export function startFallbackCutoff(now: Date): Date {
  return new Date(freshnessCutoff(now).getTime() - ASSUMED_EVENT_HOURS * HOUR_MS);
}

/**
 * The rule as a PostgREST `or` argument, for `.or(...)`.
 *
 * Three branches, which together are exactly `starts_at is null or
 * coalesce(ends_at, starts_at + 4h) >= now - 1d`:
 *
 *   1. `starts_at.is.null`                          evergreen and recurring
 *   2. `ends_at.gte.<cutoff>`                       stated end, still fresh
 *   3. `and(ends_at.is.null,starts_at.gte.<start>)` no stated end, assume 4h
 *
 * ISO-8601 instants contain no commas or parentheses, so they are safe to
 * interpolate into PostgREST's filter grammar unquoted.
 */
export function freshnessOrFilter(now: Date): string {
  const cutoff = freshnessCutoff(now).toISOString();
  const startCutoff = startFallbackCutoff(now).toISOString();
  return [
    "starts_at.is.null",
    `ends_at.gte.${cutoff}`,
    `and(ends_at.is.null,starts_at.gte.${startCutoff})`,
  ].join(",");
}

/**
 * The same rule in JavaScript. This is the reference the SQL mirrors and the
 * thing the unit tests pin. Production does NOT call this to filter the pool.
 */
export function isFresh(
  row: { starts_at: string | null; ends_at: string | null },
  now: Date,
): boolean {
  if (row.starts_at == null) return true; // evergreen and recurring never expire
  const cutoff = freshnessCutoff(now).getTime();
  const effectiveEnd =
    row.ends_at != null
      ? new Date(row.ends_at).getTime()
      : new Date(row.starts_at).getTime() + ASSUMED_EVENT_HOURS * HOUR_MS;
  return effectiveEnd >= cutoff;
}
