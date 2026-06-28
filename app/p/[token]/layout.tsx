import type { ReactNode } from "react";

// Shared plan view: fully standalone — no AppHeader, no BottomNav.
// The page manages its own header + sticky footer.
export default function SharedPlanLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
