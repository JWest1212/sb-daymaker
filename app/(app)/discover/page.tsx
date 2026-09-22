import type { Metadata } from "next";
import { getPublishedGuides } from "@/lib/guides";
import { GuideCard } from "@/components/discover/GuideCard";
import { EmptyState } from "@/components/ui";
import { pageMeta } from "@/lib/seo/pageMeta";

export const metadata: Metadata = pageMeta({
  title: "Discover SB · Neighborhood & Theme Guides · SB Daymaker",
  description:
    "Local guides to Santa Barbara's neighborhoods and themes: the Funk Zone, State Street, and more, with the live happenings scoped to each.",
  path: "/discover",
});
export const revalidate = 300; // R1 W1.6, ISR safety net behind /api/revalidate

export default async function DiscoverPage() {
  const guides = await getPublishedGuides();
  const hoods = guides.filter((g) => g.kind === "neighborhood");
  const themes = guides.filter((g) => g.kind === "theme");

  if (guides.length === 0) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
        <h1 className="sbd-visually-hidden">Discover SB</h1>
        <EmptyState
          icon="🧭"
          title="Discover SB"
          message="Guides are on the way: neighborhood wanders and themed lineups, each surfacing what's happening around town."
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
            <div className="sbd-disc__eyebrow">By neighborhood</div>
            <h2 className="sbd-disc__title">Discover the city block by block</h2>
          </div>
          {hoods.map((g) => (
            <GuideCard key={g.id} guide={g} />
          ))}
          <div className="sbd-disc__more">
            <span className="sbd-disc__more-icon" aria-hidden="true">🧭</span>
            <p className="sbd-disc__more-text">More guides are on their way to help you discover Santa Barbara.</p>
          </div>
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
