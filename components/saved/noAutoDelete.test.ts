import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * R1 Wave 1 (W1.1). The one regression that must never come back.
 *
 * The Saved list used to run an effect that diffed the saved ids against the
 * published pool and called `remove(id)` on anything it could not see. The pool
 * was silently truncated to 1,000 rows by the database, so a third of the
 * catalog looked deleted and was wiped off the visitor's device. Reproduced on
 * production: two real saves went to `{}` in the time it took /saved to hydrate
 * (docs/audits/2026-09-21-technical-pass.md, TP-A1-01 and TP-A1-10).
 *
 * This repo has no React component-test harness, and adding one is not in scope
 * for R1, so this pins the invariant at the source level instead: a save may only
 * ever be removed by a handler the visitor triggered, never by an effect. It is
 * deliberately narrow. `onRemove={() => remove(id)}` on a card is a visitor
 * action and stays legal; the same call inside a `useEffect` is the bug.
 */

const source = readFileSync(
  fileURLToPath(new URL("./SavedClient.tsx", import.meta.url)),
  "utf8",
);

/** The bodies of every `useEffect(...)` call in the file, brace-matched. */
function useEffectBodies(code: string): string[] {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const start = code.indexOf("useEffect(", from);
    if (start === -1) break;
    let depth = 0;
    let i = code.indexOf("(", start);
    const open = i;
    for (; i < code.length; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    bodies.push(code.slice(open, i + 1));
    from = i + 1;
  }
  return bodies;
}

describe("SavedClient never auto-deletes a save", () => {
  const effects = useEffectBodies(source);

  it("finds the effects it is supposed to be checking", () => {
    // A guard that silently checks nothing is worse than no guard.
    expect(effects.length).toBeGreaterThan(0);
  });

  it("calls no removal from inside any effect", () => {
    const offenders = effects.filter((body) => /\bremove\s*\(/.test(body));
    expect(offenders).toEqual([]);
  });

  it("has not reintroduced the pool-diff cleanup", () => {
    // The specific shape of the old bug: treating absence from a fetched list as
    // permission to delete.
    expect(source).not.toMatch(/if\s*\(\s*!live\.has\(/);
    expect(source).not.toMatch(/things\.length\s*>=\s*1000/);
  });
});
