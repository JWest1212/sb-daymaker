import type { Metadata } from "next";
import Link from "next/link";
import { SubmitForm } from "@/components/submit/SubmitForm";
import { pageMeta } from "@/lib/seo/pageMeta";

// R1 W7.5 (FRM-002) / W7.8 (META-001). Titled after the heading on the page,
// with a description of its own and og values that match.
export const metadata: Metadata = pageMeta({
  title: "Suggest an event or business · SB Daymaker",
  description:
    "Know a Santa Barbara happening, show, or spot worth sharing? Tell SB Daymaker.",
  path: "/submit",
});

export default function SubmitPage() {
  return (
    <>
      <div className="sbd-backrow">
        <Link href="/" className="sbd-backrow__btn">‹ Explore</Link>
      </div>
      <div style={{ paddingTop: "var(--space-4)" }}>
      <h1 className="sbd-detail__title">Suggest an event or business</h1>
      <p className="sbd-detail__body">
        Know a happening, show, or spot worth sharing? Add it here.
      </p>
      {/* Gate 5 · G5.4, expectation-setting: what happens next + how picks are made. */}
      <ul className="sbd-submit-expect" aria-label="What happens after you submit">
        <li>Every submission is checked before anything is published.</li>
        <li>We favor things that are specific, findable, and actually worth the trip. Not everything gets published.</li>
        <li>Spot a mistake on a listing that already exists? Use the &ldquo;Something off?&rdquo; link on that page instead.</li>
      </ul>
      <SubmitForm />
      </div>
    </>
  );
}
