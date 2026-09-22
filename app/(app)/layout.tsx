import type { ReactNode } from "react";
import BrandHeader from "@/components/BrandHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { PageFooter } from "@/components/app/PageFooter";

// SavesProvider lives in the root layout so the public /s and /r pages share it.

/** Shared shell for the three sections: global brand header + scrollable content + bottom nav. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sbd-shell">
      <a href="#main" className="sbd-skip">
        Skip to content
      </a>
      <BrandHeader />
      <main id="main" className="sbd-shell__main">
        {children}
      </main>
      {/* R1 W7.8 (A11Y-005). A footer landmark on every page, not only Explore. */}
      <PageFooter />
      <BottomNav />
    </div>
  );
}
