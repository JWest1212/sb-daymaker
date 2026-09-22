import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { PublicFrame } from "@/components/public/PublicFrame";
import { CADENCE_LINE } from "@/lib/edition/cadence";

export const metadata: Metadata = {
  title: "Confirm subscription · SB Daymaker",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let ok = false;
  if (token) {
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.rpc("confirm_subscription", { p_token: token });
      ok = Boolean(data);
    }
  }

  return (
    // R1 W7.8 (A11Y-005): the shared frame, so this page has the same landmarks
    // as every other. The cadence line is the one string (W8, EML-002).
    <PublicFrame explainer="SB Daymaker, what's worth doing in Santa Barbara.">
        <p className="sbd-public__eyebrow">Weekend digest · {CADENCE_LINE}</p>
        <h1 className="sbd-public__title">
          {ok ? "You're in." : "Link not valid"}
        </h1>
        <p className="sbd-public__desc">
          {ok
            ? `Your subscription is confirmed. See you in your inbox. ${CADENCE_LINE}.`
            : "This confirmation link is invalid or has expired. Try signing up again."}
        </p>
    </PublicFrame>
  );
}
