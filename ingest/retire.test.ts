import { describe, it, expect } from 'vitest';
import {
  shouldRetire,
  retireCutoff,
  bucketByMonth,
  monthKey,
  formatRetireReport,
  RETIRE_AFTER_DAYS,
  ASSUMED_EVENT_HOURS,
  type RetireCandidate,
} from './retire';

// Fixed clock, so this never expires the way the generic.test.ts case did.
const NOW = new Date('2026-09-21T12:00:00-07:00');
const HOUR = 3600e3;
const DAY = 24 * HOUR;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

describe('shouldRetire, the archive rule (R1 W2.1)', () => {
  it('never touches an evergreen or recurring row', () => {
    // No start means no occurrence to be finished with, whatever else is set.
    expect(shouldRetire({ starts_at: null, ends_at: null }, NOW)).toBe(false);
    expect(shouldRetire({ starts_at: null, ends_at: ago(400) }, NOW)).toBe(false);
  });

  it('archives an event that finished well past the window', () => {
    expect(shouldRetire({ starts_at: ago(60), ends_at: ago(60) }, NOW)).toBe(true);
  });

  it('keeps an event that finished inside the window', () => {
    // Ended 3 days ago: out of the public pool already (W1.2), still in the table.
    expect(shouldRetire({ starts_at: ago(3), ends_at: ago(3) }, NOW)).toBe(false);
  });

  it('keeps a future event', () => {
    const future = new Date(NOW.getTime() + 5 * DAY).toISOString();
    expect(shouldRetire({ starts_at: future, ends_at: null }, NOW)).toBe(false);
  });

  it('is exclusive at the boundary, so a row exactly on the cutoff is kept', () => {
    expect(shouldRetire({ starts_at: ago(30), ends_at: retireCutoff(NOW).toISOString() }, NOW)).toBe(false);
    expect(shouldRetire({ starts_at: ago(30), ends_at: new Date(retireCutoff(NOW).getTime() - 1).toISOString() }, NOW)).toBe(true);
  });

  it('assumes a four-hour run when the row states no end', () => {
    const justInside = new Date(retireCutoff(NOW).getTime() - ASSUMED_EVENT_HOURS * HOUR + HOUR).toISOString();
    const justOutside = new Date(retireCutoff(NOW).getTime() - ASSUMED_EVENT_HOURS * HOUR - HOUR).toISOString();
    expect(shouldRetire({ starts_at: justInside, ends_at: null }, NOW)).toBe(false);
    expect(shouldRetire({ starts_at: justOutside, ends_at: null }, NOW)).toBe(true);
  });

  it('prefers a stated end over the assumed one, so a long run is not archived early', () => {
    // Started 30 days ago but runs until yesterday: still live, not archived.
    expect(shouldRetire({ starts_at: ago(30), ends_at: ago(1) }, NOW)).toBe(false);
  });

  it('puts the cutoff exactly RETIRE_AFTER_DAYS back', () => {
    expect(NOW.getTime() - retireCutoff(NOW).getTime()).toBe(RETIRE_AFTER_DAYS * DAY);
  });

  it('is strictly later than the read-time pool filter, so the two never fight', () => {
    // The pool drops an event after 1 day; the table archives it after 7. A row
    // in between must be invisible in the feed but still published.
    const threeDaysAgo = { starts_at: ago(3), ends_at: ago(3) };
    expect(shouldRetire(threeDaysAgo, NOW)).toBe(false);
  });
});

describe('monthKey and bucketByMonth', () => {
  it('buckets in Santa Barbara local time, not UTC', () => {
    // 2026-08-01T02:30Z is still July 31 in Santa Barbara.
    expect(monthKey('2026-08-01T02:30:00Z')).toBe('2026-07');
    expect(monthKey('2026-08-01T18:00:00Z')).toBe('2026-08');
  });

  it('counts by month and sorts oldest first', () => {
    const rows: RetireCandidate[] = [
      { id: 'a', title: 'A', starts_at: '2026-08-10T18:00:00Z', ends_at: null },
      { id: 'b', title: 'B', starts_at: '2026-06-10T18:00:00Z', ends_at: null },
      { id: 'c', title: 'C', starts_at: '2026-08-11T18:00:00Z', ends_at: null },
    ];
    expect(Object.entries(bucketByMonth(rows))).toEqual([
      ['2026-06', 1],
      ['2026-08', 2],
    ]);
  });

  it('ignores a row with no start', () => {
    expect(bucketByMonth([{ id: 'x', title: 'X', starts_at: null, ends_at: null }])).toEqual({});
  });
});

describe('formatRetireReport', () => {
  it('labels a dry run as a dry run and reports every count the checkpoint needs', () => {
    const out = formatRetireReport({
      matched: 3,
      archived: 2,
      skippedPendingEdit: [{ id: 'k', title: 'Held for edit', starts_at: '2026-07-01T18:00:00Z', ends_at: null }],
      byMonth: { '2026-07': 2 },
      sampleTitles: ['One', 'Two'],
      dryRun: true,
    });
    expect(out).toContain('DRY RUN');
    expect(out).toContain('matched');
    expect(out).toContain('skipped, pending edit open: 1');
    expect(out).toContain('Held for edit');
    expect(out).toContain('2026-07');
    expect(out).toContain('One');
  });
});
