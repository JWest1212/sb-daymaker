import type { Metadata } from "next";
import Link from "next/link";
import {
  getGuide,
  matchGuideThings,
  parseGuideContent,
  deriveStopSub,
  directionsUrl,
  getStopThingMap,
} from "@/lib/guides";
import { getPublishedThings } from "@/lib/things";
import { cascade } from "@/lib/explore";
import { CascadeFeed } from "@/components/explore/CascadeFeed";
import { EmptyState } from "@/components/ui";
import { GuideWalkSection } from "@/components/discover/GuideWalkSection";
import type { StopDisplay } from "@/components/discover/GuideWalkSection";

export const revalidate = 600;

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getGuide(id);
  if (!result) return { title: "Guide — SB Daymaker" };
  return { title: `${result.guide.title} — Discover SB — SB Daymaker` };
}

// ─── Date helpers (server-side) ───────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatNowDate(iso: string | null): string | null {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length < 2) return null;
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2] ?? "1", 10);
  return `${MONTHS[m] ?? ""} ${d}`;
}

function formatRefreshed(iso: string | null): string | null {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length < 2) return null;
  const m = parseInt(parts[1], 10) - 1;
  const y = parts[0];
  const mon = MONTHS[m];
  return mon ? `${mon.toUpperCase()} ${y}` : null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, things] = await Promise.all([getGuide(id), getPublishedThings()]);

  if (!result) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
        <div className="sbd-backrow">
          <Link href="/discover" className="sbd-backrow__btn">‹ Discover SB</Link>
        </div>
        <EmptyState
          icon="🧭"
          title="Guide not found"
          message="This guide may have been unpublished. Head back to Discover SB."
        />
      </div>
    );
  }

  const { guide, stops } = result;
  const content = parseGuideContent(guide.content);
  const isRich = content.chapters.length > 0;

  // ── For the happenings cascade ──────────────────────────────────────────
  const happenings = cascade(matchGuideThings(guide, things));
  const isTheme = guide.kind === "theme";
  const happeningsEyebrow = isTheme
    ? `Happening · ${guide.kicker ?? "Theme"}`
    : `Happening in ${guide.title}`;

  // ── For the rich renderer ───────────────────────────────────────────────
  const thingIds = stops.map((s) => s.thing_id).filter((id): id is string => !!id);
  const stopThingMap = isRich ? await getStopThingMap(thingIds) : new Map();

  const stopDisplays: StopDisplay[] = stops.map((s) => {
    const thing = s.thing_id ? (stopThingMap.get(s.thing_id) ?? null) : null;
    return {
      position: s.position,
      chapter: s.chapter,
      label: s.label,
      note: s.note,
      thing_id: s.thing_id,
      sub: deriveStopSub(s, thing),
      directionsUrl: directionsUrl(s, thing),
    };
  });

  const refreshedLabel = formatRefreshed(guide.refreshed_on);
  const nowDateLabel = formatNowDate(guide.now_note_on);

  // ── Plain guide (no content chapters) ─────────────────────────────────
  if (!isRich) {
    return (
      <>
        <div className="sbd-backrow">
          <Link href="/discover" className="sbd-backrow__btn">‹ Discover SB</Link>
        </div>
        <div className="sbd-guide">
          <div className={`sbd-guide-hero sbd-guidecard--${isTheme ? "theme" : "hood"}`}>
            <span className="sbd-guidecard__overlay" aria-hidden="true" />
            <span className="sbd-guidecard__c">
              <span className="sbd-guidecard__kicker">
                {isTheme ? "Theme guide" : "Neighborhood guide"}
              </span>
              <span className="sbd-guidecard__title">{guide.title}</span>
            </span>
          </div>

          {guide.intro ? <p className="sbd-guide__intro">{guide.intro}</p> : null}

          {stops.length > 0 ? (
            <section className="sbd-guide__section">
              <div className="sbd-disc__head">
                <div className="sbd-disc__eyebrow">How to do it</div>
              </div>
              <ol className="sbd-guide__stops">
                {stops.map((s, i) => (
                  <li key={s.position} className="sbd-stop">
                    <span className="sbd-stop__num">{i + 1}</span>
                    <span className="sbd-stop__body">
                      <span className="sbd-stop__name">{s.label}</span>
                      {s.note ? <span className="sbd-stop__note">{s.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="sbd-guide__section">
            <div className="sbd-disc__head">
              <div className="sbd-disc__eyebrow">📅 {happeningsEyebrow}</div>
              <h2 className="sbd-disc__title">What&rsquo;s on right now</h2>
            </div>
            {happenings.length > 0 ? (
              <CascadeFeed items={happenings} horizon="today" />
            ) : (
              <EmptyState
                icon="🌙"
                message="Nothing live in this guide right now. Check back soon."
              />
            )}
          </section>
        </div>
      </>
    );
  }

  // ── Rich guide (Living Postcard renderer) ──────────────────────────────
  const stopCount = stops.length;

  return (
    <>
      {/* back row */}
      <div className="sbd-backrow">
        <Link href="/discover" className="sbd-backrow__btn">‹ Discover SB</Link>
      </div>

      {/* sketch plate + markers + walk section (client) */}
      <GuideWalkSection
        artId={content.sketch.asset}
        stops={stopDisplays}
        chapters={content.chapters}
        asides={content.asides}
        stopCount={stopCount}
      />

      {/* title block */}
      <div className="sbd-gd-title">
        <div className="sbd-gd-eyebrow">
          {isTheme ? "Theme guide" : "Neighborhood guide"}
        </div>
        <h2 className="sbd-gd-h2">{guide.title}</h2>
        {guide.intro && <p className="sbd-gd-deck">{guide.intro}</p>}
        <div className="sbd-gd-meta">
          <span>{stopCount} STOPS</span>
          {content.meta.distance_mi != null && (
            <span>~{content.meta.distance_mi} MI</span>
          )}
          {content.meta.plan_hrs.length >= 2 && (
            <span className="sbd-gd-meta__new">
              PLAN {content.meta.plan_hrs[0]}–{content.meta.plan_hrs[1]} HRS
            </span>
          )}
          {refreshedLabel && <span>REFRESHED {refreshedLabel}</span>}
        </div>
      </div>

      {/* sticky bar */}
      <div className="sbd-gd-stickybar" aria-label="Guide navigation">
        <span className="sbd-gd-stickybar__who">{guide.title}</span>
        <span className="sbd-gd-stickybar__prog">
          {stopCount} STOPS · {guide.zone ? guide.zone.toUpperCase().replace("_", " ") : guide.kicker ?? ""}
        </span>
      </div>

      {/* now block (only if now_note is present) */}
      {guide.now_note && (
        <div className="sbd-gd-now" role="note" aria-label="Right now in the Funk Zone">
          <div className="sbd-gd-now__eyebrow">
            Right now{nowDateLabel ? ` · updated ${nowDateLabel}` : ""}
          </div>
          <p className="sbd-gd-now__body">{guide.now_note}</p>
          {happenings.length > 0 && (
            <button
              type="button"
              className="sbd-gd-haptoggle"
              aria-expanded="false"
              aria-label="Show upcoming happenings"
            >
              <span className="sbd-gd-haptoggle__dot" aria-hidden="true" />
              <span className="sbd-gd-haptoggle__label">
                {happenings[0]?.title ?? "Happenings"}
                {happenings.length > 1 ? ` · +${happenings.length - 1} more` : ""}
              </span>
              <span className="sbd-gd-haptoggle__chev" aria-hidden="true">▾</span>
            </button>
          )}
        </div>
      )}

      {/* passport slab — zero state (static in Phase 2) */}
      {guide.stamp_code && (
        <div className="sbd-gd-passport" aria-label={`Your ${guide.title} passport`}>
          <div className="sbd-gd-passport__left">
            <div className="sbd-gd-passport__row">
              <span className="sbd-gd-passport__lbl">Your {guide.title}</span>
              <span className="sbd-gd-passport__num">
                {stopCount} STOPS · {content.secret_tease ? "1 SECRET" : ""}
              </span>
            </div>
            <div className="sbd-gd-passport__bar" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={stopCount}>
              <div className="sbd-gd-passport__fill" style={{ width: "0%" }} />
            </div>
            <p className="sbd-gd-passport__note">
              Walk it, mark it, and the stamp presses at {stopCount}.{" "}
              {content.secret_tease && (
                <span className="sbd-gd-passport__tease">{content.secret_tease}</span>
              )}{" "}
              Lives on this phone. No account needed.
            </p>
          </div>
          <div className="sbd-gd-stampslot" aria-label={`${guide.stamp_code} stamp, not yet earned`}>
            <span className="sbd-gd-stampslot__code">{guide.stamp_code}</span>
            <span className="sbd-gd-stampslot__lbl">THE STAMP</span>
          </div>
        </div>
      )}

      {/* take card */}
      {content.take.h && content.take.items.length > 0 && (
        <div className="sbd-gd-take">
          <div className="sbd-gd-take__eyebrow">The take</div>
          <h4 className="sbd-gd-take__h4">{content.take.h}</h4>
          {content.take.items.map((item, i) => (
            <div key={i} className="sbd-gd-take__rk">
              <span className="sbd-gd-take__n">{i + 1}</span>
              <span className="sbd-gd-take__w">
                {item.b && <b>{item.b}</b>}
                {item.rest}
              </span>
            </div>
          ))}
          {content.take.landing && (
            <p className="sbd-gd-take__landing">{content.take.landing}</p>
          )}
          <div className="sbd-gd-take__foot">THE TAKE · SB DAYMAKER</div>
        </div>
      )}

      {/* know before */}
      {content.know_before.length > 0 && (
        <div className="sbd-gd-know">
          <h3 className="sbd-gd-know__h3">Know before you go</h3>
          {content.know_before.map((row, i) => (
            <div key={i} className="sbd-gd-know__row">
              <span className="sbd-gd-know__k">{row.k}</span>
              <span className="sbd-gd-know__v">{row.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* colophon */}
      <div className="sbd-gd-colophon">
        <span className="sbd-gd-colophon__text">
          WRITTEN BY A LOCAL
          {refreshedLabel ? ` · REFRESHED ${refreshedLabel}` : ""}
          {content.sketch.no != null ? ` · SKETCH Nº ${content.sketch.no}` : ""}
        </span>
      </div>
    </>
  );
}
