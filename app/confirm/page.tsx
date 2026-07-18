import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

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
    <main className="sbd-public">
      <div className="sbd-public__inner">
        <p className="sbd-public__eyebrow">Weekend digest</p>
        <h1 className="sbd-public__title">
          {ok ? "You're in! 🎉" : "Link not valid"}
        </h1>
        <p className="sbd-public__desc">
          {ok
            ? "Your subscription is confirmed. See you in your inbox twice a week."
            : "This confirmation link is invalid or has expired. Try signing up again."}
        </p>
        <Link href="/" className="sbd-public__link">
          Open SB Daymaker →
        </Link>
      </div>
    </main>
  );
}
