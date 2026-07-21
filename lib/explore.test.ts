import { describe, it, expect } from "vitest";
import type { Thing, RecurringSchedule, HappyHourWindow } from "./things";
import { withinHorizon, sbDayOfWeek, pickEvergreenFallback, cascade, pickAutoHero, groupByWeek, ordinal, filterByActivity } from "./explore";

// SB weekday reference instants (SB = America/Los_Angeles):
const THU = new Date("2026-07-02T19:00:00Z").getTime(); // Thu noon SB
const FRI = new Date("2026-07-03T19:00:00Z").getTime(); // Fri noon SB
const FRI_UTC_THU_SB = new Date("2026-07-03T01:00:00Z").getTime(); // Fri 01:00 UTC = Thu eve SB

function thing(over: Partial<Thing> = {}): Thing {
  return {
    id: over.id ?? "x",
    type: "place",
    title: over.id ?? "x",
    blurb: null,
    blurb_long: null,
    local_note: null,
    reason_to_go: null,
    happening_tier: 3,
    editorial_weight: 0,
    happening_category: null,
    neighborhood: null,
    nearby_zone: null,
    address: null,
    lat: null,
    lng: null,
    quality_tier: over.quality_tier ?? 1,
    hours: null,
    verified_at: null,
    verified_by: null,
    last_confirmed: null,
    setting: null,
    practical_note: null,
    slug: null,
    updated_at: null,
    price_band: null,
    free: null,
    starts_at: null,
    ends_at: null,
    buy_url: null,
    time_of_day_fit: null,
    is_21_plus: false,
    indoor: false,
    photo_url: null,
    photo_source: null,
    photo_attribution: null,
    visual_kind: null,
    visual_key: null,
    visual_seed: null,
    venue_id: null,
    tags: [],
    activities: [],
    happyHours: [],
    recurring: [],
    ...over,
  };
}

function sched(day_of_week: number): RecurringSchedule {
  return { category: "market", day_of_week, start_time: null, end_time: null, label: null, frequency: "weekly", cadence: "weekly", nth_dow: null, last_confirmed: null };
}
function window(day_of_week: number): HappyHourWindow {
  return { day_of_week, starts_local: "16:00", ends_local: "18:00", deal_text: null };
}

describe("sbDayOfWeek", () => {
  it("reads the SB-local weekday (0=Sun..6=Sat), not the browser's", () => {
    expect(sbDayOfWeek(THU)).toBe(4);
    expect(sbDayOfWeek(FRI)).toBe(5);
    // Friday in UTC but still Thursday evening in SB → Thursday.
    expect(sbDayOfWeek(FRI_UTC_THU_SB)).toBe(4);
  });
});

describe("withinHorizon, W1.3a day-aware Tier-2 on Today", () => {
  const thuMarket = thing({ id: "mkt", happening_tier: 2, recurring: [sched(4)] });

  it("a Thursday-scheduled Tier-2 shows on a Thursday Today, hides on a Friday Today", () => {
    expect(withinHorizon(thuMarket, "today", THU)).toBe(true);
    expect(withinHorizon(thuMarket, "today", FRI)).toBe(false);
  });

  it("Week/Month keep pass-all for Tier-2 regardless of weekday", () => {
    expect(withinHorizon(thuMarket, "week", FRI)).toBe(true);
    expect(withinHorizon(thuMarket, "month", FRI)).toBe(true);
  });

  it("a schedule-less Tier-2 passes on Today (can't prove it's off-day)", () => {
    const noSched = thing({ id: "ns", happening_tier: 2, recurring: [] });
    expect(withinHorizon(noSched, "today", FRI)).toBe(true);
  });

  it("respects the SB timezone boundary (Fri 01:00 UTC counts as Thursday)", () => {
    expect(withinHorizon(thuMarket, "today", FRI_UTC_THU_SB)).toBe(true);
  });

  it("applies the day rule to happyhour Tier-2 via happy_hour_windows", () => {
    const hh = thing({ id: "hh", type: "happyhour", happening_tier: 2, happyHours: [window(4)] });
    expect(withinHorizon(hh, "today", THU)).toBe(true);
    expect(withinHorizon(hh, "today", FRI)).toBe(false);
  });

  it("regression: Tier-3 is untouched on every horizon", () => {
    const evergreen = thing({ id: "ev", happening_tier: 3, recurring: [sched(4)] });
    expect(withinHorizon(evergreen, "today", FRI)).toBe(true);
    expect(withinHorizon(evergreen, "week", FRI)).toBe(true);
  });

  it("regression: Tier-1 dated bounding unchanged (today passes, yesterday fails)", () => {
    const todayEvent = thing({ id: "e1", type: "event", happening_tier: 1, starts_at: "2026-07-03T22:00:00Z" });
    const pastEvent = thing({ id: "e0", type: "event", happening_tier: 1, starts_at: "2026-07-01T22:00:00Z" });
    expect(withinHorizon(todayEvent, "today", FRI)).toBe(true);
    expect(withinHorizon(pastEvent, "today", FRI)).toBe(false);
  });
});

describe("withinHorizon, G3.3 weekend", () => {
  const MON = new Date("2026-07-20T19:00:00Z").getTime(); // Mon noon SB; weekend = Fri 24..Sun 26
  it("includes a Saturday dated event, excludes a Tuesday one", () => {
    const sat = thing({ id: "sat", type: "event", happening_tier: 1, starts_at: "2026-07-25T20:00:00Z" });
    const tue = thing({ id: "tue", type: "event", happening_tier: 1, starts_at: "2026-07-21T20:00:00Z" });
    expect(withinHorizon(sat, "weekend", MON)).toBe(true);
    expect(withinHorizon(tue, "weekend", MON)).toBe(false);
  });
  it("includes a Friday 6pm event but not a Friday 10am one (Fri 5pm cutoff)", () => {
    const friEve = thing({ id: "fe", type: "event", happening_tier: 1, starts_at: "2026-07-25T01:00:00Z" }); // Fri 6pm SB
    const friMorn = thing({ id: "fm", type: "event", happening_tier: 1, starts_at: "2026-07-24T17:00:00Z" }); // Fri 10am SB
    expect(withinHorizon(friEve, "weekend", MON)).toBe(true);
    expect(withinHorizon(friMorn, "weekend", MON)).toBe(false);
  });
  it("recurring Tier-2 firing Saturday passes; Tuesday-only fails", () => {
    expect(withinHorizon(thing({ id: "sm", happening_tier: 2, recurring: [sched(6)] }), "weekend", MON)).toBe(true);
    expect(withinHorizon(thing({ id: "tm", happening_tier: 2, recurring: [sched(2)] }), "weekend", MON)).toBe(false);
  });
  it("Tier-3 evergreen always passes weekend", () => {
    expect(withinHorizon(thing({ id: "ev", happening_tier: 3 }), "weekend", MON)).toBe(true);
  });
});

describe("pickEvergreenFallback, W1.3b deterministic parachute", () => {
  const pool = [
    thing({ id: "c", happening_tier: 3 }),
    thing({ id: "a", happening_tier: 3 }),
    thing({ id: "b", happening_tier: 3 }),
    thing({ id: "t1", happening_tier: 1 }),
    thing({ id: "t2", happening_tier: 2 }),
  ];

  it("is deterministic: same date + pool → same pick", () => {
    expect(pickEvergreenFallback(pool, "2026-07-02")?.id).toBe(pickEvergreenFallback(pool, "2026-07-02")?.id);
  });

  it("rotates across days", () => {
    // sorted tier-3 ids: [a,b,c]; dayOfYear 182%3=2 → c, 183%3=0 → a.
    expect(pickEvergreenFallback(pool, "2026-07-02")?.id).toBe("c");
    expect(pickEvergreenFallback(pool, "2026-07-03")?.id).toBe("a");
  });

  it("only ever returns Tier-3 things", () => {
    const picked = pickEvergreenFallback(pool, "2026-07-05");
    expect(picked?.happening_tier).toBe(3);
  });

  it("returns null when the pool has no Tier-3 things (signals Layer 2)", () => {
    const noEvergreen = [thing({ id: "t1", happening_tier: 1 }), thing({ id: "t2", happening_tier: 2 })];
    expect(pickEvergreenFallback(noEvergreen, "2026-07-02")).toBeNull();
  });
});

describe("cascade, W2.1a editorial_weight consumption", () => {
  const ev = (id: string, over: Partial<Thing> = {}) =>
    thing({ id, ...over });

  it("negative weight sinks to the bottom of its tier section but stays present", () => {
    const civic = ev("civic", { happening_tier: 3, editorial_weight: -3 });
    const plain = ev("plain", { happening_tier: 3, editorial_weight: 0 });
    const boosted = ev("boost", { happening_tier: 3, editorial_weight: 2 });
    const out = cascade([civic, plain, boosted]).map((t) => t.id);
    expect(out).toEqual(["boost", "plain", "civic"]); // boosted first, negative last
    expect(out).toContain("civic"); // never hidden
  });

  it("Tier-1 chronological order preserved among zero-weight items", () => {
    const later = ev("later", { happening_tier: 1, type: "event", starts_at: "2026-07-03T20:00:00Z" });
    const sooner = ev("sooner", { happening_tier: 1, type: "event", starts_at: "2026-07-03T18:00:00Z" });
    expect(cascade([later, sooner]).map((t) => t.id)).toEqual(["sooner", "later"]);
  });

  it("Tier-1 same-start tie breaks toward the founder-boosted item", () => {
    const plain = ev("plain", { happening_tier: 1, type: "event", starts_at: "2026-07-03T18:00:00Z", editorial_weight: 0 });
    const boosted = ev("boost", { happening_tier: 1, type: "event", starts_at: "2026-07-03T18:00:00Z", editorial_weight: 4 });
    expect(cascade([plain, boosted]).map((t) => t.id)).toEqual(["boost", "plain"]);
  });

  it("Tier-1 soonest-first still wins over weight (chronology is primary)", () => {
    const soonPlain = ev("soon", { happening_tier: 1, type: "event", starts_at: "2026-07-03T18:00:00Z", editorial_weight: 0 });
    const laterBoost = ev("late", { happening_tier: 1, type: "event", starts_at: "2026-07-03T21:00:00Z", editorial_weight: 5 });
    expect(cascade([laterBoost, soonPlain]).map((t) => t.id)).toEqual(["soon", "late"]);
  });

  it("Tier-2/3 order primarily by weight desc", () => {
    const a = ev("a", { happening_tier: 2, editorial_weight: 1 });
    const b = ev("b", { happening_tier: 2, editorial_weight: 3 });
    const c = ev("c", { happening_tier: 2, editorial_weight: 0 });
    expect(cascade([a, b, c]).map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("tiers always sort before weight (Tier-1 zero-weight beats Tier-3 boosted)", () => {
    const t1 = ev("t1", { happening_tier: 1, type: "event", starts_at: "2026-07-03T20:00:00Z" });
    const t3 = ev("t3", { happening_tier: 3, editorial_weight: 5 });
    expect(cascade([t3, t1]).map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("is a stable sort: equal keys keep input order", () => {
    const a = ev("a", { happening_tier: 3, editorial_weight: 0 });
    const b = ev("b", { happening_tier: 3, editorial_weight: 0 });
    expect(cascade([a, b]).map((t) => t.id)).toEqual(["a", "b"]);
    expect(cascade([b, a]).map((t) => t.id)).toEqual(["b", "a"]);
  });

  // TRUST RULE regression (schema §A7 / wave §0.3): the ranker must never read
  // is_featured / sponsor_id. We set those adversarially on a fixture and assert the
  // order is identical to the same fixture without them. Cast through unknown because
  // those fields aren't on the Thing type at all, proving the sort can't consume them.
  it("never reads is_featured / sponsor_id (order unchanged when set adversarially)", () => {
    const base = [
      ev("z", { happening_tier: 1, type: "event", starts_at: "2026-07-03T21:00:00Z" }),
      ev("y", { happening_tier: 1, type: "event", starts_at: "2026-07-03T18:00:00Z" }),
      ev("x", { happening_tier: 3, editorial_weight: 2 }),
    ];
    const spiked = base.map((t) =>
      ({ ...t, is_featured: true, sponsor_id: "paid-placement-123" }) as unknown as Thing,
    );
    expect(cascade(spiked).map((t) => t.id)).toEqual(cascade(base).map((t) => t.id));
  });
});

describe("trust rule, pickAutoHero blind to sponsor status (G5.7)", () => {
  it("picks the same hero when is_featured / sponsor_id are set adversarially", () => {
    const base = [
      thing({ id: "plain", happening_tier: 1, type: "event", editorial_weight: 0, starts_at: "2026-07-03T18:00:00Z" }),
      thing({ id: "boost", happening_tier: 1, type: "event", editorial_weight: 3, starts_at: "2026-07-03T20:00:00Z" }),
    ];
    const spiked = base.map((t) => ({ ...t, is_featured: true, sponsor_id: "paid-placement-123" }) as unknown as Thing);
    const TODAY = "2026-07-03";
    expect(pickAutoHero(cascade(spiked), TODAY)?.id).toBe(pickAutoHero(cascade(base), TODAY)?.id);
  });
});

describe("pickAutoHero, W2.1a shared hero picker", () => {
  const TODAY = "2026-07-03";
  const todayEvent = (id: string, weight: number, hhmm: string) =>
    thing({ id, happening_tier: 1, type: "event", editorial_weight: weight, starts_at: `2026-07-03T${hhmm}:00Z` });

  it("prefers today's highest positive-weight Tier-1 item", () => {
    const ordered = cascade([
      todayEvent("plain", 0, "18:00"),
      todayEvent("boost", 3, "20:00"),
    ]);
    expect(pickAutoHero(ordered, TODAY)?.id).toBe("boost");
  });

  it("breaks weight ties toward the soonest start", () => {
    const ordered = cascade([
      todayEvent("late", 2, "21:00"),
      todayEvent("early", 2, "17:00"),
    ]);
    expect(pickAutoHero(ordered, TODAY)?.id).toBe("early");
  });

  it("ignores positive weight that isn't happening today", () => {
    const ordered = cascade([
      thing({ id: "tmrw", happening_tier: 1, type: "event", editorial_weight: 5, starts_at: "2026-07-04T20:00:00Z" }),
      thing({ id: "todayPlain", happening_tier: 1, type: "event", editorial_weight: 0, starts_at: "2026-07-03T18:00:00Z" }),
    ]);
    // no positive-weight item TODAY → falls back to ordered[0] (soonest today).
    expect(pickAutoHero(ordered, TODAY)?.id).toBe("todayPlain");
  });

  it("falls back to ordered[0] when no Tier-1 item today is boosted", () => {
    const ordered = cascade([
      thing({ id: "t3", happening_tier: 3, editorial_weight: 4 }),
      todayEvent("t1", 0, "18:00"),
    ]);
    expect(pickAutoHero(ordered, TODAY)?.id).toBe("t1");
  });

  it("returns null on an empty pool", () => {
    expect(pickAutoHero([], TODAY)).toBeNull();
  });
});

describe("ordinal, week header date suffixes", () => {
  it("uses st/nd/rd for 1/2/3 (and 21/22/23, 31)", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
    expect(ordinal(31)).toBe("31st");
  });

  it("special-cases 11/12/13 to 'th', not 'st'/'nd'/'rd'", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("falls back to 'th' for everything else", () => {
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(18)).toBe("18th");
    expect(ordinal(30)).toBe("30th");
  });
});

describe("groupByWeek, Month lead sticky header grouping", () => {
  it("buckets items into SB-local Sun–Sat weeks, ascending", () => {
    const items = [
      thing({ id: "wk1", happening_tier: 1, type: "event", starts_at: "2026-07-03T19:00:00Z" }), // Fri Jul 3 → week of Jun 28–Jul 4
      thing({ id: "wk2a", happening_tier: 1, type: "event", starts_at: "2026-07-05T19:00:00Z" }), // Sun Jul 5 → week of Jul 5–11
      thing({ id: "wk2b", happening_tier: 1, type: "event", starts_at: "2026-07-11T19:00:00Z" }), // Sat Jul 11 → same week as wk2a
    ];
    const weeks = groupByWeek(items);
    expect(weeks.map((w) => w.items.map((t) => t.id))).toEqual([["wk1"], ["wk2a", "wk2b"]]);
  });

  it("formats same-month and cross-month week labels", () => {
    const items = [
      thing({ id: "cross", happening_tier: 1, type: "event", starts_at: "2026-07-03T19:00:00Z" }),
      thing({ id: "same", happening_tier: 1, type: "event", starts_at: "2026-07-05T19:00:00Z" }),
    ];
    const weeks = groupByWeek(items);
    expect(weeks[0].weekLabel).toBe("June 28th through July 4th");
    expect(weeks[1].weekLabel).toBe("July 5th through 11th");
  });

  it("collects undated items into a trailing, header-less group instead of dropping them", () => {
    const items = [
      thing({ id: "dated", happening_tier: 1, type: "event", starts_at: "2026-07-05T19:00:00Z" }),
      thing({ id: "undated", happening_tier: 3 }),
    ];
    const weeks = groupByWeek(items);
    const last = weeks[weeks.length - 1];
    expect(last.weekLabel).toBeNull();
    expect(last.items.map((t) => t.id)).toEqual(["undated"]);
  });
});

// Home Rework spec §11.4, the Activity door's filter, stacked with filterByLens.
describe("filterByActivity", () => {
  it("passes everything through when no activity is selected", () => {
    const things = [thing({ id: "a", activities: ["outdoors"] }), thing({ id: "b", activities: [] })];
    expect(filterByActivity(things, null).map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("keeps only things tagged with the selected activity", () => {
    const things = [
      thing({ id: "a", activities: ["outdoors", "markets"] }),
      thing({ id: "b", activities: ["live-music"] }),
      thing({ id: "c", activities: [] }),
    ];
    expect(filterByActivity(things, "outdoors").map((t) => t.id)).toEqual(["a"]);
  });
});
