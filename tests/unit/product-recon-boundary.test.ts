import * as queries from "@/lib/product-reconciliation-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-727 boundary. The surface consumes exactly the five operations of
 * `catalog/product-reconciliation.yaml` through the generated client: no
 * direct 013 item-map write, no call to the Connector or ERPNext, no
 * hand-rolled fetch, no Authorization header (cookie session only), and the
 * feature folder never touches the client itself.
 */
const wrapper = readSource("src/lib/product-reconciliation-queries.ts");
const feature = sourcesUnder("src/product-reconciliation");

describe("product reconciliation boundary (RT-727)", () => {
  test("exactly the five contract wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual([
      "getProductReconciliationRunResults",
      "listProductReconciliationBacklog",
      "listProductReconciliationRuns",
      "repairProductMapping",
      "triggerProductReconciliationRun",
    ]);
  });

  test("the wrappers call only the product-reconciliation paths", () => {
    const paths = [...wrapper.matchAll(/apiClient\.(GET|POST)\(\s*"([^"]+)"/g)].map(
      ([, method, path]) => `${method} ${path}`,
    );
    expect(paths.sort()).toEqual([
      "GET /api/v1/catalog/erpnext-product-reconciliation/backlog",
      "GET /api/v1/catalog/erpnext-product-reconciliation/runs",
      "GET /api/v1/catalog/erpnext-product-reconciliation/runs/{runId}/results",
      "POST /api/v1/catalog/erpnext-product-reconciliation/repairs",
      "POST /api/v1/catalog/erpnext-product-reconciliation/runs",
    ]);
    expect(wrapper).not.toMatch(/apiClient\.(PUT|PATCH|DELETE)/);
  });

  test("the feature never calls the client, fetch, ERPNext or the 013 item-map directly", () => {
    for (const { file, src } of [...feature, { file: "wrapper", src: wrapper }]) {
      expect(src, file).not.toMatch(/\bfetch\(|XMLHttpRequest|Authorization/);
      expect(src, file).not.toMatch(/\/api\/resource|\/api\/method|frappe|erpnext-item-mappings/i);
    }
    for (const { file, src } of feature) {
      expect(src, file).not.toMatch(/apiClient/);
    }
  });

  test("mutations are never retried by the console", () => {
    const hooks = readSource("src/product-reconciliation/useProductReconciliation.ts");
    expect(hooks.match(/useMutation\(/g)).toHaveLength(1);
    expect(hooks).toMatch(/useMutation\(\{\s*retry: false,/);
    expect(hooks.match(/useSingleShot\(/g)).toHaveLength(2);
  });
});
