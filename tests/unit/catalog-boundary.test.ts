import * as queries from "@/lib/catalog-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-765 boundary (RT-752 AC 5, CAT-C1a). The catalog list reads only the two
 * read operations of `console-catalog.yaml` through the generated client. The
 * writes are the CAT-C2 slices; nothing here reaches POS, ERPNext or the
 * Connector, hand-rolls a fetch, or sets an Authorization header (cookie
 * transport). Static source scan, comments stripped.
 */
const wrapperSrc = readSource("src/lib/catalog-queries.ts");
const feature = sourcesUnder("src/catalog");
const surface = [{ file: "src/lib/catalog-queries.ts", src: wrapperSrc }, ...feature];

/** What no file of the catalog surface may contain. */
const FORBIDDEN: readonly [name: string, pattern: RegExp][] = [
  ["a write through the generated client", /apiClient\.(POST|PUT|PATCH|DELETE)/],
  [
    "a catalog write operation",
    /consoleCreateCatalogProduct|consoleUpdateCatalogProduct|consoleRetireCatalogProduct|consoleAddProductIdentifier|consoleRetireProductIdentifier|consoleUpsertStoreOverride|consoleRetireStoreOverride/,
  ],
  ["a POS route", /\/api\/pos\//],
  ["a POS credential", /X-Cashier-Admission|operatorAuthorization/i],
  ["an ERPNext / Frappe call", /frappe|\/api\/resource|\/api\/method/i],
  ["a Connector call", /ERPNext-Connector|connector-admin|listConnector/i],
  ["a hand-rolled fetch", /\bfetch\s*\(/],
  ["an Authorization or Bearer header", /[Aa]uthorization\s*:|[Bb]earer\s+/],
];

describe("console catalog list boundary (RT-765)", () => {
  test("exactly the two read wrappers are exported, on the two read paths", () => {
    const exported = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(exported).toEqual(["consoleListCatalogCategories", "consoleListCatalogProducts"]);
    expect(wrapperSrc).toContain('"/api/v1/catalog/products"');
    expect(wrapperSrc).toContain('"/api/v1/catalog/categories"');
  });

  test("the feature reads through the wrappers, never the client directly", () => {
    const direct = feature.filter(({ src }) => src.includes("@/generated/client"));
    expect(direct.map((f) => f.file)).toEqual([]);
  });

  test.each(FORBIDDEN)("the catalog surface contains no %s", (_name, pattern) => {
    const offenders = surface.filter(({ src }) => pattern.test(src));
    expect(offenders.map((f) => f.file)).toEqual([]);
  });
});
