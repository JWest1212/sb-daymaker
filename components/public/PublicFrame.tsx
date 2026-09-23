import Link from "next/link";
import type { ReactNode } from "react";
import "@/components/brand-header.css";

/**
 * R1 W7.3 (SHR-002). The frame every recipient page sits in: /s, /p, /r and
 * their not-found branches.
 *
 * A friend opening a shared link used to land on a page that never said what
 * SB Daymaker is: no mark, no header, one line reading "Someone shared these
 * with you". This puts the same wordmark the app wears at the top, one line
 * saying what the site is, and a way in that is always there, with the four
 * landmarks (header, main, nav, footer) a screen reader expects on every page.
 */
export const PUBLIC_EXPLAINER = "A friend's picks from SB Daymaker, what's worth doing in Santa Barbara.";

export function PublicFrame({
  explainer = PUBLIC_EXPLAINER,
  children,
  wayIn = { href: "/", label: "Open SB Daymaker" },
}: {
  /** The one line under the mark. Defaults to the shared-picks line. */
  explainer?: string;
  children: ReactNode;
  /** The persistent link at the foot of the page. */
  wayIn?: { href: string; label: string };
}) {
  return (
    <div className="sbd-public">
      <a href="#main" className="sbd-skip">Skip to content</a>
      <header className="sbd-public__hd">
        <div className="sbd-public__inner">
          <Link href="/" className="sbd-brandhdr__logo" aria-label="Santa Barbara Daymaker, Explore">
            <span className="sbd-brandhdr__mark" aria-hidden="true">
              <span className="sbd-brandhdr__glint" />
              <span className="sbd-brandhdr__sun" />
            </span>
            <span className="sbd-brandhdr__word">
              <span className="sbd-brandhdr__eyebrow">Santa Barbara</span>
              <span className="sbd-brandhdr__wordmark">
                Day<b>maker</b>
              </span>
            </span>
          </Link>
          <p className="sbd-public__explainer">{explainer}</p>
        </div>
        <div className="sbd-brandhdr__horizon" aria-hidden="true" />
      </header>
      <main id="main" className="sbd-public__inner sbd-public__main">
        {children}
      </main>
      <footer className="sbd-public__ft">
        <nav className="sbd-public__inner" aria-label="SB Daymaker">
          <Link href={wayIn.href} className="sbd-public__wayin">
            {wayIn.label}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
