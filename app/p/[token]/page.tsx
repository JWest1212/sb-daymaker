import type { Metadata } from "next";
import { getSharedStateOnce as getSharedState } from "@/lib/sharesServer";
import type { SharedPlanPayload } from "@/lib/plan/types";
import { PublicFrame } from "@/components/public/PublicFrame";
import { pageMeta } from "@/lib/seo/pageMeta";
import { SharedPlanView } from "./SharedPlanView";

export const dynamic = "force-dynamic";

// R1 W7.3 (SHR-002) / W7.8 (META-001). The description names the plan and its
// size, not the sitewide default.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedState(token);
  const payload = shared?.kind === "shared_plan" ? (shared.payload as SharedPlanPayload) : null;
  const n = payload?.stops.length ?? 0;
  return pageMeta({
    title: payload ? `${payload.title} · SB Daymaker` : "Shared day plan · SB Daymaker",
    description: n > 0 ? `A ${n}-stop Santa Barbara day shared from SB Daymaker.` : "A Santa Barbara day shared from SB Daymaker.",
    noindex: true,
  });
}

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedState(token);

  if (!shared || shared.kind !== "shared_plan") {
    return (
      <PublicFrame
        explainer="A friend's day plan from SB Daymaker, what's worth doing in Santa Barbara."
        wayIn={{ href: "/plan", label: "Make your own day" }}
      >
        <h1 className="sbd-public__title">Plan not found</h1>
        <p className="sbd-public__desc">
          This shared plan may have expired or the link is incomplete.
        </p>
      </PublicFrame>
    );
  }

  const payload = shared.payload as SharedPlanPayload;
  return <SharedPlanView payload={payload} />;
}
