import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";

/** Shared shell for the three sections: header + scrollable content + bottom nav. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sbd-shell">
      <AppHeader />
      <main className="sbd-shell__main">{children}</main>
      <BottomNav />
    </div>
  );
}
