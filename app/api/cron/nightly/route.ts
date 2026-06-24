import { NextResponse, type NextRequest } from "next/server";
import { runNightly } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // headroom for the enrichment loop (Vercel Pro/Fluid)

// Vercel Cron calls this with `Authorization: Bearer ${CRON_SECRET}` automatically.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runNightly();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
