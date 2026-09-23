import { getPublishedThingsCached } from "@/lib/cachedData";
import type { Metadata } from "next";
import { PlanClient } from "@/components/plan/PlanClient";
import { pageMeta } from "@/lib/seo/pageMeta";

export const metadata: Metadata = pageMeta({
  title: "Build Your Santa Barbara Day · SB Daymaker",
  description:
    "Tell us the shape of your day and we'll draft a Santa Barbara plan you can tweak: clustered stops, hours where we know them, meals, and a shareable link.",
  path: "/plan",
});
export const revalidate = 300; // R1 W1.6, ISR safety net, the pool the planner slots from

export default async function PlanPage() {
  const things = await getPublishedThingsCached();
  return <PlanClient things={things} />;
}
