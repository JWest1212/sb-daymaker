import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Unsubscribe — SB Daymaker",
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
    <main className="sbd-public">
      <div className="sbd-public__inner">
        <p className="sbd-public__eyebrow">Weekend digest</p>
        <h1 className="sbd-public__title">
          {ok ? "You're unsubscribed" : "Link not valid"}
        </h1>
        <p className="sbd-public__desc">
          {ok
            ? "You won't get the digest anymore. No hard feelings — you can resubscribe anytime."
            : "This unsubscribe link is invalid or has expired."}
        </p>
        <Link href="/" className="sbd-public__link">
          Open SB Daymaker →
        </Link>
      </div>
    </main>
  );
}
