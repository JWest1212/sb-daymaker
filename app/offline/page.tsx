import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline — SB Daymaker",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="sbd-public">
      <div className="sbd-public__inner">
        <p className="sbd-public__eyebrow">No connection</p>
        <h1 className="sbd-public__title">You&rsquo;re offline</h1>
        <p className="sbd-public__desc">
          Santa Barbara isn&rsquo;t going anywhere. Reconnect and we&rsquo;ll
          pick up right where you left off — your saved list lives on this device
          either way.
        </p>
        <Link href="/" className="sbd-public__link">
          Try again →
        </Link>
      </div>
    </main>
  );
}
