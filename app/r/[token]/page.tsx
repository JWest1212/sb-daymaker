import type { Metadata } from "next";
import Link from "next/link";
import { getSharedState } from "@/lib/shares";
import type { SaveState } from "@/components/saves/SavesProvider";
import { RestoreView } from "./RestoreView";

export const metadata: Metadata = {
  title: "Restore saves · SB Daymaker",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function RestorePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedState(token);

  if (!shared || shared.kind !== "save_restore") {
    return (
      <main className="sbd-public">
        <div className="sbd-public__inner">
          <h1 className="sbd-public__title">Restore link not found</h1>
          <p className="sbd-public__desc">
            This restore link may have expired or is incomplete.
          </p>
          <Link href="/" className="sbd-public__link">
            Open SB Daymaker →
          </Link>
        </div>
      </main>
    );
  }

  const saves = (shared.payload.saves ?? {}) as Record<string, SaveState>;
  return <RestoreView saves={saves} />;
}
