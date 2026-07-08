"use client";

import type { ArchiveRow } from "@/lib/edition/cockpitTypes";

const STATUS_CHIP: Record<string, string> = { sent: "green", failed: "amber" };

export function ArchiveTable({ rows }: { rows: ArchiveRow[] | null }) {
  if (rows === null) return <p className="ed-swap-empty">Loading…</p>;
  if (rows.length === 0) return <div className="gatebox">No sent or failed editions yet.</div>;
  return (
    <table className="ed-archive">
      <thead>
        <tr>
          <th>Date</th><th>Type</th><th>Subject</th><th>Status</th>
          <th>Sent</th><th>Opens</th><th>Clicks</th><th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.edition_date}>
            <td className="ed-archive-date">{r.edition_date}</td>
            <td>{r.edition_type === "weekend" ? "Thu" : "Sun"}</td>
            <td className="ed-archive-subject">{r.subject ?? "—"}</td>
            <td><span className={`chip ${STATUS_CHIP[r.status] ?? "amber"}`}><span className="dot" />{r.status}</span></td>
            <td>{r.sent_count}</td>
            <td>{r.open_count}</td>
            <td>{r.click_count}</td>
            <td>
              {r.status === "sent" ? (
                <a href={`/edition/${r.edition_date}`} target="_blank" rel="noreferrer" className="prov">View →</a>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
