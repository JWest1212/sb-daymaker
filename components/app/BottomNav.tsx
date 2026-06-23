"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaves } from "@/components/saves/SavesProvider";

const TABS = [
  { href: "/", label: "Explore", icon: "🌅" },
  { href: "/saved", label: "Saved", icon: "❤️" },
  { href: "/discover", label: "Discover SB", icon: "🧭" },
] as const;

/** Bottom navigation — exactly three tabs (v9: Explore · Saved · Discover SB). */
export function BottomNav() {
  const pathname = usePathname();
  const { counts } = useSaves();

  return (
    <nav className="sbd-nav" aria-label="Main">
      {TABS.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="sbd-nav__btn"
            aria-current={active ? "page" : undefined}
          >
            <span className="sbd-nav__icon" aria-hidden="true">
              {tab.icon}
              {tab.href === "/saved" && counts.total > 0 ? (
                <span className="sbd-nav__badge">{counts.total}</span>
              ) : null}
            </span>
            <span className="sbd-nav__label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
