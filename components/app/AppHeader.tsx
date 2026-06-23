/** The app's sticky brand header: mark + wordmark + tagline. */
export function AppHeader() {
  return (
    <header className="sbd-header">
      <span className="sbd-header__mark" aria-hidden="true">
        S
      </span>
      <span>
        <span className="sbd-header__name">SB Daymaker</span>
        <span className="sbd-header__tag" style={{ display: "block" }}>
          Santa Barbara, today
        </span>
      </span>
    </header>
  );
}
