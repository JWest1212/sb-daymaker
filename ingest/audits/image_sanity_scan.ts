// ingest/audits/image_sanity_scan.ts  (Gate 0 · G0.5)
//
// Flags published photos that are provably wrong or credited to license
// boilerplate. "Blank beats wrong": the remediation is to NULL photo_url + set
// photo_source='placeholder' (+ clear the bogus credit) so the existing motif
// fallback renders. This scan produces a review table; it does NOT write unless
// run with APPLY=1 (Jim approves the table first).
//
//   A. PDF/DjVu-derived URLs (Federal Register scans, yearbook pages, etc.).
//   B. Attribution whose AUTHOR field is license boilerplate, not a name
//      ("You may select the license of your choice", a bare "CC BY…", "Public
//      domain"). The credit line, and usually the image, are wrong.
//   C. (weak) Wikimedia file whose filename shares no token with the title, //      reported for human review only, never auto-acted.
//
// Run (report):  node --env-file=.env.local --import tsx ingest/audits/image_sanity_scan.ts
// Run (apply):   APPLY=1 node --env-file=.env.local --import tsx ingest/audits/image_sanity_scan.ts

import { getDb } from '../db';
import { AUDIT_DIR, isMain } from './_util';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PDF_URL_RE = /\.pdf|\.djvu|page1-|pdf\.jpg/i;

// The author segment (before the first " · ") being one of these means the credit
// is boilerplate, not a person. A real author + license suffix ("Warren LeMay …
// · CC BY-SA 2.0 · Wikimedia Commons") is fine and must NOT flag.
const BOILERPLATE_AUTHOR_RE = /^(you may select|cc[ -]by|public domain|license of your choice|creative commons|unknown author|no machine[- ]readable)/i;

// Words too generic to count as a filename↔title match for the (C) heuristic.
const STOP = new Set(['the', 'of', 'and', 'a', 'in', 'at', 'santa', 'barbara', 'sb', 'ca', 'california', 'jpg', 'png', 'thumb', 'commons', 'wikipedia', 'file', 'px', '1280px', '960px']);

interface Row {
  id: string; title: string;
  photo_url: string; photo_source: string; photo_attribution: string | null;
}

export type ImageIssue = 'pdf' | 'boilerplate' | 'title_mismatch';

export interface ImageFlag {
  id: string; title: string; issue: ImageIssue; detail: string; url: string;
}

function authorSegment(attr: string): string {
  return attr.split('·')[0].split(' - ')[0].trim();
}

function titleTokens(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

function filenameTokens(url: string): Set<string> {
  const file = decodeURIComponent(url).split('/').pop() ?? '';
  return new Set(file.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

export function classifyImage(r: Row): ImageFlag[] {
  const flags: ImageFlag[] = [];
  if (PDF_URL_RE.test(r.photo_url)) {
    flags.push({ id: r.id, title: r.title, issue: 'pdf', detail: 'PDF/DjVu-derived image', url: r.photo_url });
  }
  if (r.photo_attribution && BOILERPLATE_AUTHOR_RE.test(authorSegment(r.photo_attribution))) {
    flags.push({ id: r.id, title: r.title, issue: 'boilerplate', detail: `author = "${authorSegment(r.photo_attribution)}"`, url: r.photo_url });
  }
  // (C) weak: only for wikimedia, only when NOT already flagged above.
  if (/wikimedia|wikipedia/i.test(r.photo_url) && !flags.length) {
    const tt = titleTokens(r.title);
    const ft = filenameTokens(r.photo_url);
    const shared = [...tt].some((w) => ft.has(w));
    if (tt.size && ft.size && !shared) {
      const file = decodeURIComponent(r.photo_url).split('/').pop() ?? '';
      flags.push({ id: r.id, title: r.title, issue: 'title_mismatch', detail: `filename "${file.slice(0, 60)}" shares no token with title`, url: r.photo_url });
    }
  }
  return flags;
}

export async function runImageSanityScan(): Promise<ImageFlag[]> {
  const sb = getDb();
  const { data, error } = await sb
    .from('things')
    .select('id, title, photo_url, photo_source, photo_attribution')
    .eq('status', 'published')
    .not('photo_url', 'is', null);
  if (error) throw new Error(`image sanity scan: ${error.message}`);
  return (data ?? []).flatMap((r) => classifyImage(r as Row));
}

/** After Jim approves: null the wrong images (A + B) so the motif fallback renders.
 *  The weak (C) title-mismatch set is NEVER auto-nulled. */
async function applyNulls(flags: ImageFlag[]): Promise<number> {
  const sb = getDb();
  const ids = [...new Set(flags.filter((f) => f.issue !== 'title_mismatch').map((f) => f.id))];
  let n = 0;
  for (const id of ids) {
    const { error } = await sb
      .from('things')
      .update({ photo_url: null, photo_source: 'placeholder', photo_attribution: null })
      .eq('id', id);
    if (error) throw new Error(`null image ${id}: ${error.message}`);
    n++;
  }
  return n;
}

function renderReport(flags: ImageFlag[]): string {
  const section = (title: string, issue: ImageIssue, action: string) => {
    const rows = flags.filter((f) => f.issue === issue);
    if (!rows.length) return `### ${title}\n\n_None._\n\n`;
    let md = `### ${title} (${rows.length}), ${action}\n\n| id | title | detail |\n|---|---|---|\n`;
    for (const f of rows) md += `| \`${f.id}\` | ${f.title} | ${f.detail} |\n`;
    return md + '\n';
  };
  return (
    `# G0.5, Image sanity (published)\n\n` +
    `Generated by \`ingest/audits/image_sanity_scan.ts\`. Run with \`APPLY=1\` to null the ` +
    `A+B images (photo_url→null, photo_source→placeholder, credit cleared). The weak (C) ` +
    `set is human-review only.\n\n` +
    section('A. PDF/DjVu-derived images', 'pdf', 'auto-null on approval') +
    section('B. Boilerplate-credited images', 'boilerplate', 'auto-null on approval') +
    section('C. Wikimedia filename shares no title token (WEAK, human review)', 'title_mismatch', 'no auto-action')
  );
}

async function main() {
  const apply = process.env.APPLY === '1';
  console.log(`[image_sanity_scan] scanning published photos…${apply ? ' (APPLY mode)' : ''}\n`);
  const flags = await runImageSanityScan();
  const c = (i: ImageIssue) => flags.filter((f) => f.issue === i).length;
  console.log(`  A pdf: ${c('pdf')} · B boilerplate: ${c('boilerplate')} · C title-mismatch(weak): ${c('title_mismatch')}`);
  const path = join(AUDIT_DIR, 'image_sanity_scan.out.md');
  writeFileSync(path, renderReport(flags), 'utf8');
  console.log(`\n[image_sanity_scan] report: ${path}`);
  if (apply) {
    const n = await applyNulls(flags);
    console.log(`[image_sanity_scan] APPLY: nulled ${n} images (A+B). Motif fallback now renders for them.`);
  }
  process.exit(0);
}

if (isMain(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
