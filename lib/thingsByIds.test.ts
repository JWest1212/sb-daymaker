import { describe, it, expect, vi, beforeEach } from "vitest";

// R1 W7.4. A dropped connection must never be reported as "these ids are gone".
// Supabase's client does not throw on a network failure; it resolves with
// { error }. getThingsByIds has to turn that into an error the caller can see.

let response: { data: unknown; error: unknown } = { data: [], error: null };
function query() {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "in", "eq", "abortSignal"]) q[m] = () => q;
  q.then = (resolve: (v: unknown) => void) => resolve(response);
  return q;
}
vi.mock("./supabase", () => ({ getSupabase: () => ({ from: () => query() }) }));
vi.mock("./venues", () => ({ getDogFriendlyVenueIds: async () => new Set<string>() }));

const { getThingsByIds, ThingsUnreachableError } = await import("./things");

describe("getThingsByIds", () => {
  beforeEach(() => { response = { data: [], error: null }; });

  it("throws ThingsUnreachableError when the database cannot be reached", async () => {
    response = { data: null, error: { message: "TypeError: Failed to fetch" } };
    await expect(getThingsByIds(["a"])).rejects.toBeInstanceOf(ThingsUnreachableError);
  });

  it("resolves an empty map when the database answered and had none of them", async () => {
    response = { data: [], error: null };
    const m = await getThingsByIds(["a", "b"]);
    expect(m.size).toBe(0);
  });

  it("returns early without asking when there are no ids", async () => {
    response = { data: null, error: { message: "should not be read" } };
    expect((await getThingsByIds([])).size).toBe(0);
  });
});
