import * as queries from "@/lib/ai-entitlements-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-665 boundary (AD-AI-ENT-001 D-2, D-5, D-6). The panel reads the one
 * Console operation of the AI entitlements contract through the generated
 * client: no opt-out write, no grant control, no server-internal `check`, no
 * ERPNext / Frappe call, no hand-rolled fetch and no Authorization header
 * (cookie transport). Entitlement is Backend-Core's: nothing here decides it.
 * Nothing commercial (price, currency, plan name, token cost, spend, credit) is
 * named in the panel's code. Static source scan, comments stripped.
 */
const wrapperSrc = readSource("src/lib/ai-entitlements-queries.ts");
const feature = sourcesUnder("src/ai-entitlements");
const all = [wrapperSrc, ...feature.map((f) => f.src)];

describe("AI entitlements panel boundary (RT-665)", () => {
  test("exactly one wrapper is exported: the read", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);
    expect(functions).toEqual(["consoleGetTenantAiEntitlements"]);
  });

  test("the wrapper calls the Console read path with GET, and nothing writes", () => {
    expect(wrapperSrc).toContain('"/api/v1/tenants/{tenant_id}/ai/entitlements"');
    expect(wrapperSrc.match(/apiClient\.GET/g)).toHaveLength(1);
    for (const src of all) expect(src).not.toMatch(/apiClient\.(POST|PUT|PATCH|DELETE)/);
  });

  test("the owner opt-out write and the internal check are not wrapped or called", () => {
    for (const src of all) {
      expect(src).not.toMatch(/consolePutTenantAiFeatureOptOut|\/opt-outs\b|opt-outs\//);
      expect(src).not.toMatch(/AiFeatureOptOutRequest|expectedOptOutVersion|Idempotency-Key/);
      expect(src).not.toMatch(/AiEntitlementCheck|AiEntitlementDecision|AiEntitlementAllow/);
    }
  });

  test("the feature reads through the wrapper, never the client directly", () => {
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

  test("nothing commercial is named in the panel's code", () => {
    for (const { file, src } of feature) {
      expect(src, file).not.toMatch(
        /price|currency|planName|tokenCost|token_cost|creditBalance|credit_balance|spendCap|spend_cap|free_credit|invoice|billing|formatMoney|<Money/i,
      );
    }
  });

  test("no entitlement or quota is decided in the UI", () => {
    for (const { file, src } of feature) {
      // Availability, reason and figures are the server's; the UI never recomputes them.
      expect(src, file).not.toMatch(
        /limit\s*-\s*used|used\s*\+\s*reserved|remaining\s*[<>]=?\s*[1-9]/,
      );
      expect(src, file).not.toMatch(/Date\.now|new Date\(/);
    }
  });

  test("the tenant page mounts the section and does not read the AI wrapper itself", () => {
    const detail = readSource("src/tenants/TenantDetail.tsx");
    expect(detail).toContain("<TenantAiPlanSection");
    expect(detail).not.toMatch(/ai-entitlements-queries|consoleGetTenantAiEntitlements/);
  });
});
