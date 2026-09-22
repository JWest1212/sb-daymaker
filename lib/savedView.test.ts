import { describe, it, expect } from "vitest";
import type { Thing } from "./things";
import { filterByState, splitPast, beenList, partitionSaves, pastEventLabel, type SavesMap } from "./savedView";
import { groupSaved } from "./savedGroups";

// Minimal Thing factory, only the fields these selectors read matter.
function thing(id: string, over: Partial<Thing> = {}): Thing {
  return {
    id,
    type: "place",
    status: "published",
    hero_eligible: true,
    is_civic: false,
    source: null,
    venue_name: null,
    price_note: null,
    series_key: null,
    title: id,
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
    quality_tier: 1,
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

describe("filterByState", () => {
  const a = thing("a");
  const b = thing("b");
  const c = thing("c");
  const pool = [a, b, c];

  it("is value-sensitive: a want→been flip in a NEW map re-derives (the regression)", () => {
    const before: SavesMap = { a: "want", b: "want", c: "been" };
    expect(filterByState(pool, before, "want").map((t) => t.id)).toEqual(["a", "b"]);
    expect(filterByState(pool, before, "been").map((t) => t.id)).toEqual(["c"]);

    // Flip b to "been" in a brand-new object (mirrors immutable provider update).
    const after: SavesMap = { ...before, b: "been" };
    expect(filterByState(pool, after, "want").map((t) => t.id)).toEqual(["a"]);
    expect(filterByState(pool, after, "been").map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("excludes a missing entry and treats an explicit \"want\" as want", () => {
    const saves: SavesMap = { a: "want" }; // b, c not saved
    expect(filterByState(pool, saves, "want").map((t) => t.id)).toEqual(["a"]);
    expect(filterByState(pool, saves, "been")).toEqual([]);
  });
});

describe("splitPast", () => {
  // Fixed reference clock: 2026-07-03T18:00:00Z.
  const nowMs = new Date("2026-07-03T18:00:00Z").getTime();
  const earlierToday = thing("earlier", { type: "event", starts_at: "2026-07-03T09:00:00Z" });
  const laterToday = thing("later", { type: "event", starts_at: "2026-07-03T21:00:00Z" });
  const yesterday = thing("yesterday", { type: "event", starts_at: "2026-07-02T20:00:00Z" });
  const placeNoDate = thing("place"); // non-event, never past

  it("routes only already-started dated events to past", () => {
    const { current, past } = splitPast(
      [earlierToday, laterToday, yesterday, placeNoDate],
      nowMs,
    );
    expect(past.map((t) => t.id)).toEqual(["earlier", "yesterday"]);
    expect(current.map((t) => t.id)).toEqual(["later", "place"]);
  });
});

describe("beenList", () => {
  it("returns only been-state things present in the pool, in saves-key order", () => {
    const pool = [thing("a"), thing("b"), thing("c")];
    // d is been but absent from the pool → excluded; order follows map keys.
    const saves: SavesMap = { c: "been", a: "want", b: "been", d: "been" };
    expect(beenList(pool, saves).map((t) => t.id)).toEqual(["c", "b"]);
  });
});

describe("partitionSaves (R1 W1.1, saves are never deleted)", () => {
  const a = thing("a", { happening_tier: 1, starts_at: "2026-09-22T18:00:00Z" });
  const b = thing("b", { happening_tier: 3, starts_at: null });

  it("renders the rows it has and lists the rest as missing, keeping every id", () => {
    // The spec case: three saved ids, the lookup returns two.
    const lookup = new Map([
      ["a", a],
      ["b", b],
    ]);
    const answered = new Set(["a", "b", "c"]);
    const { found, missing } = partitionSaves(["a", "b", "c"], lookup, answered);
    expect(found.map((t) => t.id)).toEqual(["a", "b"]);
    expect(missing).toEqual(["c"]);
    // Nothing is dropped on the floor: every saved id is accounted for.
    expect(found.length + missing.length).toBe(3);
  });

  it("does not call an id missing until the lookup has actually answered for it", () => {
    // In flight: neither rendered nor reported gone. This is the guard against a
    // slow or failed network reading as "deleted".
    const { found, missing } = partitionSaves(["a", "c"], new Map([["a", a]]), new Set(["a"]));
    expect(found.map((t) => t.id)).toEqual(["a"]);
    expect(missing).toEqual([]);
  });

  it("treats an archived row as found, not missing", () => {
    const archived = thing("z", { status: "archived", happening_tier: 1, starts_at: "2026-06-27T18:00:00Z" });
    const { found, missing } = partitionSaves(["z"], new Map([["z", archived]]), new Set(["z"]));
    expect(found.map((t) => t.id)).toEqual(["z"]);
    expect(missing).toEqual([]);
  });

  it("orders found rows by tier, then soonest start, with evergreen last", () => {
    const soon = thing("soon", { happening_tier: 1, starts_at: "2026-09-21T18:00:00Z" });
    const later = thing("later", { happening_tier: 1, starts_at: "2026-09-25T18:00:00Z" });
    const ever = thing("ever", { happening_tier: 1, starts_at: null });
    const lookup = new Map([
      ["ever", ever],
      ["later", later],
      ["soon", soon],
    ]);
    const { found } = partitionSaves(
      ["ever", "later", "soon"],
      lookup,
      new Set(["ever", "later", "soon"]),
    );
    expect(found.map((t) => t.id)).toEqual(["soon", "later", "ever"]);
  });

  it("returns empty lists for an empty save set", () => {
    expect(partitionSaves([], new Map(), new Set())).toEqual({ found: [], missing: [] });
  });
});

describe("groupSaved with a chosen area (R1 W4.3)", () => {
  const funk = thing("f1", { type: "place", neighborhood: "funk_zone" });
  const funk2 = thing("f2", { type: "event", neighborhood: "funk_zone", starts_at: "2026-10-02T18:00:00Z" });
  const town = thing("d1", { type: "event", neighborhood: "downtown", starts_at: "2026-10-03T18:00:00Z" });
  const unknown = thing("u1", { type: "place", neighborhood: null });

  it("groups by type when no area is chosen", () => {
    const g = groupSaved([funk, funk2, town, unknown]);
    expect(g.map((x) => x.label)).toEqual(["Events", "Places and regulars"]);
  });

  // R1 W7.2. An undated recurring event is a regular, and sits with the places.
  it("puts an undated recurring event under Places and regulars, not Events", () => {
    const swim = thing("s1", { type: "event", starts_at: null, happening_tier: 2 });
    const g = groupSaved([town, swim, funk]);
    expect(g.map((x) => x.label)).toEqual(["Events", "Places and regulars"]);
    expect(g[1].items.map((t) => t.id).sort()).toEqual(["f1", "s1"]);
  });

  it("puts the chosen area in its own group at the top", () => {
    // Without this, Near Me bubbles the matches and then type-grouping scatters
    // them again, so tapping it appears to do nothing (TP-A2-05).
    const g = groupSaved([funk, funk2, town, unknown], { key: "funk_zone", label: "Funk Zone" });
    expect(g[0].label).toBe("In Funk Zone");
    expect(g[0].items.map((t) => t.id).sort()).toEqual(["f1", "f2"]);
  });

  it("keeps everything else grouped by type below it", () => {
    const g = groupSaved([funk, funk2, town, unknown], { key: "funk_zone", label: "Funk Zone" });
    expect(g.slice(1).map((x) => x.label)).toEqual(["Events", "Places and regulars"]);
    expect(g.slice(1).flatMap((x) => x.items.map((t) => t.id)).sort()).toEqual(["d1", "u1"]);
  });

  it("omits the area group when nothing matches, rather than showing it empty", () => {
    const g = groupSaved([town], { key: "funk_zone", label: "Funk Zone" });
    expect(g.some((x) => x.label.startsWith("In "))).toBe(false);
  });

  it("never loses a saved thing between the groups", () => {
    const all = [funk, funk2, town, unknown];
    const g = groupSaved(all, { key: "funk_zone", label: "Funk Zone" });
    expect(g.flatMap((x) => x.items).length).toBe(all.length);
  });
});


describe("pastEventLabel (R1 W7.1, SAV-003)", () => {
  // Monday 2026-09-21, 1:52 PM in Santa Barbara: the audit's reading time.
  const NOW = new Date("2026-09-21T13:52:00-07:00").getTime();
  const at = (iso: string) => new Date(iso).getTime();

  it("the audit's case: an 11 AM event read at 1:52 PM the same day is 'This morning', not 'Last night'", () => {
    expect(pastEventLabel(at("2026-09-21T11:00:00-07:00"), NOW)).toBe("This morning");
  });
  it("same day, afternoon and evening", () => {
    expect(pastEventLabel(at("2026-09-21T13:00:00-07:00"), NOW)).toBe("This afternoon");
    expect(pastEventLabel(at("2026-09-21T19:00:00-07:00"), at("2026-09-21T23:00:00-07:00"))).toBe("This evening");
  });
  it("yesterday evening is 'Last night'; yesterday morning is 'Yesterday'", () => {
    expect(pastEventLabel(at("2026-09-20T20:00:00-07:00"), NOW)).toBe("Last night");
    expect(pastEventLabel(at("2026-09-20T10:00:00-07:00"), NOW)).toBe("Yesterday");
  });
  it("earlier this week names the weekday", () => {
    expect(pastEventLabel(at("2026-09-19T18:00:00-07:00"), NOW)).toBe("On Saturday");
  });
  it("older than a week gives the date", () => {
    expect(pastEventLabel(at("2026-09-05T18:00:00-07:00"), NOW)).toBe("On September 5");
  });
  it("uses the Santa Barbara day, not UTC's: 11 PM Sunday SB is still 'Last night' on Monday", () => {
    // 2026-09-20T23:30 PDT is 2026-09-21T06:30Z, already Monday in UTC.
    expect(pastEventLabel(at("2026-09-20T23:30:00-07:00"), NOW)).toBe("Last night");
  });
});
