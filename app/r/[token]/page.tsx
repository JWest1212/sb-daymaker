import type { Metadata } from "next";
import Link from "next/link";
import { getSharedState } from "@/lib/shares";
import { getThingsByIds } from "@/lib/things";
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
  // R1 W2.2 (SHR-002, past part). This page lists no items, only a count, so the
  // honest way to mark past ones is to say how many there are before the visitor
  // restores. The items themselves get the full "already happened" line on /saved.
  const resolved = await getThingsByIds(Object.keys(saves));
  const pastCount = [...resolved.values()].filter((t) => t.status === "archived").length;
  return <RestoreView saves={saves} pastCount={pastCount} />;
}
