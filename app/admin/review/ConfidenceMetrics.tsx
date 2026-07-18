import type { ConfidenceMetrics as Metrics } from "@/lib/reviewServer";

/** Data Arch Redesign 24 Phase 4, "measure the win" (Doc 24 §4): how much of
 *  the founder's review time the auto-publish gate is reclaiming, all-time
 *  since Phase 3 launch, from the audit trail the gate already writes. */
export function ConfidenceMetrics({ metrics }: { metrics: Metrics }) {
  const { autoPublished, autoHeld, manuallyApproved, autoPublishRatePct, queueDepth } = metrics;
  const noDataYet = autoPublished === 0 && manuallyApproved === 0;
  return (
    <div className="panel">
      <h3>Time reclaimed</h3>
      <div className="metrics">
        {noDataYet ? (
          <div className="mrow"><span className="mlabel">No approvals recorded yet, check back after your queue moves.</span></div>
        ) : (
          <>
            <div className="mrow">
              <span className="mlabel">Auto-published (all-time)</span>
              <span className="mvalue">{autoPublished}</span>
            </div>
            <div className="mrow">
              <span className="mlabel">You approved by hand</span>
              <span className="mvalue">{manuallyApproved}</span>
            </div>
            <div className="mrow">
              <span className="mlabel">Auto-publish rate</span>
              <span className="mvalue">{autoPublishRatePct}%</span>
            </div>
          </>
        )}
        <div className="mrow">
          <span className="mlabel">Held back (below floor)</span>
          <span className="mvalue">{autoHeld}</span>
        </div>
        <div className="mrow">
          <span className="mlabel">In your queue right now</span>
          <span className="mvalue">{queueDepth}</span>
        </div>
      </div>
    </div>
  );
}
