// Skeleton shown during ISR revalidation / cold-start streaming of the plan page.
// Matches the PlanSetup layout so the first interaction feels instant.
export default function PlanLoading() {
  return (
    <div className="sbd-shell__main" style={{ padding: "var(--space-5)" }}>
      {/* Header skeleton */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          marginBottom: "var(--space-6)",
        }}
      >
        <span className="sbd-skel sbd-skel--circle" style={{ width: 36, height: 36, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span className="sbd-skel sbd-skel--line" style={{ width: "55%" }} />
          <span className="sbd-skel sbd-skel--line" style={{ width: "35%", height: 10 }} />
        </div>
      </div>
      {/* Make My Day card skeleton */}
      <span className="sbd-skel sbd-skel--block" style={{ height: 80, marginBottom: "var(--space-5)", borderRadius: "var(--radius-lg)" }} />
      {/* Question rows */}
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: "var(--space-5)" }}>
          <span className="sbd-skel sbd-skel--line" style={{ width: "30%", marginBottom: "var(--space-3)" }} />
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {[1, 2, 3, 4].map((j) => (
              <span
                key={j}
                className="sbd-skel"
                style={{ flex: 1, height: 52, borderRadius: "var(--radius-md)" }}
              />
            ))}
          </div>
        </div>
      ))}
      {/* CTA skeleton */}
      <span className="sbd-skel" style={{ width: "100%", height: 52, borderRadius: "var(--radius-pill)", marginTop: "var(--space-4)" }} />
    </div>
  );
}
