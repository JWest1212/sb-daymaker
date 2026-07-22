// lib/todayServer.ts
//
// Elevation v1 Cockpit build, Wave 2 (S1). Server-only aggregation for the
// Today screen: one read-only pass over the same data every other desk reads,
// no new tables. Every count degrades to 0/null on a per-query failure so a
// single flaky read doesn't blank the whole screen, EXCEPT an outright thrown
// error (a table missing, a network failure) is allowed to surface via the
// `unhealthy` flag, per the never-lie principle, rather than silently
// reporting a quiet morning that isn't real.

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import { rollupSources } from "./review";
import { loadSourceHealth } from "./sourcesServer";
import { countMatchesToReview } from "./venuesServer";
import { countImagesBacklog } from "./imagesServer";
import { countOpenFlags } from "./flagsServer";
import { loadPendingEditions } from "./edition/cockpitServer";
import { loadHeroPlan } from "./heroServer";
import { loadCoverage } from "./coverageServer";
import { COVERAGE_WINDOWS, COVERAGE_FLOORS, type CoverageResult } from "./coverage";

const VENUE_MATCHES_ATTENTION_THRESHOLD = 30;
const EDITION_SENDING_SOON_HOURS = 48;
const RECENTLY_REJECTED_DAYS = 7;
const SEND_HOUR_UTC = 14; // mirrors lib/edition/window.ts's SEND_HOUR_UTC

const DROP_REASON_LABEL: Record<string, string> = {
  no_start: "no start-time", duplicate: "duplicate", no_title: "no title",
  no_address: "no address", no_source: "no source",
};

export type TodayDot = "ok" | "warn" | "bad" | "idle";

export interface TodayRow {
  key: "queue" | "edition" | "venues" | "images" | "coverage" | "flags" | "hero" | "sources";
  label: string;
  dot: TodayDot;
  count: number;
  countLabel: string;
  story: string;
  href: string;
  goLabel: string;
}

export interface TodayAttentionItem {
  text: string;
  linkLabel: string;
  href: string;
}

export interface TodayData {
  generatedAt: string;
  nightSummary: string;
  attention: TodayAttentionItem[]; // at most 2, urgency-ordered
  rows: TodayRow[];
  lastRunAt: string | null;
  recentlyRejectedCount: number;
  unhealthy: boolean;
}

function thinCellExamples(results: CoverageResult[]): { count: number; examples: string[] } {
  let count = 0;
  const examples: string[] = [];
  for (const res of results) {
    for (const row of res.rows) {
      for (const w of COVERAGE_WINDOWS) {
        if (row.windows[w] < COVERAGE_FLOORS[w]) {
          count++;
          if (examples.length < 2) examples.push(`${row.label} next ${w}d`);
        }
      }
    }
  }
  return { count, examples };
}

export async function loadToday(now: number = Date.now()): Promise<TodayData> {
  const generatedAt = new Date(now).toISOString();
  const empty: TodayData = {
    generatedAt,
    nightSummary: "Cockpit data isn't configured.",
    attention: [], rows: [], lastRunAt: null, recentlyRejectedCount: 0, unhealthy: true,
  };
  const sb = getAdminSupabase();
  if (!sb) return empty;

  try {
    const sevenDaysAgo = new Date(now - RECENTLY_REJECTED_DAYS * 86_400_000).toISOString();

    const [
      queueRes, overlayRes, dropsRes, runsRes,
      sourceHealthRows, venueMatches, imagesBacklog, openFlags,
      pendingEditions, heroPlan, coverageVibe, coverageZone, rejectedRes,
    ] = await Promise.all([
      sb.from("things").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
      sb.from("thing_edits").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("ingest_drops").select("reason").order("created_at", { ascending: false }).limit(40),
      sb.from("source_runs").select("source, landed, fetched, ok, started_at").order("started_at", { ascending: false }).limit(60),
      loadSourceHealth(),
      countMatchesToReview(),
      countImagesBacklog(),
      countOpenFlags(),
      loadPendingEditions(sb),
      loadHeroPlan(now),
      loadCoverage("vibe", now),
      loadCoverage("zone", now),
      sb.from("audit_log").select("id", { count: "exact", head: true })
        .eq("action", "reject").eq("actor", "founder").gte("created_at", sevenDaysAgo),
    ]);

    const queueCount = queueRes.count ?? 0;
    const overlayCount = overlayRes.count ?? 0;

    const dropByReason: Record<string, number> = {};
    for (const d of dropsRes.data ?? []) {
      const r = d.reason as string;
      dropByReason[r] = (dropByReason[r] ?? 0) + 1;
    }
    const dropsTotal = dropsRes.data?.length ?? 0;
    const dropBreakdown = Object.entries(dropByReason)
      .map(([r, n]) => `${n} ${DROP_REASON_LABEL[r] ?? r}`)
      .join(", ");

    const sourceRunRows = rollupSources((runsRes.data ?? []) as never);
    const sourcesDown = sourceRunRows.filter((s) => s.status === "fail").length;
    const lastRunAt = ((runsRes.data ?? [])[0]?.started_at as string | undefined) ?? null;

    const activeHealth = sourceHealthRows.filter((s) => s.status === "active");
    const sourcesReporting = activeHealth.length;
    const sourcesBelowBaseline = activeHealth.filter((s) => s.health === "below_baseline").length;

    const nextEdition = pendingEditions[0] ?? null;
    let editionHoursUntilSend: number | null = null;
    let editionSendingSoon = false;
    if (nextEdition) {
      const sendAt = Date.parse(`${nextEdition.edition_date}T${String(SEND_HOUR_UTC).padStart(2, "0")}:00:00Z`);
      editionHoursUntilSend = Math.round((sendAt - now) / 3_600_000);
      editionSendingSoon = nextEdition.status !== "skipped" && editionHoursUntilSend <= EDITION_SENDING_SOON_HOURS;
    }

    const heroGapDays = heroPlan.days.filter((d) => !d.pin && !d.autoPick);
    const heroStaleDays = heroPlan.days.filter((d) => d.pin && !d.pin.valid);
    const heroIssueCount = heroGapDays.length + heroStaleDays.length;

    const { count: thinCellCount, examples: thinCellExamplesList } = thinCellExamples([coverageVibe, coverageZone]);

    const recentlyRejectedCount = rejectedRes.count ?? 0;

    // ---- night summary (one sentence, only real numbers) --------------------
    const nightSummary =
      `The queue has ${queueCount} thing${queueCount === 1 ? "" : "s"} waiting` +
      (overlayCount > 0 ? ` (${overlayCount} founder edit${overlayCount === 1 ? "" : "s"} awaiting a second look)` : "") +
      `, ${dropsTotal} recently dropped${dropBreakdown ? ` (${dropBreakdown})` : ""}, and ` +
      (sourcesDown === 0 ? "every source reported healthy." : `${sourcesDown} source${sourcesDown === 1 ? "" : "s"} reporting trouble.`);

    // ---- ledger rows ----------------------------------------------------------
    const rows: TodayRow[] = [
      {
        key: "queue", label: "Queue", href: "/admin/review", goLabel: "Start the pass →",
        dot: queueCount > 0 ? "warn" : "ok",
        count: queueCount, countLabel: "waiting",
        story: queueCount === 0
          ? "Nothing waiting. The next batch lands tonight."
          : `${queueCount} item${queueCount === 1 ? "" : "s"} to review${overlayCount > 0 ? `, including ${overlayCount} founder edit${overlayCount === 1 ? "" : "s"} on top` : ""}.`,
      },
      {
        key: "edition", label: "Edition", href: "/admin/edition-draft", goLabel: "Review draft →",
        dot: !nextEdition ? "ok" : nextEdition.status === "skipped" ? "idle" : "warn",
        count: nextEdition ? 1 : 0, countLabel: nextEdition ? (nextEdition.status === "skipped" ? "on hold" : "draft") : "none",
        story: !nextEdition
          ? "No edition pending review."
          : nextEdition.status === "skipped"
            ? `${nextEdition.edition_type === "weekend" ? "Weekend" : "Week-ahead"} edition is on hold, it will not send until reviewed.`
            : editionHoursUntilSend != null && editionHoursUntilSend > 0
              ? `${nextEdition.edition_type === "weekend" ? "Weekend" : "Week-ahead"} edition sends in about ${editionHoursUntilSend} hour${editionHoursUntilSend === 1 ? "" : "s"} unless held.`
              : `${nextEdition.edition_type === "weekend" ? "Weekend" : "Week-ahead"} edition's send window has passed, approving now sends immediately.`,
      },
      {
        key: "venues", label: "Venues", href: "/admin/venues", goLabel: "Review matches →",
        dot: venueMatches > 0 ? "warn" : "ok",
        count: venueMatches, countLabel: "matches",
        story: venueMatches === 0
          ? "No fuzzy venue matches waiting."
          : `${venueMatches} fuzzy venue match${venueMatches === 1 ? "" : "es"} waiting to approve.`,
      },
      {
        key: "images", label: "Images", href: "/admin/images", goLabel: "Open the desk →",
        dot: "ok",
        count: imagesBacklog, countLabel: "need photos",
        story: imagesBacklog === 0
          ? "Every published thing has a real photo."
          : `${imagesBacklog} published thing${imagesBacklog === 1 ? "" : "s"} still on a placeholder or motif.`,
      },
      {
        key: "coverage", label: "Coverage", href: "/admin/coverage", goLabel: "See the grid →",
        dot: "ok",
        count: thinCellCount, countLabel: "thin cells",
        story: thinCellCount === 0
          ? "No cell sits below its floor right now."
          : `${thinCellExamplesList.join(" and ")}${thinCellCount > thinCellExamplesList.length ? `, and ${thinCellCount - thinCellExamplesList.length} more` : ""} sit below floor.`,
      },
      {
        key: "flags", label: "Flags", href: "/admin/flags", goLabel: "Triage →",
        dot: openFlags > 0 ? "warn" : "ok",
        count: openFlags, countLabel: "open",
        story: openFlags === 0
          ? "No open visitor corrections."
          : `${openFlags} visitor correction${openFlags === 1 ? "" : "s"} waiting on a decision.`,
      },
      {
        key: "hero", label: "Hero plan", href: "/admin/heroes", goLabel: "Plan the rail →",
        dot: heroIssueCount > 0 ? "idle" : "ok",
        count: heroIssueCount, countLabel: heroIssueCount === 1 ? "gap day" : "gap days",
        story: heroIssueCount === 0
          ? "Every day is pinned or happily on Auto."
          : heroIssueCount === 1
            ? `${(heroGapDays[0] ?? heroStaleDays[0]).label} ${heroGapDays.length ? "has no ⭑ candidates yet" : "has a stale pin"}; every other day is pinned or on Auto.`
            : `${heroGapDays.length} gap day${heroGapDays.length === 1 ? "" : "s"} and ${heroStaleDays.length} stale pin${heroStaleDays.length === 1 ? "" : "s"} need a look.`,
      },
      {
        key: "sources", label: "Sources", href: "/admin/coverage/sources", goLabel: "Registry →",
        dot: sourcesDown > 0 ? "bad" : sourcesBelowBaseline > 0 ? "warn" : "ok",
        count: sourcesReporting, countLabel: "reporting",
        story: sourcesDown > 0
          ? `${sourcesDown} source${sourcesDown === 1 ? "" : "s"} failed its last run.`
          : sourcesBelowBaseline > 0
            ? `${sourcesBelowBaseline} source${sourcesBelowBaseline === 1 ? "" : "s"} below baseline yield.`
            : "All healthy.",
      },
    ];

    // ---- attention band (urgency order, at most 2) ---------------------------
    const attention: TodayAttentionItem[] = [];
    if (editionSendingSoon && nextEdition) {
      attention.push({
        text: `the ${nextEdition.edition_type === "weekend" ? "weekend" : "week-ahead"} edition draft sends in ${editionHoursUntilSend} hour${editionHoursUntilSend === 1 ? "" : "s"}`,
        linkLabel: "review it", href: "/admin/edition-draft",
      });
    }
    if (sourcesDown > 0) {
      attention.push({
        text: `${sourcesDown} source${sourcesDown === 1 ? "" : "s"} down`,
        linkLabel: "check sources", href: "/admin/coverage/sources",
      });
    }
    if (venueMatches > VENUE_MATCHES_ATTENTION_THRESHOLD) {
      attention.push({
        text: `venue matches are at ${venueMatches}`,
        linkLabel: "clear a batch", href: "/admin/venues",
      });
    }
    if (openFlags > 0) {
      attention.push({
        text: `${openFlags} open flag${openFlags === 1 ? "" : "s"}`,
        linkLabel: "triage", href: "/admin/flags",
      });
    }
    if (thinCellCount > 0) {
      attention.push({
        text: `${thinCellCount} coverage cell${thinCellCount === 1 ? "" : "s"} below floor`,
        linkLabel: "see the grid", href: "/admin/coverage",
      });
    }

    return {
      generatedAt,
      nightSummary,
      attention: attention.slice(0, 2),
      rows,
      lastRunAt,
      recentlyRejectedCount,
      unhealthy: false,
    };
  } catch (err) {
    console.error("[today] load failed:", err instanceof Error ? err.message : err);
    return { ...empty, nightSummary: "Couldn't read some counts, the data below may be incomplete." };
  }
}

export interface ShellCounts {
  queue: number;
  dropped: number;
  down: number;
  editionPending: boolean;
  venueMatches: number;
  imagesBacklog: number;
  openFlags: number;
  thinCells: number;
  heroGaps: number;
}

const EMPTY_SHELL_COUNTS: ShellCounts = {
  queue: 0, dropped: 0, down: 0, editionPending: false,
  venueMatches: 0, imagesBacklog: 0, openFlags: 0, thinCells: 0, heroGaps: 0,
};

/** The layout-level shell's topbar stats + every tab badge (Today's cheap
 *  subset, per S1 2.3). Unlike loadToday(), this backs chrome present on
 *  EVERY /admin/* route, so it degrades to all-zero on any failure rather
 *  than surfacing "unhealthy" (a transient hiccup here must never take the
 *  whole cockpit's navigation down with it). */
export async function loadShellCounts(): Promise<ShellCounts> {
  const sb = getAdminSupabase();
  if (!sb) return EMPTY_SHELL_COUNTS;

  try {
    const [
      queueRes, dropRes, runsRes,
      venueMatches, imagesBacklog, openFlags,
      pendingEditions, heroPlan, coverageVibe, coverageZone,
    ] = await Promise.all([
      sb.from("things").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
      sb.from("ingest_drops").select("id", { count: "exact", head: true }),
      sb.from("source_runs").select("source, landed, fetched, ok, started_at")
        .order("started_at", { ascending: false }).limit(60),
      countMatchesToReview(),
      countImagesBacklog(),
      countOpenFlags(),
      loadPendingEditions(sb),
      loadHeroPlan(),
      loadCoverage("vibe"),
      loadCoverage("zone"),
    ]);

    const down = rollupSources((runsRes.data ?? []) as never).filter((s) => s.status === "fail").length;
    const heroGaps = heroPlan.days.filter((d) => (d.pin && !d.pin.valid) || (!d.pin && !d.autoPick)).length;
    const { count: thinCells } = thinCellExamples([coverageVibe, coverageZone]);

    return {
      queue: queueRes.count ?? 0,
      dropped: dropRes.count ?? 0,
      down,
      editionPending: pendingEditions.some((e) => e.status !== "skipped"),
      venueMatches, imagesBacklog, openFlags, thinCells, heroGaps,
    };
  } catch (err) {
    console.error("[shell] counts load failed:", err instanceof Error ? err.message : err);
    return EMPTY_SHELL_COUNTS;
  }
}
