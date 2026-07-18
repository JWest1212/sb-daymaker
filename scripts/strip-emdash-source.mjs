// scripts/strip-emdash-source.mjs  (Gate 0 . G0.9)
//
// One-time (idempotent) mechanical purge of the em dash (U+2014) from SOURCE
// files, so THE GOLDEN RULE holds from the first commit of this build forward and
// scripts/check-emdash.mjs can stay green. Scope: .ts/.tsx/.mts/.mjs under app,
// components, lib, ingest, packages, scripts. NOT .md (planning docs) or .sql.
//
// The character never appears literally in this file (only via fromCharCode), so
// the file purges itself to a no-op and the CI gate needs no allowlist.
//
// Ordered substitution (an em dash is never valid JS outside a comment/string, so
// a blind textual replace cannot break syntax):
//   1. test assertion literal  toContain('EM')            -> fromCharCode form
//   2. brand title tail        ' EM SB Daymaker'          -> ' . SB Daymaker' (middot)
//   3. brand title tail        ' EM Discover SB'          -> ' . Discover SB' (middot)
//   4. standalone placeholder  'EM'                       -> '.' (middot)
//   5. numeric/time range      '5 EM 8'                   -> '5 to 8'
//   6. everything else         ' EM '                     -> ', '

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const EM = String.fromCharCode(0x2014);
const MIDDOT = String.fromCharCode(0x00b7);
const ROOTS = ['app', 'components', 'lib', 'ingest', 'packages', 'scripts'];
const EXTS = new Set(['.ts', '.tsx', '.mts', '.mjs']);
const SKIP_DIR = new Set(['node_modules', '.next', '.git', 'dist', 'build']);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

function purge(text) {
  const q = "['\"`]";
  return text
    // 1. test assertion: toContain('EM') / toContain(\"EM\") -> fromCharCode
    .replace(new RegExp('toContain\\((' + q + ')' + EM + '\\1\\)', 'g'), 'toContain(String.fromCharCode(0x2014))')
    // 2/3. brand title tails -> ' . ' middot
    .replace(new RegExp('\\s*' + EM + '\\s*(SB Daymaker|Discover SB)', 'g'), ' ' + MIDDOT + ' $1')
    // 4. standalone placeholder literal 'EM' -> '.' middot (admin no-value glyph)
    .replace(new RegExp('(' + q + ')' + EM + '\\1', 'g'), '$1' + MIDDOT + '$1')
    // 5. numeric/time range -> ' to '
    .replace(new RegExp('(\\d)\\s*' + EM + '\\s*(\\d)', 'g'), '$1 to $2')
    // 6. everything else -> ', '
    .replace(new RegExp('\\s*' + EM + '\\s*', 'g'), ', ');
}

const files = ROOTS.filter((r) => { try { return statSync(r).isDirectory(); } catch { return false; } })
  .flatMap((r) => walk(r, []));
let changed = 0, occ = 0;
for (const f of files) {
  const before = readFileSync(f, 'utf8');
  if (!before.includes(EM)) continue;
  occ += before.split(EM).length - 1;
  const after = purge(before);
  if (after !== before) { writeFileSync(f, after, 'utf8'); changed++; console.log('  purged', f); }
}
console.log(`\n[strip-emdash-source] ${occ} em dash(es) removed across ${changed} file(s).`);
