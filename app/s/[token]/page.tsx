import type { Metadata } from "next";
import Link from "next/link";
import { getSharedState } from "@/lib/shares";
import { getPublishedThings, type Thing } from "@/lib/things";
import { SharedListView } from "./SharedListView";

export const metadata: Metadata = {
  title: "Shared picks — SB Daymaker",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SharedListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedState(token);

  if (!shared || shared.kind !== "shared_list") {
    return (
      <main className="sbd-public">
        <div className="sbd-public__inner">
          <h1 className="sbd-public__title">Link not found</h1>
          <p className="sbd-public__desc">
            This shared list may have expired or the link is incomplete.
          </p>
          <Link href="/" className="sbd-public__link">
            Open SB Daymaker →
          </Link>
        </div>
      </main>
    );
  }

  const ids = shared.payload.ids ?? [];
  const all = await getPublishedThings();
  const byId = new Map(all.map((t) => [t.id, t]));
  const items = ids.map((id) => byId.get(id)).filter(Boolean) as Thing[];

  return <SharedListView items={items} />;
}
