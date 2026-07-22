import type { Metadata } from "next";
import { runNeighborhoodSweep, loadVenueDictionary } from "@/lib/neighborhoodSweepServer";
import { NeighborhoodSweepView } from "./NeighborhoodSweepView";

export const metadata: Metadata = { title: "Neighborhood Sweep · SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NeighborhoodSweepPage() {
  const [summary, dictionary] = await Promise.all([
    runNeighborhoodSweep({ dry: true }),
    loadVenueDictionary(),
  ]);
  return <NeighborhoodSweepView initialSummary={summary} initialDictionary={dictionary} />;
}
