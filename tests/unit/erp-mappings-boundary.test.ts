import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as queries from "@/lib/erp-mapping-queries";
import { describe, expect, test } from "vitest";

/**
 * RT-725 boundary. The mapping screens consume exactly the seven Backend-Core
 * mapping operations through the generated client: no call to ERPNext, Frappe
 * or the Connector, no hand-rolled fetch, no Authorization header (cookie
 * session only), and no catalog product read (no contract exists yet, so no
 * free-text product id is ever offered). Static source scan; code checks strip
 * comments.
 */
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FEATURE_DIR = join(process.cwd(), "src/erp-mappings");
const featureSrc = withoutComments(
  readdirSync(FEATURE_DIR, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => readFileSync(join(FEATURE_DIR, name), "utf8"))
    .join("\n"),
);
const wrapperSrc = withoutComments(
  readFileSync(join(process.cwd(), "src/lib/erp-mapping-queries.ts"), "utf8"),
);

describe("ERPNext mapping boundary (RT-725)", () => {
  test("exactly the seven mapping wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual([
      "tenantAdminConfirmErpnextItemMapping",
      "tenantAdminListErpnextItemMappings",
      "tenantAdminListErpnextWarehouseMappings",
      "tenantAdminRetireErpnextItemMapping",
      "tenantAdminRetireErpnextWarehouseMapping",
      "tenantAdminSetErpnextWarehouseMapping",
      "tenantAdminSuggestErpnextItemMapping",
    ]);
  });

  test("every path is a Backend-Core catalog mapping path; GET and POST only", () => {
    const paths = [...wrapperSrc.matchAll(/apiClient\.(\w+)\(\s*"([^"]+)"/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(paths).toHaveLength(7);
    for (const [method, path] of paths) {
      expect(["GET", "POST"]).toContain(method);
      expect(path).toMatch(
        /^\/api\/v1\/catalog\/erpnext-(item|warehouse)-mappings(\/\{id\}\/(confirm|retire))?$/,
      );
    }
  });

  test("the feature never calls the client, fetch, ERPNext or the Connector directly", () => {
    expect(featureSrc).not.toMatch(/apiClient\./);
    for (const src of [featureSrc, wrapperSrc]) {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/XMLHttpRequest|axios/);
      expect(src).not.toMatch(/[Aa]uthorization\s*:/);
      expect(src).not.toMatch(/\/api\/resource\/|\/api\/method\/|frappe/i);
      expect(src).not.toContain("/api/connector/");
    }
  });

  test("no catalog product read and no free-text product field", () => {
    expect(featureSrc).not.toMatch(/tenant-products|listTenantProducts|catalog\/products/);
    // The product id sent with a suggestion comes from a mapping row, never an input.
    expect(featureSrc).toContain("tenant_product_id: retired.tenant_product_id");
  });
});
