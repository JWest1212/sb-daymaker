// QW6, the Suspense fallback for every /admin route while its server data
// loads. Sits inside the cockpit shell (app/admin/layout.tsx already wraps
// children in .sbd-cockpit), so it only needs to fill the content area.
export default function AdminLoading() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--plaster)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "1.4rem",
            color: "var(--ink)",
            letterSpacing: "-.01em",
          }}
        >
          <span style={{ color: "var(--gold)" }}>SB</span> Daymaker
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: ".78rem",
            color: "var(--ink-2)",
          }}
        >
          Loading the cockpit…
        </span>
      </div>
    </div>
  );
}
