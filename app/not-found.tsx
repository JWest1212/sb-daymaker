import Link from "next/link";
import type { Metadata } from "next";
import BrandHeader from "@/components/BrandHeader";
import { BottomNav } from "@/components/app/BottomNav";
import { PageFooter } from "@/components/app/PageFooter";

/**
 * R1 W6.7 (EDG-001). The branded not-found page.
 *
 * A root not-found renders inside the ROOT layout only, so it does not inherit
 * the (app) group's shell. The header and the bottom nav are rendered here
 * explicitly. Before this, a bad URL dropped the visitor onto Next's bare
 * default: black text on white, no header, no nav, and no way back that did not
 * involve editing the address bar.
 *
 * Three ways out, because a 404 has three likely causes: a typo (Explore), a
 * link to something that has since been taken down (Saved, where their own list
 * still is), and an old bookmark (Discover SB, which is evergreen).
 */
export const metadata: Metadata = {
  title: "Page not found · SB Daymaker",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="sbd-shell">
      <a href="#main" className="sbd-skip">
        Skip to content
      </a>
      <BrandHeader />
      <main id="main" className="sbd-shell__main">
        <div className="sbd-notfound">
          <p className="sbd-notfound__code">404</p>
          <h1 className="sbd-notfound__title">We could not find that page</h1>
          <p className="sbd-notfound__msg">
            The link may be old, or the event may have finished and been put away. Everything
            happening in Santa Barbara right now is one tap away.
          </p>
          <div className="sbd-notfound__ways">
            <Link href="/" className="sbd-notfound__go">
              Back to Explore
            </Link>
            <Link href="/saved" className="sbd-notfound__alt">
              Saved
            </Link>
            <Link href="/discover" className="sbd-notfound__alt">
              Discover SB
            </Link>
          </div>
        </div>
      </main>
      <PageFooter />
      <BottomNav />
    </div>
  );
}
