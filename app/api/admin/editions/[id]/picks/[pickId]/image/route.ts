import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { rehostImage } from "@/lib/edition/imageHost";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getAdminUser();
  return user ? getAdminSupabase() : null;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};

async function setOverride(
  sb: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
  editionId: string,
  pickId: string,
  url: string,
) {
  const { error } = await sb
    .from("edition_picks")
    .update({ override_image_url: url, is_manual: true })
    .eq("id", pickId)
    .eq("edition_id", editionId);
  return error;
}

// POST — sets a pick's override_image_url one of two ways (spec §5.1):
//   - JSON { url }              paste any URL, or pick one of the thing's photo_options
//   - multipart/form-data file  upload a new image, hosted in the edition-media bucket
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; pickId: string }> },
) {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: editionId, pickId } = await params;

  const { data: edition, error: edErr } = await sb.from("editions").select("status").eq("id", editionId).maybeSingle();
  if (edErr || !edition) return NextResponse.json({ error: "edition not found" }, { status: 404 });
  if (!["draft", "approved"].includes(edition.status)) {
    return NextResponse.json({ error: `edition is ${edition.status} — no longer editable` }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const { url } = (await req.json()) as { url?: string };
    if (!url || !/^https:\/\//.test(url)) {
      return NextResponse.json({ error: "a valid https:// URL is required" }, { status: 400 });
    }
    const hostedUrl = (await rehostImage(sb, url)) ?? url;
    const error = await setOverride(sb, editionId, pickId, hostedUrl);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, url: hostedUrl });
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (max 8MB)" }, { status: 400 });
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) return NextResponse.json({ error: "unsupported image type (jpeg/png/webp/gif only)" }, { status: 400 });

    const path = `${editionId}/${pickId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await sb.storage.from("edition-media").upload(path, buffer, {
      contentType: file.type, upsert: true,
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: pub } = sb.storage.from("edition-media").getPublicUrl(path);
    const error = await setOverride(sb, editionId, pickId, pub.publicUrl);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  }

  return NextResponse.json({ error: "unsupported content-type" }, { status: 400 });
}
