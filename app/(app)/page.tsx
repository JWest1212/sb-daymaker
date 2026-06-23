import { EmptyState } from "@/components/ui";

// Explore — the front door (built out in Phase 4).
export default function ExplorePage() {
  return (
    <div style={{ paddingTop: "var(--space-6)" }}>
      <EmptyState
        icon="🌅"
        title="What's worth doing today"
        message="Explore is warming up. Soon this is where Santa Barbara's best lands each day — the golden-hour hero and everything worth getting out for."
      />
    </div>
  );
}
