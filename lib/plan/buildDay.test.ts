import { describe, it, expect } from "vitest";
import type { Thing } from "@/lib/things";
import { DAY_SHAPES, DAY_SHAPE_BY_ID, DEFAULT_DAY_SHAPE } from "./dayShapes";
import {
  buildDay,
  activeBlocks,
  naturalBlock,
  makeMyDayAnswers,
} from "./buildDay";
import type { PlanAnswers, Stop } from "./types";

// ---- synthetic content pool ------------------------------------------------
// A small, hand-built Thing[] covering the zones / tags / time-of-day fits the
// engine reasons over. Deliberately NOT the raw seed (which is unmapped) — this
// keeps the test deterministic and self-contained.
function mk(p: Partial<Thing> & Pick<Thing, "id" | "title">): Thing {
  return {
    type: "place",
    blurb: null,
    blurb_long: null,
    local_note: null,
    reason_to_go: null,
    happening_tier: 3,
    happening_category: null,
    neighborhood: null,
    nearby_zone: null,
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
    tags: [],
    happyHours: [],
    recurring: [],
    ...p,
  };
}

const DATE = "2026-07-09";

const POOL: Thing[] = [
  mk({ id: "stearns", title: "Stearns Wharf", tags: ["outdoors_active", "free_sb"], nearby_zone: "waterfront", time_of_day_fit: ["morning", "afternoon"] }),
  mk({ id: "mesa-steps", title: "Mesa Lane Steps", tags: ["outdoors_active", "free_sb"], nearby_zone: "mesa", time_of_day_fit: ["morning"] }),
  mk({ id: "brophy", title: "Brophy Bros", tags: ["wine_food"], happening_category: "food_drink_spot", nearby_zone: "waterfront", time_of_day_fit: ["afternoon"] }),
  mk({ id: "lucky-penny", title: "Lucky Penny", tags: ["wine_food"], happening_category: "food_drink_spot", nearby_zone: "funk", time_of_day_fit: ["afternoon"] }),
  mk({ id: "sbma", title: "SB Museum of Art", tags: ["arts_culture"], nearby_zone: "downtown", time_of_day_fit: ["afternoon"] }),
  mk({ id: "moxi", title: "MOXI Museum", tags: ["arts_culture", "family_day"], nearby_zone: "downtown", time_of_day_fit: ["afternoon"] }),
  mk({ id: "lark", title: "The Lark", tags: ["wine_food", "date_night"], happening_category: "food_drink_spot", nearby_zone: "funk", time_of_day_fit: ["evening"] }),
  mk({ id: "butterfly", title: "Butterfly Beach", tags: ["outdoors_active", "date_night"], nearby_zone: "montecito", time_of_day_fit: ["evening", "afternoon"] }),
  mk({ id: "bar-21", title: "Late Bar", tags: ["nightlife"], is_21_plus: true, nearby_zone: "downtown", time_of_day_fit: ["late"] }),
  mk({ id: "mission", title: "Old Mission", tags: ["arts_culture", "free_sb"], nearby_zone: "downtown", time_of_day_fit: ["afternoon"] }),
  // dated events
  mk({ id: "bowl-today", title: "Bowl Concert", type: "event", tags: ["catch_a_show"], happening_tier: 1, happening_category: "live_music", starts_at: `${DATE}T19:00:00-07:00`, time_of_day_fit: ["evening"] }),
  mk({ id: "fest-other", title: "Off-day Festival", type: "event", tags: ["wine_food"], happening_tier: 1, happening_category: "festival_fair", nearby_zone: "funk", starts_at: "2026-08-01T12:00:00-07:00", time_of_day_fit: ["afternoon"] }),
];

const ANSWERS_FULL: PlanAnswers = {
  dateISO: DATE,
  periods: ["morning", "afternoon", "evening"],
  who: "couple",
  vibes: [],
  zone: null,
};

const titles = (stops: Stop[]) =>
  stops.map((s) => POOL.find((t) => t.id === s.thingId)?.title ?? s.thingId);
const noRepeats = (stops: Stop[]) =>
  new Set(stops.map((s) => s.thingId)).size === stops.length;

describe("activeBlocks — midday is a lunch bridge", () => {
  it("inserts midday only when morning AND afternoon are both covered", () => {
    expect(activeBlocks(["morning", "afternoon", "evening"])).toEqual([
      "morning",
      "midday",
      "afternoon",
      "evening",
    ]);
  });
  it("no midday when afternoon is missing", () => {
    expect(activeBlocks(["morning", "evening"])).toEqual(["morning", "evening"]);
  });
  it("maps UI 'late' to the night block", () => {
    expect(activeBlocks(["evening", "late"])).toEqual(["evening", "night"]);
  });
});

describe("naturalBlock", () => {
  it("21+ / late → night", () => expect(naturalBlock(POOL.find((t) => t.id === "bar-21")!)).toBe("night"));
  it("evening dinner → evening", () => expect(naturalBlock(POOL.find((t) => t.id === "lark")!)).toBe("evening"));
  it("morning hike → morning", () => expect(naturalBlock(POOL.find((t) => t.id === "mesa-steps")!)).toBe("morning"));
  it("afternoon food → midday bridge", () => expect(naturalBlock(POOL.find((t) => t.id === "brophy")!)).toBe("midday"));
});

describe("buildDay — core guarantees", () => {
  it("is deterministic (same inputs → same output)", () => {
    const a = buildDay(ANSWERS_FULL, DEFAULT_DAY_SHAPE, POOL);
    const b = buildDay(ANSWERS_FULL, DEFAULT_DAY_SHAPE, POOL);
    expect(a).toEqual(b);
  });

  it("fills every active block with no repeats", () => {
    const stops = buildDay(ANSWERS_FULL, DEFAULT_DAY_SHAPE, POOL);
    expect(stops.map((s) => s.block)).toEqual(["morning", "midday", "afternoon", "evening"]);
    expect(noRepeats(stops)).toBe(true);
  });

  it("never surfaces a dated event from another date", () => {
    const stops = buildDay(ANSWERS_FULL, DEFAULT_DAY_SHAPE, POOL);
    expect(stops.map((s) => s.thingId)).not.toContain("fest-other");
  });

  it("prefers the anchor zone when one is chosen", () => {
    const stops = buildDay({ ...ANSWERS_FULL, zone: "funk" }, DAY_SHAPE_BY_ID.funk, POOL);
    const evening = stops.find((s) => s.block === "evening");
    expect(evening?.thingId).toBe("lark"); // funk wins over montecito Butterfly
  });

  it("seats a pinned saved spot in its natural block, locked + badged", () => {
    const pin = POOL.find((t) => t.id === "butterfly")!; // natural: evening
    const stops = buildDay(
      { ...ANSWERS_FULL, periods: ["morning"] }, // evening not selected…
      DEFAULT_DAY_SHAPE,
      POOL,
      [pin],
    );
    const evening = stops.find((s) => s.block === "evening"); // …but the pin forces it in
    expect(evening?.thingId).toBe("butterfly");
    expect(evening?.pinned).toBe(true);
    expect(evening?.fromSaved).toBe(true);
  });

  it("keeps a family day free of 21+ spots", () => {
    const stops = buildDay(
      { ...ANSWERS_FULL, who: "family", periods: ["evening", "late"] },
      DEFAULT_DAY_SHAPE,
      POOL,
    );
    expect(stops.map((s) => s.thingId)).not.toContain("bar-21");
  });

  it("each of the four day-shapes builds a non-empty, repeat-free day", () => {
    for (const shape of DAY_SHAPES) {
      const stops = buildDay(makeMyDayAnswers(DATE), shape, POOL);
      expect(stops.length).toBeGreaterThan(0);
      expect(noRepeats(stops)).toBe(true);
    }
  });

  it("Make My Day returns a full default day", () => {
    const stops = buildDay(makeMyDayAnswers(DATE), DEFAULT_DAY_SHAPE, POOL);
    expect(stops.length).toBe(4);
    // eslint-disable-next-line no-console
    console.log("\n— Sample days (deterministic) —");
    for (const shape of DAY_SHAPES) {
      const day = buildDay(makeMyDayAnswers(DATE), shape, POOL);
      // eslint-disable-next-line no-console
      console.log(
        `${shape.name}: ` +
          day.map((s) => `${s.block}=${titles([s])[0]}`).join(" · "),
      );
    }
  });
});
