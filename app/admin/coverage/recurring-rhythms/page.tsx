import type { Metadata } from "next";
import { loadRecurringRhythms } from "@/lib/recurringRhythmsServer";
import { RecurringRhythmsView } from "./RecurringRhythmsView";

export const metadata: Metadata = { title: "Recurring Rhythms — SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RecurringRhythmsPage() {
  const rhythms = await loadRecurringRhythms();
  return <RecurringRhythmsView initialRhythms={rhythms} />;
}
