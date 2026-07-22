import type { DropRow } from "@/lib/review";

const REASON_LABEL: Record<string, string> = {
  no_start: "no deterministic start",
  no_title: "no title",
  no_address: "no navigable address",
  no_source: "no source",
  duplicate: "duplicate",
};

/** "Dropped tonight", every held-back candidate with its reason (Doc 11 §9). */
export function DroppedPanel({ drops }: { drops: DropRow[] }) {
  return (
    <div className="panel">
      <h3>Dropped tonight <span className="n">{drops.length}</span></h3>
      <div className="dropwrap">
        {drops.length === 0 ? (
          <div className="drop"><span className="ds">Nothing dropped in the latest run.</span></div>
        ) : (
          drops.map((d) => (
            <div className="drop" key={d.id}>
              <span className="dt">{d.title ?? "(untitled candidate)"}</span>
              <span className="dr">DROP · {REASON_LABEL[d.reason] ?? d.reason}</span>
              {d.detail ? <span className="ds">{d.detail}</span> : null}
              {d.source_url && /^https?:\/\//.test(d.source_url) ? (
                <a className="restore" href={d.source_url} target="_blank" rel="noreferrer">
                  {d.reason === "duplicate" ? "Compare →" : "Review manually →"}
                </a>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
