import { redirect } from "next/navigation";
import { getAdminUser, loadCockpitCounts } from "@/lib/reviewServer";
import { CockpitTabs } from "./CockpitTabs";
import "./review/cockpit.css";

// The cockpit shell: one auth gate + the shared topbar/tab strip for every
// admin route (Queue · Coverage · Live catalog · Hero plan · Edition draft ·
// Venues). Individual pages nest inside it and render only their own view.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/cockpit/login");
  const counts = await loadCockpitCounts();
  return (
    <div className="sbd-cockpit">
      <CockpitTabs counts={counts} />
      {children}
    </div>
  );
}
