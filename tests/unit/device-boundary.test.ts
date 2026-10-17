import * as queries from "@/lib/device-queries";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-371 / RT-372 boundary. The registry consumes the device operations of the
 * generated client and nothing else: the two reads, the impact preview, the
 * revoke and retire writes and the three pairing-code operations. No DELETE (a
 * device row is never removed), no bulk action, no hand-rolled fetch, no Authorization header (cookie transport). The
 * revoke note is operator text returned on the detail only: it renders in the
 * History tab and nowhere else. Static source scan, comments stripped.
 */
const wrapperSrc = readSource("src/lib/device-queries.ts");
const featureFiles = sourcesUnder("src/devices");
const featureSrc = featureFiles.map((f) => f.src).join("\n");

describe("device registry boundary (RT-371, RT-372)", () => {
  test("the data layer wraps the device reads, the lifecycle writes and the pairing-code operations", () => {
    const wrappers = new Set(
      Object.keys(queries).filter((name) => typeof Reflect.get(queries, name) === "function"),
    );
    expect(wrappers).toEqual(
      new Set([
        "consoleListDevices",
        "consoleGetDevice",
        "consoleGetDeviceImpact",
        "consoleRevokeDevice",
        "consoleRetireDevice",
        "consoleListPairingCodes",
        "consoleIssuePairingCode",
        "consoleCancelPairingCode",
      ]),
    );
  });

  test("the wrappers call the generated device paths; writes are POST on revoke, retire, issue and cancel only", () => {
    for (const path of [
      '"/api/v1/devices"',
      '"/api/v1/devices/{deviceId}"',
      '"/api/v1/devices/{deviceId}/impact"',
      '"/api/v1/devices/{deviceId}/revoke"',
      '"/api/v1/devices/{deviceId}/retire"',
      '"/api/v1/pairing-codes"',
      '"/api/v1/pairing-codes/{pairingCodeId}/cancel"',
    ]) {
      expect(wrapperSrc).toContain(path);
    }
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(/apiClient\.(PUT|PATCH|DELETE)/);
    }
    const posts = [...wrapperSrc.matchAll(/apiClient\.POST\(\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(posts.sort()).toEqual([
      "/api/v1/devices/{deviceId}/retire",
      "/api/v1/devices/{deviceId}/revoke",
      "/api/v1/pairing-codes",
      "/api/v1/pairing-codes/{pairingCodeId}/cancel",
    ]);
  });

  test("the secret pairing code is read in one place only, and its mutation is not cached", () => {
    const readers = featureFiles
      .filter((f) => /issued\??\.code|\.data\??\.code/.test(f.src))
      .map((f) => f.file);
    expect(readers).toHaveLength(1);
    expect(readers[0]).toMatch(/src\/devices\/IssuedCode\.tsx$/);
    expect(readSource("src/devices/useDeviceLifecycle.ts")).toMatch(
      /gcTime: 0,\s+mutationFn: \(body: PairingCodeIssueRequest\)/,
    );
    // never in a query key, the URL, the title or storage
    expect(featureSrc).not.toMatch(/queryKey:[^\]]*\.code/);
    expect(featureSrc).not.toMatch(/location\.(search|hash)\s*=|history\.(push|replace)State/);
  });

  test("no bulk action: nothing sends more than one device id", () => {
    expect(featureSrc).not.toMatch(/bulk|deviceIds|selectAll|select-all/i);
  });

  test("no hand-rolled fetch, and no Authorization/Bearer header", () => {
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/[Aa]uthorization\s*:/);
      expect(src).not.toMatch(/[Bb]earer\s+/);
    }
  });

  test("the revoke note renders only in the History tab", () => {
    const readers = featureFiles.filter((f) => f.src.includes("revokeNote")).map((f) => f.file);
    expect(readers).toHaveLength(1);
    expect(readers[0]).toMatch(/src\/devices\/DeviceHistory\.tsx$/);
  });

  test("the revoke note never reaches a log, the URL, the title or storage", () => {
    expect(featureSrc).not.toMatch(/console\.(log|info|warn|error|debug)/);
    expect(featureSrc).not.toMatch(/document\.title|localStorage|sessionStorage/);
  });

  test("no health verdict is computed or rendered", () => {
    expect(featureSrc).not.toMatch(/healthy|isHealthy|health:|"devices\.health/i);
  });
});
