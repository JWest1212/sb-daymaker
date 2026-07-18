import type { Metadata } from "next";
import Link from "next/link";
import { getThing } from "@/lib/things";
import { OCCASION_BY_KEY } from "@/lib/occasions";
import { Tag, EmptyState } from "@/components/ui";
import { DetailSaveButton } from "@/components/detail/DetailSaveButton";
import { BackButton } from "@/components/detail/BackButton";
import { DetailPhoto } from "@/components/detail/DetailPhoto";
import { prettify } from "@/components/explore/derive";
import { eventDetailWhen } from "@/lib/format/eventTime";

export const metadata: Metadata = { title: "Detail · SB Daymaker" };
export const revalidate = 600; // ISR: refresh published content every 10 min

const TONE_BY_TYPE: Record<string, string> = {
  event: "gold",
  happyhour: "gold",
  firstlook: "pacific",
  place: "sage",
};

export default async function ThingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getThing(id);

  if (!t) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
        <div className="sbd-backrow">
          <Link href="/" className="sbd-backrow__btn">‹ Explore</Link>
        </div>
        <EmptyState
          icon="🔍"
          title="Not found"
          message="This place or event may have been removed. Head back to Explore."
        />
      </div>
    );
  }

  const facts: { k: string; v: string }[] = [];
  // G0.7, never render the literal placeholder "Other" as a location. The
  // neighborhood enum's 'other' value means "unknown"; show nothing instead.
  if (t.neighborhood && t.neighborhood !== "other")
    facts.push({ k: "Where", v: prettify(t.neighborhood) });
  if (t.type === "event" && t.starts_at)
    facts.push({ k: "When", v: eventDetailWhen(t.starts_at) });
  // G0.7, never a bare "·" in the price slot. Free / a real band / (ticketed
  // event with an outbound) "Check site" / else omit the row entirely.
  const priceValue = t.free
    ? "Free"
    : t.price_band
      ? t.price_band
      : t.type === "event" && t.buy_url
        ? "Check site"
        : null;
  if (priceValue) facts.push({ k: "Price", v: priceValue });
  if (t.is_21_plus) facts.push({ k: "Note", v: "21+" });
  // G0.7, the `indoor` bit is a default-false binary that can't express "both"
  // (Old Mission's own secret recommends its garden, yet the bit says Indoor).
  // Rather than ship a label its own copy contradicts, the Setting row is
  // suppressed in Gate 0; Gate 1 restores it from the real `setting` enum.

  const body = t.blurb_long ?? t.blurb;

  return (
    <div className="sbd-detail">
      <BackButton />

      <DetailPhoto photoUrl={t.photo_url} tone={TONE_BY_TYPE[t.type] ?? "gold"} />
      {t.photo_url && t.photo_source !== "owned" && t.photo_attribution ? (
        <p className="sbd-detail__attribution">{t.photo_attribution}</p>
      ) : null}

      <h1 className="sbd-detail__title">{t.title}</h1>

      {t.tags.length > 0 ? (
        <div className="sbd-detail__tags">
          {t.tags.map((k) => {
            const o = OCCASION_BY_KEY[k];
            return o ? (
              <Tag key={k} color="neutral">
                {o.icon} {o.label}
              </Tag>
            ) : null;
          })}
        </div>
      ) : null}

      {t.reason_to_go ? (
        <p className="sbd-detail__reason">{t.reason_to_go}</p>
      ) : null}
      {body ? <p className="sbd-detail__body">{body}</p> : null}

      <dl className="sbd-detail__facts">
        {facts.map((f) => (
          <div key={f.k} className="sbd-detail__fact">
            <dt>{f.k}</dt>
            <dd>{f.v}</dd>
          </div>
        ))}
      </dl>

      {t.local_note ? (
        <aside className="sbd-detail__secret">
          <div className="sbd-detail__secret-k">🤫 Local&rsquo;s secret</div>
          <p>{t.local_note}</p>
        </aside>
      ) : null}

      <div className="sbd-detail__actions">
        {t.buy_url ? (
          <a
            className="sbd-btn sbd-btn--cta sbd-btn--block"
            href={t.buy_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get tickets ↗
          </a>
        ) : null}
        <DetailSaveButton id={t.id} title={t.title} />
      </div>
    </div>
  );
}
