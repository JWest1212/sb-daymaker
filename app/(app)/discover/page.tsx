import { SBIcon } from "@/components/ui/SBIcon";
import type { Metadata } from "next";
import { getPublishedGuides, nextUpcomingGuide } from "@/lib/guides";
import { GuideCard } from "@/components/discover/GuideCard";
import { EmptyState } from "@/components/ui";
import { pageMeta } from "@/lib/seo/pageMeta";

export const metadata: Metadata = pageMeta({
  title: "Discover SB · Local Guides · SB Daymaker",
  description:
    "Local walking guides to Santa Barbara: the Funk Zone and State Street, with what's on along each route right now.",
  path: "/discover",
});
export const revalidate = 300; // R1 W1.6, ISR safety net behind /api/revalidate

export default async function DiscoverPage() {
  const guides = await getPublishedGuides();
  const hoods = guides.filter((g) => g.kind === "neighborhood");
  const themes = guides.filter((g) => g.kind === "theme");
  const upcoming = nextUpcomingGuide(guides);

  if (guides.length === 0) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
        <h1 className="sbd-visually-hidden">Discover SB</h1>
        <EmptyState
          icon={<SBIcon name="compass" size={28} strokeWidth={1.75} />}
          title="Discover SB"
          message="The first guides are being written. Check back soon."
        />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: "var(--space-4)" }}>
      {/* R1 W7.8 (A11Y-002, same finding class as Saved). The page's own title
          in the heading outline; the sections below were h2s under nothing. */}
      <h1 className="sbd-saved__h1">Discover SB</h1>
      {hoods.length > 0 ? (
        <section>
          <div className="sbd-disc__head">
            {/* R1 W8.5. "Guides": State Street is a street, not a neighborhood,
                and no field can tell the two apart, so the eyebrow says what
                both are. */}
            <div className="sbd-disc__eyebrow">Guides</div>
            <h2 className="sbd-disc__title">Discover the city block by block</h2>
          </div>
          {hoods.map((g) => (
            <GuideCard key={g.id} guide={g} />
          ))}
          {/* R1 W8.5 (DSC-005). A specific promise or none: the next guide and
              its month, from guides.content.upcoming, hidden when unset. */}
          {upcoming ? (
            <div className="sbd-disc__more" role="note">
              <span className="sbd-disc__more-icon" aria-hidden="true"><SBIcon name="compass" size={18} /></span>
              <p className="sbd-disc__more-text">
                Next guide: {upcoming.title}, out in {upcoming.monthLabel}.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {themes.length > 0 ? (
        <section>
          <div className="sbd-disc__head">
            <div className="sbd-disc__eyebrow">By theme</div>
            <h2 className="sbd-disc__title">Ways to spend a day</h2>
          </div>
          {themes.map((g) => (
            <GuideCard key={g.id} guide={g} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
