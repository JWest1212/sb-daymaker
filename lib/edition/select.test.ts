import { describe, it, expect } from "vitest";
import { selectEdition } from "./select";
import type { DraftThing } from "./types";

function draftThing(over: Partial<DraftThing> & { id: string }): DraftThing {
  return {
    type: "event",
    title: over.id,
    blurb: null,
    blurb_long: null,
    local_note: null,
    reason_to_go: null,
    happening_tier: 1,
    happening_category: "community_gathering",
    editorial_weight: 0,
    neighborhood: "downtown",
    starts_at: null,
    ends_at: null,
    hero_eligible: true,
    photo_url: null,
    photo_source: null,
    photo_attribution: null,
    photo_options: [],
    created_at: null,
    last_confirmed: null,
    recurring: [],
    ...over,
  };
}

// 2026-07-09 = Thursday. Window = Fri 07-10, Sat 07-11, Sun 07-12.
const WEEKEND_WINDOW = ["2026-07-10", "2026-07-11", "2026-07-12"];
const BASE_INPUT = {
  heroPinThingId: null,
  cooldownIds: new Set<string>(),
  editionType: "weekend" as const,
  windowDays: WEEKEND_WINDOW,
  editionDateKey: "2026-07-09",
};

describe("hero selection — fallback chain", () => {
  it("prefers a valid hero_pins pick over the ranked auto-pick", () => {
    const things = [
      draftThing({ id: "auto-best", starts_at: "2026-07-10T19:00:00Z", editorial_weight: 5 }),
      draftThing({ id: "pinned", starts_at: "2026-07-11T19:00:00Z", editorial_weight: 0 }),
    ];
    const sel = selectEdition({ ...BASE_INPUT, things, heroPinThingId: "pinned" });
    expect(sel.hero.source).toBe("pin");
    expect(sel.hero.picks[0]?.id).toBe("pinned");
  });

  it("ignores an invalid pin (not hero_eligible) and falls through to auto-pick", () => {
    const things = [
      draftThing({ id: "auto-best", starts_at: "2026-07-10T19:00:00Z" }),
      draftThing({ id: "pinned-ineligible", starts_at: "2026-07-11T19:00:00Z", hero_eligible: false }),
    ];
    const sel = selectEdition({ ...BASE_INPUT, things, heroPinThingId: "pinned-ineligible" });
    expect(sel.hero.source).toBe("auto");
    expect(sel.hero.picks[0]?.id).toBe("auto-best");
  });

  it("falls back to the Tier-3 evergreen rotation when nothing qualifies in-window", () => {
    const things = [
      draftThing({ id: "evergreen-1", happening_tier: 3, starts_at: null }),
      draftThing({ id: "evergreen-2", happening_tier: 3, starts_at: null }),
    ];
    const sel = selectEdition({ ...BASE_INPUT, things });
    expect(sel.hero.source).toBe("evergreen");
    expect(sel.hero.picks).toHaveLength(1);
  });

  it("never blank: cooldown-excluding every evergreen still yields a pick", () => {
    const things = [draftThing({ id: "only-evergreen", happening_tier: 3 })];
    const sel = selectEdition({
      ...BASE_INPUT,
      things,
      cooldownIds: new Set(["only-evergreen"]),
    });
    expect(sel.hero.picks[0]?.id).toBe("only-evergreen"); // cooldown broken rather than leaving it blank
  });
});

describe("secondary selection — tier qualification + window", () => {
  it("qualifies Tier-1 dated-in-window and Tier-2 recurring-in-window; excludes out-of-window and Tier-3", () => {
    const things = [
      draftThing({ id: "hero", happening_tier: 1, starts_at: "2026-07-10T19:00:00Z", editorial_weight: 10 }),
      draftThing({ id: "t1-in-window", happening_tier: 1, starts_at: "2026-07-11T19:00:00Z" }),
      draftThing({ id: "t1-out-of-window", happening_tier: 1, starts_at: "2026-08-01T19:00:00Z" }),
      draftThing({
        id: "t2-recurring-fri",
        happening_tier: 2,
        starts_at: null,
        recurring: [{ day_of_week: 5, start_time: "18:00", end_time: "20:00", frequency: "weekly", label: null }],
      }),
      draftThing({ id: "t3-evergreen", happening_tier: 3, starts_at: null }),
    ];
    const sel = selectEdition({ ...BASE_INPUT, things });
    const ids = sel.secondary.picks.map((p) => p.id);
    expect(ids).toContain("t1-in-window");
    expect(ids).toContain("t2-recurring-fri");
    expect(ids).not.toContain("t1-out-of-window");
    expect(ids).not.toContain("t3-evergreen");
    expect(ids).not.toContain("hero"); // hero excluded from secondary pool
  });

  it("renders secondaries in chronological order regardless of rank order", () => {
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-10T12:00:00Z", editorial_weight: 10 }),
      draftThing({ id: "later", starts_at: "2026-07-12T19:00:00Z", editorial_weight: 5 }), // highest rank, latest date
      draftThing({ id: "earlier", starts_at: "2026-07-10T19:00:00Z", editorial_weight: 1 }), // lowest rank, earliest date
    ];
    const sel = selectEdition({ ...BASE_INPUT, things });
    expect(sel.secondary.picks.map((p) => p.id)).toEqual(["earlier", "later"]);
  });
});

describe("cooldown", () => {
  it("excludes a cooldown thing from the auto-pick but keeps it visible in the bench", () => {
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-10T12:00:00Z", editorial_weight: 10 }),
      draftThing({ id: "cooled-down", starts_at: "2026-07-11T19:00:00Z", editorial_weight: 8 }),
      draftThing({ id: "clean-pick", starts_at: "2026-07-11T20:00:00Z", editorial_weight: 1 }),
    ];
    const sel = selectEdition({
      ...BASE_INPUT,
      things,
      cooldownIds: new Set(["cooled-down"]),
    });
    const pickedIds = sel.secondary.picks.map((p) => p.id);
    expect(pickedIds).not.toContain("cooled-down");
    expect(pickedIds).toContain("clean-pick");
    // still visible on the bench for the cockpit swap control
    expect(sel.secondary.rankedBench.map((p) => p.id)).toContain("cooled-down");
  });
});

describe("anchor conditional vs standing", () => {
  // hero_eligible:false on the non-event fixture keeps it out of the anchor
  // pool (which requires hero_eligible=true) so the two slots never contend
  // for the same lone Tier-3 candidate.
  const nonEventFixture = draftThing({
    id: "nonevent-pick", type: "firstlook", happening_tier: 3, hero_eligible: false, created_at: "2026-07-01T00:00:00Z",
  });
  const evergreenAnchor = draftThing({ id: "evergreen-anchor", happening_tier: 3, starts_at: null, hero_eligible: true });

  it("Thursday (weekend): anchor fires only when < 3 qualifying secondaries", () => {
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-10T12:00:00Z", editorial_weight: 10 }),
      draftThing({ id: "sec-1", starts_at: "2026-07-11T19:00:00Z" }),
      nonEventFixture,
      evergreenAnchor,
    ];
    const sel = selectEdition({ ...BASE_INPUT, things, editionType: "weekend" });
    expect(sel.secondary.picks.length).toBeLessThan(3);
    expect(sel.nonevent.picks[0]?.id).toBe("nonevent-pick");
    expect(sel.anchor.fires).toBe(true);
    expect(sel.anchor.picks[0]?.id).toBe("evergreen-anchor");
  });

  it("Thursday: anchor does NOT fire once 3 qualifying secondaries exist", () => {
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-10T12:00:00Z", editorial_weight: 10 }),
      draftThing({ id: "sec-1", starts_at: "2026-07-11T19:00:00Z" }),
      draftThing({ id: "sec-2", starts_at: "2026-07-11T20:00:00Z" }),
      draftThing({ id: "sec-3", starts_at: "2026-07-11T21:00:00Z" }),
      nonEventFixture,
      evergreenAnchor,
    ];
    const sel = selectEdition({ ...BASE_INPUT, things, editionType: "weekend" });
    expect(sel.secondary.picks.length).toBe(3);
    expect(sel.anchor.fires).toBe(false);
  });

  it("Sunday (week_ahead): anchor is standing regardless of secondary count", () => {
    const sundayWindow = ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"];
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-13T12:00:00Z", editorial_weight: 10 }),
      draftThing({ id: "sec-1", starts_at: "2026-07-14T19:00:00Z" }),
      draftThing({ id: "sec-2", starts_at: "2026-07-14T20:00:00Z" }),
      draftThing({ id: "sec-3", starts_at: "2026-07-14T21:00:00Z" }),
      nonEventFixture,
      evergreenAnchor,
    ];
    const sel = selectEdition({
      ...BASE_INPUT,
      things,
      editionType: "week_ahead",
      windowDays: sundayWindow,
      editionDateKey: "2026-07-12",
    });
    expect(sel.secondary.picks.length).toBe(3);
    expect(sel.anchor.fires).toBe(true);
    expect(sel.anchor.picks[0]?.id).toBe("evergreen-anchor");
  });
});

describe("sponsor-blindness", () => {
  it("a thing flagged is_featured/sponsor_id (adversarially injected) never outranks on those fields", () => {
    const sponsored = draftThing({ id: "sponsored", starts_at: "2026-07-11T19:00:00Z", editorial_weight: 0 });
    const organic = draftThing({ id: "organic", starts_at: "2026-07-11T19:00:00Z", editorial_weight: 0 });
    // Inject fields the DraftThing type never declares/selects — cascade() must
    // ignore them structurally (ranking reads only tier/weight/starts_at).
    (sponsored as unknown as Record<string, unknown>).is_featured = true;
    (sponsored as unknown as Record<string, unknown>).sponsor_id = "sponsor-1";
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-10T12:00:00Z", editorial_weight: 10 }),
      sponsored,
      organic,
    ];
    const sel = selectEdition({ ...BASE_INPUT, things });
    // Same starts_at + same editorial_weight -> tie-break is stable input order,
    // i.e. unaffected by the sponsor fields. "organic" was pushed after
    // "sponsored" in input order, so if sponsor fields had any effect the
    // order would need to change; it must not.
    const order = sel.secondary.rankedBench.map((p) => p.id);
    expect(order.indexOf("sponsored")).toBeLessThan(order.indexOf("organic"));
  });
});

describe("determinism", () => {
  it("same input -> identical selection every call", () => {
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-10T12:00:00Z", editorial_weight: 10 }),
      draftThing({ id: "sec-1", starts_at: "2026-07-11T19:00:00Z" }),
      draftThing({ id: "fresh", type: "firstlook", happening_tier: 3, created_at: "2026-07-01T00:00:00Z" }),
    ];
    const a = selectEdition({ ...BASE_INPUT, things });
    const b = selectEdition({ ...BASE_INPUT, things });
    expect(a.hero.picks.map((p) => p.id)).toEqual(b.hero.picks.map((p) => p.id));
    expect(a.secondary.picks.map((p) => p.id)).toEqual(b.secondary.picks.map((p) => p.id));
    expect(a.nonevent.picks.map((p) => p.id)).toEqual(b.nonevent.picks.map((p) => p.id));
    expect(a.anchor.picks.map((p) => p.id)).toEqual(b.anchor.picks.map((p) => p.id));
  });
});

describe("non-event selection", () => {
  it("prefers type='firstlook' over freshness-only candidates", () => {
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-10T12:00:00Z", editorial_weight: 10 }),
      draftThing({ id: "stale-firstlook", type: "firstlook", happening_tier: 3, created_at: "2020-01-01T00:00:00Z" }),
      draftThing({ id: "fresh-place", type: "place", happening_tier: 3, created_at: "2026-07-05T00:00:00Z" }),
    ];
    const sel = selectEdition({ ...BASE_INPUT, things });
    expect(sel.nonevent.picks[0]?.id).toBe("stale-firstlook");
  });

  it("never picks a dated event, even if it's the freshest remaining candidate", () => {
    const things = [
      draftThing({ id: "hero", starts_at: "2026-07-10T12:00:00Z", editorial_weight: 10 }),
      draftThing({
        id: "freshest-but-an-event",
        type: "event",
        happening_tier: 1,
        starts_at: "2026-09-01T19:00:00Z", // out of window, so not a secondary either
        created_at: "2026-07-06T00:00:00Z",
      }),
      draftThing({ id: "older-place", type: "place", happening_tier: 3, created_at: "2026-01-01T00:00:00Z" }),
    ];
    const sel = selectEdition({ ...BASE_INPUT, things });
    expect(sel.nonevent.picks[0]?.id).toBe("older-place");
  });
});
