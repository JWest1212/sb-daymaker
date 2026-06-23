import type { Metadata } from "next";
import Link from "next/link";
import { getThing } from "@/lib/things";
import { OCCASION_BY_KEY } from "@/lib/occasions";
import { Tag, EmptyState } from "@/components/ui";
import { DetailSaveButton } from "@/components/detail/DetailSaveButton";
import { prettify } from "@/components/explore/derive";

export const metadata: Metadata = { title: "Detail — SB Daymaker" };
export const dynamic = "force-dynamic";

function eventWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

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
        <Link href="/" className="sbd-backlink">
          ‹ Explore
        </Link>
        <EmptyState
          icon="🔍"
          title="Not found"
          message="This place or event may have been removed. Head back to Explore."
        />
      </div>
    );
  }

  const facts: { k: string; v: string }[] = [];
  if (t.neighborhood) facts.push({ k: "Where", v: prettify(t.neighborhood) });
  if (t.type === "event" && t.starts_at)
    facts.push({ k: "When", v: eventWhen(t.starts_at) });
  facts.push({ k: "Price", v: t.free ? "Free" : (t.price_band ?? "—") });
  if (t.is_21_plus) facts.push({ k: "Note", v: "21+" });
  facts.push({ k: "Setting", v: t.indoor ? "Indoor" : "Outdoor" });

  const body = t.blurb_long ?? t.blurb;

  return (
    <div className="sbd-detail">
      <Link href="/" className="sbd-backlink">
        ‹ Explore
      </Link>

      <div className={`sbd-detail__media sbd-media--${TONE_BY_TYPE[t.type] ?? "gold"}`} />

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
