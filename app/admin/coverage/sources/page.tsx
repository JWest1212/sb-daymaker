import type { Metadata } from "next";
import { loadSources } from "@/lib/sourcesServer";
import { SourcesView } from "./SourcesView";

export const metadata: Metadata = { title: "Sources · SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await loadSources();
  return <SourcesView initialSources={sources} />;
}
