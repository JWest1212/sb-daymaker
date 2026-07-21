// Gate 4 bugfix, the ranker (used by both the engine and the manual Add-a-stop
// picker) must place a recurring event by its schedule time, not a mis-enriched
// time_of_day_fit. A 9pm karaoke night is never an afternoon candidate.

import { describe, it, expect } from "vitest";
import { thing } from "./_fixture";
import { rankCandidates } from "./rankCandidates";
import type { PlanAnswers } from "./types";
import type { RecurringSchedule } from "@/lib/things";

const noop = () => null;

function rec(start: string | null): RecurringSchedule {
  return { category: "recurring_nightlife", day_of_week: 2, start_time: start, end_time: "23:59:00", label: null, frequency: "weekly", cadence: "weekly", nth_dow: null, last_confirmed: null };
}

const answers = (over: Partial<PlanAnswers> = {}): PlanAnswers => ({
  dateISO: "2026-07-04", periods: ["afternoon"], who: "friends", vibes: [], zone: null, ...over,
});

describe("rankCandidates · recurring start time gates the block", () => {
  const karaoke = thing({
    id: "karaoke",
    title: "Karaoke Night, Dargan's Irish Pub",
    starts_at: null,
    time_of_day_fit: ["morning", "afternoon", "evening"], // mis-enriched, must be ignored
    tags: ["nightlife"],
    recurring: [rec("21:00:00")],
  });

  it("does NOT surface a 9pm recurring event for the afternoon block", () => {
    const ranked = rankCandidates("afternoon", answers(), [karaoke], noop);
    expect(ranked.map((r) => r.thing.id)).not.toContain("karaoke");
  });
  it("surfaces it for the night block", () => {
    const ranked = rankCandidates("night", answers({ periods: ["night"] }), [karaoke], noop);
    expect(ranked.map((r) => r.thing.id)).toContain("karaoke");
  });
  it("still surfaces a recurring thing with no declared time in any block", () => {
    const flexible = thing({ id: "flex", starts_at: null, recurring: [rec(null)], tags: [] });
    const ranked = rankCandidates("afternoon", answers(), [flexible], noop);
    expect(ranked.map((r) => r.thing.id)).toContain("flex");
  });
});
