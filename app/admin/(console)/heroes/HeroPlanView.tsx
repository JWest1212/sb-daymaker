"use client";

import { useCallback, useState } from "react";
import type { HeroPlan, HeroDay } from "@/lib/heroServer";
import { Sheet } from "../../ui/Sheet";

export function HeroPlanView({ initial }: { initial: HeroPlan }) {
  const [plan, setPlan] = useState<HeroPlan>(initial);
  const [picker, setPicker] = useState<HeroDay | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); }, []);

  const refresh = useCallback(async () => {
    const res: HeroPlan | null = await fetch("/api/admin/hero-pins").then((r) => r.json()).catch(() => null);
    if (res?.days) setPlan(res);
    return res;
  }, []);

  // QW7, only close the picker on success; on failure it stays open (with
  // the failure toast) instead of silently vanishing before the result lands.
  const pin = useCallback(async (pin_date: string, thing_id: string) => {
    const res = await fetch("/api/admin/hero-pins", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin_date, thing_id }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) { setPicker(null); showToast("Hero pinned"); refresh(); } else showToast(res?.error ?? "Pin failed");
  }, [showToast, refresh]);

  const unpin = useCallback(async (pin_date: string) => {
    const res = await fetch("/api/admin/hero-pins", {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin_date }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) { setPicker(null); showToast("Cleared to Auto"); refresh(); } else showToast("Clear failed");
  }, [showToast, refresh]);

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 1180 }}>
      <div className="vhead">
        <h1 className="qtitle">Hero plan<span className="count"> next 14 days</span></h1>
      </div>
      <p className="vsub">
        Pin the marquee card for any day. Unpinned days fall back to the ranker&apos;s pick from the ⭑ hero-eligible pool
        (the ranker never reads sponsor status). <b>Pinning today&apos;s card takes effect on the live site&apos;s hero
        right away</b>; pins for future days are saved and go live when that day arrives.
      </p>

      <div className="herorail">
        {plan.days.map((day) => {
          const stale = !!day.pin && !day.pin.valid;
          const pinned = !!day.pin && day.pin.valid;
          return (
            <div className={`hday${day.isToday ? " today" : ""}${stale ? " stale" : ""}`} key={day.date}>
              <div className="hd-date">
                {day.label}
                {day.isToday ? <span className="tdy">Today</span> : null}
              </div>

              {pinned ? (
                <>
                  <span className="pinned-pill">📌 Pinned</span>
                  <div className="hd-pick">
                    <span className="ht">{day.pin!.title}</span>
                    <span className="hm">T{day.pin!.tier} · {day.pin!.when}</span>
                  </div>
                  <button className="btn btn-edit btn-sm" onClick={() => setPicker(day)}>Change pin</button>
                </>
              ) : stale ? (
                <>
                  <span className="pinned-pill stale">⚠ Pin invalid</span>
                  <div className="hd-pick">
                    <span className="ht">{day.pin!.title}</span>
                    <span className="hm">no longer valid for this day</span>
                  </div>
                  <button className="btn btn-quiet btn-sm" onClick={() => unpin(day.date)}>Clear to Auto</button>
                </>
              ) : (
                <>
                  <div className="hd-auto">
                    <b>Auto</b>
                    {day.autoPick ? (
                      <>
                        <span className="ht">{day.autoPick.title}</span>
                        <span className="hm">T{day.autoPick.tier} · {day.autoPick.when}</span>
                      </>
                    ) : (
                      <span className="hm">no ⭑ candidates this day</span>
                    )}
                  </div>
                  <button className="btn btn-edit btn-sm" disabled={!day.candidates.length} onClick={() => setPicker(day)}
                    title={day.candidates.length ? "Pin a hero" : "No ⭑ candidates occur this day"}>
                    {day.candidates.length ? "Pin a hero" : ", no candidates, "}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <Sheet
        open={!!picker}
        onClose={() => setPicker(null)}
        titleId="hpTitle"
        title={picker ? `Pin a hero, ${picker.label}` : ""}
        footer={
          <>
            {picker?.pin ? <button className="btn btn-quiet" onClick={() => unpin(picker.date)}>Clear pin (back to Auto)</button> : null}
            <button className="btn btn-edit" onClick={() => setPicker(null)}>Done</button>
          </>
        }
      >
        {picker && picker.candidates.length === 0 ? (
          <div className="gatebox">No ⭑ hero-eligible things occur on this day. Flag more things as Hero (in Queue or Catalog), or leave the day on Auto.</div>
        ) : picker?.candidates.map((c) => (
          <div className="pickrow" key={c.id}>
            <div>
              <div className="ttl">{c.title}</div>
              <div className="pm">T{c.tier} · {c.when}</div>
            </div>
            <button className="btn btn-approve btn-sm pickbtn" onClick={() => pin(picker.date, c.id)}>Pin</button>
          </div>
        ))}
      </Sheet>

      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}
