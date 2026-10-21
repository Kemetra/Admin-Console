import * as queries from "@/lib/catalog-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-765 boundary (RT-752 AC 5, CAT-C1a). The catalog list reads only the two
 * read operations of `console-catalog.yaml` through the generated client: no
 * write (the writes are CAT-C2 slices), no POS route, no ERPNext / Frappe /
 * Connector call, no hand-rolled fetch and no Authorization header (cookie
 * transport). Static source scan, comments stripped.
 */
const wrapperSrc = readSource("src/lib/catalog-queries.ts");
const feature = sourcesUnder("src/catalog");
const all = [wrapperSrc, ...feature.map((f) => f.src)];

describe("console catalog list boundary (RT-765)", () => {
  test("exactly the two read wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual(["consoleListCatalogCategories", "consoleListCatalogProducts"]);
  });

  test("the wrappers call the two catalog read paths with GET only", () => {
    expect(wrapperSrc).toContain('"/api/v1/catalog/products"');
    expect(wrapperSrc).toContain('"/api/v1/catalog/categories"');
    for (const src of all) expect(src).not.toMatch(/apiClient\.(POST|PUT|PATCH|DELETE)/);
  });

  test("the feature reads through the wrappers, never the client directly", () => {
    for (const { file, src } of feature) {
      expect(src, file).not.toContain("@/generated/client");
    }
  });

  test("no POS route, POS credential or ERP system is reached", () => {
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

  test("no catalog write is offered or called (writes are the CAT-C2 slices)", () => {
    for (const src of all) {
      expect(src).not.toMatch(
        /consoleCreateCatalogProduct|consoleUpdateCatalogProduct|consoleRetireCatalogProduct|consoleAddProductIdentifier|consoleRetireProductIdentifier|consoleUpsertStoreOverride|consoleRetireStoreOverride/,
      );
    }
  });
});
