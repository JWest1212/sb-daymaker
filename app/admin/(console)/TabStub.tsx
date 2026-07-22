/** Placeholder view for a cockpit tab whose build lands in a later phase.
 *  Keeps the tab a real, navigable route so the shell's deep-linking works now. */
export function TabStub({ title, phase, blurb }: { title: string; phase: string; blurb: string }) {
  return (
    <div className="wrap" style={{ display: "block", maxWidth: 900 }}>
      <main>
        <div className="done" style={{ marginTop: 24 }}>
          <div className="sun">🚧</div>
          <h2>{title}</h2>
          <p style={{ maxWidth: 520, margin: "0 auto" }}>{blurb}</p>
          <p style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: ".72rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pacific)" }}>
            Arriving in phase {phase}
          </p>
        </div>
      </main>
    </div>
  );
}
