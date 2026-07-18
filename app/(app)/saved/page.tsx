import type { Metadata } from "next";
import { getPublishedThings } from "@/lib/things";
import { SavedClient } from "@/components/saved/SavedClient";

export const metadata: Metadata = {
  title: "Your Saved List · SB Daymaker",
  description:
    "Your saved Santa Barbara places and events, kept on this device. Sort by neighborhood, share a list, or build a day from it.",
  alternates: { canonical: "/saved" },
};
export const revalidate = 600; // ISR, the saved list is filtered client-side from this pool

export default async function SavedPage() {
  const things = await getPublishedThings();
  return <SavedClient things={things} />;
}
