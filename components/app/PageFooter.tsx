"use client";

import { SBIcon } from "@/components/ui/SBIcon";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTour } from "@/components/tour/useTour";
import { HOW_IT_WORKS, SUGGEST } from "@/lib/strings";

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
            <SBIcon name="plus" size={14} /> {SUGGEST}
          </Link>
        ) : null}
        {showTour ? (
        <button
          type="button"
          className="sbd-howitworks sbd-howitworks--footer"
          aria-haspopup="dialog"
          onClick={openTour}
        >
          {HOW_IT_WORKS}
        </button>
        ) : null}
      </nav>
    </footer>
  );
}
