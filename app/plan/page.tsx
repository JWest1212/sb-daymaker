import type { Metadata } from "next";
import { getPublishedThings } from "@/lib/things";
import { PlanClient } from "@/components/plan/PlanClient";

export const metadata: Metadata = {
  title: "Build Your Santa Barbara Day · SB Daymaker",
  description:
    "Tell us the shape of your day and we'll draft a Santa Barbara plan you can tweak: clustered stops, real hours, meals, and a shareable link.",
  alternates: { canonical: "/plan" },
};
export const revalidate = 600; // ISR, the content pool the planner slots from

export default async function PlanPage() {
  const things = await getPublishedThings();
  return <PlanClient things={things} />;
}
