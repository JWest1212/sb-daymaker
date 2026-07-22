import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/reviewServer";
import { loadShellCounts } from "@/lib/todayServer";
import { CockpitTabs } from "./CockpitTabs";
import "./review/cockpit.css";

// The cockpit shell: one auth gate + the shared topbar/tab strip for every
// admin route (Today · Queue · Coverage · Live catalog · Hero plan · Edition
// draft · Venues). Individual pages nest inside it and render only their own view.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  const counts = await loadShellCounts();
  return (
    <div className="sbd-cockpit">
      <CockpitTabs counts={counts} />
      {children}
    </div>
  );
}
