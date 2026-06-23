import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { SavesProvider } from "@/components/saves/SavesProvider";

/** Shared shell for the three sections: header + scrollable content + bottom nav. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SavesProvider>
      <div className="sbd-shell">
        <AppHeader />
        <main className="sbd-shell__main">{children}</main>
        <BottomNav />
      </div>
    </SavesProvider>
  );
}
