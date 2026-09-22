"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTour } from "@/components/tour/useTour";
import { SBIcon } from "@/components/ui";

/**
 * R1 W7.8 (A11Y-005). The same landmark set on every page.
 *
 * Explore had a footer (the signup block, the trust line, Submit, How it
 * works) and nothing else did, so landmark navigation changed from page to
 * page. Now this is the ONE footer, on every page including Explore: the trust
 * line and the same two links. Explore keeps only its signup block, as a
 * section of the feed.
 */
export function PageFooter({ showTour = true }: { showTour?: boolean }) {
  const pathname = usePathname();
  const { openTour } = useTour();
  return (
    <footer className="sbd-pagefoot">
      <p className="sbd-foot__trust">No accounts, no login wall. Saves live on your device.</p>
      <nav className="sbd-pagefoot__nav" aria-label="More">
        {pathname !== "/submit" ? (
          <Link href="/submit" className="sbd-foot__submit sbd-pagefoot__link">
            ＋ Submit an event or business
          </Link>
        ) : null}
        {/* Only where a tour exists to open: the Plan shell deliberately has
            no TourProvider (it must not auto-open over a half-built day). */}
        {showTour ? (
        <button
          type="button"
          className="sbd-tour-replay sbd-tour-replay--footer"
          aria-haspopup="dialog"
          onClick={openTour}
        >
          <SBIcon name="reset" size={14} />
          How SB Daymaker works
        </button>
        ) : null}
      </nav>
    </footer>
  );
}
