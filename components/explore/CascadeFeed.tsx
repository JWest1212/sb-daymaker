"use client";

import { PickCard, ListCard, EmptyState } from "@/components/ui";
import type { Thing } from "@/lib/things";
import { TIER_META } from "@/lib/explore";
import { useSaves } from "@/components/saves/SavesProvider";
import { cardBlurb, cardFacts, cardPlace, cardTag, cardTone } from "./derive";

export function CascadeFeed({ items }: { items: Thing[] }) {
  const { isSaved, toggle } = useSaves();

  if (items.length === 0) {
    return (
      <div style={{ marginTop: "var(--space-6)" }}>
        <EmptyState
          icon="🔍"
          message="Nothing matches that combination right now. Try another vibe or a wider time horizon."
        />
      </div>
    );
  }

  const tiers = [1, 2, 3] as const;

  return (
    <>
      {tiers.map((tier) => {
        const group = items.filter((t) => t.happening_tier === tier);
        if (group.length === 0) return null;
        const meta = TIER_META[tier];
        return (
          <section key={meta.key} className="sbd-feed-section">
            <h2 className="sbd-feed-section__title">{meta.title}</h2>
            <div className="sbd-feed-section__list">
              {group.map((t, i) =>
                tier === 1 ? (
                  <PickCard
                    key={t.id}
                    tone={cardTone(i)}
                    tag={cardTag(t)}
                    place={cardPlace(t)}
                    title={t.title}
                    blurb={cardBlurb(t)}
                    facts={cardFacts(t)}
                    saved={isSaved(t.id)}
                    onToggleSave={() => toggle(t.id)}
                  />
                ) : (
                  <ListCard
                    key={t.id}
                    tone={cardTone(i)}
                    tag={cardTag(t)}
                    title={t.title}
                    blurb={cardBlurb(t)}
                    meta={cardFacts(t).join(" · ")}
                    saved={isSaved(t.id)}
                    onToggleSave={() => toggle(t.id)}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
