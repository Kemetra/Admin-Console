import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * RT-371 guard for the TEMPORARY Settlement pin hold in `openapi-ts.config.ts`.
 * Settlement is read at the previous pin because settlement.yaml 2.0.0
 * (Backend-Core #779, RT-417) removes operations that the shipped 018/019
 * wrappers in `src/lib/client.ts` still call. The hold must live exactly as
 * long as those wrappers: when RT-421 removes them, this test fails until the
 * hold is removed too (and the reverse). Static source scan, comments stripped.
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const read = (path: string) => stripComments(readFileSync(join(process.cwd(), path), "utf8"));
const config = read("openapi-ts.config.ts");
const client = read("src/lib/client.ts");
const generated = readFileSync(join(process.cwd(), "src/generated/schema.d.ts"), "utf8");

/** The 018/019 operations settlement.yaml 2.0.0 retired. */
const RETIRED_SETTLEMENT_WRAPPERS = [
  "consoleListReceivables",
  "consoleGetReceivable",
  "consoleSubmitClaim",
  "consoleReconcileRemittance",
  "consoleApplyPayment",
];

const settlementEntry = config.match(/\{\s*name:\s*"Settlement"[\s\S]*?\}/)?.[0] ?? "";
const settlementHeld = /\bpin:\s*"[0-9a-f]{40}"/.test(settlementEntry);
const legacyWrappersPresent = RETIRED_SETTLEMENT_WRAPPERS.some((name) =>
  client.includes(`export async function ${name}(`),
);

describe("Settlement pin hold (RT-371 → removed by RT-421)", () => {
  test("the Settlement source entry is found", () => {
    expect(settlementEntry).toContain("settlement/settlement.yaml");
  });

  test("the hold exists exactly while the retired 018/019 wrappers exist", () => {
    expect(settlementHeld).toBe(legacyWrappersPresent);
  });

  test("Settlement is the only source with its own pin", () => {
    expect(config.match(/\bpin:\s*"[0-9a-f]{40}"/g) ?? []).toHaveLength(settlementHeld ? 1 : 0);
  });

  test("the generated header records the hold, so it is visible in the client", () => {
    const held = /settlement\/settlement\.yaml \(held @ [0-9a-f]{40}\)/.test(generated);
    expect(held).toBe(settlementHeld);
  });
});
