import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { PublicFrame } from "@/components/public/PublicFrame";
import { CADENCE_LINE } from "@/lib/edition/cadence";

export const metadata: Metadata = {
  title: "Unsubscribe · SB Daymaker",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let ok = false;
  if (token) {
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.rpc("unsubscribe", { p_token: token });
      ok = Boolean(data);
    }
  }

  return (
    // R1 W7.8 (A11Y-005): the shared frame, so this page has the same landmarks
    // as every other. The cadence line is the one string (W8, EML-002).
    <PublicFrame explainer="SB Daymaker, what's worth doing in Santa Barbara.">
        <p className="sbd-public__eyebrow">Weekend digest · {CADENCE_LINE}</p>
        <h1 className="sbd-public__title">
          {ok ? "You're unsubscribed" : "Link not valid"}
        </h1>
        <p className="sbd-public__desc">
          {ok
            ? "You won't get the digest anymore. No hard feelings, you can resubscribe anytime."
            : "This unsubscribe link is invalid or has expired."}
        </p>
    </PublicFrame>
  );
}
