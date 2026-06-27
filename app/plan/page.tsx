import type { Metadata } from "next";
import { PlanClient } from "@/components/plan/PlanClient";

export const metadata: Metadata = { title: "Plan — SB Daymaker" };

export default function PlanPage() {
  return <PlanClient />;
}
