// Gate 4 · A4.3, clustering + transition tests.

import { describe, it, expect } from "vitest";
import { thing } from "./_fixture";
import { clusterBoost, withinClusterFootprint, anchorZoneFor } from "./cluster";
import { hopBetween, sameWalkCluster, adjacentZones } from "./zoneGraph";
import { annotateTransitions } from "./transitions";
import { resolveParams } from "./params";
import type { PlanAnswers, Stop } from "./types";

const walk = resolveParams({ dateISO: "2026-07-04", periods: ["morning"], who: "solo", vibes: [], zone: "downtown", transport: "walk" } as PlanAnswers);
const car = resolveParams({ dateISO: "2026-07-04", periods: ["morning"], who: "solo", vibes: [], zone: "downtown", transport: "car" } as PlanAnswers);

describe("zoneGraph", () => {
  it("knows the walkable core", () => {
    expect(sameWalkCluster("funk", "downtown")).toBe(true);
    expect(sameWalkCluster("funk", "waterfront")).toBe(true);
    expect(sameWalkCluster("downtown", "goleta")).toBe(false);
  });
  it("knows adjacency", () => {
    expect(adjacentZones("waterfront")).toContain("mesa");
    expect(adjacentZones("goleta")).toEqual(["downtown"]);
  });
  it("estimates a short in-core hop as a walk and a distant one as a drive", () => {
    const funk = { lat: 34.4142, lng: -119.6889, zone: "funk" as const };
    const dt = { lat: 34.4208, lng: -119.6982, zone: "downtown" as const };
    const goleta = { lat: 34.4358, lng: -119.8276, zone: "goleta" as const };
    expect(hopBetween(funk, dt, "walk").mode).toBe("walk");
    expect(hopBetween(funk, goleta, "walk").mode).toBe("drive"); // too far to walk
    expect(hopBetween(funk, goleta, "car").mode).toBe("drive");
  });
});

describe("clusterBoost", () => {
  it("rewards same-zone and penalizes distant on a walking day", () => {
    const same = thing({ id: "s", nearby_zone: "downtown" });
    const far = thing({ id: "f", nearby_zone: "goleta" });
    expect(clusterBoost(same, "downtown", walk)).toBeGreaterThan(clusterBoost(far, "downtown", walk));
    expect(clusterBoost(far, "downtown", walk)).toBeLessThan(0);
  });
});

describe("withinClusterFootprint", () => {
  it("walking stays within one walk-cluster", () => {
    expect(withinClusterFootprint(["downtown"], "funk", walk)).toBe(true); // same core
    expect(withinClusterFootprint(["downtown"], "goleta", walk)).toBe(false); // second cluster
  });
  it("car tolerates two clusters but not three", () => {
    expect(withinClusterFootprint(["downtown"], "goleta", car)).toBe(true);
    expect(withinClusterFootprint(["downtown", "goleta"], "montecito", car)).toBe(false);
  });
});

describe("anchorZoneFor", () => {
  it("uses the chosen zone, else the modal zone of placed stops", () => {
    expect(anchorZoneFor(car, [])).toBe("downtown");
    const anywhere = resolveParams({ dateISO: "2026-07-04", periods: ["morning"], who: "solo", vibes: [], zone: null } as PlanAnswers);
    const placed = [thing({ nearby_zone: "funk" }), thing({ nearby_zone: "funk" }), thing({ nearby_zone: "mesa" })];
    expect(anchorZoneFor(anywhere, placed)).toBe("funk");
  });
});

describe("annotateTransitions", () => {
  it("annotates a walk between two core stops and states parking once", () => {
    const pool = [
      thing({ id: "a", nearby_zone: "funk", lat: 34.4142, lng: -119.6889 }),
      thing({ id: "b", nearby_zone: "downtown", lat: 34.4208, lng: -119.6982 }),
    ];
    const stops: Stop[] = pool.map((t, i) => ({ id: `s${i}`, block: "morning", thingId: t.id, fromSaved: false, fromDraft: true }));
    const tr = annotateTransitions(stops, new Map(pool.map((t) => [t.id, t])), walk);
    expect(tr).toHaveLength(1); // one transition between two stops
    expect(tr[0].mode).toBe("walk");
    expect(tr[0].parkingNote).toBeTruthy(); // parking truth stated once
    expect(tr[0].label).toContain("min walk");
  });
});
