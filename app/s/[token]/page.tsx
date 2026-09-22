import type { Metadata } from "next";
import Link from "next/link";
import { getSharedState } from "@/lib/shares";
import { getThingsByIds, type Thing } from "@/lib/things";
import { SharedListView } from "./SharedListView";

export const metadata: Metadata = {
  title: "Shared picks · SB Daymaker",
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
  // R1 W1.3/W2.2. Resolve the shared ids directly, exactly as /saved does. This
  // used to filter the browse pool, so anything outside it (an evergreen place
  // pushed out by the row ceiling, and after Wave 2 anything archived) silently
  // vanished from the list the sender meant to share. A recipient opening a
  // three-item link should see three items, with the past ones marked as past.
  const byId = await getThingsByIds(ids);
  const items = ids.map((id) => byId.get(id)).filter(Boolean) as Thing[];

  return <SharedListView items={items} />;
}
