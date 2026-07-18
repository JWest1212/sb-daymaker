import type { Metadata } from "next";
import Link from "next/link";
import { getThingBySlugOrId, getNearbyThings, type Thing } from "@/lib/things";
import { getGuidesFeaturingThing } from "@/lib/guides";
import { OCCASION_BY_KEY } from "@/lib/occasions";
import { ZONE_LABEL } from "@/lib/zones";
import { Tag, EmptyState } from "@/components/ui";
import { DetailActions } from "@/components/detail/DetailActions";
import { FlagButton } from "@/components/detail/FlagButton";
import { OpenNow } from "@/components/detail/OpenNow";
import { BackButton } from "@/components/detail/BackButton";
import { DetailPhoto } from "@/components/detail/DetailPhoto";
import { prettify } from "@/components/explore/derive";
import { eventDetailWhen } from "@/lib/format/eventTime";
import { outboundLink } from "@/lib/format/outboundLink";
import { isRealSecret } from "@/lib/quality/localSecret";
import { thingJsonLd } from "@/lib/seo/jsonLd";
import { absoluteUrl, thingPath, guidePath } from "@/lib/seo/site";

export const revalidate = 600; // ISR: refresh published content every 10 min

const TONE_BY_TYPE: Record<string, string> = {
  event: "gold",
  happyhour: "gold",
  firstlook: "pacific",
  place: "sage",
};

const SETTING_LABEL: Record<NonNullable<Thing["setting"]>, string> = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  both: "Indoor & outdoor",
};

const STAMP_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  year: "numeric",
});

/** "Verified · Jul 2026" from an ISO/date string, or null if undated. */
function verifiedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Verified · ${STAMP_FMT.format(d)}`;
}

/** The human-readable neighborhood/zone for titles + JSON-LD, "Santa Barbara"
 *  as the safe fallback (never the placeholder "other"). */
function whereLabel(t: Thing): string {
  if (t.neighborhood && t.neighborhood !== "other") return prettify(t.neighborhood);
  if (t.nearby_zone) return ZONE_LABEL[t.nearby_zone];
  return "Santa Barbara";
}

function truncate(s: string, n: number): string {
  const clean = s.trim();
  return clean.length <= n ? clean : `${clean.slice(0, n - 1).trimEnd()}…`;
}

// Elevation v1 · Gate 2 · G2.3, per-page metadata: a unique title + the real
// what-it-is description + a self-referential canonical at the slug URL. Never the
// sitewide default. The per-thing OG image comes from the colocated
// opengraph-image route (G2.4), auto-wired by Next.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getThingBySlugOrId(id);
  if (!t) return { title: "Not found · SB Daymaker" };
  const title = `${t.title} · ${whereLabel(t)} · SB Daymaker`;
  const description = truncate(
    t.blurb ?? t.reason_to_go ?? t.blurb_long ?? `${t.title} in Santa Barbara.`,
    155,
  );
  const canonical = thingPath(t);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: t.type === "event" ? "article" : "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ThingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getThingBySlugOrId(id);

  // G3.5, cross-link data: guides this thing stars in, and nearby same-zone things.
  const [guidesFeaturing, nearby] = t
    ? await Promise.all([
        getGuidesFeaturingThing(t.id),
        t.nearby_zone ? getNearbyThings(t.nearby_zone, t.id, 3) : Promise.resolve([]),
      ])
    : [[], []];

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

  // G1.3, the human-readable neighborhood/zone, granular first (Riviera, Funk
  // Zone), coarse zone as a fallback. Never render the literal placeholder
  // "other" (G0.7): if the area is genuinely unknown, omit the row.
  const neighborhoodLabel =
    t.neighborhood && t.neighborhood !== "other"
      ? prettify(t.neighborhood)
      : t.nearby_zone
        ? ZONE_LABEL[t.nearby_zone]
        : null;

  // G1.3, the Directions destination: a real address, else stored coordinates.
  const directionsDest = t.address?.trim()
    ? t.address.trim()
    : t.lat != null && t.lng != null
      ? `${t.lat},${t.lng}`
      : null;
  const directionsHref = directionsDest
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsDest)}`
    : null;

  // G1.3 facts, address FIRST, neighborhood directly beneath it.
  const facts: { k: string; v: string }[] = [];
  if (t.address?.trim()) facts.push({ k: "Address", v: t.address.trim() });
  if (neighborhoodLabel) facts.push({ k: "Neighborhood", v: neighborhoodLabel });
  if (t.type === "event" && t.starts_at)
    facts.push({ k: "When", v: eventDetailWhen(t.starts_at) });
  // G0.7, never a bare separator in the price slot. Free / a real band / a
  // ticketed event with an outbound ("Check site") / else omit the row entirely.
  const priceValue = t.free
    ? "Free"
    : t.price_band
      ? t.price_band
      : t.type === "event" && t.buy_url
        ? "Check site"
        : null;
  if (priceValue) facts.push({ k: "Price", v: priceValue });
  // G1.3, restore the Setting row from the real `setting` enum (Gate 0 had
  // suppressed the old default-false `indoor` bit that couldn't say "both").
  if (t.setting) facts.push({ k: "Setting", v: SETTING_LABEL[t.setting] });
  if (t.is_21_plus) facts.push({ k: "Note", v: "21+" });

  // G1.4, the outbound link label adapts to type/price/destination.
  const outbound = outboundLink(t);

  // G1.6, the verification stamp: Tier 1 shows a dated "Verified" stamp (from
  // verified_at, else last_confirmed); Tier 2 shows a quieter "Listed".
  const stamp = verifiedLabel(t.verified_at ?? t.last_confirmed);

  // G1.8, render Local's Secret only when it's a genuine secret (not the entry's
  // own marketing said another way).
  const showSecret = t.local_note ? isRealSecret(t.local_note, t) : false;

  const body = t.blurb_long ?? t.blurb;

  // G2.5, Event / LocalBusiness + Breadcrumb JSON-LD for crawlers.
  const jsonLd = thingJsonLd(t, absoluteUrl(thingPath(t)), thingPath(t));

  return (
    <div className="sbd-detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BackButton />

      <DetailPhoto photoUrl={t.photo_url} tone={TONE_BY_TYPE[t.type] ?? "gold"}>
        {/* G1.6, Verified stamp anchored to the image top-right. Shown ONLY for
            Tier-1 entries; nothing is shown otherwise (no "Listed"). The freshness
            dot pulses but stops under prefers-reduced-motion (static). */}
        {t.quality_tier === 1 && stamp ? (
          <span className="sbd-detail__stamp">
            <span className="sbd-detail__stamp-dot" aria-hidden="true" />
            {stamp}
          </span>
        ) : null}
      </DetailPhoto>
      {t.photo_url && t.photo_source !== "owned" && t.photo_attribution ? (
        <p className="sbd-detail__attribution">{t.photo_attribution}</p>
      ) : null}

      <h1 className="sbd-detail__title">{t.title}</h1>

      {t.tags.length > 0 ? (
        <div className="sbd-detail__tags">
          {/* G1.9, up to 3 occasion chips, in confidence order (tags is sorted in
              mapThing); the card shows only tags[0], the detail's top chip. */}
          {t.tags.slice(0, 3).map((k) => {
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

      {/* G1.5, open-now computed client-side from stored hours; renders nothing
          when hours are unknown. */}
      <OpenNow hours={t.hours} />

      {/* G1.7, the outdoor "Before you go" practical note; rendered only when
          present (hide, don't fill). */}
      {t.practical_note ? (
        <aside className="sbd-detail__practical">
          <div className="sbd-detail__practical-k">Before you go</div>
          <p>{t.practical_note}</p>
        </aside>
      ) : null}

      {showSecret ? (
        <aside className="sbd-detail__secret">
          <div className="sbd-detail__secret-k">🤫 Local&rsquo;s secret</div>
          <p>{t.local_note}</p>
        </aside>
      ) : null}

      {/* G3.5, Thing -> Guide: this thing stars in a published guide. */}
      {guidesFeaturing.length > 0 ? (
        <p className="sbd-detail__featured">
          Featured in{" "}
          {guidesFeaturing.map((g, i) => (
            <span key={g.id}>
              {i > 0 ? ", " : ""}
              <Link href={guidePath(g)}>{g.title}</Link>
            </span>
          ))}
        </p>
      ) : null}

      <div className="sbd-detail__actions">
        {outbound ? (
          <a
            className="sbd-btn sbd-btn--cta sbd-btn--block"
            href={outbound.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {outbound.label}
          </a>
        ) : null}
        {/* G1.3, the Save / Share / Directions action row. */}
        <DetailActions id={t.id} title={t.title} directionsHref={directionsHref} />
      </div>

      {/* G3.5, Nearby / pairs-with: 2-3 same-zone things, Tier-1 first. */}
      {nearby.length > 0 && t.nearby_zone ? (
        <section className="sbd-detail__nearby">
          <h2 className="sbd-detail__nearby-h">Nearby in {ZONE_LABEL[t.nearby_zone]}</h2>
          <ul className="sbd-detail__nearby-list">
            {nearby.map((n) => (
              <li key={n.id}>
                <Link href={thingPath(n)} className="sbd-detail__nearby-link">
                  <span className="sbd-detail__nearby-name">{n.title}</span>
                  <span className="sbd-detail__nearby-meta">
                    {n.free ? "Free" : (n.price_band ?? "")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* G3.6, one-tap correction flag (no PII). */}
      <div className="sbd-detail__flag">
        <FlagButton thingId={t.id} />
      </div>
    </div>
  );
}
