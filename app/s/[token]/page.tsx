import type { Metadata } from "next";
import { getSharedStateOnce as getSharedState } from "@/lib/sharesServer";
import { getThingsByIds, ThingsUnreachableError, type Thing } from "@/lib/things";
import { PublicFrame } from "@/components/public/PublicFrame";
import { pageMeta } from "@/lib/seo/pageMeta";
import { SharedListView } from "./SharedListView";

export const dynamic = "force-dynamic";

// R1 W7.3 (SHR-002) / W7.8 (META-001). A description that says what this link
// is, with the count, instead of the sitewide default.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedState(token);
  const n = shared?.kind === "shared_list" ? (shared.payload.ids ?? []).length : 0;
  return pageMeta({
    title: "Shared picks · SB Daymaker",
    ogTitle: n > 0 ? `${n} Santa Barbara pick${n === 1 ? "" : "s"}, shared with you` : "Santa Barbara picks, shared with you",
    description:
      n > 0
        ? `${n} pick${n === 1 ? "" : "s"} shared from SB Daymaker, what's worth doing in Santa Barbara.`
        : "Picks shared from SB Daymaker, what's worth doing in Santa Barbara.",
    noindex: true,
  });
}

export default async function SharedListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedState(token);

  if (!shared || shared.kind !== "shared_list") {
    return (
      <PublicFrame>
        <h1 className="sbd-public__title">Link not found</h1>
        <p className="sbd-public__desc">
          This shared list may have expired or the link is incomplete.
        </p>
      </PublicFrame>
    );
  }

  const ids = shared.payload.ids ?? [];
  // R1 W1.3/W2.2. Resolve the shared ids directly, exactly as /saved does. This
  // used to filter the browse pool, so anything outside it (an evergreen place
  // pushed out by the row ceiling, and after Wave 2 anything archived) silently
  // vanished from the list the sender meant to share. A recipient opening a
  // three-item link should see three items, with the past ones marked as past.
  let byId: Map<string, Thing>;
  try {
    byId = await getThingsByIds(ids);
  } catch (err) {
    if (!(err instanceof ThingsUnreachableError)) throw err;
    // R1 W7.4. Not "empty or expired": the list is fine, the database was not
    // reachable. Say that, and let them try again.
    return (
      <PublicFrame>
        <p className="sbd-public__eyebrow">Shared with you</p>
        <h1 className="sbd-public__title">One moment</h1>
        <p className="sbd-public__desc">
          We couldn&rsquo;t load these picks just now. The link is fine; try again in a moment.
        </p>
      </PublicFrame>
    );
  }
  const items = ids.map((id) => byId.get(id)).filter(Boolean) as Thing[];

  // R1 W7.3. The request's clock, handed down so the client renders the same
  // "already happened" lines the server did.
  const nowMs = Date.now();
  return <SharedListView items={items} nowMs={nowMs} />;
}
