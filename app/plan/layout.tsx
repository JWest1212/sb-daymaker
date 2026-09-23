import type { ReactNode } from "react";
import { BottomNav } from "@/components/app/BottomNav";
import { PageFooter } from "@/components/app/PageFooter";

// The Plan surface owns its own header (it changes across setup → spine → swap),
// so it deliberately does NOT use the (app) group's AppHeader. It reuses the same
// shell + the shared BottomNav (SavesProvider lives in the root layout).
export default function PlanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sbd-shell">
      <a href="#main" className="sbd-skip">
        Skip to content
      </a>
      {children}
      {/* R1 W7.8 (A11Y-005). The same footer landmark as every other page. */}
      <PageFooter />
      <BottomNav />
    </div>
  );
}
