import type { Metadata } from "next";
import { loadCockpitData } from "@/lib/reviewServer";
import { ReviewQueue } from "./ReviewQueue";

export const metadata: Metadata = {
  title: "Review cockpit — SB Daymaker",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// Auth + cockpit chrome live in app/admin/layout.tsx; this page renders the Queue view.
export default async function ReviewPage() {
  const data = await loadCockpitData();
  return <ReviewQueue initial={data} />;
}
