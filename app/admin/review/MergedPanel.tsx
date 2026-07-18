"use client";

import { useState } from "react";
import type { MergedRow } from "@/lib/review";

/** Data Arch Redesign 26 Phase 5 — the founder's "un-merge" surface. Each row
 *  is a dedupe merge dedupeVenueAware() made: the dropped candidate was
 *  archived and pointed at its survivor instead of discarded, so a wrong call
 *  is reversible. Posts to /api/admin/dedupe/unmerge; on success the row is
 *  needs_review again (both records visible) and disappears from this list. */
export function MergedPanel({
  merges,
  onToast,
}: {
  merges: MergedRow[];
  onToast?: (msg: string) => void;
}) {
  const [rows, setRows] = useState(merges);
  const [busyId, setBusyId] = useState<string | null>(null);

  const unmerge = async (row: MergedRow) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/dedupe/unmerge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thing_id: row.id }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (!res?.ok) {
        onToast?.(`Un-merge failed for "${row.title}"`);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      onToast?.(`Un-merged "${row.title}" — back in the review queue`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="panel">
      <h3>Merged events <span className="n">{rows.length}</span></h3>
      <div className="dropwrap">
        {rows.length === 0 ? (
          <div className="drop"><span className="ds">No merges to review.</span></div>
        ) : (
          rows.map((r) => (
            <div className="drop" key={r.id}>
              <span className="dt">{r.title}</span>
              <span className="dr">MERGED into &ldquo;{r.survivorTitle}&rdquo;</span>
              <button
                type="button"
                className="restore"
                disabled={busyId === r.id}
                onClick={() => unmerge(r)}
              >
                {busyId === r.id ? "Un-merging…" : "Un-merge →"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
