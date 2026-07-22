"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutOfCockpit } from "./actions";
import type { ShellCounts } from "@/lib/todayServer";

const TABS = [
  { href: "/admin/today", label: "Today" },
  { href: "/admin/review", label: "Queue" },
  { href: "/admin/coverage", label: "Coverage" },
  { href: "/admin/catalog", label: "Live catalog" },
  { href: "/admin/heroes", label: "Hero plan" },
  { href: "/admin/edition-draft", label: "Edition draft" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/images", label: "Images" },
  { href: "/admin/flags", label: "Flags" },
] as const;

/** S1 2.3 badges (Decision D1): Queue always shows its count (hot-gold once
 *  nonzero, the primary desk); Edition shows a single hot dot while a
 *  non-skipped draft is pending; every other desk's badge only appears once
 *  there's actually a number worth flagging, quiet desks stay unbadged. */
function badgeFor(href: string, c: ShellCounts): { count: number; hot: boolean } | null {
  switch (href) {
    case "/admin/review": return { count: c.queue, hot: c.queue > 0 };
    case "/admin/coverage": return c.thinCells > 0 ? { count: c.thinCells, hot: false } : null;
    case "/admin/heroes": return c.heroGaps > 0 ? { count: c.heroGaps, hot: false } : null;
    case "/admin/edition-draft": return c.editionPending ? { count: 1, hot: true } : null;
    case "/admin/venues": return c.venueMatches > 0 ? { count: c.venueMatches, hot: false } : null;
    case "/admin/images": return c.imagesBacklog > 0 ? { count: c.imagesBacklog, hot: false } : null;
    case "/admin/flags": return c.openFlags > 0 ? { count: c.openFlags, hot: false } : null;
    default: return null;
  }
}

/** Cockpit v2 shell chrome: pacific-dark topbar + the tab strip. Tabs are
 *  real routes (deep-linkable, back-button works), plain nav semantics
 *  (aria-current, no tablist/tab roles or arrow-key handling to carry) per
 *  the B2 ARIA finding. Counts start as the server layout's snapshot
 *  (refreshed on every navigation by Next re-running the layout), and QW9
 *  additionally re-pulls them on window focus/visibilitychange, no polling. */
export function CockpitTabs({ counts }: { counts: ShellCounts }) {
  const pathname = usePathname();
  const [liveCounts, setLiveCounts] = useState(counts);
  // Sync during render (not an effect) when the server layout hands down a
  // fresh `counts` snapshot on navigation; avoids a cascading-render effect.
  const [syncedCounts, setSyncedCounts] = useState(counts);
  if (counts !== syncedCounts) {
    setSyncedCounts(counts);
    setLiveCounts(counts);
  }

  const refresh = useCallback(() => {
    fetch("/api/admin/cockpit-counts")
      .then((r) => r.json())
      .then((d) => { if (d?.counts) setLiveCounts(d.counts); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span><span className="sb">SB</span> Daymaker</span>
          <span className="kicker">Cockpit</span>
        </div>
        <div className="topbar-stats">
          <div className="tstat"><b>{liveCounts.queue}</b><span>In queue</span></div>
          <div className="tstat dropped"><b>{liveCounts.dropped}</b><span>Dropped</span></div>
          <div className="tstat broken"><b>{liveCounts.down}</b><span>Source down</span></div>
        </div>
        <form action={signOutOfCockpit}>
          <button type="submit" className="signout">Sign out</button>
        </form>
      </div>
      <nav className="tabstrip" aria-label="Cockpit views">
        {TABS.map((t) => {
          const selected = pathname === t.href || pathname.startsWith(t.href + "/");
          const badge = badgeFor(t.href, liveCounts);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="tab"
              aria-current={selected ? "page" : undefined}
            >
              {t.label}
              {badge ? <span className={`tn${badge.hot ? " hot" : ""}`}>{badge.count}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
