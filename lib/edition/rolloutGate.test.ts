import { describe, it, expect, afterEach } from "vitest";
import { autosendUnapprovedEnabled } from "./rolloutGate";

describe("autosendUnapprovedEnabled — spec §11.3 staged rollout", () => {
  const saved = process.env.EDITION_AUTOSEND_UNAPPROVED;
  afterEach(() => {
    if (saved === undefined) delete process.env.EDITION_AUTOSEND_UNAPPROVED;
    else process.env.EDITION_AUTOSEND_UNAPPROVED = saved;
  });

  it("defaults to false (safe: a draft edition is not sent) when unset", () => {
    delete process.env.EDITION_AUTOSEND_UNAPPROVED;
    expect(autosendUnapprovedEnabled()).toBe(false);
  });
  it("is false for any value other than the literal string '1'", () => {
    for (const v of ["true", "yes", "on", "0", ""]) {
      process.env.EDITION_AUTOSEND_UNAPPROVED = v;
      expect(autosendUnapprovedEnabled()).toBe(false);
    }
  });
  it("is true only when explicitly set to '1'", () => {
    process.env.EDITION_AUTOSEND_UNAPPROVED = "1";
    expect(autosendUnapprovedEnabled()).toBe(true);
  });
});
