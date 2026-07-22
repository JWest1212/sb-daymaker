import type { Metadata } from "next";
import { loadCoverage } from "@/lib/coverageServer";
import { countPublishedWithNoZone } from "@/lib/neighborhoodSweepServer";
import { loadSourceHealth } from "@/lib/sourcesServer";
import { CoverageView } from "./CoverageView";

export const metadata: Metadata = { title: "Coverage · SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CoveragePage() {
  const [initial, noZoneCount, sourceHealth] = await Promise.all([
    loadCoverage("vibe"), countPublishedWithNoZone(), loadSourceHealth(),
  ]);
  return <CoverageView initial={initial} noZoneCount={noZoneCount} sourceHealth={sourceHealth} />;
}
