import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Discover SB — SB Daymaker" };

// Discover SB — the city guides (built out in Phase 6).
export default function DiscoverPage() {
  return (
    <div style={{ paddingTop: "var(--space-6)" }}>
      <EmptyState
        icon="🧭"
        title="Discover SB"
        message="City guides are on the way — neighborhood wanders and themed lineups, each surfacing what's actually happening around town."
      />
    </div>
  );
}
