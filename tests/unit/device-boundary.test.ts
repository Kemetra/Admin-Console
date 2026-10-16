import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as queries from "@/lib/device-queries";
import { describe, expect, test } from "vitest";

/**
 * RT-371 boundary. The registry is read-only and consumes exactly the two
 * device reads of the generated client: no revoke (RT-372), no write verb, no
 * hand-rolled fetch, no Authorization header (cookie transport). The revoke
 * note is operator text returned on the detail only: it renders in the History
 * tab and nowhere else. Static source scan, comments stripped.
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
function filesUnder(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const read = (path: string) => stripComments(readFileSync(join(process.cwd(), path), "utf8"));
const wrapperSrc = read("src/lib/device-queries.ts");
const featureFiles = filesUnder(join(process.cwd(), "src/devices")).map((file) => ({
  file: file.replaceAll("\\", "/"),
  src: stripComments(readFileSync(file, "utf8")),
}));
const featureSrc = featureFiles.map((f) => f.src).join("\n");

describe("device registry boundary (RT-371)", () => {
  test("exactly the two read wrappers are exported", () => {
    const functions = Object.entries(queries)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual(["consoleGetDevice", "consoleListDevices"]);
  });

  test("the wrappers call the generated device paths with GET only", () => {
    expect(wrapperSrc).toContain('"/api/v1/devices"');
    expect(wrapperSrc).toContain('"/api/v1/devices/{deviceId}"');
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(/apiClient\.(POST|PUT|PATCH|DELETE)/);
    }
  });

  test("no lifecycle action: revoke / replace / move / retire / pairing are RT-372", () => {
    for (const src of [wrapperSrc, featureSrc]) {
      expect(src).not.toMatch(
        /consoleRevokeDevice|\/revoke"|pairing-code|acknowledgeCustodyException/,
      );
    }
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
