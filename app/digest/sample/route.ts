import { getPublishedThingsCached } from "@/lib/cachedData";
// Elevation v1 · Gate 5 · G5.3, the sample weekend edition. Gives the subscribe
// box real proof of what an issue looks like, WITHOUT building the send path (that
// stays a separate founder priority). It assembles a representative edition from
// the live published `things` (no invented content) and renders it through the
// exact same renderer the real email/permalink use (lib/edition/render.ts). ISR
// 600s. No em dash (Golden Rule; the renderer + content already strip them).

import { NextResponse } from "next/server";
import {type Thing } from "@/lib/things";
import { cascade } from "@/lib/explore";
import { renderEditionEmailHtml, type RenderPick, type RenderableEdition } from "@/lib/edition/render";
import { eventCardWhen } from "@/lib/format/eventTime";
import { absoluteUrl, thingPath } from "@/lib/seo/site";
import { areaLabelForThing } from "@/lib/areas";

export const revalidate = 600;

/** R1 W4.1/W5.8. One area label, the same string Explore, Plan, Saved and the
 *  detail page use. It used to fall back to the raw enum value, so the digest
 *  could say "mission_canyon" where the site said "Mission and Riviera". */
function areaOf(t: Thing): string | null {
  return areaLabelForThing(t);
}

/** R1 W5.8. The coming send window: from now to the end of Sunday, in SB time.
 *  The sample is proof of what an issue looks like, so it has to be dated for
 *  the issue a visitor would actually receive next, not for whatever happens to
 *  sit at the top of the pool. */
function sendWindow(now: Date): { fromMs: number; toMs: number } {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" });
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(fmt.format(now));
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  const end = new Date(now.getTime() + (daysToSunday + 1) * 86_400_000);
  end.setHours(0, 0, 0, 0);
  return { fromMs: now.getTime(), toMs: end.getTime() };
}

function weekdayOf(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long" }).format(new Date(iso));
}

function toPick(t: Thing, withDayLabel = false): RenderPick {
  return {
    thingId: t.id,
    title: t.title,
    blurb: t.reason_to_go ?? t.blurb ?? null,
    when: t.starts_at ? eventCardWhen(t.starts_at) : "Ongoing",
    neighborhood: areaOf(t),
    localNote: null, // the feed select omits local_note; the secret block simply won't show
    imageUrl: t.photo_url,
    imageAttribution: null,
    dayLabel: withDayLabel ? weekdayOf(t.starts_at) : null,
    href: absoluteUrl(thingPath(t)),
  };
}

export async function GET() {
  const things = await getPublishedThingsCached();
  if (things.length === 0) {
    return new NextResponse("No sample available yet.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const ordered = cascade(things);
  const { fromMs, toMs } = sendWindow(new Date());
  // R1 W5.8. Only events inside the coming send window, so every link in the
  // sample is something the reader could still go to. Falls back to any upcoming
  // event if the window is thin, rather than rendering an empty edition.
  const upcoming = ordered.filter((t) => t.starts_at && new Date(t.starts_at).getTime() >= fromMs);
  const inWindow = upcoming.filter((t) => new Date(t.starts_at!).getTime() <= toMs);
  const events = inWindow.length >= 4 ? inWindow : upcoming;
  const places = ordered.filter((t) => !t.starts_at);

  const hero = events[0] ?? ordered[0];
  const usedIds = new Set<string>([hero.id]);
  const take = (pool: Thing[], n: number) => {
    const out: Thing[] = [];
    for (const t of pool) {
      if (usedIds.has(t.id)) continue;
      usedIds.add(t.id);
      out.push(t);
      if (out.length >= n) break;
    }
    return out;
  };

  const secondaries = take(events, 3);
  const [nonEvent] = take(places, 1);
  const [anchor] = take(places, 1);

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  const edition: RenderableEdition = {
    editionType: "weekend",
    subject: "This weekend in Santa Barbara (sample)",
    preheader: "A sample of the SB Daymaker weekend edition, so you know what you are signing up for.",
    greeting: "Here is a taste of the weekend edition.",
    windowLabel: "This weekend",
    dateLabel,
    secondariesLabel: "Also worth your weekend",
    nonEventLabel: "Beyond the calendar",
    hero: toPick(hero),
    secondaries: secondaries.map((t) => toPick(t, true)),
    nonEvent: nonEvent ? toPick(nonEvent) : null,
    anchor: anchor ? toPick(anchor) : null,
    permalinkUrl: absoluteUrl("/digest/sample"),
    subscribeUrl: absoluteUrl("/"),
    unsubscribeUrl: null,
  };

  // R1 W5.8. A description and a title suffix, so a shared link to the sample
  // previews as something rather than as an untitled document.
  const html = renderEditionEmailHtml(edition)
    .replace(
      /<title>[^<]*<\/title>/i,
      // R1 W7.8 (CON-002). Canonical too, and og values of its own.
      `<title>Sample edition &middot; SB Daymaker</title><meta name="description" content="${edition.preheader}">` +
        `<link rel="canonical" href="${absoluteUrl("/digest/sample")}">` +
        `<meta property="og:title" content="A sample SB Daymaker weekend edition">` +
        `<meta property="og:description" content="${edition.preheader}">` +
        `<meta property="og:site_name" content="SB Daymaker">`,
    );
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
