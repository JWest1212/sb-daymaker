import type { Metadata } from "next";
import { getPublishedGuides } from "@/lib/guides";
import { GuideCard } from "@/components/discover/GuideCard";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Discover SB — SB Daymaker" };
export const revalidate = 600; // ISR — refresh published content every 10 min

export default async function DiscoverPage() {
  const guides = await getPublishedGuides();
  const hoods = guides.filter((g) => g.kind === "neighborhood");
  const themes = guides.filter((g) => g.kind === "theme");

  if (guides.length === 0) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
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
      {hoods.length > 0 ? (
        <section>
          <div className="sbd-disc__head">
            <div className="sbd-disc__eyebrow">By neighborhood</div>
            <h2 className="sbd-disc__title">Know the city block by block</h2>
          </div>
          {hoods.map((g) => (
            <GuideCard key={g.id} guide={g} />
          ))}
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
