import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as queries from "@/lib/stock-discrepancy-queries";
import { describe, expect, test } from "vitest";

/**
 * RT-178 boundary. The view consumes EXACTLY three ops of
 * `erpnext-reconciliation/reconciliation.yaml` through the generated client:
 * the two RT-177 reads and the existing `triggerReconciliationRun`. It never
 * reaches the posting backlog/repair, run reads, or the stock `re_sync` /
 * `re_map` repair (non-goals), never calls ERPNext, never sets auth headers,
 * and never float-parses the quantity. Static scan, comments stripped.
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

const wrapperSrc = stripComments(
  readFileSync(join(process.cwd(), "src/lib/stock-discrepancy-queries.ts"), "utf8"),
);
const moduleFiles = filesUnder(join(process.cwd(), "src/stock-discrepancies"));
const moduleSrc = moduleFiles.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");
const allSrc = `${wrapperSrc}\n${moduleSrc}`;

describe("stock discrepancy boundary (RT-178)", () => {
  test("exactly the three wrappers are exported", () => {
    const fns = Object.entries(queries)
      .filter(([, v]) => typeof v === "function")
      .map(([k]) => k)
      .sort();
    expect(fns).toEqual([
      "listErpnextNegativeOnHand",
      "listErpnextNegativeOnHandStores",
      "triggerReconciliationRun",
    ]);
  });

  test("wrappers call the generated paths only", () => {
    const paths = [...wrapperSrc.matchAll(/"(\/api\/v1\/[^"]+)"/g)].map((m) => m[1]).sort();
    expect(paths).toEqual([
      "/api/v1/catalog/erpnext-reconciliation/negative-on-hand/stores",
      "/api/v1/catalog/erpnext-reconciliation/runs",
      "/api/v1/catalog/erpnext-reconciliation/stores/{storeId}/negative-on-hand",
    ]);
    expect(allSrc).not.toMatch(/\bfetch\s*\(/);
  });

  test("no repair / acknowledge / run-read ops and no ERPNext calls", () => {
    for (const forbidden of [
      "/repair",
      "postings/backlog",
      "/results",
      "re_sync",
      "re_map",
      "acknowledge",
      "/api/resource",
      "/api/method",
    ]) {
      expect(allSrc).not.toContain(forbidden);
    }
  });

  test("no auth header and no float parsing of quantities", () => {
    expect(allSrc).not.toMatch(/[Aa]uthorization\s*:/);
    expect(allSrc).not.toMatch(/[Bb]earer\s+/);
    expect(moduleSrc).not.toMatch(/parseFloat|Number\(\s*item|toFixed|toLocaleString/);
  });

  test("AC7: no UI copy calls the snapshot live or current", () => {
    const strings = [...moduleSrc.matchAll(/"([^"\n]*)"|>([^<>{}\n]+)</g)]
      .map((m) => m[1] ?? m[2] ?? "")
      .join("\n");
    expect(strings).not.toMatch(/\blive\b|\bcurrent/i);
  });
});
