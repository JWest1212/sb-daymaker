// ingest/parseSeed.ts
//
// A small, string-aware parser for the seed SQL's `insert into things (...)`
// blocks. The seed uses THREE different column layouts and value rows contain
// commas, escaped apostrophes (''), ::type casts, and {array} literals — so a
// naive split() won't do. We tokenize respecting single-quoted strings and
// parenthesis depth, and map each value to its column NAME (never by position).
//
// Pure (no I/O): callers pass the SQL text in. Used by buildFixtures.ts and the
// gate test, so the 107 rows are the single regression oracle.

export type SeedValue = string | number | boolean | null;
export type SeedRow = Record<string, SeedValue>;

/** Strip `--` line comments (which the seed places BETWEEN value rows, and which
 *  contain stray parens/semicolons/apostrophes) while respecting string literals. */
export function stripSqlComments(sql: string): string {
  let out = '';
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) {
      if (ch === "'") {
        if (sql[i + 1] === "'") { out += "''"; i++; continue; }
        inStr = false; out += ch; continue;
      }
      out += ch; continue;
    }
    if (ch === "'") { inStr = true; out += ch; continue; }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++; // skip to end of line
      out += '\n';
      continue;
    }
    out += ch;
  }
  return out;
}

/** Parse every `insert into things (...) values (...);` block into name-keyed rows. */
export function parseThings(sqlRaw: string): SeedRow[] {
  const sql = stripSqlComments(sqlRaw);
  const rows: SeedRow[] = [];
  const headerRe = /insert\s+into\s+things\s*\(([^)]*)\)\s*values/gi;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(sql)) !== null) {
    const cols = m[1].split(',').map((c) => c.trim());
    const groups = readGroups(sql, headerRe.lastIndex);
    for (const g of groups) {
      const fields = splitFields(g);
      if (fields.length !== cols.length) {
        throw new Error(
          `seed parse: ${cols.length} columns but ${fields.length} values in row:\n  ${g.slice(0, 120)}…`,
        );
      }
      const row: SeedRow = {};
      cols.forEach((c, i) => {
        row[c] = parseValue(fields[i]);
      });
      rows.push(row);
    }
  }
  return rows;
}

/** Collect each top-level (...) group after `values`, stopping at the statement's `;`. */
function readGroups(sql: string, start: number): string[] {
  const groups: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  let capturing = false;
  for (let i = start; i < sql.length; i++) {
    const ch = sql[i];
    if (inStr) {
      if (ch === "'") {
        if (sql[i + 1] === "'") { cur += "''"; i++; continue; } // escaped quote
        inStr = false; cur += ch; continue;
      }
      cur += ch; continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === '(') {
      depth++;
      if (depth === 1) { capturing = true; cur = ''; continue; }
      cur += ch; continue;
    }
    if (ch === ')') {
      depth--;
      if (depth === 0) { groups.push(cur); capturing = false; continue; }
      cur += ch; continue;
    }
    if (capturing) { cur += ch; continue; }
    // Between value groups at depth 0, only whitespace and commas are legal.
    // Anything else (`;`, or the `on conflict (id) do nothing` tail) ends the
    // value list — stop before its literal `(id)` is misread as a row.
    if (depth === 0 && ch !== ',' && !/\s/.test(ch)) break;
  }
  return groups;
}

/** Split one group's inner text into raw field tokens at top-level commas. */
function splitFields(group: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < group.length; i++) {
    const ch = group[i];
    if (inStr) {
      if (ch === "'") {
        if (group[i + 1] === "'") { cur += "''"; i++; continue; }
        inStr = false; cur += ch; continue;
      }
      cur += ch; continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) { fields.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim() !== '') fields.push(cur.trim());
  return fields;
}

/** Turn one raw SQL token into a JS value (strips ::casts, unquotes strings). */
function parseValue(tokenIn: string): SeedValue {
  // Strip a trailing ::type or ::type[] cast (outside any string).
  const token = tokenIn.replace(/::\s*[a-z_]+(\s*\[\])?$/i, '').trim();
  if (/^null$/i.test(token)) return null;
  if (/^true$/i.test(token)) return true;
  if (/^false$/i.test(token)) return false;
  if (token.startsWith("'")) {
    // strip surrounding quotes and unescape doubled single-quotes
    return token.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
  return token; // bare token (e.g. an unquoted {array}) — kept verbatim
}
