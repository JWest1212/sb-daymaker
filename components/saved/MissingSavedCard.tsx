"use client";

/**
 * R1 Wave 1 (W1.1). A saved id the database no longer returns.
 *
 * The old behavior was to delete these silently, which is how a truncated pool
 * erased real saves off people's phones. The rule now: show it, say plainly that
 * it is gone, and let the visitor be the one who removes it. Nothing here calls
 * `remove` on its own.
 *
 * The title is shown when it is known, which happens when the row resolved
 * earlier in this session and disappeared afterwards. On a cold load there is no
 * title to show, because saves store only the id.
 */
export function MissingSavedCard({
  title,
  onRemove,
  offline = false,
}: {
  title: string | null;
  onRemove: () => void;
  /** R1 W7.4. The database could not be reached, so nothing is known about
   *  this row beyond its remembered title. Not "gone": just not fetched.
   *  "offline" when the browser says so; "down" when it is online and the
   *  database did not answer, which is not the visitor's connection. */
  offline?: false | "offline" | "down";
}) {
  const label = title ?? "This saved item";
  return (
    <article className={`sbd-card sbd-savedcard sbd-savedcard--missing${offline ? " sbd-savedcard--offline" : ""}`}>
      <div className="sbd-savedcard__top">
        <div className="sbd-savedcard__body">
          <h3 className="sbd-savedcard__title">{label}</h3>
          <div className="sbd-savedcard__meta">
            {offline === "offline"
              ? "Details will load when you're back online."
              : offline === "down"
                ? "Details will load as soon as SB Daymaker answers."
                : "No longer listed. It may have been taken down, or it already happened."}
          </div>
        </div>
      </div>
      <div className="sbd-savedcard__actions">
        <button
          type="button"
          className="sbd-savedcard__act sbd-savedcard__act--remove"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          ✕ Remove
        </button>
      </div>
    </article>
  );
}
