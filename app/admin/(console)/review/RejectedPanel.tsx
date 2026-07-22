"use client";

import { useCallback, useEffect, useState } from "react";

// S2, the Queue sidebar's "Recently rejected" panel (mockup r2): a founder
// reject is reversible for 14 days, mirrors MergedPanel.tsx's shape (fetch on
// mount, one-click restore, optimistic removal + toast).

interface RejectedRow { id: string; title: string; rejectedAt: string; reason: string; }

const DAY_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" });

export function RejectedPanel({ onToast }: { onToast?: (msg: string) => void }) {
  const [rows, setRows] = useState<RejectedRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/rejected")
      .then((r) => r.json())
      .then((d) => setRows(d?.rows ?? []))
      .catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const restore = async (row: RejectedRow) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/rejected", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok) {
        onToast?.(`Restore failed for "${row.title}"`);
        return;
      }
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id));
      onToast?.(`Restored "${row.title}", back in the review queue`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="panel">
      <h3>Recently rejected <span className="n">last 14 days</span></h3>
      <div className="dropwrap">
        {rows == null ? (
          <div className="drop"><span className="ds">Loading…</span></div>
        ) : rows.length === 0 ? (
          <div className="drop"><span className="ds">Nothing rejected in the last 14 days.</span></div>
        ) : (
          rows.map((r) => (
            <div className="drop" key={r.id}>
              <span className="dt">{r.title}</span>
              <span className="dr">rejected {DAY_FMT.format(new Date(r.rejectedAt))} &middot; {r.reason}</span>
              <button
                type="button"
                className="restore"
                disabled={busyId === r.id}
                onClick={() => restore(r)}
              >
                {busyId === r.id ? "Restoring…" : "Restore"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
