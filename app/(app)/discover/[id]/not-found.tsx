import { SBIcon } from "@/components/ui/SBIcon";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

/** R1 W6.7 (EDG-001). As the thing route: the same words, but with a real 404
 *  status behind them. */
export default function GuideNotFound() {
  return (
    <div style={{ paddingTop: "var(--space-6)" }}>
      <div className="sbd-backrow">
        <Link href="/discover" className="sbd-backrow__btn"><SBIcon name="chevron" rotate="left" size={14} /> Discover SB</Link>
      </div>
      <EmptyState
        titleAs="h1"
        icon={<SBIcon name="compass" size={28} strokeWidth={1.75} />}
        title="Guide not found"
        message="This guide may have been unpublished. Head back to Discover SB."
      />
    </div>
  );
}
