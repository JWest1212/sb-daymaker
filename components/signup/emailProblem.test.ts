import { describe, it, expect } from "vitest";
import { emailProblem } from "./EmailSignup";

// R1 W7.6. The audit's two probes, caught by the site rather than the browser.
describe("emailProblem", () => {
  it("catches the audit's cases", () => {
    expect(emailProblem("notanemail")).toBe("That doesn't look like an email address.");
    expect(emailProblem("test@")).toBe("That doesn't look like an email address.");
    expect(emailProblem("   ")).toBe("Type your email address.");
  });
  it("passes a real address", () => {
    expect(emailProblem("jim@example.com")).toBeNull();
  });
});
