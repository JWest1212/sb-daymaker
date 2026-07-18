// scripts/check-emdash.mjs  (Gate 0 . G0.9 . THE GOLDEN RULE, build-time gate)
//
// Fails the build if an em dash (U+2014) appears in any site source file. No em
// dash, no green build. The em-dash-handling code (lib/text/stripEmDash, the
// purge script, this file) references the character only via fromCharCode, so the
// gate needs NO allowlist and has NO exceptions: zero U+2014 literals, period.
//
// Scope: .ts/.tsx/.mts/.mjs under app, components, lib, ingest, packages, scripts.
// (.md planning docs and .sql are not shipped to the site and are out of scope;
// DB content is guarded separately by the write-time and render-time layers.)
//
// Run: node scripts/check-emdash.mjs   (exit 1 on any hit)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const EM = String.fromCharCode(0x2014);
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

const files = ROOTS.filter((r) => { try { return statSync(r).isDirectory(); } catch { return false; } })
  .flatMap((r) => walk(r, []));

const hits = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    let col = line.indexOf(EM);
    while (col !== -1) { hits.push(`${f}:${i + 1}:${col + 1}`); col = line.indexOf(EM, col + 1); }
  });
}

if (hits.length) {
  console.error(`THE GOLDEN RULE violated: ${hits.length} em dash(es) (U+2014) in source.`);
  console.error('Fix: recast, or use a comma/period/colon/"to" for ranges. Run scripts/strip-emdash-source.mjs to purge mechanically.');
  for (const h of hits.slice(0, 50)) console.error('  ' + h);
  if (hits.length > 50) console.error(`  ...and ${hits.length - 50} more`);
  process.exit(1);
}
console.log(`check-emdash: clean (${files.length} files, zero U+2014).`);
