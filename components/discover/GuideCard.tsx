import Link from "next/link";
import type { Guide } from "@/lib/guides";
import { guidePath } from "@/lib/seo/site";

/** A guide entry on the Discover SB list, links to the guide page. */
export function GuideCard({ guide }: { guide: Guide }) {
  const isTheme = guide.kind === "theme";
  return (
    <Link
      /* R1 W6.7 (DSC-004). The slug, not the UUID. The Discover list was the
         last place still handing out a raw id, so a guide shared from here
         arrived at a URL that says nothing about what it is. */
      href={guidePath(guide)}
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
