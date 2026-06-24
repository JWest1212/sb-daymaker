import type { Metadata } from "next";
import { getPublishedThings } from "@/lib/things";
import { SavedClient } from "@/components/saved/SavedClient";

export const metadata: Metadata = { title: "Saved — SB Daymaker" };
export const revalidate = 600; // ISR — the saved list is filtered client-side from this pool

export default async function SavedPage() {
  const things = await getPublishedThings();
  return <SavedClient things={things} />;
}
