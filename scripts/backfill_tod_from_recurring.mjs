// Data cleanup: recompute time_of_day_fit for recurring events from their
// schedule start time. A recurring event has no `starts_at`, so the ingest used
// to fall back to a generic ['morning','afternoon','evening'] default, which
// mislabeled evening/late rhythms (a 9pm karaoke night showed as "afternoon").
// The ingest is now fixed (ingest/gate.ts recurringTod); this backfills the rows
// already in the DB. Same tod thresholds as ingest/gate.ts bucketTod.
//
// SAFE BY DEFAULT: dry run unless `--live`. Live writes a reversible backup of
// every original {id, time_of_day_fit} to scripts/backups/ first.
//
// RUN:  node scripts/backfill_tod_from_recurring.mjs           # dry run
//       node scripts/backfill_tod_from_recurring.mjs --live    # execute
//
// No em dash (Golden Rule).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const LIVE = process.argv.includes("--live");
const TOD_ORDER = ["morning", "afternoon", "evening", "late"];

function bucketFromClock(hhmm) {
  const h = parseInt(String(hhmm).slice(0, 2), 10);
  if (!Number.isFinite(h)) return [];
  if (h >= 5 && h < 11) return ["morning"];
  if (h >= 11 && h < 17) return ["afternoon"];
  if (h >= 17 && h < 22) return ["evening"];
  return ["late"];
}

function todFromSchedules(schedules) {
  const set = new Set();
  for (const s of schedules ?? []) {
    if (typeof s.start_time === "string" && /^\d{2}:\d{2}/.test(s.start_time)) {
      for (const t of bucketFromClock(s.start_time)) set.add(t);
    }
  }
  return TOD_ORDER.filter((t) => set.has(t));
}

const eq = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

// ---- config -----------------------------------------------------------------
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"));
const cfg = {};
for (const line of env) {
  const i = line.indexOf("=");
  cfg[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data, error } = await sb
    .from("things")
    .select("id, title, starts_at, time_of_day_fit, recurring_schedules ( start_time )")
    .eq("status", "published")
    .is("starts_at", null)
    .limit(3000);
  if (error) { console.error("query failed:", error.message); process.exit(1); }

  const changes = [];
  for (const row of data ?? []) {
    const next = todFromSchedules(row.recurring_schedules);
    if (next.length === 0) continue; // no clock time on any schedule: leave as is
    const cur = row.time_of_day_fit ?? [];
    if (!eq(cur, next)) changes.push({ id: row.id, title: row.title, from: cur, to: next });
  }

  console.log(`mode: ${LIVE ? "LIVE (writing)" : "DRY RUN (no writes)"}`);
  console.log(`recurring (no starts_at) rows scanned: ${(data ?? []).length}`);
  console.log(`rows whose time_of_day_fit will change: ${changes.length}`);
  for (const c of changes.slice(0, 12)) {
    console.log(`  ${c.title}: [${c.from.join(",")}] -> [${c.to.join(",")}]`);
  }
  if (changes.length === 0) { console.log("nothing to do."); return; }

  if (!LIVE) return;

  mkdirSync(new URL("./backups/", import.meta.url), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(
    new URL(`./backups/tod_${stamp}.json`, import.meta.url),
    JSON.stringify(changes.map((c) => ({ id: c.id, time_of_day_fit: c.from })), null, 2),
  );
  console.log(`backup written: scripts/backups/tod_${stamp}.json (${changes.length} rows, reversible)`);

  let ok = 0, fail = 0;
  for (const c of changes) {
    const upd = await sb.from("things").update({ time_of_day_fit: c.to }).eq("id", c.id);
    if (upd.error) { fail++; console.log(`  FAIL ${c.title}: ${upd.error.message}`); } else ok++;
  }
  console.log(`done. updated: ${ok} | failed: ${fail}`);
}

main().then(() => process.exit(0));
