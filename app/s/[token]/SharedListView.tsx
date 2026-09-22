"use client";

import { useEffect, useState } from "react";
import { thingPath } from "@/lib/seo/site";
import { ListCard, Button } from "@/components/ui";
import { PublicFrame } from "@/components/public/PublicFrame";
import { rememberSaveTitles } from "@/lib/saveTitles";
import { useSaves } from "@/components/saves/SavesProvider";
import { trackEvent } from "@/lib/analytics";
import type { Thing } from "@/lib/things";
import { cardBlurb, cardFacts, cardTone, cardVisual, alreadyHappenedLine, imageAlt } from "@/components/explore/derive";

export function SharedListView({ items, nowMs }: { items: Thing[]; nowMs: number }) {
  const { saveMany } = useSaves();
  const [saved, setSaved] = useState(false);

  // Event 4: a shared list was opened (fires on mount; count is stable on this
  // static view, so this is effectively once).
  useEffect(() => {
    trackEvent("share_open", { kind: "list", count: items.length });
  }, [items.length]);

  // R1 W7.3 (SHR-002). The frame carries the wordmark, the explainer and the
  // persistent way in; hearts start empty because nothing here is saved yet.
  return (
    <PublicFrame>
        <p className="sbd-public__eyebrow">Shared with you</p>
        <h1 className="sbd-public__title">A few Santa Barbara picks</h1>
        <p className="sbd-public__desc">
          Someone shared these with you. Save your own copy, no account needed.
        </p>

        {items.length === 0 ? (
          <p className="sbd-public__desc">This list is empty or has expired.</p>
        ) : (
          <div className="sbd-public__list">
            {items.map((t, i) => (
              <ListCard
                key={t.id}
                id={t.id}
                tone={cardTone(i)}
                occasionKey={t.tags[0]}
                title={t.title}
                blurb={cardBlurb(t)}
                when={[alreadyHappenedLine(t, nowMs), cardFacts(t).join(" · ")].filter(Boolean).join(" · ")}
                href={thingPath(t)}
                photo={t.photo_url ?? undefined}
                photoAlt={imageAlt(t)}
                visual={cardVisual(t)}
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
                  rememberSaveTitles(items.map((t) => ({ id: t.id, title: t.title }))); // R1 W7.4
                  saveMany(items.map((t) => t.id));
                  setSaved(true);
                }}
              >
                Save your own copy
              </Button>
            )}
          </div>
        ) : null}
    </PublicFrame>
  );
}
