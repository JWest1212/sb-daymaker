import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser, loadCockpitData } from "@/lib/reviewServer";
import { ReviewQueue } from "./ReviewQueue";
import "./cockpit.css";

export const metadata: Metadata = {
  title: "Review cockpit — SB Daymaker",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await getAdminUser();
  if (!user) redirect("/cockpit/login");
  const data = await loadCockpitData();
  return <ReviewQueue initial={data} />;
}
