// scripts/resize_hosted_photos.mjs  (Performance pass, 2026-09-22)
//
// WHAT: the 67 published listing photos stored in our own Supabase bucket
// (edition-media/things/, written full size by scripts/rehost_google_photos.mjs)
// had a median of 245 KB and reached 1.3 MB, shown in slots about 400px wide.
// This writes a resized copy of each (at most 1200px wide, JPEG q78, still fine
// for the email edition, which cannot rely on WebP) under edition-media/things-1200/
// and points things.photo_url at it.
//
// REVERSIBLE: originals are never touched, and in live mode a backup of every
// {id, photo_url} is written to scripts/backups/ FIRST. Rows whose resized copy
// would not be smaller are left alone.
//
// RUN:  node scripts/resize_hosted_photos.mjs          # dry run (no writes)
//       node scripts/resize_hosted_photos.mjs --live   # execute

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const LIVE = process.argv.includes("--live");
const BUCKET = "edition-media";
const FROM = `/storage/v1/object/public/${BUCKET}/things/`;
const MAX_WIDTH = 1200;
const CONCURRENCY = 4;

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"));
const cfg = {};
for (const line of env) { const i = line.indexOf("="); cfg[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function one(row) {
  try {
    const res = await fetch(row.photo_url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { id: row.id, ok: false, reason: `fetch ${res.status}` };
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    if (out.byteLength >= input.byteLength) return { id: row.id, ok: true, skipped: "not smaller", before: input.byteLength };
    const name = row.photo_url.split("/").pop().replace(/\.[a-z]+$/i, "") + ".jpg";
    const path = `things-1200/${name}`;
    if (!LIVE) return { id: row.id, ok: true, dryRun: true, before: input.byteLength, after: out.byteLength };
    const up = await sb.storage.from(BUCKET).upload(path, out, { contentType: "image/jpeg", upsert: true });
    if (up.error) return { id: row.id, ok: false, reason: `upload ${up.error.message}` };
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl;
    if (!url) return { id: row.id, ok: false, reason: "no public url" };
    const upd = await sb.from("things").update({ photo_url: url }).eq("id", row.id);
    if (upd.error) return { id: row.id, ok: false, reason: `db ${upd.error.message}` };
    return { id: row.id, ok: true, before: input.byteLength, after: out.byteLength };
  } catch (e) {
    return { id: row.id, ok: false, reason: String(e).slice(0, 120) };
  }
}

const { data, error } = await sb.from("things").select("id, photo_url").in("status", ["published", "archived"]).like("photo_url", `%${FROM}%`).limit(2000);
if (error) { console.error(error.message); process.exit(1); }
console.log(`mode: ${LIVE ? "LIVE" : "DRY RUN"} · stored photos to consider: ${data.length}`);
if (LIVE) {
  mkdirSync(new URL("./backups/", import.meta.url), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(new URL(`./backups/resize_photos_${stamp}.json`, import.meta.url), JSON.stringify(data, null, 2));
  console.log(`backup: scripts/backups/resize_photos_${stamp}.json`);
}
const results = [];
for (let i = 0; i < data.length; i += CONCURRENCY) results.push(...(await Promise.all(data.slice(i, i + CONCURRENCY).map(one))));
const done = results.filter((r) => r.ok && r.after), skipped = results.filter((r) => r.skipped), failed = results.filter((r) => !r.ok);
const kb = (n) => Math.round(n / 1024);
console.log(`resized: ${done.length} · already small: ${skipped.length} · failed: ${failed.length}`);
console.log(`bytes: ${kb(done.reduce((a, r) => a + r.before, 0))} KB -> ${kb(done.reduce((a, r) => a + r.after, 0))} KB`);
for (const f of failed.slice(0, 5)) console.log("  failed:", f.id, f.reason);
