import type { Metadata } from "next";
import Link from "next/link";
import { SubmitForm } from "@/components/submit/SubmitForm";

export const metadata: Metadata = { title: "Submit — SB Daymaker" };

export default function SubmitPage() {
  return (
    <>
      <div className="sbd-backrow">
        <Link href="/" className="sbd-backrow__btn">‹ Explore</Link>
      </div>
      <div style={{ paddingTop: "var(--space-4)" }}>
      <h1 className="sbd-detail__title">Suggest an event or business</h1>
      <p className="sbd-detail__body">
        Know a happening, show, or spot worth sharing? Add it here — the best
        submissions get featured in the weekend digest.
      </p>
      <SubmitForm />
      </div>
    </>
  );
}
