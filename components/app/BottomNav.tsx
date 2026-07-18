"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaves } from "@/components/saves/SavesProvider";

// Custom line icons (S2-B): sun-over-mountain (Explore, ties to the hero/brand),
// heart (Saved), compass (Discover SB). Stroke = currentColor so each inherits
// the active/inactive tab color. OS-independent, no emoji.
const ICONS: Record<string, React.ReactNode> = {
  explore: (
    <svg
      className="sbd-nav__ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="3.2" />
      <path d="M3 19 L9 12 L13 16 L17 11 L21 19 Z" />
    </svg>
  ),
  saved: (
    <svg
      className="sbd-nav__ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
    </svg>
  ),
  discover: (
    <svg
      className="sbd-nav__ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9 L11 11 L9 15 L13 13 Z" />
    </svg>
  ),
  // Plan (v9.1): an itinerary timeline, a vertical spine with stop-dots and stop
  // lines, echoing the day-spine the Plan surface builds.
  plan: (
    <svg
      className="sbd-nav__ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4.5 V19.5" />
      <path d="M10.5 6.5 H19" />
      <path d="M10.5 12 H19" />
      <path d="M10.5 17.5 H16.5" />
      <circle cx="6" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="17.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const TABS = [
  { href: "/", key: "explore", label: "Explore" },
  { href: "/saved", key: "saved", label: "Saved" },
  { href: "/discover", key: "discover", label: "Discover SB" },
] as const;

/**
 * Bottom navigation, three browse tabs (Explore · Saved · Discover SB) plus the
 * Plan create-action (v9.1), each an icon + label cell.
 */
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
              {ICONS[tab.key]}
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
