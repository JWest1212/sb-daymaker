import type { Metadata } from "next";
import Link from "next/link";
import { getSharedState } from "@/lib/shares";
import type { SharedPlanPayload } from "@/lib/plan/types";
import { SharedPlanView } from "./SharedPlanView";

export const metadata: Metadata = {
  title: "Shared day plan · SB Daymaker",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedState(token);

  if (!shared || shared.kind !== "shared_plan") {
    return (
      <main className="sbd-public">
        <div className="sbd-public__inner">
          <h1 className="sbd-public__title">Plan not found</h1>
          <p className="sbd-public__desc">
            This shared plan may have expired or the link is incomplete.
          </p>
          <Link href="/plan" className="sbd-public__link">
            Make your own day →
          </Link>
        </div>
      </main>
    );
  }

  const payload = shared.payload as SharedPlanPayload;
  return <SharedPlanView payload={payload} />;
}
