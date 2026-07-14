import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { loadImagesDesk } from "@/lib/imagesServer";

export const dynamic = "force-dynamic";

// GET -> the Images desk dataset: every published thing without a real photo
// (null / placeholder / motif, minus photo_ack dismissals), plus the venue
// directory for suggestions and manual attach. The client filters/pages.
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await loadImagesDesk());
}
