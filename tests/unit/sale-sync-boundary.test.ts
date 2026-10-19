import * as queries from "@/lib/sale-sync-ops-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-726 boundary (spec 032 §9). The sale sync-ops surfaces use only the four
 * operations of the generated sale sync-ops client, through their wrappers.
 * The repair is the one write: one POST per confirmation, never retried by the
 * client, and no bulk "repair all". No POS route, no ERPNext call, no
 * hand-rolled fetch, no Authorization header. Static scan, comments stripped.
 */
const wrapperSrc = readSource("src/lib/sale-sync-ops-queries.ts");
const feature = sourcesUnder("src/sale-sync");
const all = [wrapperSrc, ...feature.map((f) => f.src)];

describe("sale sync-ops boundary (RT-726)", () => {
  test("exactly the four contract wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual([
      "consoleGetSaleAuditTimeline",
      "consoleGetSaleSyncStatus",
      "consoleListNeedsRepair",
      "consoleRepairSaleSync",
    ]);
  });

  test("the wrappers call only the sale sync-ops paths; the one POST is the repair", () => {
    const paths = [...wrapperSrc.matchAll(/apiClient\.(\w+)\("([^"]+)"/g)].map(
      ([, method, path]) => `${method} ${path}`,
    );
    expect(paths.sort()).toEqual([
      "GET /api/v1/catalog/sale-sync-ops/needs-repair",
      "GET /api/v1/catalog/sale-sync-ops/sales/{saleRef}/audit-timeline",
      "GET /api/v1/catalog/sale-sync-ops/sales/{saleRef}/status",
      "POST /api/v1/catalog/sale-sync-ops/sales/{saleRef}/repair",
    ]);
  });

  test("the feature reads through the wrappers, never the client directly", () => {
    for (const { file, src } of feature) expect(src, file).not.toContain("@/generated/client");
  });

  test("the repair is called from one place and never retried by the client", () => {
    const callers = feature.filter(({ src }) => /consoleRepairSaleSync\(/.test(src));
    expect(callers.map(({ file }) => file.split("/").pop())).toEqual(["useSaleSync.ts"]);
    expect(callers[0].src.match(/consoleRepairSaleSync\(/g)).toHaveLength(1);
    for (const { src } of feature) {
      expect(src).not.toMatch(/useMutation|retry:\s*(true|[1-9])|retryDelay/);
      expect(src).not.toMatch(/repairAll|retryAll|bulkRepair/i);
    }
  });

  test("no POS route, POS credential or ERP system is reached", () => {
    for (const src of all) {
      expect(src).not.toMatch(/\/api\/pos\//);
      expect(src).not.toMatch(/X-Cashier-Admission|operatorAuthorization/i);
      expect(src).not.toMatch(/frappe|\/api\/resource|\/api\/method/i);
    }
  });

  test("no hand-rolled fetch, and no Authorization/Bearer header", () => {
    for (const src of all) {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/[Aa]uthorization\s*:/);
      expect(src).not.toMatch(/[Bb]earer\s+/);
    }
  });
});
