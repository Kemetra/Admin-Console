import * as queries from "@/lib/inventory-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-728 boundary. The inventory views use only the four READ operations of
 * the generated inventory client, through their wrappers. No write
 * (createStockMovement / createStockTransfer / recordStockCount / backfill),
 * no ERPNext call, no hand-rolled fetch, no Authorization header, no free-text
 * product entry. Static scan, comments stripped.
 */
const wrapperSrc = readSource("src/lib/inventory-queries.ts");
const feature = sourcesUnder("src/inventory");
const all = [wrapperSrc, ...feature.map((f) => f.src)];

describe("inventory read boundary (RT-728)", () => {
  test("exactly the four read wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual([
      "getOnHand",
      "listStockLocations",
      "listStoreMovements",
      "listTrackingIdentities",
    ]);
  });

  test("the wrappers only GET the inventory read paths", () => {
    const paths = [...wrapperSrc.matchAll(/apiClient\.(\w+)\("([^"]+)"/g)].map(
      ([, method, path]) => `${method} ${path}`,
    );
    expect(paths.sort()).toEqual([
      "GET /api/inventory/v1/on-hand/{storeId}/{productId}",
      "GET /api/inventory/v1/products/{productId}/tracking-identities",
      "GET /api/inventory/v1/stores/{storeId}/locations",
      "GET /api/inventory/v1/stores/{storeId}/movements",
    ]);
  });

  test("the store ledger is the whole store (scope=all), never by product", () => {
    expect(wrapperSrc).toContain('scope: "all"');
    expect(wrapperSrc).not.toMatch(/productId[^}]*scope|scope[^}]*productId/);
  });

  test("the feature reads through the wrappers and never writes", () => {
    for (const { file, src } of feature) {
      expect(src, file).not.toContain("@/generated/client");
      expect(src, file).not.toMatch(/useMutation|Idempotency-Key/);
      expect(src, file).not.toMatch(/createStockMovement|createStockTransfer|recordStockCount/);
    }
  });

  test("no free-text product entry: the feature renders no input", () => {
    for (const { file, src } of feature) expect(src, file).not.toMatch(/<input|<textarea/);
  });

  test("no ERP system, hand-rolled fetch or Authorization header", () => {
    for (const src of all) {
      expect(src).not.toMatch(/frappe|\/api\/resource|\/api\/method/i);
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/[Aa]uthorization\s*:/);
    }
  });
});
