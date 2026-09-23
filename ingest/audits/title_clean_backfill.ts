// ingest/audits/title_clean_backfill.ts
//
// R1 Wave 5 (W5.1) data pass. Apply ingest/clean.ts to rows that already landed.
//
// Slugs are NOT regenerated. An existing row's slug is its URL, and people have
// those saved, shared and indexed; renaming a thing is not a reason to break its
// link. New rows get a slug from their cleaned title at land time.

import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanTitle, cleanBlurb } from '../clean';

export interface TitleChange {
  id: string;
  status: string;
  before: string;
  after: string;
  venueName: string | null;
  blurbBefore: string | null;
  blurbAfter: string | null;
  addressLifted: string | null;
}

export interface TitleReport {
  scanned: number;
  changes: TitleChange[];
  titleChanged: number;
  venueLifted: number;
  blurbChanged: number;
  addressLifted: number;
  written: number;
  dryRun: boolean;
}

const PAGE = 1000;

export async function backfillTitles(
  sb: SupabaseClient,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<TitleReport> {
  const rows: {
    id: string; status: string; title: string; venue_name: string | null;
    blurb: string | null; address: string | null;
  }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('things')
      .select('id, status, title, venue_name, blurb, address')
      .in('status', ['published', 'archived', 'needs_review', 'draft'])
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`title backfill read: ${error.message}`);
    const page = (data ?? []) as unknown as typeof rows;
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const changes: TitleChange[] = [];
  for (const r of rows) {
    const { title, venueName } = cleanTitle(r.title);
    const { blurb, address } = cleanBlurb(r.blurb);
    const titleChanged = title !== r.title;
    const venueNew = venueName != null && venueName !== r.venue_name;
    const blurbChanged = r.blurb != null && blurb !== r.blurb;
    // Only lift an address into a row that has none.
    const addressLifted = address && !r.address?.trim() ? address : null;
    if (!titleChanged && !venueNew && !blurbChanged && !addressLifted) continue;
    changes.push({
      id: r.id,
      status: r.status,
      before: r.title,
      after: title,
      venueName: venueNew ? venueName : null,
      blurbBefore: blurbChanged ? r.blurb : null,
      blurbAfter: blurbChanged ? blurb : null,
      addressLifted,
    });
  }

  const report: TitleReport = {
    scanned: rows.length,
    changes,
    titleChanged: changes.filter((c) => c.before !== c.after).length,
    venueLifted: changes.filter((c) => c.venueName).length,
    blurbChanged: changes.filter((c) => c.blurbAfter).length,
    addressLifted: changes.filter((c) => c.addressLifted).length,
    written: 0,
    dryRun,
  };
  if (dryRun || changes.length === 0) return report;

  let written = 0;
  for (const c of changes) {
    const patch: Record<string, string> = {};
    if (c.before !== c.after) patch.title = c.after;
    if (c.venueName) patch.venue_name = c.venueName;
    if (c.blurbAfter) patch.blurb = c.blurbAfter;
    if (c.addressLifted) patch.address = c.addressLifted;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await sb.from('things').update(patch).eq('id', c.id);
    if (error) throw new Error(`title backfill write ${c.id}: ${error.message}`);
    written++;
  }
  report.written = written;

  await sb.from('audit_log').insert({
    entity_type: 'thing',
    entity_id: null,
    action: 'clean_titles',
    actor: 'pipeline',
    payload: {
      written,
      title_changed: report.titleChanged,
      venue_lifted: report.venueLifted,
      blurb_changed: report.blurbChanged,
      address_lifted: report.addressLifted,
    },
  });
  return report;
}

export function formatTitleReport(r: TitleReport, sampleSize = 30): string {
  const L: string[] = [];
  L.push(`${r.dryRun ? 'DRY RUN' : 'APPLIED'}  clean_titles`);
  L.push(`  scanned                  : ${r.scanned}`);
  L.push(`  rows to change           : ${r.changes.length}`);
  L.push(`    title rewritten        : ${r.titleChanged}`);
  L.push(`    venue lifted out       : ${r.venueLifted}`);
  L.push(`    blurb cleaned          : ${r.blurbChanged}`);
  L.push(`    address lifted to field: ${r.addressLifted}`);
  L.push('');
  L.push(`  ${Math.min(sampleSize, r.changes.length)} before and after:`);
  for (const c of r.changes.slice(0, sampleSize)) {
    L.push(`     - ${c.before}`);
    L.push(`     + ${c.after}${c.venueName ? `   [venue: ${c.venueName}]` : ''}`);
    if (c.addressLifted) L.push(`       address lifted: ${c.addressLifted}`);
    if (c.blurbAfter) L.push(`       blurb: "${(c.blurbBefore ?? '').slice(0, 44)}" -> "${c.blurbAfter.slice(0, 44)}"`);
  }
  return L.join('\n');
}
