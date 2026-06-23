import type { Metadata } from "next";
import { getPublishedThings } from "@/lib/things";
import { SavedClient } from "@/components/saved/SavedClient";

export const metadata: Metadata = { title: "Saved — SB Daymaker" };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const things = await getPublishedThings();
  return <SavedClient things={things} />;
}
