import * as queries from "@/lib/cash-variance-policy-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-389 boundary (AD-CASH-001 F6). The screens use only the six Console
 * operations of the shift variance policy contract through the generated
 * client: not the POS terminal read, no ERPNext / Frappe call, no hand-rolled
 * fetch and no Authorization header (cookie transport). Inheritance is
 * Backend-Core's (K-9): no module here resolves, merges or compares policies.
 * Static source scan, comments stripped.
 */
const wrapperSrc = readSource("src/lib/cash-variance-policy-queries.ts");
const feature = sourcesUnder("src/cash-policy");
const all = [wrapperSrc, ...feature.map((f) => f.src)];

describe("shift variance policy boundary (RT-389)", () => {
  test("exactly the six Console wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual([
      "consoleGetStoreCashVariancePolicy",
      "consoleGetTenantCashVariancePolicy",
      "consoleListStoreCashVariancePolicyRevisions",
      "consoleListTenantCashVariancePolicyRevisions",
      "consolePublishStoreCashVariancePolicyOverride",
      "consolePublishTenantCashVariancePolicy",
    ]);
  });

  test("the wrappers call the Console paths, reads with GET and publishes with POST", () => {
    for (const path of [
      '"/api/v1/tenants/{tenant_id}/cash-variance-policy"',
      '"/api/v1/tenants/{tenant_id}/cash-variance-policy/revisions"',
      '"/api/v1/stores/{store_id}/cash-variance-policy"',
      '"/api/v1/stores/{store_id}/cash-variance-policy/revisions"',
    ]) {
      expect(wrapperSrc).toContain(path);
    }
    expect(wrapperSrc.match(/apiClient\.POST/g)).toHaveLength(2);
    for (const src of all) expect(src).not.toMatch(/apiClient\.(PUT|PATCH|DELETE)/);
  });

  test("the POS terminal read is not wrapped or called", () => {
    for (const src of all) {
      expect(src).not.toMatch(/posGetCashVariancePolicy|\/api\/pos\//);
      expect(src).not.toMatch(/X-Cashier-Admission|operatorAuthorization|device_token/i);
    }
  });

  test("the feature reads through the wrappers, never the client directly", () => {
    for (const { file, src } of feature) {
      expect(src, file).not.toContain("@/generated/client");
    }
  });

  test("no ERP system is reached and no fetch or Authorization header is built", () => {
    for (const src of all) {
      expect(src).not.toMatch(/frappe|\/api\/resource|\/api\/method/i);
      expect(src).not.toMatch(/ERPNext-Connector|connector-admin|listConnector/i);
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/[Aa]uthorization\s*:/);
      expect(src).not.toMatch(/[Bb]earer\s+/);
    }
  });

  test("no inheritance or stricter-only logic is computed in the UI (K-9)", () => {
    for (const { file, src } of feature) {
      expect(src, file).not.toMatch(
        /isStricter|isLooser|stricterOf|resolvePolicy|mergePolicy|comparePolic|limitAmount\s*[<>]/,
      );
      expect(src, file).not.toMatch(/policySource\s*===/);
    }
  });

  test("the fallback source is never produced (it is the POS's own value)", () => {
    for (const { file, src } of feature) expect(src, file).not.toMatch(/"fallback"/);
  });
});
