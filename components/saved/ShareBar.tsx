export function ShareBar({
  count,
  onShare,
  onCancel,
}: {
  count: number;
  onShare: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="sbd-sharebar" role="group" aria-label="Share selected">
      <button type="button" className="sbd-sharebar__cancel" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        className="sbd-sharebar__share"
        onClick={onShare}
        disabled={count === 0}
      >
        Share {count > 0 ? `${count} ` : ""}selected
      </button>
    </div>
  );
}
