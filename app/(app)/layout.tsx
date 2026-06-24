import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";

// SavesProvider lives in the root layout so the public /s and /r pages share it.

/** Shared shell for the three sections: header + scrollable content + bottom nav. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sbd-shell">
      <a href="#main" className="sbd-skip">
        Skip to content
      </a>
      <AppHeader />
      <main id="main" className="sbd-shell__main">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
