import type { Metadata } from "next";
import Link from "next/link";
import { PublicFrame } from "@/components/public/PublicFrame";

export const metadata: Metadata = {
  title: "Offline · SB Daymaker",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  // R1 W7.4. Same frame as the recipient pages: wordmark, landmarks, way in.
  return (
    <PublicFrame explainer="SB Daymaker, what's worth doing in Santa Barbara." wayIn={{ href: "/saved", label: "Open Saved" }}>
        <p className="sbd-public__eyebrow">No connection</p>
        <h1 className="sbd-public__title">You&rsquo;re offline</h1>
        <p className="sbd-public__desc">
          Santa Barbara isn&rsquo;t going anywhere. Reconnect and we&rsquo;ll
          pick up right where you left off, your saved list lives on this device
          either way.
        </p>
        <Link href="/" className="sbd-public__link">
          Try again →
        </Link>
    </PublicFrame>
  );
}
