import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { readSource, sourcesUnder } from "./source-scan";

/**
 * RT-421 guard: settlement.yaml 2.0.0 (RT-417) retired cash application, claims,
 * remittance and receivables (RT-413 Option B: ERPNext owns A/R). The Console
 * must hold no screen, route, wrapper, i18n key or generated type for them.
 * Static source scan, comments stripped (the generated file is scanned whole).
 */
const RETIRED_PATH =
  /apply-payment|reconcile-remittance|settlement\/claims|settlement\/receivables/;
const RETIRED_OPERATIONS = [
  "consoleApplyPayment",
  "consoleSubmitClaim",
  "consoleReconcileRemittance",
  "posRecordSettlementIntent",
  "consoleGetReceivable",
  "consoleListReceivables",
];

/** Every file under src/, raw: the ticket's acceptance grep does not strip comments. */
function rawFilesUnder(dir: string): { file: string; raw: string }[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? rawFilesUnder(full)
      : [{ file: full.replaceAll("\\", "/"), raw: readFileSync(full, "utf8") }];
  });
}

const files = sourcesUnder("src");
const nonGenerated = files.filter((f) => !f.file.includes("/src/generated/"));

describe("retired 018/019 settlement surface (RT-421)", () => {
  test("the acceptance grep over src/ finds no retired route", () => {
    const hits = rawFilesUnder(join(process.cwd(), "src"))
      .filter((f) => RETIRED_PATH.test(f.raw))
      .map((f) => f.file);
    expect(hits).toEqual([]);
  });

  test("no retired operation is exported, called or generated", () => {
    for (const op of RETIRED_OPERATIONS) {
      const hits = files.filter((f) => f.src.includes(op)).map((f) => f.file);
      expect(hits, op).toEqual([]);
    }
  });

  test("no per-source pin hold remains: nothing in the config sources, nothing in the generated header", () => {
    const config = readSource("openapi-ts.config.ts");
    const sources = config.slice(
      config.indexOf("OPENAPI_SOURCE_SPECS:"),
      config.indexOf("OPENAPI_SOURCES ="),
    );
    expect(sources).not.toMatch(/\spin:/);
    expect(readFileSync(join(process.cwd(), "src/generated/schema.d.ts"), "utf8")).not.toContain(
      "held @",
    );
  });

  test.each(["src/receivables", "src/settlement-reconciliation", "src/shell/receivableRoutes.tsx"])(
    "%s is gone",
    (path) => {
      expect(existsSync(join(process.cwd(), path))).toBe(false);
    },
  );

  test("no shell route or nav entry points at /receivables", () => {
    for (const path of ["src/App.tsx", "src/shell/AppShell.tsx"]) {
      expect(readSource(path)).not.toMatch(/receivable/i);
    }
    expect(nonGenerated.filter((f) => /["'`]\/receivables/.test(f.src))).toEqual([]);
  });

  test("the i18n catalogs carry no receivable / claim / remittance / apply-payment keys", () => {
    for (const locale of ["en", "ar"]) {
      for (const file of ["money.ts", "overview.ts"]) {
        const raw = readFileSync(
          join(process.cwd(), `src/i18n/messages/${locale}/${file}`),
          "utf8",
        );
        expect(raw, `${locale}/${file}`).not.toMatch(
          /"(receivables|claims?|remittance|applyPayment|settlement-reconciliation)\.|"overview\.receivables\./,
        );
      }
    }
  });
});
