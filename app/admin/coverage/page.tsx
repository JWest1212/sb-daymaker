import type { Metadata } from "next";
import { loadCoverage } from "@/lib/coverageServer";
import { CoverageView } from "./CoverageView";

export const metadata: Metadata = { title: "Coverage — SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CoveragePage() {
  const initial = await loadCoverage("vibe");
  return <CoverageView initial={initial} />;
}
