// lib/edition/imageHost.ts
//
// Re-hosts a chosen image into the edition-media bucket (spec §3.5: "Email and
// permalink reference the hosted URL, absolute, non-expiring; never a Places
// URL that can expire"). Keyed by a hash of the source URL, so the same photo
// is never fetched/uploaded twice across picks or editions — the on-disk
// analog of ingest/images.ts's image_cache table.
//
// Graceful degradation: any failure (network, unsupported type, oversized)
// returns the original source URL unchanged rather than throwing. A working
// hotlinked image beats a broken pick — this mirrors the rest of the image
// pipeline's "never block on image trouble" posture (state matrix §10).
//
// Deliberately NOT `import "server-only"` — draft.ts (which calls this) must
// stay importable from the ingest/ worker via plain Node/tsx, not just
// Next.js's bundler, and "server-only" only resolves inside the latter.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const MAX_BYTES = 8 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};

export async function rehostImage(sb: SupabaseClient, sourceUrl: string | null | undefined): Promise<string | null> {
  if (!sourceUrl) return null;
  if (sourceUrl.includes("/storage/v1/object/public/edition-media/")) return sourceUrl; // already hosted

  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return sourceUrl;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = EXT_BY_TYPE[contentType];
    if (!ext) return sourceUrl;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return sourceUrl;

    const hash = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 24);
    const path = `sources/${hash}.${ext}`;
    const { error } = await sb.storage.from("edition-media").upload(path, buf, { contentType, upsert: true });
    if (error) return sourceUrl;

    const { data } = sb.storage.from("edition-media").getPublicUrl(path);
    return data.publicUrl || sourceUrl;
  } catch {
    return sourceUrl;
  }
}
