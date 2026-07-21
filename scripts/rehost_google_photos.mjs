// Elevation v1 · Gate 5 · G5.6, rehost cached Google Places photo hotlinks.
//
// WHAT: for every published thing whose photo is a Google `googleusercontent`
// hotlink (photo_source='google'), download the current image and re-upload it to
// the existing `edition-media` Supabase Storage bucket (under a `things/` prefix),
// then point things.photo_url at the stable hosted URL. This removes link-rot from
// ~404 rows (62% of the catalog). Mirrors lib/edition/imageHost.ts, which already
// does exactly this for the email digest.
//
// TOS NOTE: this caches Google imagery, which the schema comment discourages
// ("place_id cacheable; the photo is NOT"). We keep `place_id` and `photo_source`
// untouched, so a future switch to live re-resolve from place_id stays possible.
// This matches the digest pipeline's existing rehost posture.
//
// SAFE BY DEFAULT: dry-run unless you pass `--live`. In live mode it writes a
// reversible backup of every original {id, photo_url} to scripts/backups/ FIRST.
//
// RUN:  node scripts/rehost_google_photos.mjs            # dry run (no writes)
//       node scripts/rehost_google_photos.mjs --live     # execute
//
// No em dash (Golden Rule).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const LIVE = process.argv.includes("--live");
const BUCKET = "edition-media";
const MAX_BYTES = 8 * 1024 * 1024;
const CONCURRENCY = 5;
const EXT_BY_TYPE = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

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

const isGoogleHotlink = (url) =>
  !!url && (url.includes("googleusercontent") || url.includes("lh3.")) &&
  !url.includes(`/storage/v1/object/public/${BUCKET}/`);

async function rehostOne(row) {
  try {
    const res = await fetch(row.photo_url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { id: row.id, ok: false, reason: `fetch ${res.status}` };
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = EXT_BY_TYPE[contentType];
    if (!ext) return { id: row.id, ok: false, reason: `type ${contentType}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return { id: row.id, ok: false, reason: "size" };

    const hash = createHash("sha256").update(row.photo_url).digest("hex").slice(0, 24);
    const path = `things/${hash}.${ext}`;

    if (!LIVE) return { id: row.id, ok: true, dryRun: true, path };

    const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType, upsert: true });
    if (up.error) return { id: row.id, ok: false, reason: `upload ${up.error.message}` };
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    const hosted = data?.publicUrl;
    if (!hosted) return { id: row.id, ok: false, reason: "no public url" };

    // Point the row at the stable hosted URL. Keep photo_source='google' and
    // place_id untouched (attribution logic + future re-resolve both still work).
    const upd = await sb.from("things").update({ photo_url: hosted }).eq("id", row.id);
    if (upd.error) return { id: row.id, ok: false, reason: `db ${upd.error.message}` };
    return { id: row.id, ok: true, hosted };
  } catch (e) {
    return { id: row.id, ok: false, reason: String(e).slice(0, 120) };
  }
}

async function main() {
  const { data, error } = await sb
    .from("things")
    .select("id, title, photo_url, photo_source, status")
    .eq("status", "published")
    .eq("photo_source", "google")
    .limit(2000);
  if (error) { console.error("query failed:", error.message); process.exit(1); }

  const targets = (data ?? []).filter((r) => isGoogleHotlink(r.photo_url));
  console.log(`mode: ${LIVE ? "LIVE (writing)" : "DRY RUN (no writes)"}`);
  console.log(`published google-sourced rows: ${(data ?? []).length}`);
  console.log(`google hotlinks to rehost:     ${targets.length}`);
  if (targets.length === 0) { console.log("nothing to do."); return; }
  console.log("sample:", targets.slice(0, 3).map((t) => t.title).join(" | "));

  if (LIVE) {
    mkdirSync(new URL("./backups/", import.meta.url), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = new URL(`./backups/rehost_${stamp}.json`, import.meta.url);
    writeFileSync(backupPath, JSON.stringify(targets.map((t) => ({ id: t.id, photo_url: t.photo_url })), null, 2));
    console.log(`backup written: scripts/backups/rehost_${stamp}.json (${targets.length} rows, reversible)`);
  }

  const results = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(rehostOne))));
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length}\r`);
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\ndone. ${LIVE ? "rehosted" : "would rehost"}: ${ok} | failed: ${fail.length}`);
  if (fail.length) {
    const byReason = {};
    for (const f of fail) byReason[f.reason] = (byReason[f.reason] ?? 0) + 1;
    console.log("failure reasons:", JSON.stringify(byReason));
  }
}

main().then(() => process.exit(0));
