"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Counts { queue: number; dropped: number; down: number; }

const TABS = [
  { href: "/admin/review", label: "Queue", showCount: true },
  { href: "/admin/coverage", label: "Coverage", showCount: false },
  { href: "/admin/catalog", label: "Live catalog", showCount: false },
  { href: "/admin/heroes", label: "Hero plan", showCount: false },
  { href: "/admin/edition-draft", label: "Edition draft", showCount: false },
  { href: "/admin/venues", label: "Venues", showCount: false },
  { href: "/admin/images", label: "Images", showCount: false },
  { href: "/admin/flags", label: "Flags", showCount: false },
] as const;

/** Cockpit v2 shell chrome: pacific-dark topbar + the four-tab strip.
 *  Tabs are real routes (deep-linkable, back-button works). Counts are the
 *  latest-run snapshot from the server layout, they refresh on navigation. */
export function CockpitTabs({ counts }: { counts: Counts }) {
  const pathname = usePathname();
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span><span className="sb">SB</span> Daymaker</span>
          <span className="kicker">Cockpit</span>
        </div>
        <div className="topbar-stats">
          <div className="tstat"><b>{counts.queue}</b><span>In queue</span></div>
          <div className="tstat dropped"><b>{counts.dropped}</b><span>Dropped</span></div>
          <div className="tstat broken"><b>{counts.down}</b><span>Source down</span></div>
        </div>
      </div>
      <div className="tabstrip" role="tablist" aria-label="Cockpit views">
        {TABS.map((t) => {
          const selected = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className="tab"
              role="tab"
              aria-selected={selected}
            >
              {t.label}
              {t.showCount ? <span className="tn">{counts.queue}</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
