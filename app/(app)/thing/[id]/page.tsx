import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getThingBySlugOrId, getNearbyThings, type Thing } from "@/lib/things";
import { getGuidesFeaturingThing } from "@/lib/guides";
import { OCCASION_BY_KEY } from "@/lib/occasions";
import { areaLabelForThing, areaShortForThing } from "@/lib/areas";
import { AREA_FIELD, nearbyIn } from "@/lib/strings";
import { priceLabel, imageAlt } from "@/components/explore/derive";
import { Tag } from "@/components/ui";
import { DetailActions } from "@/components/detail/DetailActions";
import { FlagButton } from "@/components/detail/FlagButton";
import { OpenNow } from "@/components/detail/OpenNow";
import { BackButton } from "@/components/detail/BackButton";
import { ArchivedBanner } from "@/components/detail/ArchivedBanner";
import { DetailPhoto } from "@/components/detail/DetailPhoto";
import { eventDetailWhenWithYear } from "@/lib/format/eventTime";
import { resolveOutbound } from "@/lib/links/outbound";
import { isRealSecret } from "@/lib/quality/localSecret";
import { thingJsonLd } from "@/lib/seo/jsonLd";
import { absoluteUrl, thingPath, guidePath, isUuid } from "@/lib/seo/site";
import { redirectTargetFor } from "@/lib/links/redirects";
import { isOver } from "@/components/explore/derive";

export const revalidate = 300; // R1 W1.6, ISR safety net behind /api/revalidate

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

/** R1 W2.2 (DET-014). "Verified · Jul 2026", but ONLY while the check is still
 *  worth something. A stamp older than 90 days is not reassurance, it is a claim
 *  the site cannot stand behind, so it is hidden rather than shown stale. */
export const VERIFIED_MAX_AGE_DAYS = 90;

export function verifiedLabel(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ageDays = (now.getTime() - d.getTime()) / 86_400_000;
  if (ageDays > VERIFIED_MAX_AGE_DAYS) return null;
  // A stamp dated in the future is not credible either.
  if (ageDays < -1) return null;
  return `Verified · ${STAMP_FMT.format(d)}`;
}

/** The human-readable neighborhood/zone for titles + JSON-LD, "Santa Barbara"
 *  as the safe fallback (never the placeholder "other"). */
function whereLabel(t: Thing): string {
  // R1 W4.1: one label, from the one module. The city name is still the fallback
  // HERE, because a page title needs some place name; on the page body itself an
  // unknown area renders as nothing (see neighborhoodLabel below).
  return areaLabelForThing(t) ?? "Santa Barbara";
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
    // R1 W2.2. An archived page stays reachable so saved and shared links never
    // 404, but it is not something search should be sending new people to.
    ...(t.status === "archived" ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ThingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getThingBySlugOrId(id);

  // R1 W6.7 (DET-007). A page with a slug has ONE address. A UUID URL still
  // works, because old saves, old shares and old inbound links use it, but it
  // moves permanently to the slug: a 308, so a share of a share carries the
  // readable URL and search engines fold the two into one page.
  if (t?.slug && isUuid(id)) permanentRedirect(thingPath(t));

  // R1 W7.3. When this render happened, for "already happened". A server
  // component, so there is no client render to disagree with it.
  const renderedAt = Date.now();

  // G3.5, cross-link data: guides this thing stars in, and nearby same-zone things.
  const [guidesFeaturing, nearby] = t
    ? await Promise.all([
        getGuidesFeaturingThing(t.id),
        // R1 W2.6, five distinct titles, deduped by series inside getNearbyThings.
        t.nearby_zone ? getNearbyThings(t.nearby_zone, t.id, 5) : Promise.resolve([]),
      ])
    : [[], []];

  if (!t) {
    // R1 W6.7 (DET-007). Before giving up, ask whether this path MOVED. An old
    // slug (one that was shortened, or a duplicate folded into its survivor) has
    // a row in url_redirects; the proxy only catches UUID-shaped segments, so
    // until now an old slug fell straight through to this dead end.
    const moved = await redirectTargetFor(`/thing/${id}`);
    if (moved) permanentRedirect(moved);
    // R1 W6.7 (EDG-001). notFound(), not an inline empty state: the words were
    // already right, the STATUS was not. This used to answer 200, which tells a
    // crawler a dead listing is a healthy page. The copy now lives in this
    // segment's not-found.tsx and the response is a real 404.
    notFound();
  }

  // G1.3, the human-readable neighborhood/zone, granular first (Riviera, Funk
  // Zone), coarse zone as a fallback. Never render the literal placeholder
  // "other" (G0.7): if the area is genuinely unknown, omit the row.
  // R1 W4.1 (DET-009). One label from lib/areas.ts, identical to the Explore
  // door, the Plan area step, Saved's Near Me and the digest. Unknown renders as
  // nothing: never "other", never the city name standing in for an answer.
  const neighborhoodLabel = areaLabelForThing(t);

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
  if (neighborhoodLabel) facts.push({ k: AREA_FIELD, v: neighborhoodLabel }); // R1 W8.1
  if (t.type === "event" && t.starts_at)
    facts.push({ k: "When", v: eventDetailWhenWithYear(t.starts_at) });
  // G0.7, never a bare separator in the price slot. Free / a real band / a
  // ticketed event with an outbound ("Check site") / else omit the row entirely.
  // R1 W5.5 (DET-011). One price rule, shared with the card. Never blank.
  facts.push({ k: "Price", v: priceLabel(t) });
  // G1.3, restore the Setting row from the real `setting` enum (Gate 0 had
  // suppressed the old default-false `indoor` bit that couldn't say "both").
  if (t.setting) facts.push({ k: "Setting", v: SETTING_LABEL[t.setting] });
  if (t.is_21_plus) facts.push({ k: "Note", v: "21+" });

  // G1.4, the outbound link label adapts to type/price/destination.
  const outbound = resolveOutbound(t);

  // G1.6, the verification stamp: Tier 1 shows a dated "Verified" stamp (from
  // verified_at, else last_confirmed); Tier 2 shows a quieter "Listed".
  // R1 W8.2 (XC-004). "Verified" means a person checked it: verified_at only.
  // last_confirmed is the scraper seeing the listing again, which is not that.
  const stamp = verifiedLabel(t.verified_at);

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

      {/* R1 W2.2, said before anything else on the page, so the visitor never
          reads a finished event as an upcoming one. */}
      {/* R1 W7.3. The same rule as every card: archived, or over. */}
      {isOver(t, renderedAt) ? (
        <ArchivedBanner startsAt={t.starts_at} />
      ) : null}

      <DetailPhoto photoUrl={t.photo_url} tone={TONE_BY_TYPE[t.type] ?? "gold"} alt={imageAlt(t)}>
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
                {o.label}
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

      {/* R1 W5.5 (DET-011). A tiny key, shown only when the price is a band, so
          "$$" means something to someone seeing it for the first time. */}
      {!t.price_note?.trim() && !t.free && t.price_band ? (
        <p className="sbd-detail__pricekey">$ under 15 &middot; $$ 15 to 40 &middot; $$$ over 40</p>
      ) : null}

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
          <div className="sbd-detail__secret-k">Local&rsquo;s secret</div>
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
        <DetailActions id={t.id} title={t.title} path={thingPath(t)} directionsHref={directionsHref} />
      </div>

      {/* G3.5, Nearby / pairs-with: 2-3 same-zone things, Tier-1 first. */}
      {nearby.length > 0 && t.nearby_zone ? (
        <section className="sbd-detail__nearby">
          <h2 className="sbd-detail__nearby-h">{nearbyIn(areaShortForThing(t) ?? neighborhoodLabel ?? "")}</h2>
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
