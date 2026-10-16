import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as queries from "@/lib/erp-status-queries";
import { describe, expect, test } from "vitest";

/**
 * RT-560 boundary (spec 016 A-7, Phase A only). The surface is read-only and
 * consumes exactly five Backend-Core GETs through the generated client: no
 * credential lifecycle (Phase B, OD-1), no posting repair (Phase C), no machine
 * heartbeat, no call to the Connector or ERPNext, no hand-rolled fetch and no
 * Authorization header (cookie session only). Static source scan; the code
 * checks strip comments, the URL checks read the raw source.
 */
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const FEATURE_DIR = join(process.cwd(), "src/erp-status");
const featureFiles = readdirSync(FEATURE_DIR, { recursive: true, encoding: "utf8" })
  .filter((name) => /\.tsx?$/.test(name))
  .map((name) => join(FEATURE_DIR, name));

const raw = (path: string) => readFileSync(path, "utf8");
const wrapperRaw = raw(join(process.cwd(), "src/lib/erp-status-queries.ts"));
const featureRaw = featureFiles.map(raw).join("\n");
const wrapperSrc = withoutComments(wrapperRaw);
const featureSrc = withoutComments(featureRaw);

describe("ERP status boundary (RT-560)", () => {
  test("exactly the five read wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual([
      "consoleGetSyncOpsSummary",
      "consoleListPostingBacklog",
      "consoleListReconciliationRuns",
      "listConnectorHealth",
      "tenantAdminListConnectorInstances",
    ]);
  });

  test("the wrappers call the five Backend-Core paths with GET only", () => {
    for (const path of [
      '"/api/v1/connector/instances"',
      '"/api/v1/connector/health"',
      '"/api/v1/catalog/erpnext-sync-ops/summary"',
      '"/api/v1/catalog/erpnext-sync-ops/posting-backlog"',
      '"/api/v1/catalog/erpnext-sync-ops/reconciliation-runs"',
    ]) {
      expect(wrapperSrc).toContain(path);
    }
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(/apiClient\.(POST|PUT|PATCH|DELETE)/);
    }
    expect(featureSrc).not.toMatch(/apiClient\./);
  });

  test("no Phase B / Phase C operation and no machine heartbeat", () => {
    for (const forbidden of [
      "tenantAdminRegisterConnectorInstance",
      "tenantAdminIssueConnectorCredential",
      "tenantAdminRotateConnectorCredential",
      "tenantAdminRevokeConnectorCredential",
      "tenantAdminDisableConnectorInstance",
      "connectorReportHeartbeat",
      "/api/connector/",
      "/credentials",
      "/disable",
      "repairPosting",
      "reResolvePosting",
      "consoleRepairSaleSync",
      "triggerReconciliationRun",
    ]) {
      expect(wrapperSrc).not.toContain(forbidden);
      expect(featureSrc).not.toContain(forbidden);
    }
  });

  test("no credential secret, issue/rotate response or credential id is read or shown", () => {
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(/\bsecret\b/);
      expect(src).not.toContain("IssuedCredential");
      expect(src).not.toContain("credential_id");
    }
  });

  test("nothing leaves for the Connector or ERPNext, and no hand-rolled fetch or bearer", () => {
    // Raw source: stripping `//` comments would also cut "https://" out of a string.
    for (const src of [wrapperRaw, featureRaw]) {
      expect(src).not.toMatch(/https?:\/\//);
      expect(src).not.toMatch(/\/api\/method\/|\/api\/resource\//);
    }
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/XMLHttpRequest|axios/);
      expect(src).not.toMatch(/[Aa]uthorization\s*:/);
      expect(src).not.toMatch(/[Bb]earer\s+/);
    }
  });
});
