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
  const [toast, setToast] = useState<string | null>(null);

  const act = async (id: string, action: "resolve" | "dismiss") => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/flags/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setFlags((prev) => prev.filter((f) => f.id !== id));
      } else {
        setToast("Couldn't update that flag, try again");
        setTimeout(() => setToast(null), 3600);
      }
    } catch {
      setToast("Couldn't update that flag, try again");
      setTimeout(() => setToast(null), 3600);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 820 }}>
      <div className="vhead">
        <h1 className="qtitle">Flags</h1>
      </div>
      <p className="vsub">{flags.length} open correction{flags.length === 1 ? "" : "s"} from visitors. Settling them fast is the trust loop.</p>

      {flags.length === 0 ? (
        <div className="covempty">No open flags. Nothing needs a look right now.</div>
      ) : (
        <div>
          {flags.map((f) => (
            <div key={f.id} className="flagcard">
              <div className="fr">{f.reasonLabel}</div>
              <h4>
                {f.targetHref ? (
                  <Link href={f.targetHref} target="_blank">{f.targetLabel}</Link>
                ) : (
                  f.targetLabel
                )}
                {f.targetKind ? <span className="fkind"> &middot; {f.targetKind}</span> : null}
              </h4>
              {f.detail ? <p>&ldquo;{f.detail}&rdquo;</p> : null}
              <div className="fm">
                flagged {DATE.format(new Date(f.created_at))}
                {f.targetHref ? <> &middot; <Link href={f.targetHref} target="_blank">open the live page &#8599;</Link></> : null}
              </div>
              <div className="flagrow">
                <button className="btn btn-approve btn-sm" disabled={busy === f.id} onClick={() => act(f.id, "resolve")}>Resolve</button>
                <button className="btn btn-edit btn-sm" disabled={busy === f.id} onClick={() => act(f.id, "dismiss")}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}
