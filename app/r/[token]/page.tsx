import type { Metadata } from "next";
import { getSharedStateOnce as getSharedState } from "@/lib/sharesServer";
import { getThingsByIds, type Thing } from "@/lib/things";
import { isOver } from "@/components/explore/derive";
import type { SaveState } from "@/components/saves/SavesProvider";
import { PublicFrame } from "@/components/public/PublicFrame";
import { pageMeta } from "@/lib/seo/pageMeta";
import { RestoreView } from "./RestoreView";

export const dynamic = "force-dynamic";

const RESTORE_EXPLAINER = "Your own saves from SB Daymaker, what's worth doing in Santa Barbara.";

// R1 W7.8 (META-001). A description with the count, not the sitewide default.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedState(token);
  const n = shared?.kind === "save_restore" ? Object.keys(shared.payload.saves ?? {}).length : 0;
  return pageMeta({
    title: "Restore saves · SB Daymaker",
    description:
      n > 0 ? `${n} save${n === 1 ? "" : "s"} to bring back to this device, from SB Daymaker.` : "Bring your SB Daymaker saves back to this device.",
    noindex: true,
  });
}

export default async function RestorePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedState(token);

  if (!shared || shared.kind !== "save_restore") {
    return (
      <PublicFrame explainer={RESTORE_EXPLAINER}>
        <h1 className="sbd-public__title">Restore link not found</h1>
        <p className="sbd-public__desc">
          This restore link may have expired or is incomplete.
        </p>
      </PublicFrame>
    );
  }

  const saves = (shared.payload.saves ?? {}) as Record<string, SaveState>;
  // R1 W2.2 (SHR-002, past part). This page lists no items, only a count, so the
  // honest way to mark past ones is to say how many there are before the visitor
  // restores. The items themselves get the full "already happened" line on /saved.
  // R1 W7.4. The past count is a courtesy; if the database cannot be reached,
  // restoring still works (the saves travel in the link itself), so leave it out.
  const resolved = await getThingsByIds(Object.keys(saves)).catch(() => new Map<string, Thing>());
  // Review fix: the same rule the cards use, so the count named here matches
  // the "Already happened" lines the visitor sees after restoring.
  const nowMs = Date.now();
  const pastCount = [...resolved.values()].filter((t) => isOver(t, nowMs)).length;
  return (
    <PublicFrame explainer={RESTORE_EXPLAINER} wayIn={{ href: "/saved", label: "Go to Saved" }}>
      <RestoreView saves={saves} pastCount={pastCount} />
    </PublicFrame>
  );
}
