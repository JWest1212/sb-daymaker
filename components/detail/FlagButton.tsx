"use client";

// Elevation v1 · Gate 3 · G3.6, the quiet "Something off?" correction affordance.
// Opens a tiny sheet with the controlled reasons + an optional one-line detail,
// posts a content_flags row, shows a thank-you. NO contact fields (PII boundary).
// Device-side throttle (localStorage) on top of the server's per-IP soft cap.

import { useState } from "react";
import { FLAG_REASONS, FLAG_DETAIL_MAX, type FlagReason } from "@/lib/flags";

const LS_KEY = "sbd.flags.v1";
const MAX_PER_DAY = 6;

/** True if this device is over its soft daily flag cap. */
function overDeviceCap(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = JSON.parse(window.localStorage.getItem(LS_KEY) ?? "[]") as number[];
    const dayAgo = Date.now() - 86_400_000;
    return raw.filter((t) => t > dayAgo).length >= MAX_PER_DAY;
  } catch {
    return false;
  }
}

function recordSubmit() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LS_KEY) ?? "[]") as number[];
    const dayAgo = Date.now() - 86_400_000;
    const next = [...raw.filter((t) => t > dayAgo), Date.now()];
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* ignore storage failures */
  }
}

export function FlagButton({ thingId, guideId }: { thingId?: string; guideId?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "capped" | "error">("idle");

  const submit = async () => {
    if (!reason) return;
    if (overDeviceCap()) {
      setState("capped");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thing_id: thingId, guide_id: guideId, reason, detail }),
      });
      if (!res.ok) {
        setState(res.status === 429 ? "capped" : "error");
        return;
      }
      recordSubmit();
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (!open) {
    return (
      <button type="button" className="sbd-flag__trigger" onClick={() => setOpen(true)}>
        Something off? Let us know
      </button>
    );
  }

  return (
    <div className="sbd-flag" role="group" aria-label="Report a correction">
      {state === "done" ? (
        <p className="sbd-flag__thanks">Thanks, a local will take a look.</p>
      ) : state === "capped" ? (
        <p className="sbd-flag__thanks">Thanks for the help today, please try again tomorrow.</p>
      ) : (
        <>
          <div className="sbd-flag__label">What looks wrong?</div>
          <div className="sbd-flag__reasons">
            {FLAG_REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`sbd-flag__reason${reason === r.key ? " sbd-flag__reason--on" : ""}`}
                aria-pressed={reason === r.key}
                onClick={() => setReason(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className="sbd-flag__detail-label">
            <span className="sbd-sr-only">Optional detail</span>
            <input
              type="text"
              className="sbd-flag__detail"
              placeholder="Add a detail (optional)"
              maxLength={FLAG_DETAIL_MAX}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
          {state === "error" ? <p className="sbd-flag__err">Could not send, please try again.</p> : null}
          <div className="sbd-flag__actions">
            <button type="button" className="sbd-flag__cancel" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="sbd-flag__send"
              disabled={!reason || state === "sending"}
              onClick={submit}
            >
              {state === "sending" ? "Sending..." : "Send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
