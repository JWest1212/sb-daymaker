import type { Metadata } from "next";
import { loadToday } from "@/lib/todayServer";
import { TodayView } from "./TodayView";

export const metadata: Metadata = { title: "Today · SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const data = await loadToday();
  return <TodayView data={data} />;
}
