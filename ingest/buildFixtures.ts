// ingest/buildFixtures.ts
//
// Parses the 107-row seed (the regression oracle) into fixtures/seed_rows.json,
// which the gate test runs against. Run with: npm run build:fixtures
// The output is committed so the test never depends on the parser at test time.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseThings } from './parseSeed';

const SEED = resolve('Core Project Files/sbdaymaker_seed_all-2.sql');
const OUT = resolve('fixtures/seed_rows.json');

const sql = readFileSync(SEED, 'utf8');
const rows = parseThings(sql);

const events = rows.filter((r) => r.type === 'event').length;
const places = rows.filter((r) => r.type === 'place').length;

mkdirSync(resolve('fixtures'), { recursive: true });
writeFileSync(OUT, JSON.stringify(rows, null, 2) + '\n', 'utf8');

console.log(`Parsed ${rows.length} things (${events} events + ${places} places) -> ${OUT}`);
