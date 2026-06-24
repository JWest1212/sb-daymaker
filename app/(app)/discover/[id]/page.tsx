import type { Metadata } from "next";
import Link from "next/link";
import { getGuide, matchGuideThings } from "@/lib/guides";
import { getPublishedThings } from "@/lib/things";
import { cascade } from "@/lib/explore";
import { CascadeFeed } from "@/components/explore/CascadeFeed";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Guide — SB Daymaker" };
export const revalidate = 600; // ISR — refresh published content every 10 min

export default async function GuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, things] = await Promise.all([getGuide(id), getPublishedThings()]);

  if (!result) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
        <Link href="/discover" className="sbd-backlink">
          ‹ Discover SB
        </Link>
        <EmptyState
          icon="🧭"
          title="Guide not found"
          message="This guide may have been unpublished. Head back to Discover SB."
        />
      </div>
    );
  }

  const { guide, stops } = result;
  const happenings = cascade(matchGuideThings(guide, things));
  const isTheme = guide.kind === "theme";
  const eyebrow = isTheme
    ? `Happening · ${guide.kicker ?? "Theme"}`
    : `Happening in ${guide.title}`;

  return (
    <div className="sbd-guide">
      <Link href="/discover" className="sbd-backlink">
        ‹ Discover SB
      </Link>

      <div className={`sbd-guide-hero sbd-guidecard--${isTheme ? "theme" : "hood"}`}>
        <span className="sbd-guidecard__overlay" aria-hidden="true" />
        <span className="sbd-guidecard__c">
          <span className="sbd-guidecard__kicker">
            {isTheme ? "Theme guide" : "Neighborhood guide"}
          </span>
          <span className="sbd-guidecard__title">{guide.title}</span>
        </span>
      </div>

      {guide.intro ? <p className="sbd-guide__intro">{guide.intro}</p> : null}

      {stops.length > 0 ? (
        <section className="sbd-guide__section">
          <div className="sbd-disc__head">
            <div className="sbd-disc__eyebrow">How to do it</div>
          </div>
          <ol className="sbd-guide__stops">
            {stops.map((s, i) => (
              <li key={s.position} className="sbd-stop">
                <span className="sbd-stop__num">{i + 1}</span>
                <span className="sbd-stop__body">
                  <span className="sbd-stop__name">{s.label}</span>
                  {s.note ? <span className="sbd-stop__note">{s.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="sbd-guide__section">
        <div className="sbd-disc__head">
          <div className="sbd-disc__eyebrow">📅 {eyebrow}</div>
          <h2 className="sbd-disc__title">What&rsquo;s on right now</h2>
        </div>
        {happenings.length > 0 ? (
          <CascadeFeed items={happenings} />
        ) : (
          <EmptyState
            icon="🌙"
            message="Nothing live in this guide right now — check back soon."
          />
        )}
      </section>
    </div>
  );
}
