import type { Metadata } from "next";
import { SavedClient } from "@/components/saved/SavedClient";

export const metadata: Metadata = {
  title: "Your Saved List · SB Daymaker",
  description:
    "Your saved Santa Barbara places and events, kept on this device. Sort by neighborhood, share a list, or build a day from it.",
  alternates: { canonical: "/saved" },
};
// R1 W1.6. Lowered from 600 as a safety net until the ingest revalidate hook is
// proven in production. The page shell is all that is cached now: R1 W1.1 moved
// the saved rows to a client-side lookup by id, so this page no longer ships the
// browse pool and no longer goes stale in a way that can affect a visitor's list.
export const revalidate = 300;

export default function SavedPage() {
  return <SavedClient />;
}
