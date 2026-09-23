import { describe, it, expect } from "vitest";
import { submitProblems } from "./SubmitForm";

// R1 W7.5 (FRM-001). An empty submit names every gap.
describe("submitProblems", () => {
  const empty = { name: "", where: "", when: "", submitterEmail: "" };
  it("an empty event form has three problems, name first", () => {
    const p = submitProblems(empty, "event");
    expect(Object.keys(p)).toEqual(["name", "where", "when"]);
  });
  it("a business does not need a when", () => {
    expect(Object.keys(submitProblems(empty, "business"))).toEqual(["name", "where"]);
  });
  it("a complete form has none", () => {
    expect(submitProblems({ name: "Jazz", where: "SOhO", when: "Fri 8pm", submitterEmail: "" }, "event")).toEqual({});
  });
  it("an email is only checked when one is typed", () => {
    expect(submitProblems({ name: "x", where: "y", when: "z", submitterEmail: "nope" }, "event")).toEqual({
      submitterEmail: "That email doesn't look right.",
    });
    expect(submitProblems({ name: "x", where: "y", when: "z", submitterEmail: "a@b.co" }, "event")).toEqual({});
  });
});
