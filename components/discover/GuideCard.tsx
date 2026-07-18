import Link from "next/link";
import type { Guide } from "@/lib/guides";

/** A guide entry on the Discover SB list, links to the guide page. */
export function GuideCard({ guide }: { guide: Guide }) {
  const isTheme = guide.kind === "theme";
  return (
    <Link
      href={`/discover/${guide.id}`}
      className={`sbd-guidecard sbd-guidecard--${isTheme ? "theme" : "hood"}`}
    >
      <span className="sbd-guidecard__overlay" aria-hidden="true" />
      <span className="sbd-guidecard__c">
        {isTheme ? (
          <span className="sbd-guidecard__badge">✦ For you</span>
        ) : null}
        {guide.kicker ? (
          <span className="sbd-guidecard__kicker">{guide.kicker}</span>
        ) : null}
        <span className="sbd-guidecard__title">{guide.title}</span>
        {guide.intro ? (
          <span className="sbd-guidecard__desc">{guide.intro}</span>
        ) : null}
      </span>
    </Link>
  );
}
