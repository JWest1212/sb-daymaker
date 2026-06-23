"use client";

import { useState } from "react";
import Link from "next/link";
import { ListCard, Button } from "@/components/ui";
import { useSaves } from "@/components/saves/SavesProvider";
import type { Thing } from "@/lib/things";
import { cardBlurb, cardFacts, cardTag, cardTone } from "@/components/explore/derive";

export function SharedListView({ items }: { items: Thing[] }) {
  const { saveMany } = useSaves();
  const [saved, setSaved] = useState(false);

  return (
    <main className="sbd-public">
      <div className="sbd-public__inner">
        <p className="sbd-public__eyebrow">Shared with you</p>
        <h1 className="sbd-public__title">A few Santa Barbara picks</h1>
        <p className="sbd-public__desc">
          Someone shared these with you. Save your own copy — no account needed.
        </p>

        {items.length === 0 ? (
          <p className="sbd-public__desc">This list is empty or has expired.</p>
        ) : (
          <div className="sbd-public__list">
            {items.map((t, i) => (
              <ListCard
                key={t.id}
                tone={cardTone(i)}
                tag={cardTag(t)}
                title={t.title}
                blurb={cardBlurb(t)}
                meta={cardFacts(t).join(" · ")}
              />
            ))}
          </div>
        )}

        {items.length > 0 ? (
          <div className="sbd-public__actions">
            {saved ? (
              <p className="sbd-public__saved">
                ✓ Saved to your device. Open Saved to see them.
              </p>
            ) : (
              <Button
                variant="cta"
                block
                onClick={() => {
                  saveMany(items.map((t) => t.id));
                  setSaved(true);
                }}
              >
                Save your own copy
              </Button>
            )}
            <Link href="/" className="sbd-public__link">
              Open SB Daymaker →
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
