import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as queries from "@/lib/shift-close-queries";
import { describe, expect, test } from "vitest";

/**
 * RT-18 boundary. The review is read-only and consumes exactly the two
 * shift-close reads of the generated client: no write op, no policy field, no
 * `approverCheck` (RT-384 / RT-385 are not in the contract), no hand-rolled
 * fetch, no Authorization header (cookie transport). Static source scan, comments
 * stripped.
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
function filesUnder(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const read = (path: string) => stripComments(readFileSync(join(process.cwd(), path), "utf8"));
const wrapperSrc = read("src/lib/shift-close-queries.ts");
const featureSrc = filesUnder(join(process.cwd(), "src/shift-closes"))
  .map((f) => stripComments(readFileSync(f, "utf8")))
  .join("\n");

describe("shift-close boundary (RT-18)", () => {
  test("exactly the two read wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual(["consoleGetShiftClose", "consoleListShiftCloses"]);
  });

  test("the wrappers call the generated shift-close paths with GET only", () => {
    expect(wrapperSrc).toContain('"/api/v1/shift-closes"');
    expect(wrapperSrc).toContain('"/api/v1/shift-closes/{shiftId}"');
    expect(wrapperSrc).not.toMatch(/apiClient\.(POST|PUT|PATCH|DELETE)/);
    expect(featureSrc).not.toMatch(/apiClient\.(POST|PUT|PATCH|DELETE)/);
  });

  test("no hand-rolled fetch, and no Authorization/Bearer header", () => {
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/[Aa]uthorization\s*:/);
      expect(src).not.toMatch(/[Bb]earer\s+/);
    }
  });

  test("no policy field and no approverCheck is consumed or invented", () => {
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(/approverCheck|varianceLimit|variance_limit|variancePolicy|policy/i);
    }
  });

  test("the feature code reads no other family's operations", () => {
    for (const forbidden of [
      "consoleApplyPayment",
      "consoleListReceivables",
      "listAuditEvents",
      "triggerReconciliationRun",
      "updateStore",
      "createStore",
    ]) {
      expect(featureSrc).not.toContain(forbidden);
    }
  });
});
