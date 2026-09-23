// ingest/retire.ts
//
// R1 Wave 2 (W2.1). Archive events that already happened.
//
// The catalog kept every event row forever. By the 2026-09-21 audit, 1,108 of
// 1,529 published rows were events from June, July and August that had never
// been retired. That dead weight is what pushed the catalog past PostgREST's
// 1,000-row ceiling, which pushed every evergreen place out of the public pool,
// which is what made /saved delete real saves (TP-A1-09).
//
// Wave 1 stopped the bleeding at read time: getPublishedThings() now excludes an
// event the day it ends. This step is the other half, and it is about the table
// rather than the query. A week after an event ends it moves to
// `status = 'archived'`, which keeps the published set small and honest.
//
// The two halves are deliberately different lengths. The read filter uses a
// 1-day grace so last night's show is gone from the feed this morning. The
// archive waits 7 days so there is a full week in which the row is still
// trivially visible in the cockpit's normal published views before it moves.
//
// Nothing here deletes. Archived rows stay readable by the anon role (the R1
// `things_read_archived` policy), so a saved, shared or restored link still
// renders with an "already happened" banner rather than a 404. That is the whole
// reason this is an archive and not a delete.

import type { SupabaseClient } from '@supabase/supabase-js';

/** How long after an event ends before its row is archived. */
export const RETIRE_AFTER_DAYS = 7;
/** Assumed run time for an event that states no `ends_at`. Matches lib/poolFilter.ts. */
export const ASSUMED_EVENT_HOURS = 4;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface RetireCandidate {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
}

export interface RetireReport {
  /** Rows matching the rule, before the pending-edit exclusion. */
  matched: number;
  /** Rows actually archived (or that would be, on a dry run). */
  archived: number;
  /** Rows skipped because a pending thing_edits overlay is open on them. */
  skippedPendingEdit: RetireCandidate[];
  /** Matching rows bucketed by the month they happened, e.g. { "2026-07": 420 }. */
  byMonth: Record<string, number>;
  /** The first 20 titles, for the dry-run report. */
  sampleTitles: string[];
  dryRun: boolean;
}

/** The cutoff an event's effective end must be older than to be archived. */
export function retireCutoff(now: Date): Date {
  return new Date(now.getTime() - RETIRE_AFTER_DAYS * DAY_MS);
}

/**
 * The rule, in one place: has this event's effective end passed the cutoff?
 *
 * Evergreen and recurring rows (`starts_at` null) are never touched, whatever
 * else is on them. They have no occurrence to be finished with.
 */
export function shouldRetire(row: Pick<RetireCandidate, 'starts_at' | 'ends_at'>, now: Date): boolean {
  if (row.starts_at == null) return false;
  const effectiveEnd =
    row.ends_at != null
      ? new Date(row.ends_at).getTime()
      : new Date(row.starts_at).getTime() + ASSUMED_EVENT_HOURS * HOUR_MS;
  return effectiveEnd < retireCutoff(now).getTime();
}

/** "2026-07" for an ISO instant, in SB local time so a late-evening event is not
 *  bucketed into the next month by UTC. */
export function monthKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

/** Bucket candidates by the month they happened, newest month last. */
export function bucketByMonth(rows: RetireCandidate[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (!r.starts_at) continue;
    const k = monthKey(r.starts_at);
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

const PAGE = 1000;

/** Every published row that already happened, paged past the row ceiling. */
async function fetchFinishedEvents(sb: SupabaseClient, now: Date): Promise<RetireCandidate[]> {
  const cutoff = retireCutoff(now).toISOString();
  // Same three-branch rewrite lib/poolFilter.ts uses, inverted: an event is
  // finished when it has a start AND its effective end is before the cutoff.
  // PostgREST cannot express coalesce(ends_at, starts_at + 4h), so the two cases
  // are spelled out.
  const startCutoff = new Date(retireCutoff(now).getTime() - ASSUMED_EVENT_HOURS * HOUR_MS).toISOString();
  const or = `ends_at.lt.${cutoff},and(ends_at.is.null,starts_at.lt.${startCutoff})`;

  const rows: RetireCandidate[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('things')
      .select('id, title, starts_at, ends_at')
      .eq('status', 'published')
      .not('starts_at', 'is', null)
      .or(or)
      .order('starts_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`retire read: ${error.message}`);
    const page = (data ?? []) as unknown as RetireCandidate[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  // Belt and braces: re-apply the rule in JS so the SQL rewrite can never archive
  // something the stated rule would keep.
  return rows.filter((r) => shouldRetire(r, now));
}

/** Ids among `ids` that carry an open thing_edits overlay. */
async function idsWithPendingEdit(sb: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await sb
      .from('thing_edits')
      .select('thing_id')
      .eq('status', 'pending')
      .in('thing_id', chunk);
    if (error) throw new Error(`retire pending-edit read: ${error.message}`);
    for (const r of (data ?? []) as { thing_id: string }[]) out.add(r.thing_id);
  }
  return out;
}

/**
 * Archive finished events. Pass `dryRun: true` to report without writing, which
 * is what CP1 shows Jim before the real run.
 */
export async function retirePastEvents(
  sb: SupabaseClient,
  { dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {},
): Promise<RetireReport> {
  const matched = await fetchFinishedEvents(sb, now);
  const pending = await idsWithPendingEdit(sb, matched.map((r) => r.id));
  const skippedPendingEdit = matched.filter((r) => pending.has(r.id));
  const toArchive = matched.filter((r) => !pending.has(r.id));

  const report: RetireReport = {
    matched: matched.length,
    archived: toArchive.length,
    skippedPendingEdit,
    byMonth: bucketByMonth(toArchive),
    sampleTitles: toArchive.slice(0, 20).map((r) => r.title),
    dryRun,
  };
  if (dryRun || toArchive.length === 0) return report;

  const archivedAt = now.toISOString();
  let written = 0;
  for (let i = 0; i < toArchive.length; i += 200) {
    const chunk = toArchive.slice(i, i + 200).map((r) => r.id);
    const { data, error } = await sb
      .from('things')
      .update({ status: 'archived', archived_at: archivedAt })
      // Guard on the status we read, so a row published or edited between the
      // read and the write is not clobbered.
      .eq('status', 'published')
      .in('id', chunk)
      .select('id');
    if (error) throw new Error(`retire write: ${error.message}`);
    written += data?.length ?? 0;
  }
  report.archived = written;

  // One audit_log row per run, not per thing: this is a batch action.
  await sb.from('audit_log').insert({
    entity_type: 'thing',
    entity_id: null,
    action: 'archive_past',
    actor: 'pipeline',
    payload: {
      archived: written,
      matched: matched.length,
      skipped_pending_edit: skippedPendingEdit.length,
      cutoff: retireCutoff(now).toISOString(),
      by_month: report.byMonth,
    },
  });

  return report;
}

/** Human-readable dry-run report, for CP1 and the run log. */
export function formatRetireReport(r: RetireReport): string {
  const lines: string[] = [];
  lines.push(`${r.dryRun ? 'DRY RUN' : 'APPLIED'}  archive_past`);
  lines.push(`  matched (finished more than ${RETIRE_AFTER_DAYS} days ago): ${r.matched}`);
  lines.push(`  would archive: ${r.archived}`);
  lines.push(`  skipped, pending edit open: ${r.skippedPendingEdit.length}`);
  for (const s of r.skippedPendingEdit.slice(0, 20)) lines.push(`     ${s.id}  ${s.title}`);
  lines.push('  by month:');
  for (const [m, n] of Object.entries(r.byMonth)) lines.push(`     ${m}  ${n}`);
  lines.push('  first 20 titles:');
  for (const t of r.sampleTitles) lines.push(`     ${t}`);
  return lines.join('\n');
}
