import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Saved — SB Daymaker" };

// Saved — your on-device list (built out in Phase 5).
export default function SavedPage() {
  return (
    <div style={{ paddingTop: "var(--space-6)" }}>
      <EmptyState
        icon="❤️"
        title="Your saved list"
        message="Nothing saved yet. Tap the heart on anything you love and it'll live right here — on this device, no account needed."
      />
    </div>
  );
}
