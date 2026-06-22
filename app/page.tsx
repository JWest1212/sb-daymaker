export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "var(--space-4)",
        padding: "var(--space-8)",
        background: "var(--bg)",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-link)",
          margin: 0,
        }}
      >
        Santa Barbara, CA
      </p>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: "var(--weight-black)",
          fontSize: "var(--text-3xl)",
          lineHeight: "var(--leading-tight)",
          color: "var(--accent)",
          margin: 0,
          maxWidth: "16ch",
        }}
      >
        SB Daymaker — coming soon
      </h1>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-lg)",
          lineHeight: "var(--leading-snug)",
          color: "var(--text-muted)",
          margin: 0,
          maxWidth: "34ch",
        }}
      >
        Find what&rsquo;s worth doing in Santa Barbara today — find it, save it,
        share it.
      </p>
    </main>
  );
}
