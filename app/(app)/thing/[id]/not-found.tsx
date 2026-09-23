import { SBIcon } from "@/components/ui/SBIcon";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

/**
 * R1 W6.7 (EDG-001). The not-found page for a listing URL.
 *
 * Same words the page used to render inline, but reached through notFound(), so
 * the response carries a real 404 status. Rendering "Not found" with a 200 tells
 * a crawler the page exists and is fine, which is how dead listings stay in
 * search results.
 *
 * Lives in the route segment, so it keeps the (app) shell: header, nav, column.
 */
export default function ThingNotFound() {
  return (
    <div style={{ paddingTop: "var(--space-6)" }}>
      <div className="sbd-backrow">
        <Link href="/" className="sbd-backrow__btn"><SBIcon name="chevron" rotate="left" size={14} /> Explore</Link>
      </div>
      <EmptyState
        titleAs="h1"
        icon={<SBIcon name="search" size={28} strokeWidth={1.75} />}
        title="Not found"
        message="This listing may have been removed. Head back to Explore."
      />
    </div>
  );
}
