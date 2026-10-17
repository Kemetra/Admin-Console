import * as queries from "@/lib/sale-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-587 boundary (spec 012 FR-001..FR-003, FR-010, AC-15). The sales screens
 * read only the two console sales operations of the generated client: no
 * write, no POS route or POS credential, no ERPNext / Frappe / Connector call,
 * no hand-rolled fetch and no Authorization header (cookie transport). Static
 * source scan, comments stripped.
 */
const wrapperSrc = readSource("src/lib/sale-queries.ts");
const feature = sourcesUnder("src/sales");
const all = [wrapperSrc, ...feature.map((f) => f.src)];

describe("console sales boundary (RT-587)", () => {
  test("exactly the two read wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual(["consoleGetSale", "consoleListSales"]);
  });

  test("the wrappers call the console sales paths with GET only", () => {
    expect(wrapperSrc).toContain('"/api/v1/sales"');
    expect(wrapperSrc).toContain('"/api/v1/sales/{saleRef}"');
    for (const src of all) expect(src).not.toMatch(/apiClient\.(POST|PUT|PATCH|DELETE)/);
  });

  test("the feature reads through the wrappers, never the client directly", () => {
    for (const { file, src } of feature) {
      expect(src, file).not.toContain("@/generated/client");
    }
  });

  test("no POS route, POS credential or ERP system is reached (FR-002, FR-003)", () => {
    for (const src of all) {
      expect(src).not.toMatch(/\/api\/pos\//);
      expect(src).not.toMatch(/X-Cashier-Admission|operatorAuthorization/i);
      expect(src).not.toMatch(/frappe|\/api\/resource|\/api\/method/i);
      expect(src).not.toMatch(/ERPNext-Connector|connector-admin|listConnector/i);
    }
  });

  test("no hand-rolled fetch, and no Authorization/Bearer header", () => {
    for (const src of all) {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/[Aa]uthorization\s*:/);
      expect(src).not.toMatch(/[Bb]earer\s+/);
    }
  });

  test("no write action on a sale is offered or called (FR-010)", () => {
    for (const src of all) {
      expect(src).not.toMatch(/recordSaleReprint|consoleRepairSaleSync|voidSale|recordReturn/);
    }
  });
});
