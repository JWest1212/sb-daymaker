"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  Tag,
  Chip,
  SegmentedControl,
  SaveHeart,
  PickCard,
  ListCard,
  BottomSheet,
  Skeleton,
  SkeletonCard,
  EmptyState,
} from "@/components/ui";

const TAGS = [
  "Date Night",
  "Family Day",
  "Outdoors & Active",
  "Wine & Food",
  "Free in SB",
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: "var(--space-10)" }}>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--text-link)",
          margin: "0 0 var(--space-1)",
        }}
      >
        {title}
      </p>
      {description ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            margin: "0 0 var(--space-4)",
          }}
        >
          {description}
        </p>
      ) : (
        <div style={{ height: "var(--space-3)" }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {children}
      </div>
    </section>
  );
}

export function KitchenSink() {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(["Date Night"]),
  );
  const [horizon, setHorizon] = useState("week");
  const [saved, setSaved] = useState<Record<string, boolean>>({
    pick: true,
    list: false,
    heart: false,
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  const toggleTag = (t: string) =>
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const toggleSave = (key: string) =>
    setSaved((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        padding: "var(--space-8) var(--space-5) var(--space-16)",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--text-link)",
              margin: 0,
            }}
          >
            SB Daymaker · design system
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: "var(--weight-black)",
              fontSize: "var(--text-2xl)",
              color: "var(--accent)",
              margin: "var(--space-1) 0 0",
            }}
          >
            Kitchen Sink
          </h1>
          <p
            style={{
              fontSize: "var(--text-base)",
              color: "var(--text-muted)",
              lineHeight: "var(--leading-body)",
              margin: "var(--space-2) 0 0",
            }}
          >
            Every reusable component, built from the tokens. This page is hidden
            and just for review.
          </p>
        </header>

        {/* BUTTONS */}
        <Section
          title="Buttons"
          description="CTA (terracotta), primary (pacific), secondary (outline), plus disabled."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <Button variant="cta" icon="🎟️">
              Get tickets
            </Button>
            <Button variant="primary">Save to my list</Button>
            <Button variant="secondary">Share</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <Button variant="cta" block icon="✨">
            One Perfect SB Day
          </Button>
        </Section>

        {/* TAGS + CHIPS */}
        <Section
          title="Tags & chips"
          description="Static label tags, then toggleable filter chips and the horizon switch."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <Tag color="gold">Tonight</Tag>
            <Tag color="sage">Outdoors</Tag>
            <Tag color="terracotta">Live music</Tag>
            <Tag color="neutral">Free</Tag>
            <Tag color="sage" micro>
              First look
            </Tag>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {TAGS.map((t) => (
              <Chip
                key={t}
                pressed={selectedTags.has(t)}
                onToggle={() => toggleTag(t)}
              >
                {t}
              </Chip>
            ))}
          </div>
          <div>
            <SegmentedControl
              ariaLabel="Time horizon"
              value={horizon}
              onChange={setHorizon}
              options={[
                { label: "Today", value: "today" },
                { label: "This Week", value: "week" },
                { label: "This Month", value: "month" },
              ]}
            />
          </div>
        </Section>

        {/* CARDS */}
        <Section
          title="Content cards"
          description="The editorial pick card and the compact list card. Tap a heart — it pops and toggles."
        >
          <PickCard
            tone="gold"
            tag="Tonight"
            place="Funk Zone"
            title="Sunset Sounds at the Harbor"
            blurb="Golden-hour live music down by the water — bring a layer for when the breeze picks up."
            facts={["Free", "7:30 PM", "All ages"]}
            saved={saved.pick}
            onToggleSave={() => toggleSave("pick")}
          />
          <ListCard
            tone="sage"
            tag="Outdoors"
            tagColor="sage"
            title="Mesa Lane Beach Walk"
            blurb="Steps down to a quieter stretch of sand — time it with low tide."
            meta="Mesa · Free"
            saved={saved.list}
            onToggleSave={() => toggleSave("list")}
          />
        </Section>

        {/* SAVE HEART */}
        <Section
          title="Save heart"
          description="Standalone, with the required Save/Saved label for screen readers."
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <SaveHeart
              saved={saved.heart}
              onToggle={() => toggleSave("heart")}
              title="this place"
            />
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {saved.heart ? "Saved" : "Not saved"}
            </span>
          </div>
        </Section>

        {/* BOTTOM SHEET */}
        <Section
          title="Bottom sheet"
          description="Slides up; close by tapping the dim area or pressing Escape."
        >
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open the sheet
          </Button>
        </Section>

        {/* SKELETONS */}
        <Section
          title="Skeleton loaders"
          description="Soft grey placeholders (not spinners) shown while content loads."
        >
          <SkeletonCard />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Skeleton variant="circle" width={44} height={44} />
            <div style={{ flex: 1 }}>
              <Skeleton variant="line" width="60%" height={16} />
              <div style={{ height: "var(--space-2)" }} />
              <Skeleton variant="line" width="90%" />
            </div>
          </div>
        </Section>

        {/* EMPTY STATES */}
        <Section
          title="Empty states"
          description="Friendly in-voice messages where a list has nothing yet."
        >
          <EmptyState
            icon="🌅"
            title="Nothing saved yet"
            message="Tap the heart on anything you like and it'll land here — on this device, no account needed."
            action={<Button variant="primary">Explore today</Button>}
          />
          <EmptyState
            icon="🔍"
            message="No happenings match that filter right now. Try another occasion."
          />
        </Section>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        kicker="Save to"
        title="Where should this go?"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button variant="primary" block onClick={() => setSheetOpen(false)}>
            Want to go
          </Button>
          <Button variant="secondary" block onClick={() => setSheetOpen(false)}>
            Been there
          </Button>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              textAlign: "center",
              margin: "var(--space-2) 0 0",
            }}
          >
            Saves live on this device — no account, ever.
          </p>
        </div>
      </BottomSheet>
    </main>
  );
}
