"use client";

import type { Thing } from "@/lib/things";
import { AREAS, AREA_BY_KEY, areaForThing, type AreaKey } from "@/lib/areas";

// R1 W8.1. The recap counts the SAME eight areas as every other surface
// (lib/areas.ts), not the six legacy nearby_zone values.
function resolveZone(t: Thing): AreaKey | null {
  return areaForThing(t);
}

/**
 * LB-1: the "Your Santa Barbara" recap, shown atop the Saved → Been tab. Built
 * entirely from been-marked items on this device (no new infra). Ships with a
 * warm empty/low state because been-data is often sparse.
 *
 * `beenCount` is the true Been total (matches the tab); `beenItems` are the
 * been items we still have published data for, in save order (oldest → newest).
 */
export function MemoryRecap({
  beenCount,
  beenItems,
}: {
  beenCount: number;
  beenItems: Thing[];
}) {
  if (beenCount === 0) {
    return (
      <section className="sbd-recap sbd-recap--empty">
        <div className="sbd-recap__kicker">Your Santa Barbara</div>
        {/* R1 W7.1 (SHR-004). No map, no memory: the product keeps saves on
            this phone and nothing else. Say that. */}
        <h2 className="sbd-recap__title">Your Santa Barbara, so far.</h2>
        <p className="sbd-recap__lead">
          Mark a place you&rsquo;ve been and it shows up here. Everything you save and
          mark stays on this phone.
        </p>
      </section>
    );
  }

  const hoods = [
    ...new Set(beenItems.map(resolveZone).filter((z): z is AreaKey => Boolean(z))),
  ];
  const total = AREAS.length; // the eight areas
  const pct = Math.min(100, Math.round((hoods.length / total) * 100));
  const recent = beenItems.slice(-2).reverse();

  return (
    <section className="sbd-recap">
      <div className="sbd-recap__kicker">Your Santa Barbara</div>
      <h2 className="sbd-recap__title">You&rsquo;re building a real SB.</h2>

      <div className="sbd-recap__big">
        <span className="sbd-recap__n">{beenCount}</span>
        <span className="sbd-recap__nl">
          spot{beenCount === 1 ? "" : "s"} you&rsquo;ve made it to
        </span>
      </div>

      {/* Only show the neighborhood progress when we actually have area data, otherwise a stray "0 of 6" reads as a bug next to a non-zero count
          (e.g. been items that have rolled out of the live feed). */}
      {hoods.length > 0 ? (
        <>
          <div className="sbd-recap__hoods">
            {hoods.slice(0, 5).map((z) => (
              <span key={z} className="sbd-recap__chip">
                {AREA_BY_KEY[z].short}
              </span>
            ))}
          </div>
          <div className="sbd-recap__bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="sbd-recap__barl">
            {hoods.length} of {total} areas explored
          </div>
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <div className="sbd-recap__laneh">Lately</div>
          {recent.map((t) => {
            const z = resolveZone(t);
            return (
              <div key={t.id} className="sbd-recap__tl">
                <span className="sbd-recap__dot" aria-hidden="true" />
                <div>
                  <div className="sbd-recap__tln">{t.title}</div>
                  {z ? <div className="sbd-recap__tld">{AREA_BY_KEY[z].short}</div> : null}
                </div>
              </div>
            );
          })}
        </>
      ) : null}
    </section>
  );
}
