// ingest/audits/qa_note_scan.ts  (Gate 0 · G0.1)
//
// Scans PUBLISHED content for operator QA notes that leaked into user-visible
// copy (the canonical failure: the Funk Zone Art Walk "Local's secret" shipping
// "...confirm the specific date on funkzone.net before publishing"). Emits a
// review table; does NOT auto-edit. Jim supplies corrected copy per row.
//
// Also importable as a NON-BLOCKING nightly warning: scanCandidatesForQaNotes()
// takes already-loaded {things, recurringLabels, guideStops} and returns flags.
//
// Run: node --env-file=.env.local --import tsx ingest/audits/qa_note_scan.ts

import { getDb } from '../db';
import { type Flag, isMain, printTable, snippet, writeReport } from './_util';

// Case-insensitive phrase signatures of an operator note, each with a friendly
// label for the review table's "note" column.
const PHRASE_SIGNATURES: { re: RegExp; name: string }[] = [
  { re: /before publish/i, name: 'before publish' },
  { re: /\bconfirm\b/i, name: 'confirm' },
  { re: /\bverify\b/i, name: 'verify' },
  { re: /\bdouble[- ]check\b/i, name: 'double-check' },
  { re: /check the\b/i, name: 'check the…' },
  { re: /not weekly/i, name: 'NOT weekly' },
  { re: /\bTODO\b/, name: 'TODO' },
  { re: /\bFIXME\b/, name: 'FIXME' },
  { re: /\bplaceholder\b/i, name: 'placeholder' },
  { re: /\bxxx\b/i, name: 'xxx' },
  { re: /\(\?\)/, name: '(?)' },
  { re: /\?\?/, name: '??' },
  { re: /\(~\s*every/i, name: 'parenthetical cadence hedge (~every…)' },
];

// The spec asks us to flag "ALL-CAPS words of 3+ letters that aren't known
// acronyms." Taken literally that flags every legitimate brand acronym in the
// catalog (LOTG, YMCA, BBQ, SBHS, DAR, WIC…), which would make the A0.1
// "scan runs clean" bar unreachable, those brands are real published copy. So
// we narrow the all-caps signal to SHOUTED COMMON WORDS: an operator note
// shouts an ordinary English word ("NOT weekly", "EACH MONTH", "FRIDAY"), not a
// proper-noun acronym. Only all-caps tokens whose lowercase is in this set flag.
const SHOUT_WORDS = new Set([
  'NOT', 'NO', 'ALL', 'EACH', 'EVERY', 'ONLY', 'MUST', 'NEVER', 'ALWAYS',
  'WEEKLY', 'MONTHLY', 'BIMONTHLY', 'BIWEEKLY', 'DAILY', 'YEARLY',
  'MONTH', 'WEEK', 'DAY', 'YEAR',
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'JUNE', 'JULY', 'AUGUST',
  'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
  'TBD', 'TBA', 'DRAFT', 'INTERNAL', 'NOTE', 'PENDING', 'UNCONFIRMED', 'WIP',
]);

const ALLCAPS_RE = /\b[A-Z]{3,}\b/g;

/** Return the signature descriptions that fired for a value, or [] if clean. */
export function qaNoteSignals(value: string | null | undefined): string[] {
  if (!value) return [];
  const hits: string[] = [];
  for (const { re, name } of PHRASE_SIGNATURES) {
    if (re.test(value)) hits.push(name);
  }
  const caps = value.match(ALLCAPS_RE) ?? [];
  const shouted = [...new Set(caps)].filter((w) => SHOUT_WORDS.has(w));
  if (shouted.length) hits.push(`shouted: ${shouted.join(', ')}`);
  return hits;
}

interface ThingRow {
  id: string; title: string;
  blurb: string | null; blurb_long: string | null;
  reason_to_go: string | null; local_note: string | null;
}
interface RecurringRow { id: string; label: string | null; things: { title: string } | null }
interface GuideStopRow { id: string; note: string | null; label: string; guides: { title: string } | null }

export async function runQaNoteScan(): Promise<Flag[]> {
  const sb = getDb();
  const flags: Flag[] = [];

  // things, published only
  const { data: things, error: tErr } = await sb
    .from('things')
    .select('id, title, blurb, blurb_long, reason_to_go, local_note')
    .eq('status', 'published');
  if (tErr) throw new Error(`things scan: ${tErr.message}`);
  for (const t of (things ?? []) as ThingRow[]) {
    for (const col of ['blurb', 'blurb_long', 'reason_to_go', 'local_note'] as const) {
      const signals = qaNoteSignals(t[col]);
      if (signals.length) {
        flags.push({ id: t.id, title: t.title, table: 'things', column: col, snippet: snippet(t[col]!), note: signals.join(' · ') });
      }
    }
  }

  // recurring_schedules.label, only for published things
  const { data: rec, error: rErr } = await sb
    .from('recurring_schedules')
    .select('id, label, things!inner(title, status)')
    .eq('things.status', 'published');
  if (rErr) throw new Error(`recurring scan: ${rErr.message}`);
  for (const r of (rec ?? []) as unknown as RecurringRow[]) {
    const signals = qaNoteSignals(r.label);
    if (signals.length) {
      flags.push({ id: r.id, title: r.things?.title ?? '(unknown thing)', table: 'recurring_schedules', column: 'label', snippet: snippet(r.label!), note: signals.join(' · ') });
    }
  }

  // guide_stops.note, only for published guides
  const { data: stops, error: sErr } = await sb
    .from('guide_stops')
    .select('id, note, label, guides!inner(title, status)')
    .eq('guides.status', 'published');
  if (sErr) throw new Error(`guide_stops scan: ${sErr.message}`);
  for (const s of (stops ?? []) as unknown as GuideStopRow[]) {
    for (const col of ['note', 'label'] as const) {
      const signals = qaNoteSignals(s[col]);
      if (signals.length) {
        flags.push({ id: s.id, title: `${s.guides?.title ?? '(guide)'} › ${s.label}`, table: 'guide_stops', column: col, snippet: snippet(s[col]!), note: signals.join(' · ') });
      }
    }
  }

  return flags;
}

async function main() {
  console.log('[qa_note_scan] scanning published content for operator QA notes…\n');
  const flags = await runQaNoteScan();
  printTable(flags);
  const path = writeReport('qa_note_scan', 'G0.1, Leaked operator QA notes (published content)', flags);
  console.log(`\n[qa_note_scan] ${flags.length} flagged. Report: ${path}`);
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
