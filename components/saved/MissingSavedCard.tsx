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
}: {
  title: string | null;
  onRemove: () => void;
}) {
  const label = title ?? "This saved item";
  return (
    <article className="sbd-card sbd-savedcard sbd-savedcard--missing">
      <div className="sbd-savedcard__top">
        <div className="sbd-savedcard__body">
          <h3 className="sbd-savedcard__title">{label}</h3>
          <div className="sbd-savedcard__meta">
            No longer listed. It may have been taken down, or it already happened.
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
