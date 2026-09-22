// Gate 4 · A4.3, clustering + transition tests.

import { describe, it, expect } from "vitest";
import { thing } from "./_fixture";
import { clusterBoost, withinClusterFootprint, anchorZoneFor } from "./cluster";
import { hopBetween, sameWalkCluster, adjacentZones } from "./zoneGraph";
import { annotateTransitions } from "./transitions";
import { resolveParams } from "./params";
import type { PlanAnswers, Stop } from "./types";

const walk = resolveParams({ dateISO: "2026-07-04", periods: ["morning"], who: "solo", vibes: [], zone: "downtown_state", transport: "walk" } as PlanAnswers);
const car = resolveParams({ dateISO: "2026-07-04", periods: ["morning"], who: "solo", vibes: [], zone: "downtown_state", transport: "car" } as PlanAnswers);

describe("zoneGraph", () => {
  it("knows the walkable core", () => {
    expect(sameWalkCluster("funk_zone", "downtown_state")).toBe(true);
    expect(sameWalkCluster("funk_zone", "waterfront_harbor")).toBe(true);
    expect(sameWalkCluster("downtown_state", "goleta_isla_vista")).toBe(false);
  });
  it("knows adjacency", () => {
    expect(adjacentZones("waterfront_harbor")).toContain("mesa");
    // R1 W4.1: Goleta now also neighbours Upper State, which the old 6-value
    // graph could not express because Upper State folded into Downtown.
    expect(adjacentZones("goleta_isla_vista")).toEqual(["downtown_state", "upper_state"]);
  });
  it("estimates a short in-core hop as a walk and a distant one as a drive", () => {
    const funk = { lat: 34.4142, lng: -119.6889, zone: "funk_zone" as const };
    const dt = { lat: 34.4208, lng: -119.6982, zone: "downtown_state" as const };
    const goleta = { lat: 34.4358, lng: -119.8276, zone: "goleta_isla_vista" as const };
    expect(hopBetween(funk, dt, "walk").mode).toBe("walk");
    expect(hopBetween(funk, goleta, "walk").mode).toBe("drive"); // too far to walk
    expect(hopBetween(funk, goleta, "car").mode).toBe("drive");
  });
});

describe("clusterBoost", () => {
  it("rewards same-zone and penalizes distant on a walking day", () => {
    const same = thing({ id: "s", neighborhood: "downtown" });
    const far = thing({ id: "f", neighborhood: "goleta" });
    expect(clusterBoost(same, "downtown_state", walk)).toBeGreaterThan(clusterBoost(far, "downtown_state", walk));
    expect(clusterBoost(far, "downtown_state", walk)).toBeLessThan(0);
  });
});

describe("withinClusterFootprint", () => {
  it("walking stays within one walk-cluster", () => {
    expect(withinClusterFootprint(["downtown_state"], "funk_zone", walk)).toBe(true); // same core
    expect(withinClusterFootprint(["downtown_state"], "goleta_isla_vista", walk)).toBe(false); // second cluster
  });
  it("car tolerates two clusters but not three", () => {
    expect(withinClusterFootprint(["downtown_state"], "goleta_isla_vista", car)).toBe(true);
    expect(withinClusterFootprint(["downtown_state", "goleta_isla_vista"], "montecito_carpinteria", car)).toBe(false);
  });
});

describe("anchorZoneFor", () => {
  it("uses the chosen zone, else the modal zone of placed stops", () => {
    expect(anchorZoneFor(car, [])).toBe("downtown_state");
    const anywhere = resolveParams({ dateISO: "2026-07-04", periods: ["morning"], who: "solo", vibes: [], zone: null } as PlanAnswers);
    const placed = [thing({ neighborhood: "funk_zone" }), thing({ neighborhood: "funk_zone" }), thing({ neighborhood: "mesa" })];
    expect(anchorZoneFor(anywhere, placed)).toBe("funk_zone");
  });
});

describe("annotateTransitions", () => {
  it("annotates a walk between two core stops and states parking once", () => {
    const pool = [
      thing({ id: "a", neighborhood: "funk_zone", lat: 34.4142, lng: -119.6889 }),
      thing({ id: "b", neighborhood: "downtown", lat: 34.4208, lng: -119.6982 }),
    ];
    const stops: Stop[] = pool.map((t, i) => ({ id: `s${i}`, block: "morning", thingId: t.id, fromSaved: false, fromDraft: true }));
    const tr = annotateTransitions(stops, new Map(pool.map((t) => [t.id, t])), walk);
    expect(tr).toHaveLength(1); // one transition between two stops
    expect(tr[0].mode).toBe("walk");
    expect(tr[0].parkingNote).toBeTruthy(); // parking truth stated once
    expect(tr[0].label).toContain("min walk");
  });
});
