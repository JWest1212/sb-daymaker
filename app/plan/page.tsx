import type { Metadata } from "next";
import { getPublishedThings } from "@/lib/things";
import { PlanClient } from "@/components/plan/PlanClient";

export const metadata: Metadata = { title: "Plan · SB Daymaker" };
export const revalidate = 600; // ISR, the content pool the planner slots from

export default async function PlanPage() {
  const things = await getPublishedThings();
  return <PlanClient things={things} />;
}
