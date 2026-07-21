// Elevation v1 · Gate 5 · G5.3, the sample weekend edition. Gives the subscribe
// box real proof of what an issue looks like, WITHOUT building the send path (that
// stays a separate founder priority). It assembles a representative edition from
// the live published `things` (no invented content) and renders it through the
// exact same renderer the real email/permalink use (lib/edition/render.ts). ISR
// 600s. No em dash (Golden Rule; the renderer + content already strip them).

import { NextResponse } from "next/server";
import { getPublishedThings, type Thing } from "@/lib/things";
import { cascade } from "@/lib/explore";
import { renderEditionEmailHtml, type RenderPick, type RenderableEdition } from "@/lib/edition/render";
import { eventCardWhen } from "@/lib/format/eventTime";
import { absoluteUrl, thingPath } from "@/lib/seo/site";
import { ZONE_LABEL } from "@/lib/zones";

export const revalidate = 600;

function areaOf(t: Thing): string | null {
  if (t.nearby_zone) return ZONE_LABEL[t.nearby_zone] ?? null;
  return t.neighborhood;
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
  const things = await getPublishedThings();
  if (things.length === 0) {
    return new NextResponse("No sample available yet.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const ordered = cascade(things);
  const events = ordered.filter((t) => t.starts_at);
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

  const html = renderEditionEmailHtml(edition);
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
