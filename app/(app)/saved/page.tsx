import type { Metadata } from "next";
import { SavedClient } from "@/components/saved/SavedClient";
import { pageMeta } from "@/lib/seo/pageMeta";

export const metadata: Metadata = pageMeta({
  title: "Saved · SB Daymaker", // R1 W8.1, the page's one name
  // R1 W7.1 (SHR-004). Names what exists. There is no sort control.
  description: "Save what you want to do, mark what you did, share a list, or build a day from it.",
  path: "/saved",
});
// R1 W1.6. Lowered from 600 as a safety net until the ingest revalidate hook is
// proven in production. The page shell is all that is cached now: R1 W1.1 moved
// the saved rows to a client-side lookup by id, so this page no longer ships the
// browse pool and no longer goes stale in a way that can affect a visitor's list.
export const revalidate = 300;

export default function SavedPage() {
  return <SavedClient />;
}
