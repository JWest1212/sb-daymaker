// Gate 1 data backfill (unlocks the Gate 4 planner's open-hours validation).
//
// HOURS: for every published place that has a Google place_id but no stored
// hours, fetch regularOpeningHours from Google Place Details (New) and map it to
// the app's HourSpec[] ({dow, open, close}, SB-local). Small volume (~63 venues),
// well inside the Place Details Enterprise free tier (1,000 calls/month).
//
// SETTING: deterministic indoor/outdoor/both from happening_category (no API).
// Only the unambiguous categories are set; ambiguous ones stay null (never guess).
//
// SAFE BY DEFAULT: dry run (prints setting counts + a 3-venue hours sample, no
// writes) unless `--live`. Live writes reversible backups to scripts/backups/.
//
// RUN:  node scripts/backfill_hours_and_setting.mjs           # dry run
//       node scripts/backfill_hours_and_setting.mjs --live    # execute
//
// No em dash (Golden Rule).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const LIVE = process.argv.includes("--live");
const HOURS_CALL_CAP = 300; // runaway guard; far above the ~63 real targets

// ---- setting rule (category -> indoor/outdoor/both; unmapped -> leave null) --
const SETTING_BY_CATEGORY = {
  recurring_outdoors: "outdoor", scenic_chill: "outdoor", sports_outdoors_event: "outdoor",
  outdoor_activity: "outdoor", recurring_market: "outdoor", festival_fair: "outdoor",
  arts_theater: "indoor", culture_spot: "indoor", live_music: "indoor",
  recurring_nightlife: "indoor", shopping_browse: "indoor", recurring_arts: "indoor",
  food_drink_spot: "both", food_drink_event: "both",
  // community_gathering + anything else: too ambiguous, leave null (do not guess).
};

const pad = (n) => String(n).padStart(2, "0");

/** Google regularOpeningHours.periods -> HourSpec[] ({dow, open, close}). Handles
 *  overnight (close on the next day, stored as close <= open) and all-week 24h. */
function mapHours(roh) {
  const periods = roh?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;
  // 24/7: a single period, open day 0 00:00, no close.
  if (periods.length === 1 && periods[0].open && !periods[0].close && (periods[0].open.hour ?? 0) === 0) {
    return Array.from({ length: 7 }, (_, dow) => ({ dow, open: "00:00", close: "23:59" }));
  }
  const out = [];
  for (const p of periods) {
    if (!p.open) continue;
    const dow = p.open.day ?? 0;
    const open = `${pad(p.open.hour ?? 0)}:${pad(p.open.minute ?? 0)}`;
    const close = p.close ? `${pad(p.close.hour ?? 0)}:${pad(p.close.minute ?? 0)}` : "23:59";
    out.push({ dow, open, close });
  }
  return out.length ? out : null;
}

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
const KEY = cfg.GOOGLE_PLACES_KEY;

async function fetchHours(placeId) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "regularOpeningHours" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) return { error: `${r.status}` };
  const j = await r.json();
  return { hours: mapHours(j?.regularOpeningHours) };
}

async function main() {
  console.log(`mode: ${LIVE ? "LIVE (writing)" : "DRY RUN (no writes)"}`);

  // ---- SETTING (deterministic, no API) ----
  // Venues only: a place's indoor/outdoor nature is stable and category-derivable
  // (a museum is indoor, a trail is outdoor). Events are excluded, their setting
  // depends on the specific venue, which we don't reliably know, so we never guess
  // it (an outdoor concert would wrongly read as indoor from its category).
  const { data: all } = await sb
    .from("things")
    .select("id, title, happening_category, setting")
    .eq("status", "published")
    .eq("type", "place")
    .limit(3000);
  const settingChanges = [];
  for (const t of all ?? []) {
    const want = SETTING_BY_CATEGORY[t.happening_category ?? ""];
    if (want && t.setting !== want) settingChanges.push({ id: t.id, to: want });
  }
  const settingCounts = settingChanges.reduce((a, c) => ((a[c.to] = (a[c.to] ?? 0) + 1), a), {});
  console.log(`setting: ${settingChanges.length} rows to set ${JSON.stringify(settingCounts)}`);

  // ---- HOURS (Google, venues missing them) ----
  const { data: venues } = await sb
    .from("things")
    .select("id, title, place_id")
    .eq("status", "published")
    .eq("type", "place")
    .not("place_id", "is", null)
    .is("hours", null)
    .limit(3000);
  console.log(`hours: ${(venues ?? []).length} venues with a place_id and no hours`);

  if (!LIVE) {
    console.log("\n-- hours sample (first 3, no write) --");
    for (const v of (venues ?? []).slice(0, 3)) {
      const res = await fetchHours(v.place_id);
      console.log(`  ${v.title}: ${res.error ? "err " + res.error : JSON.stringify(res.hours)?.slice(0, 160)}`);
    }
    console.log("\n(dry run) re-run with --live to write setting + fetch/write all hours.");
    return;
  }

  mkdirSync(new URL("./backups/", import.meta.url), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Apply setting.
  writeFileSync(new URL(`./backups/setting_${stamp}.json`, import.meta.url), JSON.stringify(settingChanges.map((c) => c.id), null, 2));
  let setOk = 0;
  for (const c of settingChanges) {
    const u = await sb.from("things").update({ setting: c.to }).eq("id", c.id);
    if (!u.error) setOk++;
  }
  console.log(`setting written: ${setOk}/${settingChanges.length}`);

  // Fetch + apply hours.
  const hoursBackupIds = [];
  let calls = 0, wrote = 0, empty = 0, failed = 0;
  for (const v of venues ?? []) {
    if (calls >= HOURS_CALL_CAP) { console.log("hit call cap, stopping"); break; }
    calls++;
    const res = await fetchHours(v.place_id);
    if (res.error) { failed++; continue; }
    if (!res.hours) { empty++; continue; } // Google has no hours for this place (park/trail)
    const u = await sb.from("things").update({ hours: res.hours }).eq("id", v.id);
    if (u.error) { failed++; continue; }
    hoursBackupIds.push(v.id);
    wrote++;
    process.stdout.write(`  hours ${wrote} written (${calls} calls)\r`);
  }
  writeFileSync(new URL(`./backups/hours_${stamp}.json`, import.meta.url), JSON.stringify(hoursBackupIds, null, 2));
  console.log(`\nhours: google calls ${calls} | written ${wrote} | no-hours-on-google ${empty} | failed ${failed}`);
  console.log(`backups: scripts/backups/setting_${stamp}.json, hours_${stamp}.json (reversible)`);
}

main().then(() => process.exit(0));
