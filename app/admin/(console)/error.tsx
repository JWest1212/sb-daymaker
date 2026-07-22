"use client";

// QW6, the error boundary for every /admin route. Sits inside the cockpit
// shell (app/admin/layout.tsx wraps children in .sbd-cockpit), so it only
// needs to fill the content area.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        textAlign: "center",
        padding: "0 24px",
        background: "var(--plaster)",
      }}
    >
      <p style={{ fontFamily: "var(--font-body)", fontSize: ".95rem", color: "var(--ink-2)", maxWidth: 420, margin: 0 }}>
        Something broke on our side. Reload, and if it persists check Vercel logs.
      </p>
      <button type="button" className="btn btn-approve btn-sm" onClick={reset}>
        Reload
      </button>
    </div>
  );
}
