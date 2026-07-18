"use client";

// Elevation v1 · Gate 3 · G3.6, the cockpit Flags view. Lists open visitor
// corrections, each linking to the flagged thing/guide, with Resolve / Dismiss.
// Closing a flag removes it from the list (sets status + resolved_at server-side).

import { useState } from "react";
import Link from "next/link";
import type { FlagRow } from "@/lib/flagsServer";

const DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function FlagsView({ initialFlags }: { initialFlags: FlagRow[] }) {
  const [flags, setFlags] = useState<FlagRow[]>(initialFlags);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, action: "resolve" | "dismiss") => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/flags/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setFlags((prev) => prev.filter((f) => f.id !== id));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sbd-flags-view">
      <header className="sbd-flags-view__head">
        <h1>Flags</h1>
        <p>{flags.length} open correction{flags.length === 1 ? "" : "s"} from visitors.</p>
      </header>

      {flags.length === 0 ? (
        <p className="sbd-flags-view__empty">No open flags. Nothing needs a look right now.</p>
      ) : (
        <ul className="sbd-flags-view__list">
          {flags.map((f) => (
            <li key={f.id} className="sbd-flag-card">
              <div className="sbd-flag-card__body">
                <span className="sbd-flag-card__reason">{f.reasonLabel}</span>
                <span className="sbd-flag-card__target">
                  {f.targetHref ? (
                    <Link href={f.targetHref} target="_blank">
                      {f.targetLabel}
                    </Link>
                  ) : (
                    f.targetLabel
                  )}
                  {f.targetKind ? <span className="sbd-flag-card__kind"> · {f.targetKind}</span> : null}
                </span>
                {f.detail ? <p className="sbd-flag-card__detail">{f.detail}</p> : null}
                <span className="sbd-flag-card__when">{DATE.format(new Date(f.created_at))}</span>
              </div>
              <div className="sbd-flag-card__actions">
                <button type="button" disabled={busy === f.id} onClick={() => act(f.id, "resolve")}>
                  Resolve
                </button>
                <button
                  type="button"
                  className="sbd-flag-card__dismiss"
                  disabled={busy === f.id}
                  onClick={() => act(f.id, "dismiss")}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
